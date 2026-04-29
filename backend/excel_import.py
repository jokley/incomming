"""
Excel Import (FINAL)
- Auto-detect file type
- UPSERT athletes
- Bulk insert
- Cached lookups
"""

import pandas as pd
from datetime import datetime
import unicodedata

from models import db, Athlete, RoomAssignment, Hotel, RoomType, HotelRoomInventory, ImportRun


# -------------------------
# Helpers
# -------------------------

def normalize_string(s):
    if not s:
        return ''
    s = str(s).strip().lower()
    return ''.join(
        c for c in unicodedata.normalize('NFKD', s)
        if not unicodedata.combining(c)
    )


def normalize_columns(df):
    # If Excel has metadata rows above the real header, pandas may produce only
    # "Unnamed: X" columns. In that case, promote the first row to header if it
    # looks like a header row.
    if len(df.columns) > 0:
        unnamed_cols = [str(c).startswith('Unnamed:') for c in df.columns]
        if all(unnamed_cols):
            candidate = [normalize_whitespace(v) for v in df.iloc[0].tolist()]
            candidate_keys = {normalize_string(v) for v in candidate if v}
            header_markers = {
                'hotel', 'zimmertyp', 'von', 'bis', 'zimmer', 'ort', 'region', 'hp', 'sr',
                'maxpersonen', 'zimmer', 'zimmertypid', 'hotelid', 'venueid', 'venue'
            }
            if candidate_keys.intersection(header_markers):
                df = df.copy()
                df.columns = candidate
                df = df.iloc[1:].reset_index(drop=True)

    def _col_key(name: str) -> str:
        if name is None:
            return ''
        s = str(name)
        s = s.replace('\u00a0', ' ')  # NBSP
        s = s.replace('\n', ' ').replace('\r', ' ')
        s = s.strip().strip('"').strip("'")
        # normalize unicode + strip diacritics, then keep only alnum
        s = normalize_string(s)
        return ''.join(ch for ch in s if ch.isalnum())

    aliases = {
        # German hotel/inventory + room-type sheets
        'hotel': 'Hotel',
        'zimmertyp': 'ZimmerTyp',
        'von': 'Von',
        'bis': 'Bis',
        'zimmer': 'Zimmer',
        'ort': 'Ort',
        'region': 'Region',
        'hp': 'HP',
        'sr': 'SR',
        'maxpersonen': 'MaxPersonen',
        'maxperson': 'MaxPersonen',
        'maxpersons': 'MaxPersonen',

        # Core roomlist fields
        'roomtype': 'Room_type',
        'roomtypeezdz': 'Room_type',
        'roomtyp': 'Room_type',
        'singleroom': 'Single',
        'single': 'Single',
        'doubleshared': 'Double_shared',
        'double_shared': 'Double_shared',
        'doublesingle': 'Double_single',
        'appartment': 'Appartment',
        'apartment': 'Appartment',
        # Shared-with columns (Excel sometimes line-breaks headers)
        'sharedwithname': 'Shared with Name',
        'sharedwithnationcode': 'Shared with Nationcode',
        'sharedwithindustryname': 'Shared with Industryname',
        'sharedwithfunction': 'Shared with Function',
        'sharedwithforgender': 'Shared with For_gender',
        'sharedwitharrivaldate': 'Shared with Arrival_date',
        'sharedwithdeparturedate': 'Shared with Departure_date',
        'sharedwithlatecheckout': 'Shared with Late_checkout',
        'sharedwithfirstmeal': 'Shared_with_First_meal',
        'sharedwithlastmeal': 'Shared_with_Last_meal',
        'sharedwithspecialmeal': 'Shared_with_Special_meal',
    }

    normalized = []
    for col in df.columns:
        col_str = str(col).replace('\u00a0', ' ')
        col_str = col_str.replace('\n', ' ').replace('\r', ' ')
        col_str = col_str.strip().strip('"').strip("'")
        col_str = ' '.join(col_str.split())  # collapse whitespace
        normalized.append(aliases.get(_col_key(col_str), col_str))

    df.columns = normalized
    return df


def build_name_key(lastname, firstname, nation):
    return f"{normalize_string(lastname)}|{normalize_string(firstname)}|{normalize_string(nation)}"


