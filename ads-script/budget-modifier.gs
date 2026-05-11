/**
 * Weather Budget Modifier — Google Ads Script
 *
 * Adjusts campaign daily budgets based on current weather conditions.
 * Bucket rules and campaign links live in a Google Sheet; this script
 * reads them, fetches current weather from Open-Meteo, picks the
 * highest-priority matching bucket per campaign, and updates the
 * daily budget to:
 *
 *     new_budget = base_budget * (1 + modifier_pct / 100)
 *
 * `base_budget` is snapshotted into the Sheet on first run for each
 * campaign — every adjustment is computed from that base, never from
 * the previously-adjusted value (prevents compounding drift).
 *
 * -----------------------------------------------------------------------
 * SETUP (one time)
 * -----------------------------------------------------------------------
 * 1. Create a new, empty Google Sheet. Copy its URL.
 * 2. Paste the URL into SHEET_URL below.
 * 3. In Google Ads → Tools → Bulk actions → Scripts → New script,
 *    paste this entire file. Authorize when prompted (it needs
 *    AdWords access, external URL fetch for the weather API, and
 *    Spreadsheets access for the linked Sheet).
 * 4. From the function dropdown at the top of the script editor,
 *    select `setupSheet` and click Run. This populates the Sheet
 *    with the four required tabs (config / buckets / campaigns / log)
 *    plus example rows.
 * 5. Open the Sheet. Fill in real values:
 *      - `config`     lat / lon for the location whose weather drives budgets
 *      - `buckets`    your rules (delete the examples or edit them)
 *      - `campaigns`  campaign IDs you want to manage + which bucket IDs
 *                     each campaign is eligible for (comma-separated)
 *    Tip: run `listCampaigns` from the function dropdown to print
 *    every campaign in the account with its ID to the script log.
 * 6. Back in the script editor, click **Preview** to see what the
 *    script would do without applying changes. Inspect the log.
 * 7. When happy, click **Run** to apply once. Then schedule daily
 *    runs via Scripts → … → Frequency → Daily.
 * -----------------------------------------------------------------------
 */

const SHEET_URL = 'PASTE_GOOGLE_SHEET_URL_HERE';

const TABS = {
  CONFIG: 'config',
  BUCKETS: 'buckets',
  CAMPAIGNS: 'campaigns',
  LOG: 'log',
};

// Open-Meteo uses WMO weather interpretation codes. We collapse them to
// a small set of labels the operator can use in the `conditions` column.
const WEATHER_CODE_TO_CONDITION = {
  0: 'clear',
  1: 'cloud', 2: 'cloud', 3: 'cloud',
  45: 'fog', 48: 'fog',
  51: 'rain', 53: 'rain', 55: 'rain', 56: 'rain', 57: 'rain',
  61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  80: 'rain', 81: 'rain', 82: 'rain',
  85: 'snow', 86: 'snow',
  95: 'thunder', 96: 'thunder', 99: 'thunder',
};

const VALID_CONDITIONS = ['clear', 'cloud', 'fog', 'rain', 'snow', 'thunder'];

// =====================================================================
// Entry points — pick one from the function dropdown in the script editor.
// =====================================================================

function main() {
  const ss = openSheet();
  const config = readConfig(ss);
  const weather = fetchWeather(config.lat, config.lon);
  Logger.log(
    'Weather: ' + weather.tempC + '°C, ' + weather.condition +
    ' (WMO code ' + weather.code + ')'
  );

  const buckets = readBuckets(ss);
  const links = readCampaignLinks(ss);
  const campaignIndex = buildCampaignIndex(links.map(l => l.campaignId));

  const decisions = [];
  for (const link of links) {
    decisions.push(processCampaign(ss, link, campaignIndex, buckets, weather));
  }

  appendLog(ss, weather, decisions);

  const updated = decisions.filter(d => d.status === 'updated').length;
  const skipped = decisions.filter(d => d.status !== 'updated').length;
  Logger.log('Done. updated=' + updated + ' skipped=' + skipped);
}

