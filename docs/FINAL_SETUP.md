# ✅ Finale Setup-Anleitung - Freestyle WM 2027

## 🎯 System-Übersicht

Das System ist jetzt vollständig konfiguriert mit:
- **Excel-Import** nur für Athletes & RoomList
- **Vollständige UI-Verwaltung** für alle Stammdaten
- **Analysen & Dashboards** für Auswertungen

## 📋 Workflow: Von Null bis Produktiv

### Schritt 1: System starten

```bash
docker-compose up --build
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

---

### Schritt 2: Zimmertypen anlegen

**Navigation:** `/room-types`

Erstellen Sie alle Zimmertypen, die Sie verwenden werden:

| Name | Max Personen | Beschreibung |
|------|-------------|--------------|
| DZ / DU | 2 | Doppelzimmer mit Dusche |
| EZ / DU | 1 | Einzelzimmer mit Dusche |
| 3BZ / DU | 2 | 3-Bett-Zimmer |
| 4BZ / DU | 2 | 4-Bett-Zimmer |
| APP: 1 DZ + DU | 2 | Apartment 1 Doppelzimmer |
| APP: 2 DZ + DU | 2 | Apartment 2 Doppelzimmer |
| APP: 2 DZ + 2 DU | 4 | Apartment 2 Doppelzimmer, 2 Duschen |
| APP: 3 DZ + DU | 2 | Apartment 3 Doppelzimmer |
| APP: 3 DZ + 2 DU | 4 | Apartment 3 Doppelzimmer, 2 Duschen |
| APP: 3 DZ + 3 DU | 6 | Apartment 3 Doppelzimmer, 3 Duschen |
| APP: 1 DZ + 1 EZ + DU | 2 | Apartment gemischt |

**Aktionen:**
- ✏️ Bearbeiten
- 🗑️ Löschen

---

### Schritt 3: Hotels anlegen

**Navigation:** `/hotels`

#### 3.1 Hotel erstellen
1. Klicken Sie auf "Hotel hinzufügen"
2. Eingaben:
   - **Name:** z.B. "Grand Hotel Alpine"
   - **Ort:** z.B. "Innsbruck"
   - **Region:** z.B. "Tirol"
3. Klicken Sie auf "Erstellen"

#### 3.2 Zimmerkontingente hinzufügen
1. Wählen Sie ein Hotel aus der Liste links
2. Klicken Sie rechts auf "+ Kontingent"
3. Eingaben:
   - **Zimmertyp:** Aus Dropdown wählen
   - **Anzahl Zimmer:** z.B. 30
   - **Verfügbar von:** 07.03.2027
   - **Verfügbar bis:** 22.03.2027
   - **Halbpension (HP):** ☑ Ja/Nein
   - **SR:** ☑ Ja/Nein
4. Klicken Sie auf "Hinzufügen"

**Wiederholen Sie dies für alle Zimmertypen des Hotels!**

**Beispiel:**
```
Hotel: Grand Hotel Alpine (Innsbruck, Tirol)
├─ DZ / DU: 30 Zimmer (07.03-22.03) [HP: Ja, SR: Nein]
├─ EZ / DU: 15 Zimmer (07.03-22.03) [HP: Ja, SR: Nein]
└─ APP: 2 DZ + 2 DU: 5 Zimmer (07.03-22.03) [HP: Ja, SR: Nein]
```

---

### Schritt 4: Events erstellen

**Navigation:** `/events`

#### 4.1 Event erstellen
1. Klicken Sie auf "Event hinzufügen"
2. Eingaben:
   - **Disziplin:** z.B. "Big Air"
   - **Start Datum:** 07.03.2027
   - **End Datum:** 14.03.2027
3. Klicken Sie auf "Erstellen"

#### 4.2 Zimmerbedarf definieren
1. Wählen Sie ein Event aus der Liste links
2. Klicken Sie rechts auf "+ Bedarf"
3. Eingaben:
   - **Zimmertyp:** Aus Dropdown wählen
   - **Benötigte Zimmer:** z.B. 50
4. Klicken Sie auf "Hinzufügen"

**Wiederholen Sie dies für alle Zimmertypen des Events!**

**Beispiel:**
```
Event: Big Air (07.03-14.03)
├─ DZ / DU: 141 Zimmer benötigt = 282 Betten
└─ EZ / DU: 139 Zimmer benötigt = 139 Betten
   Gesamt: 280 Zimmer, 421 Betten
