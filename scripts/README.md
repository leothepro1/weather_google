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
| C   | Tröskelvärde (°C)   | number  | Justeringen aktiveras när `temp >= tröskel`                             |
| D   | Budgetjustering (%) | number  | `+20` = höj 20 %, `-20` = sänk 20 %, `0` = ingen ändring                |
| E   | Basbudget (SEK)     | number  | "Normalnivå" — referens som scriptet alltid räknar från                 |
| F   | Maxbudget (SEK)     | number  | Rad-specifikt säkerhetstak (lägsta av detta och globalt tak vinner)     |
| G   | Status              | text    | `Aktiv` = kör, allt annat = hoppa över                                  |
| H   | Gäller från         | date    | Valfri. Tom = inget startdatum. Före datum → raden hoppas över          |
| I   | Gäller till         | date    | Valfri. Tom = inget slutdatum. Efter datum → raden hoppas över          |
| J   | Senaste åtgärd      | (auto)  | Skrivs av scriptet: `BOOSTAD` / `SÄNKT` / `NORMAL`                      |
| K   | Senast kört         | (auto)  | Skrivs av scriptet (ISO-tid)                                            |
| L   | Senaste temp (°C)   | (auto)  | Skrivs av scriptet                                                      |

- **Basbudget** är "normalnivån" — scriptet återställer alltid hit när tröskeln
  inte är uppfylld, så vi undviker att budgeten driver uppåt mellan körningar.
- **Datumkolumnerna** låter samma kampanj ha olika regler per säsong: skapa en
  rad för "Vinterjackor" som gäller nov–mar och en annan rad för samma kampanj
  som gäller apr–okt med andra trösklar. Tomma datum = gäller alltid.
- Kolumn J–L skrivs av scriptet vid varje körning — rör inte dem manuellt.

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

## 4. Återställningslogiken (det som saknades i utkastet)

Varje körning räknar scriptet om budgeten från **basbudgeten i Sheetet**:

```
triggered     = temp >= threshold
desiredBudget = triggered ? base × (1 + adjustPct/100) : base
applied       = clamp(desiredBudget, 0.01, min(rowMax, globalMax))
```

Eftersom vi alltid utgår från basbudgeten — inte den senast satta budgeten —
driver budgeten aldrig uppåt vid upprepade körningar, och faller tillbaka
till `base` automatiskt så fort temperaturen sjunker under tröskeln.

`adjustPct` får vara negativ. Exempel:

- **Sommarjackor**, tröskel `15`, justering `+20`: när det är ≥ 15 °C → höj 20 %.
- **Vinterjackor**, tröskel `5`, justering `-50`: när det är ≥ 5 °C → sänk 50 %.
  (Under 5 °C → tillbaka till basbudgeten = full effekt i kallt väder.)

## 5. Säkerhetsspärrar

- Rad-max (kolumn F) **och** globalt tak (`CONFIG.GLOBAL_MAX_BUDGET_SEK`).
- Saknad/felaktig rad hoppas över med loggrad istället för att krascha hela
  körningen.
- Misslyckad väder-fetch loggas och raden hoppas över — ingen budget rörs.
- Identisk budget skrivs inte tillbaka (sparar API-anrop och håller loggen
  läsbar).