function setupSheet() {
  const ss = openSheet();

  ensureTab(ss, TABS.CONFIG, [['key', 'value']], [
    ['lat', 59.3293],
    ['lon', 18.0686],
  ]);

  ensureTab(
    ss,
    TABS.BUCKETS,
    [['id', 'name', 'min_temp_c', 'max_temp_c', 'conditions', 'modifier_pct', 'priority', 'enabled']],
    [
      ['hot_clear', 'Hot & clear',  20, '',  'clear',        25, 10, true],
      ['cold_any',  'Cold weather', '',  5, '',             -20, 20, true],
      ['rainy',     'Rainy day',    '',  '', 'rain,thunder', -10, 15, true],
    ]
  );

  ensureTab(
    ss,
    TABS.CAMPAIGNS,
    [['campaign_id', 'campaign_name', 'bucket_ids', 'base_budget', 'enabled']],
    [
      ['123456789', 'Example campaign', 'hot_clear,cold_any,rainy', '', true],
    ]
  );

  ensureTab(
    ss,
    TABS.LOG,
    [['timestamp', 'temp_c', 'condition', 'campaign_id', 'campaign_name',
      'matched_bucket_id', 'matched_bucket_name', 'base_budget', 'new_budget',
      'status', 'detail']],
    []
  );

  Logger.log('Sheet set up. Now edit `config`, `buckets`, and `campaigns` ' +
             'and run `listCampaigns` to find your campaign IDs.');
}

function listCampaigns() {
  Logger.log('Campaigns in account:');
  const printOne = c => Logger.log(
    '  ' + c.getId() + '\t' + c.getName() +
    '\t(daily budget=' + c.getBudget().getAmount() + ')'
  );
  const iter1 = AdsApp.campaigns().get();
  while (iter1.hasNext()) printOne(iter1.next());

  if (typeof AdsApp.performanceMaxCampaigns === 'function') {
    const iter2 = AdsApp.performanceMaxCampaigns().get();
    while (iter2.hasNext()) printOne(iter2.next());
  }
  if (typeof AdsApp.videoCampaigns === 'function') {
    const iter3 = AdsApp.videoCampaigns().get();
    while (iter3.hasNext()) printOne(iter3.next());
  }
}

// =====================================================================
// Per-campaign decision
// =====================================================================

function processCampaign(ss, link, campaignIndex, buckets, weather) {
  if (!link.enabled) {
    return { link, status: 'skipped', detail: 'disabled in sheet' };
  }
  const campaign = campaignIndex.get(link.campaignId);
  if (!campaign) {
    return { link, status: 'skipped', detail: 'campaign id not found in account' };
  }

  const baseBudget = ensureBaseBudget(ss, link, campaign);

  const matches = buckets
    .filter(b => b.enabled
      && link.bucketIds.indexOf(b.id) !== -1
      && bucketMatches(b, weather))
    .sort((a, b) => b.priority - a.priority);
  const winner = matches[0];

  if (!winner) {
    return { link, status: 'no-match', baseBudget };
  }

  const newBudget = round2(baseBudget * (1 + winner.modifierPct / 100));
  try {
    campaign.getBudget().setAmount(newBudget);
    return { link, status: 'updated', baseBudget, newBudget, winner };
  } catch (e) {
    return { link, status: 'error', baseBudget, newBudget, winner, detail: String(e) };
  }
}

function bucketMatches(bucket, weather) {
  if (bucket.minTempC !== null && weather.tempC < bucket.minTempC) return false;
  if (bucket.maxTempC !== null && weather.tempC > bucket.maxTempC) return false;
  if (bucket.conditions.length > 0 &&
      bucket.conditions.indexOf(weather.condition) === -1) return false;
  return true;
}

function ensureBaseBudget(ss, link, campaign) {
  if (link.baseBudget !== null && link.baseBudget > 0) return link.baseBudget;
  const current = campaign.getBudget().getAmount();
  const sheet = requireSheet(ss, TABS.CAMPAIGNS);
  const header = readHeader(sheet);
  const baseCol = header.indexOf('base_budget') + 1;
  sheet.getRange(link.rowIndex, baseCol).setValue(current);
  link.baseBudget = current;
  return current;
}

// =====================================================================
// Weather
// =====================================================================

function fetchWeather(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + encodeURIComponent(lat)
    + '&longitude=' + encodeURIComponent(lon)
    + '&current=temperature_2m,weather_code';
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('weather api ' + res.getResponseCode() + ': ' +
                    res.getContentText().slice(0, 300));
  }
  const body = JSON.parse(res.getContentText());
  const code = body.current.weather_code;
  return {
    tempC: body.current.temperature_2m,
    code: code,
    condition: WEATHER_CODE_TO_CONDITION[code] || 'unknown',
  };
}

// =====================================================================
// Campaign index — covers Search/Display/Shopping, PMax, and Video.
// =====================================================================

