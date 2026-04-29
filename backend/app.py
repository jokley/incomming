from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, RoomType, Hotel, HotelRoomInventory, Event, EventRoomDemand, Athlete, RoomAssignment, RoomBooking, RoomBookingOccupant, ImportRun
from fis_rules import compute_official_quota, compute_single_room_entitlement, is_supported_discipline
from datetime import datetime
import os
import csv
import io
from sqlalchemy import text, func

app = Flask(__name__)
CORS(app)

# Database configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'freestyle_wm_new.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)


def _normalize_gender(athlete):
    raw = (athlete.gender or athlete.for_gender or '').strip().lower()
    if raw in {'m', 'male', 'man', 'men', 'herr', 'herren'}:
        return 'male'
    if raw in {'f', 'female', 'woman', 'women', 'dame', 'damen'}:
        return 'female'
    return None


def _dates_overlap(start_a, end_a, start_b, end_b):
    if not start_a or not end_a or not start_b or not end_b:
        return False
    return start_a <= end_b and start_b <= end_a


def _booking_error(reason_code, message, details=None):
    return jsonify({
        'error': 'VALIDATION_ERROR',
        'reasonCode': reason_code,
        'message': message,
        'details': details or {}
    }), 400


def _build_official_quota_usage_rows(nation_code=None, discipline=None, gender=None):
    rows = []
    athletes = Athlete.query
    if nation_code:
        athletes = athletes.filter(Athlete.nation_code == nation_code)
    if discipline:
        athletes = athletes.filter(Athlete.discipline == discipline)

    athletes = athletes.all()
    grouped = {}
    for athlete in athletes:
        athlete_gender = (athlete.gender or athlete.for_gender or '').strip()
        if not athlete_gender:
            continue
        g = athlete_gender.lower()
        if g.startswith('m'):
            normalized_gender = 'M'
        elif g.startswith('f'):
            normalized_gender = 'F'
        else:
            normalized_gender = athlete_gender

        if gender and normalized_gender.lower() != gender.lower():
            continue

        key = (athlete.nation_code, athlete.discipline or '', normalized_gender)
        grouped[key] = grouped.get(key, 0) + 1

    for (n_code, disc, g), count in grouped.items():
        quota = compute_official_quota(count)
        rows.append({
            'nationCode': n_code,
            'discipline': disc,
            'gender': g,
            'athletesEntered': count,
            'officialQuota': quota,
            'singleRoomsAllowed': quota,
            'assignedOfficials': 0,
            'singleRoomsUsed': 0,
        })

    return sorted(rows, key=lambda row: (row['nationCode'], row['discipline'], row['gender']))


def _get_grouped_room_bookings_response():
    bookings = RoomBooking.query.order_by(RoomBooking.hotel_id, RoomBooking.room_number, RoomBooking.id).all()
    return jsonify([b.to_dict() for b in bookings])

# Initialize database
with app.app_context():
    db.create_all()

    # Lightweight SQLite migration for added columns (no Alembic in this repo)
    def ensure_athlete_columns():
        cols = db.session.execute(text("PRAGMA table_info(athlete)")).fetchall()
        existing = {c[1] for c in cols}  # (cid, name, type, notnull, dflt, pk)

        needed = {
            "athletes_last_seen_at": "DATETIME",
            "roomlist_last_seen_at": "DATETIME",
            "roomlist_changed_at": "DATETIME",
            "roomlist_change_summary": "VARCHAR(500)",
        }

        for name, sql_type in needed.items():
            if name not in existing:
                db.session.execute(text(f"ALTER TABLE athlete ADD COLUMN {name} {sql_type}"))

        db.session.commit()

    ensure_athlete_columns()

    def backfill_room_bookings():
        existing_booking = RoomBooking.query.first()
        if existing_booking:
            return

        assignments = RoomAssignment.query.all()
        booking_map = {}

        for assignment in assignments:
            key = (
                assignment.hotel_id,
                assignment.room_type_id,
                assignment.room_number or '',
                assignment.check_in_date,
                assignment.check_out_date
            )
            booking = booking_map.get(key)
            if booking is None:
                booking = RoomBooking(
                    hotel_id=assignment.hotel_id,
                    room_type_id=assignment.room_type_id,
                    room_number=assignment.room_number,
                    check_in_date=assignment.check_in_date,
                    check_out_date=assignment.check_out_date
                )
                db.session.add(booking)
                db.session.flush()
                booking_map[key] = booking

            athlete_ids = {assignment.athlete_id}
            if assignment.shared_with_athlete_id:
                athlete_ids.add(assignment.shared_with_athlete_id)

            for athlete_id in athlete_ids:
                exists = RoomBookingOccupant.query.filter_by(
                    room_booking_id=booking.id,
                    athlete_id=athlete_id
                ).first()
                if not exists:
                    db.session.add(RoomBookingOccupant(room_booking_id=booking.id, athlete_id=athlete_id))

        db.session.commit()

    backfill_room_bookings()