```

---

### Schritt 5: Excel-Daten importieren

**Navigation:** `/import`

#### 5.1 Excel-Datei vorbereiten

Ihre Excel-Datei (.xlsx oder .xls) muss **zwei Sheets** enthalten:

**Sheet 1: "athlets"**
Spalten:
- Function, Competitorid/Staff ID, Accredid, Fiscode
- Lastname, Firstname, Nationcode
- For_gender, Gender, Phone, Email
- WC_SBX_W_6061, WC_SBX_M_6060
- Arrival_date, Arrival_time, Arrival_by, Arrival_airport, Arrival_flightno
- Arrival_need_transportation
- Departure_date, Departure_time, Departure_by, Departure_airport, Departure_flightno
- Departure_need_transportation
- Room_type, Shared_with_name, Late_checkout
- First_meal, Last_meal, Special_meal
- Stance, tv_picture_status, tv_picture_date

**Sheet 2: "roomlist"**
Spalten:
- Lastname, Firstname, Nationcode
- Room_type (z.B. "Single", "Double shared", "Appartment")
- "Shared with Name", "Shared with Nationcode"
- Arrival_date, Departure_date

#### 5.2 Import durchführen
1. Klicken Sie auf "Excel Datei auswählen"
2. Wählen Sie Ihre .xlsx Datei
3. Klicken Sie auf "Importieren"
4. Warten Sie auf Bestätigung
5. Die Seite lädt sich automatisch neu

**Wichtig:** Der Import überschreibt nur Athletes und RoomList!

---

### Schritt 6: Analysen prüfen

**Navigation:** `/analytics`

Hier sehen Sie:
- **Verfügbare Zimmer** vs. **Benötigte Zimmer**
- **Betten-Kapazität** nach Zimmertyp
- **Status:** Grün = Ausreichend, Rot = Fehlend
- Detaillierte Tabelle mit allen Zimmertypen

**Beispiel-Auswertung:**
```
DZ / DU:
  Verfügbar: 150 Zimmer (300 Betten)
  Bedarf: 141 Zimmer (282 Betten)
  Differenz: +9 Zimmer (+18 Betten) ✅

EZ / DU:
  Verfügbar: 80 Zimmer (80 Betten)
  Bedarf: 139 Zimmer (139 Betten)
  Differenz: -59 Zimmer (-59 Betten) ❌
```

---

## 🗂️ Navigation Übersicht

| Menü | Route | Beschreibung |
|------|-------|--------------|
| Dashboard | `/` | Übersicht & Statistiken |
| Athleten | `/athletes` | Athleten-Liste (nach Import) |
| Zuweisungen | `/assignments` | Zimmerzuteilungen (nach Import) |
| **Zimmertypen** | `/room-types` | ✏️ CRUD für Zimmertypen |
| **Hotels** | `/hotels` | ✏️ CRUD für Hotels & Inventories |
| **Events** | `/events` | ✏️ CRUD für Events & Demands |
| Analysen | `/analytics` | Verfügbarkeit vs. Bedarf |
| Import | `/import` | Excel-Upload |

---

## ⚙️ API Endpoints (Referenz)

### Room Types
```
GET    /api/room-types
POST   /api/room-types
PUT    /api/room-types/:id
DELETE /api/room-types/:id
```

### Hotels
```
GET    /api/hotels
POST   /api/hotels
PUT    /api/hotels/:id
DELETE /api/hotels/:id
POST   /api/hotels/:id/inventory
DELETE /api/hotels/:id/inventory/:invId
```

### Events
```
GET    /api/events
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id
POST   /api/events/:id/demand
DELETE /api/events/:id/demand/:demandId
```

### Import
```
POST   /api/import/excel (multipart/form-data)
```

### Analytics
```
GET    /api/analytics/room-availability
GET    /api/analytics/occupancy-timeline
```

---

## 🔍 Troubleshooting

### Problem: "Room type not found" beim Import
**Lösung:** Legen Sie den Zimmertyp zuerst unter `/room-types` an

### Problem: "No hotels available" beim Import
**Lösung:** Erstellen Sie mindestens ein Hotel unter `/hotels`

### Problem: Analysen zeigen negative Werte
**Lösung:** Sie haben mehr Bedarf als Verfügbarkeit. Fügen Sie mehr Hotel-Inventories hinzu oder reduzieren Sie Event-Demands

### Problem: Excel-Import schlägt fehl
**Lösung:** 
1. Überprüfen Sie, dass die Sheets "athlets" und "roomlist" existieren
2. Überprüfen Sie die Spaltennamen (Groß-/Kleinschreibung beachten)
3. Stellen Sie sicher, dass alle Zimmertypen in der DB existieren

---

## 📊 Beispiel-Workflow komplett

```
1. Zimmertypen anlegen
   ✅ DZ / DU (2 Personen)
   ✅ EZ / DU (1 Person)

2. Hotel "Grand Alpine" erstellen
   ✅ Ort: Innsbruck
   ✅ Region: Tirol

3. Inventories hinzufügen
   ✅ DZ / DU: 50 Zimmer (07.03-22.03)
   ✅ EZ / DU: 25 Zimmer (07.03-22.03)

4. Event "Big Air" erstellen
   ✅ 07.03.2027 - 14.03.2027

5. Bedarf definieren
   ✅ DZ / DU: 40 Zimmer
   ✅ EZ / DU: 30 Zimmer

6. Excel importieren
   ✅ Sheet "athlets": 150 Athleten
   ✅ Sheet "roomlist": 120 Zuweisungen

7. Analysen prüfen
   ✅ DZ: +10 Zimmer verfügbar ✅
   ✅ EZ: -5 Zimmer Mangel ❌
   → Aktion: Mehr EZ-Inventories hinzufügen!
```

---

## 🎉 Fertig!

Das System ist jetzt komplett einsatzbereit. 

**Viel Erfolg bei der Freestyle WM 2027!** 🏂⛷️🎿

---

## 📅 Wichtige Termine

Die Freestyle WM 2027 findet voraussichtlich im **März 2027** statt. 
Nutzen Sie die Event-Verwaltung, um alle Disziplinen mit genauen Terminen zu erfassen!