function buildCampaignIndex(ids) {
  const index = new Map();
  if (ids.length === 0) return index;
  const idStrings = ids.map(String);

  const selectors = [AdsApp.campaigns().withIds(idStrings)];
  if (typeof AdsApp.performanceMaxCampaigns === 'function') {
    selectors.push(AdsApp.performanceMaxCampaigns().withIds(idStrings));
  }
  if (typeof AdsApp.videoCampaigns === 'function') {
    selectors.push(AdsApp.videoCampaigns().withIds(idStrings));
  }

  for (const selector of selectors) {
    const iter = selector.get();
    while (iter.hasNext()) {
      const c = iter.next();
      index.set(String(c.getId()), c);
    }
  }
  return index;
}

// =====================================================================
// Sheet reading / writing
// =====================================================================

function openSheet() {
  if (SHEET_URL === 'PASTE_GOOGLE_SHEET_URL_HERE') {
    throw new Error('Set SHEET_URL at the top of the script before running.');
  }
  return SpreadsheetApp.openByUrl(SHEET_URL);
}

function readConfig(ss) {
  const sheet = requireSheet(ss, TABS.CONFIG);
  const rows = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0] || '').trim();
    if (key) map[key] = rows[i][1];
  }
  const lat = Number(map.lat);
  const lon = Number(map.lon);
  if (!isFinite(lat) || !isFinite(lon)) {
    throw new Error('config tab must define numeric lat and lon');
  }
  return { lat: lat, lon: lon };
}

function readBuckets(ss) {
  const sheet = requireSheet(ss, TABS.BUCKETS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return [];
  const header = rows[0].map(h => String(h).trim().toLowerCase());
  const col = name => header.indexOf(name);
  const buckets = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[col('id')] || '').trim();
    if (!id) continue;
    const conditions = parseCsvList(row[col('conditions')]);
    for (const c of conditions) {
      if (VALID_CONDITIONS.indexOf(c) === -1) {
        throw new Error(
          'bucket "' + id + '" has unknown condition "' + c + '". ' +
          'Valid: ' + VALID_CONDITIONS.join(', ')
        );
      }
    }
    buckets.push({
      id: id,
      name: String(row[col('name')] || ''),
      minTempC: parseNumberOrNull(row[col('min_temp_c')]),
      maxTempC: parseNumberOrNull(row[col('max_temp_c')]),
      conditions: conditions,
      modifierPct: Number(row[col('modifier_pct')]) || 0,
      priority: Number(row[col('priority')]) || 0,
      enabled: parseBool(row[col('enabled')]),
    });
  }
  return buckets;
}

function readCampaignLinks(ss) {
  const sheet = requireSheet(ss, TABS.CAMPAIGNS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return [];
  const header = rows[0].map(h => String(h).trim().toLowerCase());
  const col = name => header.indexOf(name);
  const links = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const campaignId = String(row[col('campaign_id')] || '').trim();
    if (!campaignId) continue;
    links.push({
      rowIndex: i + 1,
      campaignId: campaignId,
      campaignName: String(row[col('campaign_name')] || ''),
      bucketIds: parseCsvList(row[col('bucket_ids')]),
      baseBudget: parseNumberOrNull(row[col('base_budget')]),
      enabled: parseBool(row[col('enabled')]),
    });
  }
  return links;
}

function appendLog(ss, weather, decisions) {
  if (decisions.length === 0) return;
  const sheet = requireSheet(ss, TABS.LOG);
  const ts = new Date();
  const rows = decisions.map(d => [
    ts,
    weather.tempC,
    weather.condition,
    d.link.campaignId,
    d.link.campaignName,
    d.winner ? d.winner.id : '',
    d.winner ? d.winner.name : '',
    d.baseBudget != null ? d.baseBudget : '',
    d.newBudget != null ? d.newBudget : '',
    d.status,
    d.detail || '',
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
    .setValues(rows);
}

// =====================================================================
// Helpers
// =====================================================================

function requireSheet(ss, name) {
  const s = ss.getSheetByName(name);
  if (!s) throw new Error('missing required tab: ' + name + ' — run setupSheet first');
  return s;
}

function readHeader(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase());
}

function ensureTab(ss, name, headerRows, dataRows) {
  let sheet = ss.getSheetByName(name);
  if (sheet) {
    Logger.log('tab "' + name + '" already exists — leaving untouched');
    return sheet;
  }
  sheet = ss.insertSheet(name);
  const all = headerRows.concat(dataRows);
  sheet.getRange(1, 1, all.length, all[0].length).setValues(all);
  sheet.getRange(1, 1, 1, headerRows[0].length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function parseNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

function parseCsvList(v) {
  if (!v) return [];
  return String(v).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
