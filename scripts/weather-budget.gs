/**
 * Weather-driven Google Ads budget modifier.
 *
 * Klistras in i Google Ads under: Verktyg & inställningar → Massändringar → Skript.
 * Schemalägg t.ex. en gång per timme.
 *
 * Sheet-struktur (flik: "Inställningar"), rad 1 = rubrik:
 *
 *   A: Kampanjnamn          (string, måste matcha exakt i Google Ads)
 *   B: Stad                 (string, t.ex. "Stockholm,SE")
 *   C: Tröskelvärde (°C)    (number, justera budget när temp >= detta värde)
 *   D: Budgetjustering (%)  (number, +20 = höj 20 %, -20 = sänk 20 %, 0 = ingen)
 *   E: Maxbudget (SEK)      (number, säkerhetstak — budget får aldrig överstiga detta)
 *   F: Status               ("Aktiv" / annat → hoppas över)
 *   G: Gäller från          (date, valfri — tom = inget startdatum)
 *   H: Gäller till          (date, valfri — tom = inget slutdatum)
 *   I: Naturlig budget      (auto — scriptet sparar din normalbudget här när
 *                            triggern aktiveras, så att den kan återställas
 *                            när triggern upphör. Editera manuellt för att
 *                            överskrida; töm för att låta scriptet om-fånga.)
 *   J: Senaste åtgärd       (skrivs av scriptet: BOOSTAD / SÄNKT / NORMAL)
 *   K: Senast kört (ISO)    (skrivs av scriptet)
 *   L: Senaste temp (°C)    (skrivs av scriptet)
 *
 * Beteende:
 *   - Trigger AV (temp < tröskel): scriptet rör inte budgeten. Du kan ändra
 *     den fritt i Google Ads, scriptet fångar nya värdet vid nästa körning.
 *   - Trigger PÅ (temp >= tröskel): scriptet sparar nuvarande budget som
 *     "Naturlig budget" och sätter ny = naturlig × (1 + justering/100), med
 *     tak från Maxbudget och CONFIG.GLOBAL_MAX_BUDGET_SEK.
 *   - Trigger upphör: scriptet återställer till sparad "Naturlig budget".
 */

const CONFIG = {
  SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1VsYi4Vi11CH3rczmOR0xStC2fFnHVuHdNBwBODGZF6M/edit?gid=0#gid=0',
  SHEET_NAME: 'Inställningar',
  API_KEY: 'd064b6fcb97e441ef8e5b639f0beb643',
  GLOBAL_MAX_BUDGET_SEK: 5000,
  DRY_RUN: false, // true = logga bara, ändra inget i Google Ads
};

const COL = {
  CAMPAIGN: 0,
  CITY: 1,
  THRESHOLD: 2,
  ADJUST_PCT: 3,
  MAX_BUDGET: 4,
  STATUS: 5,
  DATE_FROM: 6,
  DATE_TO: 7,
  NATURAL_BUDGET: 8,
  LAST_ACTION: 9,
  LAST_RUN: 10,
  LAST_TEMP: 11,
};

const ACTION_BOOSTED = 'BOOSTAD';
const ACTION_REDUCED = 'SÄNKT';
const ACTION_NORMAL = 'NORMAL';

