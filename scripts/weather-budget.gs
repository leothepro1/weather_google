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
 *   D: Väderkrav            (text, valfri — t.ex. "Sol". Tom = ingen vädervillkor.
 *                            Giltiga: Sol, Molnigt, Regnigt, Snö, Dimma)
 *   E: Budgetjustering (%)  (number, +20 = höj 20 %, -20 = sänk 20 %, 0 = ingen)
 *   F: Maxbudget (SEK)      (number, säkerhetstak — budget får aldrig överstiga detta)
 *   G: Status               ("Aktiv" / annat → hoppas över)
 *   H: Gäller från          (date, valfri — tom = inget startdatum)
 *   I: Gäller till          (date, valfri — tom = inget slutdatum)
 *   J: Basbudget (SEK)      (number, REQUIRED — "normalnivån", referens som
 *                            scriptet alltid räknar från. Du sätter denna
 *                            själv. Vill du ändra natural-nivån: editera här.)
 *   K: Senaste åtgärd       (skrivs av scriptet: BOOSTAD / SÄNKT / NORMAL)
 *   L: Senast kört (ISO)    (skrivs av scriptet)
 *   M: Senaste temp (°C)    (skrivs av scriptet)
 *   N: Senaste väder        (skrivs av scriptet — OWM main + description)
 *
 * Trigger: temp >= tröskel  AND  väder matchar bucket (om angivet).
 * Båda måste vara uppfyllda — väderkravet vinner alltid över temperaturen.
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
  WEATHER_REQ: 3,
  ADJUST_PCT: 4,
  MAX_BUDGET: 5,
  STATUS: 6,
  DATE_FROM: 7,
  DATE_TO: 8,
  BASE_BUDGET: 9,
  LAST_ACTION: 10,
  LAST_RUN: 11,
  LAST_TEMP: 12,
  LAST_WEATHER: 13,
};

const ACTION_BOOSTED = 'BOOSTAD';
const ACTION_REDUCED = 'SÄNKT';
const ACTION_NORMAL = 'NORMAL';

// Mappning mellan användarvänliga bucket-namn och OpenWeatherMap condition codes.
// Se https://openweathermap.org/weather-conditions för fullständig lista.
const WEATHER_BUCKETS = {
  sol:     (id) => id === 800 || id === 801,           // clear, few clouds
  molnigt: (id) => id >= 802 && id <= 804,             // scattered/broken/overcast
  regnigt: (id) => id >= 200 && id <= 599,             // åska, dugg, regn
  'snö':   (id) => id >= 600 && id <= 699,
  dimma:   (id) => id >= 700 && id <= 799,             // dimma, dis, rök
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
    const weatherReq = String(row[COL.WEATHER_REQ] || '').trim();
    const adjustPct = Number(row[COL.ADJUST_PCT]);
    const maxBudget = Number(row[COL.MAX_BUDGET]);
    const status = String(row[COL.STATUS] || '').trim();
    const dateFrom = parseDate(row[COL.DATE_FROM]);
    const dateTo = parseDate(row[COL.DATE_TO]);
    const baseBudget = Number(row[COL.BASE_BUDGET]);

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
    if (!Number.isFinite(baseBudget) || baseBudget <= 0) {
      Logger.log(`Rad ${i + 1}: ogiltig Basbudget (måste vara > 0) — hoppar`);
      continue;
    }
    if (weatherReq && !getBucketPredicate(weatherReq)) {
      Logger.log(
        `Rad ${i + 1}: okänt väderkrav "${weatherReq}". Giltiga: ${Object.keys(WEATHER_BUCKETS).join(', ')} — hoppar`,
      );
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

    let weather = weatherCache[city];
    if (weather === undefined) {
      weather = fetchWeather(city);
      weatherCache[city] = weather;
    }
    if (weather === null) {
      Logger.log(`Rad ${i + 1}: kunde inte hämta väder för ${city} — hoppar`);
      continue;
    }

    const tempOk = weather.temp >= threshold;
    const weatherOk = !weatherReq || getBucketPredicate(weatherReq)(weather.weatherId);
    const triggered = tempOk && weatherOk;

    const currentBudget = campaign.getBudget().getAmount();

    let target;
    let action;
    if (triggered && adjustPct !== 0) {
      target = baseBudget * (1 + adjustPct / 100);
      action = adjustPct > 0 ? ACTION_BOOSTED : ACTION_REDUCED;
    } else {
      target = baseBudget;
      action = ACTION_NORMAL;
    }
    const cappedTarget = applyCaps(target, maxBudget);

    const changed = Math.abs(currentBudget - cappedTarget) >= 0.01;
    if (changed && !CONFIG.DRY_RUN) {
      campaign.getBudget().setAmount(cappedTarget);
    }

    const trigInfo = `temp ${weather.temp}°C ${tempOk ? '✓' : '✗'} (tröskel ${threshold})` +
      (weatherReq ? `, väder "${weather.main}" ${weatherOk ? '✓' : '✗'} (krav ${weatherReq})` : '');

    Logger.log(
      `${campaignName} | ${city} → ${action} | ${trigInfo} | ` +
        `bas ${baseBudget} → budget ${currentBudget} → ${cappedTarget} SEK${changed ? '' : ' (oförändrad)'}`,
    );

    const weatherLabel = `${weather.main} (${weather.description})`;
    sheet.getRange(i + 1, COL.LAST_ACTION + 1).setValue(action);
    sheet.getRange(i + 1, COL.LAST_RUN + 1).setValue(new Date().toISOString());
    sheet.getRange(i + 1, COL.LAST_TEMP + 1).setValue(weather.temp);
    sheet.getRange(i + 1, COL.LAST_WEATHER + 1).setValue(weatherLabel);
  }
}

function getBucketPredicate(bucketName) {
  const normalized = String(bucketName).trim().toLowerCase();
  return WEATHER_BUCKETS[normalized] || null;
}

function fetchWeather(city) {
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
    const w = data && Array.isArray(data.weather) && data.weather[0];
    if (!Number.isFinite(temp) || !w || !Number.isFinite(Number(w.id))) {
      Logger.log(`Oväntat väder-svar för ${city}: ${response.getContentText()}`);
      return null;
    }
    return {
      temp,
      weatherId: Number(w.id),
      main: String(w.main || ''),
      description: String(w.description || ''),
    };
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