def parse_date(date_str):
    if pd.isna(date_str) or not date_str:
        return None

    if isinstance(date_str, datetime):
        return date_str.date()

    for fmt in ('%d.%m.%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(str(date_str), fmt).date()
        except:
            continue
    return None


def parse_boolean(value):
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    if isinstance(value, str):
        return value.lower().strip() in ['yes', 'ja', 'true', '1', 'x']
    return False


def normalize_whitespace(value):
    if value is None or pd.isna(value):
        return ''
    s = str(value).replace('\u00a0', ' ').strip()
    return ' '.join(s.split())


# -------------------------
# Detection
# -------------------------

def detect_file_type(df):
    columns = set(df.columns)

    if {'Competitorid/Staff ID', 'Accredid', 'Fiscode'}.intersection(columns):
        return 'athletes'

    # Room types sheet: Zimmer + MaxPersonen (no ZimmerTypID needed)
    if {'Zimmer', 'MaxPersonen'}.issubset(columns):
        return 'room_types'

    # Hotels master list (no inventories)
    if {'Hotel', 'Ort'}.issubset(columns) and ('ZimmerTyp' not in columns):
        return 'hotels_master'

    # Hotel inventories / kontingente sheet
    if {'Hotel', 'ZimmerTyp', 'Von', 'Bis', 'Zimmer'}.issubset(columns):
        return 'hotel_inventories'

    if {'Room_type', 'Shared with Name', 'Single', 'Double_shared'}.intersection(columns):
        return 'roomlist'

    return 'unknown'


# -------------------------
# Athlete UPSERT
# -------------------------

def build_existing_athlete_map():
    athletes = Athlete.query.all()

    maps = {
        'competitor': {},
        'accred': {},
        'name': {}
    }

    for a in athletes:
        if a.competitor_id:
            maps['competitor'][str(a.competitor_id)] = a

        if a.accred_id:
            maps['accred'][str(a.accred_id)] = a

        key = build_name_key(a.lastname, a.firstname, a.nation_code)
        maps['name'][key] = a

    print(f"Loaded {len(athletes)} athletes into cache")
    return maps


def find_existing_athlete(row, maps):
    competitor_id = row.get('Competitorid/Staff ID')
    if pd.notna(competitor_id):
        a = maps['competitor'].get(str(competitor_id))
        if a:
            return a

    accred_id = row.get('Accredid')
    if pd.notna(accred_id):
        a = maps['accred'].get(str(accred_id))
        if a:
            return a

    key = build_name_key(
        row.get('Lastname'),
        row.get('Firstname'),
        row.get('Nationcode')
    )

    return maps['name'].get(key)


def import_athletes_upsert(df, app):
    with app.app_context():
        now = datetime.utcnow()
        run = ImportRun(import_type='athletes', started_at=now)
        db.session.add(run)
        db.session.flush()

        maps = build_existing_athlete_map()

        to_insert = []
        updated = 0

        for index, row in df.iterrows():
            try:
                existing = find_existing_athlete(row, maps)

                if existing:
                    # UPDATE (only key fields shown, extend as needed)
                    existing.function = row.get('Function')
                    existing.phone = row.get('Phone')
                    existing.email = row.get('Email')
                    existing.arrival_date = parse_date(row.get('Arrival_date'))
                    existing.departure_date = parse_date(row.get('Departure_date'))
                    existing.athletes_last_seen_at = now

                    updated += 1

                else:
                    athlete = Athlete(
                        function=row.get('Function'),
                        competitor_id=row.get('Competitorid/Staff ID'),
                        accred_id=row.get('Accredid'),
                        fis_code=row.get('Fiscode'),
                        lastname=row.get('Lastname'),
                        firstname=row.get('Firstname'),
                        nation_code=row.get('Nationcode'),
                        gender=row.get('Gender'),
                        arrival_date=parse_date(row.get('Arrival_date')),
                        departure_date=parse_date(row.get('Departure_date')),
                        athletes_last_seen_at=now,
                    )
                    to_insert.append(athlete)

            except Exception as e:
                print(f"[Athlete ERROR] Row {index}: {e}")

        if to_insert:
            db.session.bulk_save_objects(to_insert)

        db.session.commit()

        print(f"✓ Athletes inserted: {len(to_insert)}")
        print(f"✓ Athletes updated: {updated}")

        run.finished_at = datetime.utcnow()
        db.session.commit()

        missing_from_latest = Athlete.query.filter(
            Athlete.athletes_last_seen_at.isnot(None),
            Athlete.athletes_last_seen_at < now
        ).count()

        return {
            'inserted': len(to_insert),
            'updated': updated,
            'missingFromLatestImport': missing_from_latest,
            'run': run.to_dict(),
        }


# -------------------------
# Roomlist Import
# -------------------------

def resolve_room_type(row):
    if parse_boolean(row.get('Single')):
        return 'EZ / DU'
    if parse_boolean(row.get('Double_shared')):
        return 'DZ / DU'
    if parse_boolean(row.get('Appartment')):
        return 'APP: 2 DZ + DU'
    return None


def build_athlete_cache():
    athletes = Athlete.query.all()

    cache = {
        'competitor_id': {},
        'accred_id': {},
        'name_key': {}
    }

    for a in athletes:
        if a.competitor_id:
            cache['competitor_id'][str(a.competitor_id)] = a

        if a.accred_id:
            cache['accred_id'][str(a.accred_id)] = a

        key = build_name_key(a.lastname, a.firstname, a.nation_code)
        cache['name_key'][key] = a

    return cache


def find_athlete_cached(row, cache):
    competitor_id = row.get('Competitorid/Staff ID')
    if pd.notna(competitor_id):
        a = cache['competitor_id'].get(str(competitor_id))
        if a:
            return a

    accred_id = row.get('Accredid')
    if pd.notna(accred_id):
        a = cache['accred_id'].get(str(accred_id))
        if a:
            return a

    key = build_name_key(
        row.get('Lastname'),
        row.get('Firstname'),
        row.get('Nationcode')
    )

    return cache['name_key'].get(key)


def import_roomlist(df, app):
    with app.app_context():
        now = datetime.utcnow()
        run = ImportRun(import_type='roomlist', started_at=now)
        db.session.add(run)
        db.session.flush()

        cache = build_athlete_cache()
        matched = 0
        changed = 0

        for index, row in df.iterrows():
            try:
                athlete = find_athlete_cached(row, cache)
                if not athlete:
                    print(f"[MISS] {row.get('Firstname')} {row.get('Lastname')}")
                    continue

                next_arrival = parse_date(row.get('Arrival_date'))
                next_departure = parse_date(row.get('Departure_date'))
                next_room_type = row.get('Room_type') or resolve_room_type(row)
                next_partner = (
                    row.get('Shared with Name')
                    or row.get('Shared_with_name')
                    or row.get('Room_partner')
                    or row.get('Room partner')
                )

                before = (
                    athlete.arrival_date,
                    athlete.departure_date,
                    athlete.room_type,
                    athlete.shared_with_name,
                )

                if next_arrival is not None:
                    athlete.arrival_date = next_arrival
                if next_departure is not None:
                    athlete.departure_date = next_departure
                if next_room_type:
                    athlete.room_type = next_room_type
                if next_partner:
                    athlete.shared_with_name = str(next_partner).strip()

                athlete.roomlist_last_seen_at = now

                after = (
                    athlete.arrival_date,
                    athlete.departure_date,
                    athlete.room_type,
                    athlete.shared_with_name,
                )

                if before != after:
                    athlete.roomlist_changed_at = now
                    changes = []
                    if before[0] != after[0]:
                        changes.append("arrivalDate")
                    if before[1] != after[1]:
                        changes.append("departureDate")
                    if before[2] != after[2]:
                        changes.append("roomType")
                    if before[3] != after[3]:
                        changes.append("roomPartner")
                    athlete.roomlist_change_summary = "changed: " + ", ".join(changes)
                    changed += 1

                matched += 1

            except Exception as e:
                print(f"[Room ERROR] Row {index}: {e}")

        db.session.commit()

        run.finished_at = datetime.utcnow()
        db.session.commit()

        missing_from_latest = Athlete.query.filter(
            Athlete.roomlist_last_seen_at.isnot(None),
            Athlete.roomlist_last_seen_at < now
        ).count()

        return {
            'matched': matched,
            'changed': changed,
            'missingFromLatestImport': missing_from_latest,
            'run': run.to_dict(),
        }


# -------------------------
# Room Types + Hotels (German Excel)
# -------------------------

def import_room_types_excel(df, app):
    with app.app_context():
        now = datetime.utcnow()
        run = ImportRun(import_type='room_types', started_at=now)
        db.session.add(run)
        db.session.flush()

        # Overwrite room types only. Hotel inventories are handled by the hotels importer.
        RoomType.query.delete()
        db.session.commit()

        inserted = 0
        skipped = 0
        seen = set()

        for index, row in df.iterrows():
            try:
                name = normalize_whitespace(row.get('Zimmer'))
                max_persons = row.get('MaxPersonen')

                if not name:
                    skipped += 1
                    continue

                if name in seen:
                    continue
                seen.add(name)

                if pd.isna(max_persons):
                    skipped += 1
                    continue

                rt = RoomType(name=name, max_persons=int(max_persons))
                db.session.add(rt)
                inserted += 1

            except Exception as e:
                print(f"[RoomTypes ERROR] Row {index}: {e}")
                skipped += 1

        db.session.commit()
        run.finished_at = datetime.utcnow()
        db.session.commit()

        return {
            'inserted': inserted,
            'skipped': skipped,
            'run': run.to_dict(),
        }


def import_hotels_excel(df, app):
    with app.app_context():
        now = datetime.utcnow()
        run = ImportRun(import_type='hotels', started_at=now)
        db.session.add(run)
        db.session.flush()

        # Strict validation: all referenced ZimmerTyp must exist as RoomType.name
        referenced_types = set()
        for _, row in df.iterrows():
            rt_name = normalize_whitespace(row.get('ZimmerTyp'))
            if not rt_name:
                continue
            referenced_types.add(rt_name)

        existing_types = {normalize_whitespace(rt.name) for rt in RoomType.query.all()}
        missing_types = sorted([t for t in referenced_types if t not in existing_types])
        if missing_types:
            raise ValueError(f"Missing RoomTypes: {missing_types}")

        # Overwrite hotels + inventories (keep room types as imported from its sheet)
        HotelRoomInventory.query.delete()
        Hotel.query.delete()
        db.session.commit()

        inserted_hotels = 0
        inserted_inventories = 0
        skipped = 0
        missing_room_types = 0

        hotel_cache = {}  # (name, location, region) -> Hotel
        room_type_cache = {normalize_whitespace(rt.name): rt for rt in RoomType.query.all()}

        for index, row in df.iterrows():
            try:
                hotel_name = normalize_whitespace(row.get('Hotel'))
                room_type_name = normalize_whitespace(row.get('ZimmerTyp'))
                available_from = parse_date(row.get('Von'))
                available_until = parse_date(row.get('Bis'))
                room_count = row.get('Zimmer')

                location = row.get('Ort')
                region = row.get('Region')
                has_hp = parse_boolean(row.get('HP'))
                has_sr = parse_boolean(row.get('SR'))

                if not hotel_name or not room_type_name or pd.isna(room_count):
                    skipped += 1
                    continue

                location = None if pd.isna(location) else normalize_whitespace(location)
                region = None if pd.isna(region) else normalize_whitespace(region)

                if not available_from or not available_until:
                    skipped += 1
                    continue

                rt = room_type_cache.get(room_type_name)
                if not rt:
                    # Should not happen due to strict validation, but keep as a safeguard.
                    missing_room_types += 1
                    skipped += 1
                    continue

                hotel_key = (hotel_name, location or '', region or '')
                hotel = hotel_cache.get(hotel_key)
                if not hotel:
                    hotel = Hotel(name=hotel_name, location=location, region=region)
                    db.session.add(hotel)
                    db.session.flush()
                    hotel_cache[hotel_key] = hotel
                    inserted_hotels += 1

                inv = HotelRoomInventory(
                    hotel_id=hotel.id,
                    room_type_id=rt.id,
                    available_from=available_from,
                    available_until=available_until,
                    room_count=int(room_count),
                    has_half_board=has_hp,
                    has_sr=has_sr,
                )
                db.session.add(inv)
                inserted_inventories += 1

            except Exception as e:
                print(f"[Hotels ERROR] Row {index}: {e}")
                skipped += 1

        db.session.commit()
        run.finished_at = datetime.utcnow()
        db.session.commit()

        return {
            'hotelsInserted': inserted_hotels,
            'inventoriesInserted': inserted_inventories,
            'missingRoomTypes': missing_room_types,
            'skipped': skipped,
            'run': run.to_dict(),
        }


def import_hotels_master_excel(df, app):
    with app.app_context():
        now = datetime.utcnow()
        run = ImportRun(import_type='hotels_master', started_at=now)
        db.session.add(run)
        db.session.flush()

        # Overwrite just hotels (no inventories in this sheet type)
        Hotel.query.delete()
        db.session.commit()

        inserted = 0
        skipped = 0

        for index, row in df.iterrows():
            try:
                name = normalize_whitespace(row.get('Hotel'))
                if not name:
                    skipped += 1
                    continue

                location = None if pd.isna(row.get('Ort')) else normalize_whitespace(row.get('Ort'))
                region = None if pd.isna(row.get('Region')) else normalize_whitespace(row.get('Region'))

                db.session.add(Hotel(name=name, location=location or None, region=region or None))
                inserted += 1
            except Exception as e:
                print(f"[HotelsMaster ERROR] Row {index}: {e}")
                skipped += 1

        db.session.commit()
        run.finished_at = datetime.utcnow()
        db.session.commit()

        return {'inserted': inserted, 'skipped': skipped, 'run': run.to_dict()}


# -------------------------
# Main Import
# -------------------------

def import_excel_file(file_path, app):
    print("Starting Excel import...")

    sheets = pd.read_excel(file_path, sheet_name=None)
    if not isinstance(sheets, dict):
        sheets = {'Sheet1': sheets}

    # Pass 1: classify sheets
    classified = []
    for sheet_name, df in sheets.items():
        if df is None or getattr(df, 'empty', True):
            continue
        df = normalize_columns(df)
        file_type = detect_file_type(df)
        classified.append((sheet_name, file_type, df))
        print(f"[{sheet_name}] Columns: {list(df.columns)}")
        print(f"[{sheet_name}] Detected: {file_type}")

    if not classified:
        raise ValueError("Unknown or empty Excel format")

    # Pass 2: import in dependency order
    results = {}
    summary = {
        'imported': {
            'room_types': 0,
            'hotels_master': 0,
            'hotel_inventories': 0,
            'athletes': 0,
            'roomlist': 0
        },
        'skippedSheets': 0,
    }

    ordered_types = ['room_types', 'hotels_master', 'hotel_inventories', 'athletes', 'roomlist']
    for wanted in ordered_types:
        for sheet_name, file_type, df in classified:
            if file_type != wanted:
                continue

            if wanted == 'athletes':
                results[sheet_name] = {'type': 'athletes', 'result': import_athletes_upsert(df, app)}
                summary['imported']['athletes'] += 1
            elif wanted == 'roomlist':
                results[sheet_name] = {'type': 'roomlist', 'result': import_roomlist(df, app)}
                summary['imported']['roomlist'] += 1
            elif wanted == 'room_types':
                results[sheet_name] = {'type': 'room_types', 'result': import_room_types_excel(df, app)}
                summary['imported']['room_types'] += 1
            elif wanted == 'hotels_master':
                results[sheet_name] = {'type': 'hotels_master', 'result': import_hotels_master_excel(df, app)}
                summary['imported']['hotels_master'] += 1
            elif wanted == 'hotel_inventories':
                results[sheet_name] = {'type': 'hotel_inventories', 'result': import_hotels_excel(df, app)}
                summary['imported']['hotel_inventories'] += 1

    # Record unknown sheets (we keep them in results so the user can see what was ignored)
    for sheet_name, file_type, df in classified:
        if sheet_name in results:
            continue
        results[sheet_name] = {'type': 'unknown', 'result': {'skipped': True, 'columns': list(df.columns)}}
        summary['skippedSheets'] += 1

    if not results:
        raise ValueError("Unknown or empty Excel format")

    return {'summary': summary, 'sheets': results}


# -------------------------
# CLI
# -------------------------

if __name__ == '__main__':
    from app import app
    import sys

    if len(sys.argv) < 2:
        print("Usage: python excel_import.py <file>")
        sys.exit(1)

    import_excel_file(sys.argv[1], app)
