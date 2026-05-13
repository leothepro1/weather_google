# Weather Budget Script

Fristående Google Ads-skript som höjer/återställer kampanjbudget utifrån
aktuell temperatur i en angiven stad. Allt styrs från ett Google Sheet — ingen
backend eller deploy behövs.

## 1. Förbered Google Sheet

**Snabbstart:** Importera den färdiga mallen [`installningar.csv`](./installningar.csv):

1. Gå till <https://sheets.new> → **Arkiv → Importera → Ladda upp**.
2. Välj `installningar.csv`, importtyp **Ersätt aktuellt ark**, avgränsare **Komma**.
3. Döp om fliken (nedtill) från `installningar` till `Inställningar` så att den
   matchar `CONFIG.SHEET_NAME` i scriptet.
4. Justera/ta bort exempelraderna efter dina kampanjer. Notera att kampanjnamnet
   i kolumn A måste matcha **exakt** mot kampanjen i Google Ads.

Manuellt alternativ — skapa ett ark med fliken `Inställningar` och följande
kolumner (rad 1 = rubrik):

| Kol | Rubrik              | Typ     | Innebörd                                                                |
| --- | ------------------- | ------- | ----------------------------------------------------------------------- |
| A   | Kampanjnamn         | text    | Måste matcha **exakt** mot kampanjen i Google Ads                       |
| B   | Stad                | text    | OpenWeatherMap-format, t.ex. `Stockholm,SE`                             |
| C   | Tröskelvärde (°C)   | number  | Temperaturvillkor: utlöses när `temp >= tröskel`                        |
| D   | Väderkrav           | text    | Valfri vädervillkor (bucket). Tom = bara temperaturen avgör.            |
| E   | Budgetjustering (%) | number  | `20` = höj 20 %, `-20` = sänk 20 %, `0` = ingen ändring                 |
| F   | Maxbudget (SEK)     | number  | Rad-specifikt säkerhetstak (lägsta av detta och globalt tak vinner)     |
| G   | Status              | text    | `Aktiv` = kör, allt annat = hoppa över                                  |
| H   | Gäller från         | date    | Valfri. Tom = inget startdatum. Före datum → raden hoppas över          |
| I   | Gäller till         | date    | Valfri. Tom = inget slutdatum. Efter datum → raden hoppas över          |
| J   | Naturlig budget     | (auto)  | Scriptets snapshot av din normalbudget. Editera för att överskrida      |
| K   | Senaste åtgärd      | (auto)  | `BOOSTAD` / `SÄNKT` / `NORMAL`                                          |
| L   | Senast kört         | (auto)  | ISO-tid                                                                 |
| M   | Senaste temp (°C)   | (auto)  | Senast hämtad temperatur                                                |
| N   | Senaste väder       | (auto)  | T.ex. `Clouds (broken clouds)` — vad OWM rapporterade                   |

- **Trigger-villkoret är AND** mellan temp och väder. Om båda anges måste båda
  uppfyllas. Tomt `Väderkrav` = bara temperaturen räknas (bakåtkompatibelt).
- **Väder-buckets (kolumn D):**

  | Bucket     | Matchar (OpenWeatherMap)                       |
  | ---------- | ---------------------------------------------- |
  | `Sol`      | Klart väder, lätt molnighet (id 800, 801)      |
  | `Molnigt`  | Spridda → heltäckta moln (id 802–804)          |
  | `Regnigt`  | Regn, dugg, åska (id 200–599)                  |
  | `Snö`      | All snö (id 600–699)                           |
  | `Dimma`    | Dimma, dis, rök (id 700–799)                   |

  Case-insensitive — `sol` = `Sol` = `SOL`. Felstavning loggas och raden
  hoppas över.
- **Positiv justering = höjning, negativ = sänkning.** Inget prefix krävs.
- **Datumkolumnerna** låter samma kampanj ha olika regler per säsong.
- **Naturlig budget** sköts av scriptet — se sektion 4.

## 2. Hämta API-nyckel

Registrera ett gratis-konto på <https://openweathermap.org/api> och kopiera din
API-nyckel.

## 3. Installera i Google Ads

1. Google Ads → **Verktyg & inställningar → Massändringar → Skript → +**
2. Klistra in innehållet i [`weather-budget.gs`](./weather-budget.gs).
3. Fyll i `CONFIG.SPREADSHEET_URL` och `CONFIG.API_KEY`.
4. Sätt `CONFIG.DRY_RUN = true` första gången — kör en gång och granska loggen.
5. När det ser rätt ut: `DRY_RUN = false`, **Auktorisera**, schemalägg
   (t.ex. en gång per timme).

## 4. Återställningslogiken

Den faktiska Google Ads-budgeten är källan till sanning. Scriptet "äger" bara
budgeten medan triggern är aktiv:

| Tillstånd                                     | Vad scriptet gör                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| Trigger AV (`temp < tröskel`), tidigare NORMAL | Rör inte budgeten. Skriver `naturlig = nuvarande Google Ads-budget` i sheetet. |
| Trigger PÅ från NORMAL                         | Sparar nuvarande budget i `Naturlig budget`, sätter ny = `naturlig × (1 + pct/100)`, kapar mot max. |
| Trigger PÅ, redan boostad/sänkt                | Räknar om från sparad `Naturlig budget` (om du t.ex. har ändrat `pct` i sheetet). |
| Trigger AV efter att ha varit PÅ               | Återställer till sparad `Naturlig budget`.                                     |

Praktiskt innebär det att du under stilla väder kan ändra budgeten fritt i
Google Ads — scriptet fångar nya värdet vid nästa körning. När triggern
sedan aktiveras blir den nya budgeten baseline för procentjusteringen.

Vill du tvinga in ett nytt baseline-värde mitt under en aktiv trigger:
editera kolumn I (`Naturlig budget`) manuellt i sheetet.

`adjustPct` får vara negativ. Exempel:

- **Sommarjackor**, tröskel `15`, justering `20`: när det är ≥ 15 °C → höj 20 %.
- **Vinterjackor**, tröskel `5`, justering `-50`: när det är ≥ 5 °C → sänk 50 %.
  (Under 5 °C → tillbaka till naturlig budget = full effekt i kallt väder.)

## 5. Säkerhetsspärrar

- Rad-max (kolumn F) **och** globalt tak (`CONFIG.GLOBAL_MAX_BUDGET_SEK`).
- Saknad/felaktig rad hoppas över med loggrad istället för att krascha hela
  körningen.
- Misslyckad väder-fetch loggas och raden hoppas över — ingen budget rörs.
- Identisk budget skrivs inte tillbaka (sparar API-anrop och håller loggen
  läsbar).
