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
 *   C: Tröskelvärde (°C)    (number, höj budget när temp >= detta värde)
 *   D: Budgethöjning (%)    (number, t.ex. 20 = +20 %)
 *   E: Basbudget (SEK)      (number, "normalnivån" — referens för upp/ner)
 *   F: Maxbudget (SEK)      (number, säkerhetstak — budget får aldrig överstiga detta)
 *   G: Status               ("Aktiv" / annat → hoppas över)
 *   H: Senaste åtgärd       (skrivs av scriptet: "BOOSTAD" / "NORMAL")
 *   I: Senast kört (ISO)    (skrivs av scriptet)
 *   J: Senaste temp (°C)    (skrivs av scriptet)
 */

const CONFIG = {
  SPREADSHEET_URL: 'DIN_GOOGLE_SHEET_URL_HÄR',
  SHEET_NAME: 'Inställningar',
  API_KEY: 'd064b6fcb97e441ef8e5b639f0beb643',
  // Hard cap som extra säkerhet utöver kolumn F. Sätt till 0 för att inaktivera.
  GLOBAL_MAX_BUDGET_SEK: 5000,
  DRY_RUN: false, // true = logga bara, ändra inget i Google Ads
};

const COL = {
  CAMPAIGN: 0,
  CITY: 1,
  THRESHOLD: 2,
  INCREASE_PCT: 3,
  BASE_BUDGET: 4,
  MAX_BUDGET: 5,
  STATUS: 6,
  LAST_ACTION: 7,
  LAST_RUN: 8,
  LAST_TEMP: 9,
};

function main() {
  const sheet = SpreadsheetApp.openByUrl(CONFIG.SPREADSHEET_URL).getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Hittar inte fliken "${CONFIG.SHEET_NAME}"`);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('Inga datarader i sheetet — avbryter.');
    return;
  }

  const campaignIndex = buildCampaignIndex();
  const weatherCache = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const campaignName = String(row[COL.CAMPAIGN] || '').trim();
    const city = String(row[COL.CITY] || '').trim();
    const threshold = Number(row[COL.THRESHOLD]);
    const increasePct = Number(row[COL.INCREASE_PCT]);
    const baseBudget = Number(row[COL.BASE_BUDGET]);
    const maxBudget = Number(row[COL.MAX_BUDGET]);
    const status = String(row[COL.STATUS] || '').trim();

    if (status !== 'Aktiv') {
      Logger.log(`Rad ${i + 1}: hoppar (status="${status}")`);
      continue;
    }
    if (!campaignName || !city) {
      Logger.log(`Rad ${i + 1}: saknar kampanjnamn eller stad — hoppar`);
      continue;
    }
    if (!Number.isFinite(threshold) || !Number.isFinite(increasePct) || !Number.isFinite(baseBudget) || baseBudget <= 0) {
      Logger.log(`Rad ${i + 1}: ogiltiga tal (tröskel/höjning/basbudget) — hoppar`);
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

    const shouldBoost = temp >= threshold;
    const desiredBudget = shouldBoost ? baseBudget * (1 + increasePct / 100) : baseBudget;
    const cappedBudget = applyCaps(desiredBudget, maxBudget);

    const result = setCampaignBudget(campaignIndex, campaignName, cappedBudget);
    const action = shouldBoost ? 'BOOSTAD' : 'NORMAL';

    Logger.log(
      `${campaignName} | ${city} ${temp}°C (tröskel ${threshold}) → ${action} | ` +
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
  return Math.round(capped * 100) / 100;
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
