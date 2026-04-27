"""
Excel Import for Athletes and RoomList
"""
import pandas as pd
from datetime import datetime
from models import db, Athlete, RoomAssignment, Hotel, RoomType


def parse_date(date_str):
    """Parse various date formats"""
    if pd.isna(date_str) or not date_str:
        return None

    if isinstance(date_str, datetime):
        return date_str.date()

    try:
        # Try DD.MM.YYYY format
        return datetime.strptime(str(date_str), '%d.%m.%Y').date()
    except:
        try:
            # Try YYYY-MM-DD format
            return datetime.strptime(str(date_str), '%Y-%m-%d').date()
        except:
            return None


def parse_boolean(value):
    """Parse boolean values"""
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ['yes', 'ja', 'true', '1', 'x']
    return False


def import_athletes_excel(file_path, app):
    """Import athletes from Excel file"""
    with app.app_context():
        # Read Excel file
        df = pd.read_excel(file_path, sheet_name='athlets')

        # Clear existing athletes
        Athlete.query.delete()

        imported = 0
        for index, row in df.iterrows():
            try:
                athlete = Athlete(
                    function=str(row.get('Function', '')) if pd.notna(row.get('Function')) else None,
                    competitor_id=str(row.get('Competitorid/Staff ID', '')) if pd.notna(row.get('Competitorid/Staff ID')) else None,
                    accred_id=str(row.get('Accredid', '')) if pd.notna(row.get('Accredid')) else None,
                    fis_code=str(row.get('Fiscode', '')) if pd.notna(row.get('Fiscode')) else None,
                    lastname=str(row.get('Lastname', '')),
                    firstname=str(row.get('Firstname', '')),
                    nation_code=str(row.get('Nationcode', '')),
                    for_gender=str(row.get('For_gender', '')) if pd.notna(row.get('For_gender')) else None,
                    gender=str(row.get('Gender', '')) if pd.notna(row.get('Gender')) else None,
                    phone=str(row.get('Phone', '')) if pd.notna(row.get('Phone')) else None,
                    email=str(row.get('Email', '')) if pd.notna(row.get('Email')) else None,

                    # Event participation
                    wc_sbx_w=parse_boolean(row.get('WC_SBX_W_6061')),
                    wc_sbx_m=parse_boolean(row.get('WC_SBX_M_6060')),

                    # Travel
                    arrival_date=parse_date(row.get('Arrival_date')),
                    arrival_time=str(row.get('Arrival_time', '')) if pd.notna(row.get('Arrival_time')) else None,
                    arrival_by=str(row.get('Arrival_by', '')) if pd.notna(row.get('Arrival_by')) else None,
                    arrival_airport=str(row.get('Arrival_airport', '')) if pd.notna(row.get('Arrival_airport')) else None,
                    arrival_flight_no=str(row.get('Arrival_flightno', '')) if pd.notna(row.get('Arrival_flightno')) else None,
                    arrival_need_transportation=parse_boolean(row.get('Arrival_need_transportation')),

                    departure_date=parse_date(row.get('Departure_date')),
                    departure_time=str(row.get('Departure_time', '')) if pd.notna(row.get('Departure_time')) else None,
                    departure_by=str(row.get('Departure_by', '')) if pd.notna(row.get('Departure_by')) else None,
                    departure_airport=str(row.get('Departure_airport', '')) if pd.notna(row.get('Departure_airport')) else None,
                    departure_flight_no=str(row.get('Departure_flightno', '')) if pd.notna(row.get('Departure_flightno')) else None,
                    departure_need_transportation=parse_boolean(row.get('Departure_need_transportation')),

                    # Accommodation
                    room_type=str(row.get('Room_type', '')) if pd.notna(row.get('Room_type')) else None,
                    shared_with_name=str(row.get('Shared_with_name', '')) if pd.notna(row.get('Shared_with_name')) else None,
                    late_checkout=parse_boolean(row.get('Late_checkout')),

                    # Meals
                    first_meal=str(row.get('First_meal', '')) if pd.notna(row.get('First_meal')) else None,
                    last_meal=str(row.get('Last_meal', '')) if pd.notna(row.get('Last_meal')) else None,
                    special_meal=str(row.get('Special_meal', '')) if pd.notna(row.get('Special_meal')) else None,

                    # Additional
                    stance=str(row.get('Stance', '')) if pd.notna(row.get('Stance')) else None,
                    tv_picture_status=str(row.get('tv_picture_status', '')) if pd.notna(row.get('tv_picture_status')) else None,
                    tv_picture_date=parse_date(row.get('tv_picture_date'))
                )

                db.session.add(athlete)
                imported += 1

                if imported % 50 == 0:
                    print(f"Imported {imported} athletes...")

            except Exception as e:
                print(f"Error importing athlete at row {index}: {e}")
                continue

        db.session.commit()
        print(f"✓ Imported {imported} athletes")
        return imported


