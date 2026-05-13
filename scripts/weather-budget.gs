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
 *   D: Budgetjustering (%)  (number, +20 = höj 20 %, -20 = sänk 20 %)
 *   E: Basbudget (SEK)      (number, "normalnivån" — referens för upp/ner)
 *   F: Maxbudget (SEK)      (number, säkerhetstak — budget får aldrig överstiga detta)
 *   G: Status               ("Aktiv" / annat → hoppas över)
 *   H: Gäller från          (date, valfri — tom = inget startdatum)
 *   I: Gäller till          (date, valfri — tom = inget slutdatum)
 *   J: Senaste åtgärd       (skrivs av scriptet: BOOSTAD / SÄNKT / NORMAL)
 *   K: Senast kört (ISO)    (skrivs av scriptet)
 *   L: Senaste temp (°C)    (skrivs av scriptet)
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
  BASE_BUDGET: 4,
  MAX_BUDGET: 5,
  STATUS: 6,
  DATE_FROM: 7,
  DATE_TO: 8,
  LAST_ACTION: 9,
  LAST_RUN: 10,
  LAST_TEMP: 11,
};

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
    const baseBudget = Number(row[COL.BASE_BUDGET]);
    const maxBudget = Number(row[COL.MAX_BUDGET]);
    const status = String(row[COL.STATUS] || '').trim();
    const dateFrom = parseDate(row[COL.DATE_FROM]);
    const dateTo = parseDate(row[COL.DATE_TO]);

    if (status !== 'Aktiv') {
      Logger.log(`Rad ${i + 1}: hoppar (status="${status}")`);
      continue;
    }
    if (!campaignName || !city) {
      Logger.log(`Rad ${i + 1}: saknar kampanjnamn eller stad — hoppar`);
      continue;
    }
    if (!Number.isFinite(threshold) || !Number.isFinite(adjustPct) || !Number.isFinite(baseBudget) || baseBudget <= 0) {
      Logger.log(`Rad ${i + 1}: ogiltiga tal (tröskel/justering/basbudget) — hoppar`);
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

    let temp = weatherCache[city];
    if (temp === undefined) {
      temp = fetchTemperature(city);
      weatherCache[city] = temp;
    }
    if (temp === null) {
      Logger.log(`Rad ${i + 1}: kunde inte hämta väder för ${city} — hoppar`);
      continue;
    }

    const triggered = temp >= threshold;
    const desiredBudget = triggered ? baseBudget * (1 + adjustPct / 100) : baseBudget;
    const cappedBudget = applyCaps(desiredBudget, maxBudget);

    let action;
    if (!triggered || adjustPct === 0) action = 'NORMAL';
    else if (adjustPct > 0) action = 'BOOSTAD';
    else action = 'SÄNKT';

    const result = setCampaignBudget(campaignIndex, campaignName, cappedBudget);

    Logger.log(
      `${campaignName} | ${city} ${temp}°C (tröskel ${threshold}, justering ${adjustPct}%) → ${action} | ` +
        `budget ${result.previous} → ${result.applied} SEK${result.changed ? '' : ' (oförändrad)'}`,
    );

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
  const iterator = AdsApp.campaigns().get();
  while (iterator.hasNext()) {
    const c = iterator.next();
    index[c.getName()] = c;
  }
  return index;
}

function setCampaignBudget(campaignIndex, campaignName, newAmount) {
  const campaign = campaignIndex[campaignName];
  if (!campaign) {
    Logger.log(`Hittade ingen kampanj med namn "${campaignName}"`);
    return { previous: null, applied: null, changed: false };
  }

  const budget = campaign.getBudget();
  const previous = budget.getAmount();

  if (Math.abs(previous - newAmount) < 0.01) {
    return { previous, applied: previous, changed: false };
  }

  if (!CONFIG.DRY_RUN) {
    budget.setAmount(newAmount);
  }
  return { previous, applied: newAmount, changed: true };
}
