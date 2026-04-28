# Excel Import Guide - Freestyle WM

## ✅ Aktualisiert: Excel statt CSV

Das System wurde angepasst:
- **Excel Import** (.xlsx, .xls) nur für **Athletes** und **RoomList**
- **UI-Verwaltung** für Zimmertypen, Hotels und Events

## 📊 Excel-Dateistruktur

Ihre Excel-Datei muss zwei Sheets enthalten:

### 1. Sheet: "athlets"

**Erforderliche Spalten:**
- `Function` - Athlete, NSA Coach, NSA Team Doctor, etc.
- `Competitorid/Staff ID` - Eindeutige ID
- `Accredid` - Akkreditierungs-ID
- `Fiscode` - FIS Code
- `Lastname` - Nachname
- `Firstname` - Vorname
- `Nationcode` - Ländercode (z.B. AUT, GER, USA)
- `For_gender` - Wettkampf-Geschlecht (M/W)
- `Gender` - Geschlecht
- `Phone` - Telefonnummer
- `Email` - E-Mail Adresse
- `WC_SBX_W_6061` - YES/NO
- `WC_SBX_M_6060` - YES/NO
- `Arrival_date` - Format: DD.MM.YYYY
- `Arrival_time` - Uhrzeit
- `Arrival_by` - Auto, Flugzeug, etc.
- `Arrival_airport` - Flughafen Code
- `Arrival_flightno` - Flugnummer
- `Arrival_need_transportation` - YES/NO
- `Departure_date` - Format: DD.MM.YYYY
- `Departure_time` - Uhrzeit
- `Departure_by` - Auto, Flugzeug, etc.
- `Departure_airport` - Flughafen Code
- `Departure_flightno` - Flugnummer
- `Departure_need_transportation` - YES/NO
- `Room_type` - Single, Double shared, etc.
- `Shared_with_name` - Name des Zimmerpartners
- `Late_checkout` - YES/NO
- `First_meal` - Dinner, Lunch, etc.
- `Last_meal` - Breakfast, Lunch, etc.
- `Special_meal` - Vegetarisch, Glutenfrei, etc.
- `Stance` - R/L (für Snowboard)
- `tv_picture_status` - Status
- `tv_picture_date` - Datum

### 2. Sheet: "roomlist"

**Erforderliche Spalten:**
- `Lastname` - Nachname (muss mit "athlets" übereinstimmen)
- `Firstname` - Vorname (muss mit "athlets" übereinstimmen)
- `Nationcode` - Ländercode (muss mit "athlets" übereinstimmen)
- `Room_type` - "Single", "Double shared", "Appartment"
- `Shared with Name` - Format: "Nachname, Vorname"
- `Shared with Nationcode` - Ländercode des Zimmerpartners
- `Arrival_date` - Format: DD.MM.YYYY
- `Departure_date` - Format: DD.MM.YYYY

## 🔧 Vor dem Import

### 1. Zimmertypen anlegen
Navigieren Sie zu **Zimmertypen** und erstellen Sie:

```
Name              Max Personen
DZ / DU           2
EZ / DU           1
APP: 2 DZ + DU    2
APP: 2 DZ + 2 DU  4
3BZ / DU          2
4BZ / DU          2
```

### 2. Hotels anlegen
Navigieren Sie zu **Hotels** und erstellen Sie Hotels mit:
- Name
- Ort
- Region

### 3. Hotel-Inventories hinzufügen
Für jedes Hotel:
- Zimmertyp wählen
- Verfügbar Von/Bis Datum
- Anzahl Zimmer
- Halbpension (HP): Ja/Nein
- SR: Ja/Nein

### 4. Events erstellen
Navigieren Sie zu **Events** und erstellen Sie:
- Disziplin (Big Air, Moguls, etc.)
- Start Datum
- End Datum

### 5. Event Room Demands hinzufügen
Für jedes Event:
- Zimmertyp wählen
- Anzahl benötigte Zimmer

## 📥 Import durchführen

1. Navigieren Sie zu **Import** (`/import`)
2. Laden Sie Ihre Excel-Datei hoch
3. Klicken Sie auf "Importieren"
4. Warten Sie auf Bestätigung
5. Die Seite lädt sich automatisch neu

## ⚠️ Wichtige Hinweise

- **Nur Athletes und RoomList** werden aus Excel importiert
- Der Import **überschreibt** bestehende Athleten und Zimmerzuteilungen
- Zimmertypen, Hotels und Events müssen **vor dem Import** im UI angelegt sein
- Die Namen in "roomlist" müssen **exakt** mit "athlets" übereinstimmen

## 🎯 Nach dem Import

1. Überprüfen Sie unter **Athleten**, ob alle importiert wurden
2. Prüfen Sie unter **Zuweisungen**, ob die Zimmerzuteilungen korrekt sind
3. Gehen Sie zu **Analysen**, um Verfügbarkeit vs. Bedarf zu sehen

## 🔍 Troubleshooting

**Problem: "Athlete not found"**
- Lösung: Stellen Sie sicher, dass Name und Nationcode in beiden Sheets identisch sind

**Problem: "Room type not found"**
- Lösung: Legen Sie den Zimmertyp zuerst im UI an (z.B. "DZ / DU")

**Problem: "No hotels available"**
- Lösung: Erstellen Sie mindestens ein Hotel im UI

**Problem: Import fehlgeschlagen**
- Lösung: Überprüfen Sie, dass Ihre Excel-Datei die Sheets "athlets" und "roomlist" enthält

## 📊 Beispiel-Workflow

```
1. Zimmertypen anlegen
   ✓ DZ / DU (2 Personen)
   ✓ EZ / DU (1 Person)

2. Hotel anlegen
   ✓ Hotel: "Grand Alpine"
   ✓ Ort: "Innsbruck"
   ✓ Region: "Tirol"

3. Hotel Inventory hinzufügen
   ✓ DZ / DU: 30 Zimmer (07.03.2027 - 22.03.2027)
   ✓ EZ / DU: 15 Zimmer (07.03.2027 - 22.03.2027)

4. Event erstellen
   ✓ Disziplin: "Big Air"
   ✓ Von: 07.03.2027
   ✓ Bis: 14.03.2027

5. Event Demand hinzufügen
   ✓ DZ / DU: 50 Zimmer
   ✓ EZ / DU: 50 Zimmer

6. Excel importieren
   ✓ Athleten importiert
   ✓ Zimmerzuteilungen importiert

7. Analysen prüfen
   ✓ Verfügbarkeit vs. Bedarf
   ✓ Betten-Kapazität
```
