from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, RoomType, Hotel, HotelRoomInventory, Event, EventRoomDemand, Athlete, RoomAssignment
from datetime import datetime
import os
import csv
import io

app = Flask(__name__)
CORS(app)

# Database configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'freestyle_wm_new.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Initialize database
with app.app_context():
    db.create_all()


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
    return jsonify([a.to_dict() for a in athletes])


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
@app.route('/api/room-assignments', methods=['GET'])
def get_room_assignments():
    assignments = RoomAssignment.query.all()
    return jsonify([a.to_dict() for a in assignments])


@app.route('/api/room-assignments', methods=['POST'])
def create_room_assignment():
    data = request.json
    assignment = RoomAssignment(
        athlete_id=int(data['athleteId']),
        hotel_id=int(data['hotelId']),
        room_type_id=int(data['roomTypeId']),
        check_in_date=datetime.fromisoformat(data['checkInDate']).date() if data.get('checkInDate') else None,
        check_out_date=datetime.fromisoformat(data['checkOutDate']).date() if data.get('checkOutDate') else None,
        shared_with_athlete_id=int(data['sharedWithAthleteId']) if data.get('sharedWithAthleteId') else None
    )
    db.session.add(assignment)
    db.session.commit()
    return jsonify(assignment.to_dict()), 201


# Statistics & Analytics
@app.route('/api/analytics/room-availability', methods=['GET'])
def get_room_availability():
    """Compare room demand vs availability"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
    if end_date:
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

    # Get all room types
    room_types = RoomType.query.all()

    result = []
    for rt in room_types:
        # Calculate total available rooms
        query = HotelRoomInventory.query.filter_by(room_type_id=rt.id)
        if start_date and end_date:
            query = query.filter(
                HotelRoomInventory.available_from <= end_date,
                HotelRoomInventory.available_until >= start_date
            )

        total_available = sum([inv.room_count for inv in query.all()])

        # Calculate demand
        demand_query = EventRoomDemand.query.filter_by(room_type_id=rt.id)
        if start_date and end_date:
            demand_query = demand_query.join(Event).filter(
                Event.start_date <= end_date,
                Event.end_date >= start_date
            )

        total_demand = sum([d.room_count for d in demand_query.all()])

        result.append({
            'roomType': rt.to_dict(),
            'available': total_available,
            'demand': total_demand,
            'difference': total_available - total_demand
        })

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
