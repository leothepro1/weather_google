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

| A Kampanjnamn  | B Stad         | C Tröskel (°C) | D Höjning (%) | E Basbudget | F Maxbudget | G Status | H Senaste åtgärd | I Senast kört | J Senaste temp |
| -------------- | -------------- | -------------- | ------------- | ----------- | ----------- | -------- | ---------------- | ------------- | -------------- |
| Sommarjackor   | Stockholm,SE   | 15             | 20            | 500         | 1000        | Aktiv    |                  |               |                |
| Paraplyer      | Göteborg,SE    | 10             | 10            | 300         | 600         | Aktiv    |                  |               |                |

- **Stad** följer OpenWeatherMap-formatet `Stad,LANDSKOD`.
- **Basbudget** är "normalnivån" — scriptet återställer alltid hit när tröskeln
  inte är uppfylld, så vi undviker att budgeten driver uppåt mellan körningar.
- **Maxbudget** är ett rad-specifikt tak; `CONFIG.GLOBAL_MAX_BUDGET_SEK` är ett
  globalt tak. Det lägsta vinner.
- Kolumn H–J skrivs av scriptet vid varje körning (verifierbart, ingen ändring
  i Google Ads krävs för att läsa dem).

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
shouldBoost = temp >= threshold
desiredBudget = shouldBoost ? base × (1 + pct/100) : base
applied = min(desiredBudget, rowMax, globalMax)
```

Eftersom vi alltid utgår från basbudgeten — inte den senast satta budgeten —
driver budgeten aldrig uppåt vid upprepade körningar, och faller tillbaka
till `base` automatiskt så fort temperaturen sjunker under tröskeln.

## 5. Säkerhetsspärrar

- Rad-max (kolumn F) **och** globalt tak (`CONFIG.GLOBAL_MAX_BUDGET_SEK`).
- Saknad/felaktig rad hoppas över med loggrad istället för att krascha hela
  körningen.
- Misslyckad väder-fetch loggas och raden hoppas över — ingen budget rörs.
- Identisk budget skrivs inte tillbaka (sparar API-anrop och håller loggen
  läsbar).