function main() {
  const sheet = SpreadsheetApp.openByUrl(CONFIG.SPREADSHEET_URL).getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Hittar inte fliken "${CONFIG.SHEET_NAME}"`);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('Inga datarader i sheetet — avbryter.');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const campaignIndex = buildCampaignIndex();
  const weatherCache = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const campaignName = String(row[COL.CAMPAIGN] || '').trim();
    const city = String(row[COL.CITY] || '').trim();
    const threshold = Number(row[COL.THRESHOLD]);
    const adjustPct = Number(row[COL.ADJUST_PCT]);
    const maxBudget = Number(row[COL.MAX_BUDGET]);
    const status = String(row[COL.STATUS] || '').trim();
    const dateFrom = parseDate(row[COL.DATE_FROM]);
    const dateTo = parseDate(row[COL.DATE_TO]);
    const naturalSaved = Number(row[COL.NATURAL_BUDGET]);
    const lastAction = String(row[COL.LAST_ACTION] || '').trim();

    if (status !== 'Aktiv') {
      Logger.log(`Rad ${i + 1}: hoppar (status="${status}")`);
      continue;
    }
    if (!campaignName || !city) {
      Logger.log(`Rad ${i + 1}: saknar kampanjnamn eller stad — hoppar`);
      continue;
    }
    if (!Number.isFinite(threshold) || !Number.isFinite(adjustPct)) {
      Logger.log(`Rad ${i + 1}: ogiltiga tal (tröskel/justering) — hoppar`);
      continue;
    }
    if (dateFrom && today < dateFrom) {
      Logger.log(`Rad ${i + 1}: före perioden (gäller från ${formatDate(dateFrom)}) — hoppar`);
      continue;
    }
    if (dateTo && today > dateTo) {
      Logger.log(`Rad ${i + 1}: efter perioden (gällde till ${formatDate(dateTo)}) — hoppar`);
      continue;
    }

    const campaign = campaignIndex[campaignName];
    if (!campaign) {
      logCampaignMiss(campaignIndex, campaignName);
      continue;
    }

    let temp = weatherCache[city];
    if (temp === undefined) {
      temp = fetchTemperature(city);
      weatherCache[city] = temp;
    }
    if (temp === null) {
      Logger.log(`Rad ${i + 1}: kunde inte hämta väder för ${city} — hoppar`);
      continue;
    }

    const currentBudget = campaign.getBudget().getAmount();
    const wasModified = lastAction === ACTION_BOOSTED || lastAction === ACTION_REDUCED;

    // Den faktiska Google Ads-budgeten är källan till sanning så länge
    // scriptet inte har modifierat den — då litar vi på den sparade.
    const naturalBudget =
      wasModified && Number.isFinite(naturalSaved) && naturalSaved > 0
        ? naturalSaved
        : currentBudget;

    const triggered = temp >= threshold;
    let target;
    let action;
    if (triggered && adjustPct !== 0) {
      target = naturalBudget * (1 + adjustPct / 100);
      action = adjustPct > 0 ? ACTION_BOOSTED : ACTION_REDUCED;
    } else {
      target = naturalBudget;
      action = ACTION_NORMAL;
    }
    const cappedTarget = applyCaps(target, maxBudget);

    const changed = Math.abs(currentBudget - cappedTarget) >= 0.01;
    if (changed && !CONFIG.DRY_RUN) {
      campaign.getBudget().setAmount(cappedTarget);
    }

    Logger.log(
      `${campaignName} | ${city} ${temp}°C (tröskel ${threshold}, justering ${adjustPct}%) → ${action} | ` +
        `naturlig ${naturalBudget} → budget ${currentBudget} → ${cappedTarget} SEK${changed ? '' : ' (oförändrad)'}`,
    );

    sheet.getRange(i + 1, COL.NATURAL_BUDGET + 1).setValue(naturalBudget);
    sheet.getRange(i + 1, COL.LAST_ACTION + 1).setValue(action);
    sheet.getRange(i + 1, COL.LAST_RUN + 1).setValue(new Date().toISOString());
    sheet.getRange(i + 1, COL.LAST_TEMP + 1).setValue(temp);
  }
}

function fetchTemperature(city) {
  const url =
    'https://api.openweathermap.org/data/2.5/weather' +
    `?q=${encodeURIComponent(city)}&appid=${CONFIG.API_KEY}&units=metric`;

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = response.getResponseCode();
    if (code !== 200) {
      Logger.log(`OpenWeatherMap svarade ${code} för ${city}: ${response.getContentText()}`);
      return null;
    }
    const data = JSON.parse(response.getContentText());
    const temp = Number(data && data.main && data.main.temp);
    return Number.isFinite(temp) ? temp : null;
  } catch (e) {
    Logger.log(`Väder-fetch misslyckades för ${city}: ${e}`);
    return null;
  }
}

function applyCaps(desired, rowMax) {
  let capped = desired;
  if (Number.isFinite(rowMax) && rowMax > 0) capped = Math.min(capped, rowMax);
  if (CONFIG.GLOBAL_MAX_BUDGET_SEK > 0) capped = Math.min(capped, CONFIG.GLOBAL_MAX_BUDGET_SEK);
  capped = Math.max(capped, 0.01); // Google Ads kräver positiv budget
  return Math.round(capped * 100) / 100;
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  let d;
  if (value instanceof Date) {
    d = new Date(value.getTime());
  } else {
    d = new Date(String(value).trim());
  }
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildCampaignIndex() {
  const index = {};
  const selectors = [
    AdsApp.campaigns(),
    AdsApp.shoppingCampaigns(),
    AdsApp.videoCampaigns(),
    AdsApp.performanceMaxCampaigns(),
  ];
  for (const selector of selectors) {
    try {
      const iterator = selector.get();
      while (iterator.hasNext()) {
        const c = iterator.next();
        index[c.getName()] = c;
      }
    } catch (e) {
      // Vissa konton har inte tillgång till alla kampanjtyper — hoppa över tyst.
    }
  }
  return index;
}

function logCampaignMiss(campaignIndex, campaignName) {
  const available = Object.keys(campaignIndex);
  const hint =
    available.length === 0
      ? 'inga kampanjer hittades i kontot — fel konto valt?'
      : `${available.length} kampanjer i kontot; första: "${available.slice(0, 5).join('", "')}"`;
  Logger.log(`Hittade ingen kampanj med namn "${campaignName}" (längd ${campaignName.length}). ${hint}`);
}

/**
 * Diagnostik-funktion: kör denna separat från scripteditorn för att se
 * exakt vilka kampanjnamn Google Ads Scripts hittar. Loggen visar varje
 * namn omgivet av citationstecken så att osynliga tecken (mellanslag,
 * en-dash vs hyphen, etc.) blir synliga.
 */
function listCampaigns() {
  const index = buildCampaignIndex();
  const names = Object.keys(index).sort();
  Logger.log(`Hittade ${names.length} kampanjer:`);
  for (const name of names) {
    Logger.log(`  "${name}" (längd ${name.length})`);
  }
}