# ============================================================================
# CSV IMPORT ENDPOINTS
# ============================================================================

@app.route('/api/import/excel', methods=['POST'])
def import_excel():
    """Import athletes and roomlist from Excel file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'error': 'Only Excel files (.xlsx, .xls) are supported'}), 400

    try:
        # Save temporarily
        import tempfile
        import os
        from excel_import import import_excel_file

        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        # Import
        result = import_excel_file(tmp_path, app)

        # Cleanup
        os.unlink(tmp_path)

        return jsonify({
            'success': True,
            'message': 'Data imported successfully',
            'counts': result
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def import_data_from_csv(csv_content):
    """Parse and import CSV data"""
    lines = csv_content.strip().split('\n')

    # Find section boundaries
    sections = {}
    current_section = None

    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        if line_lower.startswith('zimmertyp'):
            current_section = 'room_types'
            sections[current_section] = {'start': i, 'headers': lines[i].split()}
        elif line_lower.startswith('hotel'):
            current_section = 'hotels'
            sections[current_section] = {'start': i, 'headers': lines[i].split()}
        elif line_lower.startswith('disziplin'):
            current_section = 'events'
            sections[current_section] = {'start': i, 'headers': lines[i].split()}
        elif line_lower.startswith('athlets'):
            current_section = 'athletes'
            sections[current_section] = {'start': i, 'headers': lines[i].split()}
        elif line_lower.startswith('roomlist'):
            current_section = 'roomlist'
            sections[current_section] = {'start': i, 'headers': lines[i].split()}

    # Import Room Types
    if 'room_types' in sections:
        import_room_types(lines, sections['room_types'], sections.get('hotels', {}).get('start', len(lines)))

    # Import Hotels
    if 'hotels' in sections:
        import_hotels(lines, sections['hotels'], sections.get('events', {}).get('start', len(lines)))

    # Import Events
    if 'events' in sections:
        import_events(lines, sections['events'], sections.get('athletes', {}).get('start', len(lines)))

    # Import Athletes
    if 'athletes' in sections:
        import_athletes(lines, sections['athletes'], sections.get('roomlist', {}).get('start', len(lines)))

    db.session.commit()


def import_room_types(lines, section_info, end_line):
    """Import room types"""
    RoomType.query.delete()

    for i in range(section_info['start'] + 1, end_line):
        if not lines[i].strip():
            continue

        parts = lines[i].split()
        if len(parts) >= 4:
            try:
                # Format: Zimmertyp ZimmerTypID Zimmer MaxPersonen
                # Example: 1 DZ / DU 2
                zimmer_typ_id = int(parts[0])
                zimmer_name = ' '.join(parts[1:-1])
                max_persons = int(parts[-1])

                room_type = RoomType(
                    name=zimmer_name,
                    max_persons=max_persons
                )
                db.session.add(room_type)
            except (ValueError, IndexError):
                continue

    db.session.flush()


def import_hotels(lines, section_info, end_line):
    """Import hotels and room inventories"""
    hotels_dict = {}

    for i in range(section_info['start'] + 1, end_line):
        if not lines[i].strip():
            continue

        parts = lines[i].split()
        if len(parts) < 8:
            continue

        try:
            hotel_name = parts[0]
            zimmer_typ = parts[1]
            von = datetime.strptime(parts[2], '%d.%m.%Y').date()
            bis = datetime.strptime(parts[3], '%d.%m.%Y').date()
            zimmer_count = int(parts[4])
            ort = parts[5]
            region = parts[6]
            hp = parts[7].lower() == 'ja'
            sr = parts[8].lower() == 'ja' if len(parts) > 8 else False

            # Get or create hotel
            if hotel_name not in hotels_dict:
                hotel = Hotel.query.filter_by(name=hotel_name).first()
                if not hotel:
                    hotel = Hotel(
                        name=hotel_name,
                        location=ort,
                        region=region
                    )
                    db.session.add(hotel)
                    db.session.flush()
                hotels_dict[hotel_name] = hotel
            else:
                hotel = hotels_dict[hotel_name]

            # Find room type
            room_type = RoomType.query.filter_by(name=zimmer_typ).first()
            if not room_type:
                # Create if not exists
                max_persons = 2 if 'DZ' in zimmer_typ or 'APP' in zimmer_typ else 1
                room_type = RoomType(name=zimmer_typ, max_persons=max_persons)
                db.session.add(room_type)
                db.session.flush()

            # Create inventory
            inventory = HotelRoomInventory(
                hotel_id=hotel.id,
                room_type_id=room_type.id,
                available_from=von,
                available_until=bis,
                room_count=zimmer_count,
                has_half_board=hp,
                has_sr=sr
            )
            db.session.add(inventory)

        except (ValueError, IndexError) as e:
            print(f"Error importing hotel line {i}: {e}")
            continue

    db.session.flush()


def import_events(lines, section_info, end_line):
    """Import events and room demands"""
    events_dict = {}

    for i in range(section_info['start'] + 1, end_line):
        if not lines[i].strip():
            continue

        parts = lines[i].split()
        if len(parts) < 5:
            continue

        try:
            discipline = parts[0]
            zimmer_typ = parts[1]
            von = datetime.strptime(parts[2], '%d.%m.%Y').date()
            bis = datetime.strptime(parts[3], '%d.%m.%Y').date()
            zimmer_count = int(parts[4])

            # Get or create event
            event_key = f"{discipline}_{von}_{bis}"
            if event_key not in events_dict:
                event = Event(
                    discipline=discipline,
                    start_date=von,
                    end_date=bis
                )
                db.session.add(event)
                db.session.flush()
                events_dict[event_key] = event
            else:
                event = events_dict[event_key]

            # Find room type
            room_type = RoomType.query.filter_by(name=zimmer_typ).first()
            if room_type:
                demand = EventRoomDemand(
                    event_id=event.id,
                    room_type_id=room_type.id,
                    room_count=zimmer_count
                )
                db.session.add(demand)

        except (ValueError, IndexError) as e:
            print(f"Error importing event line {i}: {e}")
            continue

    db.session.flush()


def import_athletes(lines, section_info, end_line):
    """Import athletes"""
    Athlete.query.delete()

    for i in range(section_info['start'] + 1, end_line):
        if not lines[i].strip():
            continue

        parts = lines[i].split()
        if len(parts) < 6:
            continue

        try:
            athlete = Athlete(
                function=parts[0] if parts[0] else None,
                competitor_id=parts[1] if len(parts) > 1 else None,
                accred_id=parts[2] if len(parts) > 2 else None,
                fis_code=parts[3] if len(parts) > 3 else None,
                lastname=parts[4] if len(parts) > 4 else '',
                firstname=parts[5] if len(parts) > 5 else '',
                nation_code=parts[6] if len(parts) > 6 else '',
                for_gender=parts[7] if len(parts) > 7 else None,
                gender=parts[8] if len(parts) > 8 else None,
                phone=parts[9] if len(parts) > 9 else None,
                email=parts[10] if len(parts) > 10 else None
            )

            # Parse dates
            if len(parts) > 14 and parts[14]:
                try:
                    athlete.arrival_date = datetime.strptime(parts[14], '%d.%m.%Y').date()
                except:
                    pass

            if len(parts) > 21 and parts[21]:
                try:
                    athlete.departure_date = datetime.strptime(parts[21], '%d.%m.%Y').date()
                except:
                    pass

            if len(parts) > 28:
                athlete.room_type = parts[28]
            if len(parts) > 29:
                athlete.shared_with_name = parts[29]

            db.session.add(athlete)

        except (ValueError, IndexError) as e:
            print(f"Error importing athlete line {i}: {e}")
            continue

    db.session.flush()


# ============================================================================
# API ENDPOINTS
# ============================================================================

# Room Types - CRUD
@app.route('/api/room-types', methods=['GET'])
def get_room_types():
    room_types = RoomType.query.all()
    return jsonify([rt.to_dict() for rt in room_types])


@app.route('/api/room-types', methods=['POST'])
def create_room_type():
    data = request.json
    room_type = RoomType(
        name=data['name'],
        max_persons=data['maxPersons']
    )
    db.session.add(room_type)
    db.session.commit()
    return jsonify(room_type.to_dict()), 201


@app.route('/api/room-types/<int:room_type_id>', methods=['PUT'])
def update_room_type(room_type_id):
    room_type = RoomType.query.get_or_404(room_type_id)
    data = request.json

    if 'name' in data:
        room_type.name = data['name']
    if 'maxPersons' in data:
        room_type.max_persons = data['maxPersons']

    db.session.commit()
    return jsonify(room_type.to_dict())


@app.route('/api/room-types/<int:room_type_id>', methods=['DELETE'])
def delete_room_type(room_type_id):
    room_type = RoomType.query.get_or_404(room_type_id)
    db.session.delete(room_type)
    db.session.commit()
    return '', 204


# Hotels - CRUD
@app.route('/api/hotels', methods=['GET'])
def get_hotels():
    hotels = Hotel.query.all()
    return jsonify([h.to_dict() for h in hotels])


@app.route('/api/hotels/<int:hotel_id>', methods=['GET'])
def get_hotel(hotel_id):
    hotel = Hotel.query.get_or_404(hotel_id)
    return jsonify(hotel.to_dict())


@app.route('/api/hotels', methods=['POST'])
def create_hotel():
    data = request.json
    hotel = Hotel(
        name=data['name'],
        location=data.get('location'),
        region=data.get('region')
    )
    db.session.add(hotel)
    db.session.commit()
    return jsonify(hotel.to_dict()), 201


@app.route('/api/hotels/<int:hotel_id>', methods=['PUT'])
def update_hotel(hotel_id):
    hotel = Hotel.query.get_or_404(hotel_id)
    data = request.json

    if 'name' in data:
        hotel.name = data['name']
    if 'location' in data:
        hotel.location = data['location']
    if 'region' in data:
        hotel.region = data['region']

    db.session.commit()
    return jsonify(hotel.to_dict())


@app.route('/api/hotels/<int:hotel_id>', methods=['DELETE'])
def delete_hotel(hotel_id):
    hotel = Hotel.query.get_or_404(hotel_id)
    db.session.delete(hotel)
    db.session.commit()
    return '', 204


# Hotel Room Inventory
@app.route('/api/hotels/<int:hotel_id>/inventory', methods=['POST'])
def add_hotel_inventory(hotel_id):
    hotel = Hotel.query.get_or_404(hotel_id)
    data = request.json

    inventory = HotelRoomInventory(
        hotel_id=hotel_id,
        room_type_id=int(data['roomTypeId']),
        available_from=datetime.fromisoformat(data['availableFrom']).date(),
        available_until=datetime.fromisoformat(data['availableUntil']).date(),
        room_count=int(data['roomCount']),
        has_half_board=data.get('hasHalfBoard', False),
        has_sr=data.get('hasSR', False)
    )
    db.session.add(inventory)
    db.session.commit()
    return jsonify(inventory.to_dict()), 201


@app.route('/api/hotels/<int:hotel_id>/inventory/<int:inventory_id>', methods=['DELETE'])
def delete_hotel_inventory(hotel_id, inventory_id):
    inventory = HotelRoomInventory.query.filter_by(
        id=inventory_id,
        hotel_id=hotel_id
    ).first_or_404()
    db.session.delete(inventory)
    db.session.commit()
    return '', 204


# Events - CRUD
@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    return jsonify([e.to_dict() for e in events])


@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.json
    event = Event(
        discipline=data['discipline'],
        start_date=datetime.fromisoformat(data['startDate']).date(),
        end_date=datetime.fromisoformat(data['endDate']).date()
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@app.route('/api/events/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    event = Event.query.get_or_404(event_id)
    data = request.json

    if 'discipline' in data:
        event.discipline = data['discipline']
    if 'startDate' in data:
        event.start_date = datetime.fromisoformat(data['startDate']).date()
    if 'endDate' in data:
        event.end_date = datetime.fromisoformat(data['endDate']).date()

    db.session.commit()
    return jsonify(event.to_dict())


@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return '', 204


# Event Room Demand
@app.route('/api/events/<int:event_id>/demand', methods=['POST'])
def add_event_demand(event_id):
    event = Event.query.get_or_404(event_id)
    data = request.json

    demand = EventRoomDemand(
        event_id=event_id,
        room_type_id=int(data['roomTypeId']),
        room_count=int(data['roomCount'])
    )
    db.session.add(demand)
    db.session.commit()
    return jsonify(demand.to_dict()), 201


@app.route('/api/events/<int:event_id>/demand/<int:demand_id>', methods=['DELETE'])
def delete_event_demand(event_id, demand_id):
    demand = EventRoomDemand.query.filter_by(
        id=demand_id,
        event_id=event_id
    ).first_or_404()
    db.session.delete(demand)
    db.session.commit()
    return '', 204


# Athletes
@app.route('/api/athletes', methods=['GET'])
def get_athletes():
    athletes = Athlete.query.all()

    latest_athletes_run = ImportRun.query.filter_by(import_type='athletes').order_by(ImportRun.started_at.desc()).first()
    latest_roomlist_run = ImportRun.query.filter_by(import_type='roomlist').order_by(ImportRun.started_at.desc()).first()

    latest_athletes_at = latest_athletes_run.started_at if latest_athletes_run else None
    latest_roomlist_at = latest_roomlist_run.started_at if latest_roomlist_run else None

    result = []
    for a in athletes:
        data = a.to_dict()

        if latest_athletes_at:
            data['missingFromLatestAthletesImport'] = (
                (a.athletes_last_seen_at is None) or (a.athletes_last_seen_at < latest_athletes_at)
            )
        else:
            data['missingFromLatestAthletesImport'] = False

        had_roomlist_data = (
            a.roomlist_last_seen_at is not None
            or a.arrival_date is not None
            or a.departure_date is not None
            or bool(a.room_type)
            or bool(a.shared_with_name)
        )

        if latest_roomlist_at and had_roomlist_data:
            data['missingFromLatestRoomlistImport'] = (
                (a.roomlist_last_seen_at is None) or (a.roomlist_last_seen_at < latest_roomlist_at)
            )
        else:
            data['missingFromLatestRoomlistImport'] = False

        result.append(data)

    return jsonify(result)


@app.route('/api/athletes', methods=['POST'])
def create_athlete():
    data = request.json
    athlete = Athlete(
        lastname=data['lastname'],
        firstname=data['firstname'],
        nation_code=data['nationCode'],
        function=data.get('function')
    )
    db.session.add(athlete)
    db.session.commit()
    return jsonify(athlete.to_dict()), 201


# Room Assignments
@app.route('/api/room-bookings/grouped', methods=['GET'])
@app.route('/room-bookings/grouped', methods=['GET'])
@app.route('/api/room-assignments/grouped', methods=['GET'])
def get_grouped_room_bookings():
    return _get_grouped_room_bookings_response()


@app.route('/api/room-assignments', methods=['GET'])
def get_room_assignments():
    # Backward-compatible alias. Canonical read endpoint is /api/room-bookings/grouped.
    return _get_grouped_room_bookings_response()


@app.route('/api/fis/official-quotas', methods=['GET'])
@app.route('/fis/official-quotas', methods=['GET'])
@app.route('/api/official-quotas', methods=['GET'])
def get_official_quotas():
    nation_code = request.args.get('nationCode')
    discipline = request.args.get('discipline')
    gender = request.args.get('gender')
    rows = _build_official_quota_usage_rows(
        nation_code=nation_code,
        discipline=discipline,
        gender=gender
    )
    return jsonify(rows)


@app.route('/api/room-assignments', methods=['POST'])
def create_room_assignment():
    data = request.json
    athlete_ids = data.get('athleteIds', [])
    if not isinstance(athlete_ids, list) or len(athlete_ids) < 1 or len(athlete_ids) > 2:
        return jsonify({'error': 'athleteIds must include 1 or 2 athlete IDs'}), 400

    room_type = RoomType.query.get_or_404(int(data['roomTypeId']))
    if len(athlete_ids) > room_type.max_persons:
        return jsonify({'error': f'Room type max occupancy is {room_type.max_persons}'}), 400

    booking = RoomBooking(
        hotel_id=int(data['hotelId']),
        room_type_id=int(data['roomTypeId']),
        room_number=data.get('roomNumber'),
        check_in_date=datetime.fromisoformat(data['checkInDate']).date() if data.get('checkInDate') else None,
        check_out_date=datetime.fromisoformat(data['checkOutDate']).date() if data.get('checkOutDate') else None
    )
    db.session.add(booking)
    db.session.flush()

    unique_athlete_ids = []
    for athlete_id in athlete_ids:
        int_id = int(athlete_id)
        if int_id not in unique_athlete_ids:
            unique_athlete_ids.append(int_id)

    for athlete_id in unique_athlete_ids:
        db.session.add(RoomBookingOccupant(
            room_booking_id=booking.id,
            athlete_id=athlete_id
        ))

    db.session.commit()
    return jsonify(booking.to_dict()), 201


@app.route('/api/room-assignments/<int:assignment_id>', methods=['PUT'])
def update_room_assignment(assignment_id):
    booking = RoomBooking.query.get_or_404(assignment_id)
    data = request.json
    athlete_ids = data.get('athleteIds', [])
    if not isinstance(athlete_ids, list) or len(athlete_ids) < 1 or len(athlete_ids) > 2:
        return jsonify({'error': 'athleteIds must include 1 or 2 athlete IDs'}), 400

    room_type = RoomType.query.get_or_404(int(data['roomTypeId']))
    if len(athlete_ids) > room_type.max_persons:
        return jsonify({'error': f'Room type max occupancy is {room_type.max_persons}'}), 400

    booking.hotel_id = int(data['hotelId'])
    booking.room_type_id = int(data['roomTypeId'])
    booking.room_number = data.get('roomNumber')
    booking.check_in_date = datetime.fromisoformat(data['checkInDate']).date() if data.get('checkInDate') else None
    booking.check_out_date = datetime.fromisoformat(data['checkOutDate']).date() if data.get('checkOutDate') else None

    RoomBookingOccupant.query.filter_by(room_booking_id=booking.id).delete()
    unique_athlete_ids = []
    for athlete_id in athlete_ids:
        int_id = int(athlete_id)
        if int_id not in unique_athlete_ids:
            unique_athlete_ids.append(int_id)

    for athlete_id in unique_athlete_ids:
        db.session.add(RoomBookingOccupant(room_booking_id=booking.id, athlete_id=athlete_id))

    db.session.commit()
    return jsonify(booking.to_dict())


@app.route('/api/room-assignments/<int:assignment_id>', methods=['DELETE'])
def delete_room_assignment(assignment_id):
    booking = RoomBooking.query.get_or_404(assignment_id)
    db.session.delete(booking)
    db.session.commit()
    return '', 204




@app.route('/api/hotels/capacity-overview', methods=['GET'])
def get_hotels_capacity_overview():
    hotel_id = request.args.get('hotel_id', type=int)
    room_type_id = request.args.get('room_type_id', type=int)
    nation = request.args.get('nation')
    discipline = request.args.get('discipline')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    start_date = datetime.strptime(start_date, '%Y-%m-%d').date() if start_date else None
    end_date = datetime.strptime(end_date, '%Y-%m-%d').date() if end_date else None

    inventory_query = HotelRoomInventory.query.join(RoomType)
    if hotel_id:
        inventory_query = inventory_query.filter(HotelRoomInventory.hotel_id == hotel_id)
    if room_type_id:
        inventory_query = inventory_query.filter(HotelRoomInventory.room_type_id == room_type_id)
    if start_date and end_date:
        inventory_query = inventory_query.filter(
            HotelRoomInventory.available_from <= end_date,
            HotelRoomInventory.available_until >= start_date
        )

    assignment_query = RoomAssignment.query.join(Athlete).join(RoomType)
    if hotel_id:
        assignment_query = assignment_query.filter(RoomAssignment.hotel_id == hotel_id)
    if room_type_id:
        assignment_query = assignment_query.filter(RoomAssignment.room_type_id == room_type_id)
    if nation:
        assignment_query = assignment_query.filter(Athlete.nation_code == nation)
    if discipline:
        assignment_query = assignment_query.filter(Athlete.discipline == discipline)
    if start_date and end_date:
        assignment_query = assignment_query.filter(
            RoomAssignment.check_in_date <= end_date,
            RoomAssignment.check_out_date >= start_date
        )

    hotel_map = {}

    for inv in inventory_query.all():
        hid = inv.hotel_id
        if hid not in hotel_map:
            hotel_map[hid] = {
                'hotel': {'id': str(inv.hotel.id), 'name': inv.hotel.name, 'location': inv.hotel.location, 'region': inv.hotel.region},
                'roomTypes': {},
                'totals': {'inventoryRooms': 0, 'inventoryBeds': 0, 'occupiedRooms': 0, 'occupiedBeds': 0}
            }

        rt_id = str(inv.room_type.id)
        rt_entry = hotel_map[hid]['roomTypes'].setdefault(rt_id, {
            'roomType': inv.room_type.to_dict(),
            'inventoryRooms': 0,
            'inventoryBeds': 0,
            'occupiedBeds': 0
        })
        rt_entry['inventoryRooms'] += inv.room_count
        rt_entry['inventoryBeds'] += inv.room_count * inv.room_type.max_persons

    for a in assignment_query.all():
        hid = a.hotel_id
        if hid not in hotel_map:
            hotel_map[hid] = {
                'hotel': {'id': str(a.hotel.id), 'name': a.hotel.name, 'location': a.hotel.location, 'region': a.hotel.region},
                'roomTypes': {},
                'totals': {'inventoryRooms': 0, 'inventoryBeds': 0, 'occupiedRooms': 0, 'occupiedBeds': 0}
            }

        rt_id = str(a.room_type.id)
        rt_entry = hotel_map[hid]['roomTypes'].setdefault(rt_id, {
            'roomType': a.room_type.to_dict(),
            'inventoryRooms': 0,
            'inventoryBeds': 0,
            'occupiedBeds': 0
        })
        rt_entry['occupiedBeds'] += 1

    result = []
    for hdata in hotel_map.values():
        room_types = []
        for rt in hdata['roomTypes'].values():
            occ_rooms = (rt['occupiedBeds'] + rt['roomType']['maxPersons'] - 1) // rt['roomType']['maxPersons'] if rt['roomType']['maxPersons'] > 0 else 0
            rt['occupiedRooms'] = occ_rooms
            rt['remainingRooms'] = max(0, rt['inventoryRooms'] - occ_rooms)
            rt['remainingBeds'] = max(0, rt['inventoryBeds'] - rt['occupiedBeds'])
            room_types.append(rt)

            hdata['totals']['inventoryRooms'] += rt['inventoryRooms']
            hdata['totals']['inventoryBeds'] += rt['inventoryBeds']
            hdata['totals']['occupiedRooms'] += occ_rooms
            hdata['totals']['occupiedBeds'] += rt['occupiedBeds']

        hdata['totals']['remainingRooms'] = max(0, hdata['totals']['inventoryRooms'] - hdata['totals']['occupiedRooms'])
        hdata['totals']['remainingBeds'] = max(0, hdata['totals']['inventoryBeds'] - hdata['totals']['occupiedBeds'])
        hdata['roomTypes'] = room_types
        result.append(hdata)

    return jsonify(result)


@app.route('/api/hotels/<int:hotel_id>/reservations', methods=['GET'])
def get_hotel_reservations(hotel_id):
    room_type_id = request.args.get('room_type_id', type=int)
    nation = request.args.get('nation')
    discipline = request.args.get('discipline')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    start_date = datetime.strptime(start_date, '%Y-%m-%d').date() if start_date else None
    end_date = datetime.strptime(end_date, '%Y-%m-%d').date() if end_date else None

    q = RoomAssignment.query.join(Athlete).join(RoomType).filter(RoomAssignment.hotel_id == hotel_id)
    if room_type_id:
        q = q.filter(RoomAssignment.room_type_id == room_type_id)
    if nation:
        q = q.filter(Athlete.nation_code == nation)
    if discipline:
        q = q.filter(Athlete.discipline == discipline)
    if start_date and end_date:
        q = q.filter(RoomAssignment.check_in_date <= end_date, RoomAssignment.check_out_date >= start_date)

    assignments = q.order_by(RoomAssignment.check_in_date.asc().nullslast()).all()
    rows = []
    for a in assignments:
        rows.append({
            'assignmentId': str(a.id),
            'roomNumber': a.room_number,
            'roomType': a.room_type.to_dict(),
            'occupancy': 2 if a.shared_with else 1,
            'guestName': f"{a.athlete.firstname} {a.athlete.lastname}",
            'sharedWithName': f"{a.shared_with.firstname} {a.shared_with.lastname}" if a.shared_with else None,
            'nationCode': a.athlete.nation_code,
            'discipline': a.athlete.discipline,
            'checkInDate': a.check_in_date.isoformat() if a.check_in_date else None,
            'checkOutDate': a.check_out_date.isoformat() if a.check_out_date else None,
            'specialNotes': a.athlete.special_meal
        })
    return jsonify(rows)

# Statistics & Analytics
@app.route('/api/analytics/room-availability', methods=['GET'])
def get_room_availability():
    """Compare room demand vs availability - normalized to EZ/DZ"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
    if end_date:
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

    # Get all room types
    room_types = RoomType.query.all()

    # Accumulate beds for EZ and DZ
    ez_available = 0
    dz_available = 0
    ez_demand = 0
    dz_demand = 0

    for rt in room_types:
        # Calculate available rooms
        query = HotelRoomInventory.query.filter_by(room_type_id=rt.id)
        if start_date and end_date:
            query = query.filter(
                HotelRoomInventory.available_from <= end_date,
                HotelRoomInventory.available_until >= start_date
            )

        inventories = query.all()
        for inv in inventories:
            beds = inv.room_count * rt.max_persons
            if rt.max_persons == 1:
                ez_available += inv.room_count
            else:
                # DZ: beds / 2
                dz_available += beds // 2

        # Calculate demand
        demand_query = EventRoomDemand.query.filter_by(room_type_id=rt.id)
        if start_date and end_date:
            demand_query = demand_query.join(Event).filter(
                Event.start_date <= end_date,
                Event.end_date >= start_date
            )

        demands = demand_query.all()
        for demand in demands:
            beds = demand.room_count * rt.max_persons
            if rt.max_persons == 1:
                ez_demand += demand.room_count
            else:
                # DZ: beds / 2
                dz_demand += beds // 2

    # Return normalized EZ/DZ
    result = [
        {
            'roomType': {'id': 'ez', 'name': 'EZ / DU', 'maxPersons': 1},
            'available': ez_available,
            'demand': ez_demand,
            'difference': ez_available - ez_demand
        },
        {
            'roomType': {'id': 'dz', 'name': 'DZ / DU', 'maxPersons': 2},
            'available': dz_available,
            'demand': dz_demand,
            'difference': dz_available - dz_demand
        }
    ]

    return jsonify(result)


@app.route('/api/analytics/occupancy-timeline', methods=['GET'])
def get_occupancy_timeline():
    """Get room occupancy over time"""
    # Get all events with their demands
    events = Event.query.all()

    timeline = []
    for event in events:
        event_data = {
            'discipline': event.discipline,
            'startDate': event.start_date.isoformat(),
            'endDate': event.end_date.isoformat(),
            'demands': []
        }

        for demand in event.room_demands:
            event_data['demands'].append({
                'roomType': demand.room_type.name,
                'roomCount': demand.room_count,
                'maxPersons': demand.room_type.max_persons,
                'totalBeds': demand.room_count * demand.room_type.max_persons
            })

        timeline.append(event_data)

    return jsonify(timeline)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