def import_roomlist_excel(file_path, app):
    """Import room assignments from Excel file"""
    with app.app_context():
        # Read Excel file
        df = pd.read_excel(file_path, sheet_name='roomlist')

        # Clear existing assignments
        RoomAssignment.query.delete()

        imported = 0
        for index, row in df.iterrows():
            try:
                # Find athlete by name and nation
                lastname = str(row.get('Lastname', ''))
                firstname = str(row.get('Firstname', ''))
                nation_code = str(row.get('Nationcode', ''))

                athlete = Athlete.query.filter_by(
                    lastname=lastname,
                    firstname=firstname,
                    nation_code=nation_code
                ).first()

                if not athlete:
                    print(f"Athlete not found: {firstname} {lastname} ({nation_code})")
                    continue

                # Parse room type
                room_type_str = str(row.get('Room_type', ''))
                room_type_name = None

                if 'Single' in room_type_str:
                    room_type_name = 'EZ / DU'
                elif 'Double shared' in room_type_str:
                    room_type_name = 'DZ / DU'
                elif 'Appartment' in room_type_str:
                    # Try to match apartment type from shared info
                    room_type_name = 'APP: 2 DZ + DU'  # Default apartment

                if not room_type_name:
                    continue

                room_type = RoomType.query.filter_by(name=room_type_name).first()
                if not room_type:
                    print(f"Room type not found: {room_type_name}")
                    continue

                # For now, use first available hotel (can be improved)
                hotel = Hotel.query.first()
                if not hotel:
                    print("No hotels available for assignment")
                    continue

                # Find shared_with athlete if specified
                shared_with_id = None
                shared_with_name = row.get('Shared with Name')
                if pd.notna(shared_with_name) and shared_with_name:
                    shared_nation = str(row.get('Shared with Nationcode', ''))
                    # Try to parse name
                    name_parts = str(shared_with_name).split(',')
                    if len(name_parts) >= 2:
                        shared_lastname = name_parts[0].strip()
                        shared_firstname = name_parts[1].strip()

                        shared_athlete = Athlete.query.filter_by(
                            lastname=shared_lastname,
                            firstname=shared_firstname,
                            nation_code=shared_nation
                        ).first()

                        if shared_athlete:
                            shared_with_id = shared_athlete.id

                # Create assignment
                assignment = RoomAssignment(
                    athlete_id=athlete.id,
                    hotel_id=hotel.id,
                    room_type_id=room_type.id,
                    check_in_date=parse_date(row.get('Arrival_date')),
                    check_out_date=parse_date(row.get('Departure_date')),
                    shared_with_athlete_id=shared_with_id
                )

                db.session.add(assignment)
                imported += 1

            except Exception as e:
                print(f"Error importing room assignment at row {index}: {e}")
                continue

        db.session.commit()
        print(f"✓ Imported {imported} room assignments")
        return imported


def import_excel_file(file_path, app):
    """Main import function for Excel file"""
    print("Starting Excel import...")

    # Check which sheets exist
    try:
        xl_file = pd.ExcelFile(file_path)
        available_sheets = xl_file.sheet_names
        print(f"Available sheets: {available_sheets}")

        athletes_count = 0
        roomlist_count = 0

        if 'athlets' in available_sheets:
            print("\n--- Importing Athletes ---")
            athletes_count = import_athletes_excel(file_path, app)

        if 'roomlist' in available_sheets:
            print("\n--- Importing RoomList ---")
            roomlist_count = import_roomlist_excel(file_path, app)

        print(f"\n✅ Import complete!")
        print(f"   Athletes: {athletes_count}")
        print(f"   Room Assignments: {roomlist_count}")

        return {
            'athletes': athletes_count,
            'roomlist': roomlist_count
        }

    except Exception as e:
        print(f"❌ Error during import: {e}")
        raise


if __name__ == '__main__':
    from app_new import app
    import sys

    if len(sys.argv) < 2:
        print("Usage: python excel_import.py <path_to_excel_file>")
        sys.exit(1)

    excel_file = sys.argv[1]
    import_excel_file(excel_file, app)
