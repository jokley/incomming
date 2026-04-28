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

from models import db, Athlete, RoomAssignment, Hotel, RoomType


# -------------------------
# Helpers
# -------------------------

def normalize_columns(df):
    df.columns = (
        df.columns
        .str.replace('\n', ' ', regex=False)
        .str.replace('\r', ' ', regex=False)
        .str.strip()
    )
    return df


def normalize_string(s):
    if not s:
        return ''
    s = str(s).strip().lower()
    return ''.join(
        c for c in unicodedata.normalize('NFKD', s)
        if not unicodedata.combining(c)
    )


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


# -------------------------
# Detection
# -------------------------

def detect_file_type(df):
    columns = set(df.columns)

    if {'Competitorid/Staff ID', 'Accredid', 'Fiscode'}.intersection(columns):
        return 'athletes'

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
                    )
                    to_insert.append(athlete)

            except Exception as e:
                print(f"[Athlete ERROR] Row {index}: {e}")

        if to_insert:
            db.session.bulk_save_objects(to_insert)

        db.session.commit()

        print(f"✓ Athletes inserted: {len(to_insert)}")
        print(f"✓ Athletes updated: {updated}")

        return {
            'inserted': len(to_insert),
            'updated': updated
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
        cache = build_athlete_cache()
        hotel = Hotel.query.first()

        assignments = []

        for index, row in df.iterrows():
            try:
                athlete = find_athlete_cached(row, cache)
                if not athlete:
                    print(f"[MISS] {row.get('Firstname')} {row.get('Lastname')}")
                    continue

                room_type_name = resolve_room_type(row)
                if not room_type_name:
                    continue

                room_type = RoomType.query.filter_by(name=room_type_name).first()
                if not room_type:
                    continue

                assignment = RoomAssignment(
                    athlete_id=athlete.id,
                    hotel_id=hotel.id,
                    room_type_id=room_type.id,
                    check_in_date=parse_date(row.get('Arrival_date')),
                    check_out_date=parse_date(row.get('Departure_date')),
                )

                assignments.append(assignment)

            except Exception as e:
                print(f"[Room ERROR] Row {index}: {e}")

        if assignments:
            db.session.bulk_save_objects(assignments)

        db.session.commit()

        print(f"✓ Room assignments: {len(assignments)}")
        return len(assignments)


# -------------------------
# Main Import
# -------------------------

def import_excel_file(file_path, app):
    print("Starting Excel import...")

    df = pd.read_excel(file_path)
    df = normalize_columns(df)

    print(f"Columns: {list(df.columns)}")

    file_type = detect_file_type(df)
    print(f"Detected: {file_type}")

    if file_type == 'athletes':
        result = import_athletes_upsert(df, app)
        return {'type': 'athletes', 'result': result}

    elif file_type == 'roomlist':
        count = import_roomlist(df, app)
        return {'type': 'roomlist', 'count': count}

    else:
        raise ValueError("Unknown Excel format")


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
