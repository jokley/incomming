from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Database configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'freestyle_wm.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class Athlete(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    nation = db.Column(db.String(50), nullable=False)
    discipline = db.Column(db.String(50), nullable=False)
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotel.id'), nullable=True)
    room_type = db.Column(db.String(10), nullable=True)  # 'single' or 'double'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'nation': self.nation,
            'discipline': self.discipline,
            'hotelId': str(self.hotel_id) if self.hotel_id else None,
            'roomType': self.room_type
        }

class Hotel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100), nullable=True)
    region = db.Column(db.String(100), nullable=True)
    single_rooms = db.Column(db.Integer, nullable=False, default=0)
    double_rooms = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    athletes = db.relationship('Athlete', backref='hotel', lazy=True)
    room_categories = db.relationship('RoomCategory', backref='hotel', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        assigned_single = len([a for a in self.athletes if a.room_type == 'single'])
        assigned_double = len([a for a in self.athletes if a.room_type == 'double'])

        return {
            'id': str(self.id),
            'name': self.name,
            'location': self.location,
            'region': self.region,
            'singleRooms': self.single_rooms,
            'doubleRooms': self.double_rooms,
            'assignedSingle': assigned_single,
            'assignedDouble': assigned_double,
            'roomCategories': [rc.to_dict() for rc in self.room_categories]
        }

class RoomCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotel.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    count = db.Column(db.Integer, nullable=False)
    room_type = db.Column(db.String(10), nullable=False)  # 'single' or 'double'
    amenities = db.Column(db.Text, nullable=True)  # JSON string of amenities

    def to_dict(self):
        import json
        return {
            'id': str(self.id),
            'name': self.name,
            'count': self.count,
            'type': self.room_type,
            'amenities': json.loads(self.amenities) if self.amenities else []
        }

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    discipline = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    target_quota = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        # Calculate current quota from athletes
        current_quota = Athlete.query.filter_by(discipline=self.discipline).count()

        return {
            'id': str(self.id),
            'name': self.name,
            'discipline': self.discipline,
            'startDate': self.start_date.isoformat(),
            'endDate': self.end_date.isoformat(),
            'targetQuota': self.target_quota,
            'currentQuota': current_quota
        }

# Initialize database
with app.app_context():
    db.create_all()

# Routes - Athletes
@app.route('/api/athletes', methods=['GET'])
def get_athletes():
    athletes = Athlete.query.all()
    return jsonify([athlete.to_dict() for athlete in athletes])

@app.route('/api/athletes', methods=['POST'])
def create_athlete():
    data = request.json
    athlete = Athlete(
        name=data['name'],
        nation=data['nation'],
        discipline=data['discipline']
    )
    db.session.add(athlete)
    db.session.commit()
    return jsonify(athlete.to_dict()), 201

@app.route('/api/athletes/<int:athlete_id>', methods=['PUT'])
def update_athlete(athlete_id):
    athlete = Athlete.query.get_or_404(athlete_id)
    data = request.json

    if 'name' in data:
        athlete.name = data['name']
    if 'nation' in data:
        athlete.nation = data['nation']
    if 'discipline' in data:
        athlete.discipline = data['discipline']
    if 'hotelId' in data:
        athlete.hotel_id = int(data['hotelId']) if data['hotelId'] else None

    db.session.commit()
    return jsonify(athlete.to_dict())

@app.route('/api/athletes/<int:athlete_id>', methods=['DELETE'])
def delete_athlete(athlete_id):
    athlete = Athlete.query.get_or_404(athlete_id)
    db.session.delete(athlete)
    db.session.commit()
    return '', 204

# Routes - Hotels
@app.route('/api/hotels', methods=['GET'])
def get_hotels():
    hotels = Hotel.query.all()
    return jsonify([hotel.to_dict() for hotel in hotels])

@app.route('/api/hotels', methods=['POST'])
def create_hotel():
    data = request.json
    hotel = Hotel(
        name=data['name'],
        location=data.get('location'),
        region=data.get('region'),
        single_rooms=data.get('singleRooms', 0),
        double_rooms=data.get('doubleRooms', 0)
    )
    db.session.add(hotel)
    db.session.commit()

    # Add room categories if provided
    if 'roomCategories' in data:
        import json
        for cat in data['roomCategories']:
            room_cat = RoomCategory(
                hotel_id=hotel.id,
                name=cat['name'],
                count=cat['count'],
                room_type=cat['type'],
                amenities=json.dumps(cat.get('amenities', []))
            )
            db.session.add(room_cat)
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
    if 'singleRooms' in data:
        hotel.single_rooms = data['singleRooms']
    if 'doubleRooms' in data:
        hotel.double_rooms = data['doubleRooms']

    db.session.commit()
    return jsonify(hotel.to_dict())

@app.route('/api/hotels/<int:hotel_id>', methods=['DELETE'])
def delete_hotel(hotel_id):
    hotel = Hotel.query.get_or_404(hotel_id)
    db.session.delete(hotel)
    db.session.commit()
    return '', 204

# Routes - Assignments
@app.route('/api/assignments', methods=['POST'])
def assign_athlete():
    data = request.json
    athlete_id = int(data['athleteId'])
    hotel_id = int(data['hotelId'])
    room_type = data.get('roomType', 'double')

    athlete = Athlete.query.get_or_404(athlete_id)
    hotel = Hotel.query.get_or_404(hotel_id)

    # Check capacity based on room type
    assigned_single = len([a for a in hotel.athletes if a.room_type == 'single'])
    assigned_double = len([a for a in hotel.athletes if a.room_type == 'double'])

    if room_type == 'single':
        if assigned_single >= hotel.single_rooms:
            return jsonify({'error': 'Keine Einzelzimmer verfügbar'}), 400
    else:
        # Double room can hold 2 people
        if assigned_double >= hotel.double_rooms * 2:
            return jsonify({'error': 'Keine Doppelzimmer verfügbar'}), 400

    athlete.hotel_id = hotel_id
    athlete.room_type = room_type
    db.session.commit()

    return jsonify({'success': True}), 200

@app.route('/api/assignments/<int:athlete_id>', methods=['DELETE'])
def remove_assignment(athlete_id):
    athlete = Athlete.query.get_or_404(athlete_id)
    athlete.hotel_id = None
    athlete.room_type = None
    db.session.commit()
    return '', 204

# Routes - Events
@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    return jsonify([event.to_dict() for event in events])

@app.route('/api/events', methods=['POST'])
def create_event():
    from datetime import datetime as dt
    data = request.json
    event = Event(
        name=data['name'],
        discipline=data['discipline'],
        start_date=dt.fromisoformat(data['startDate']).date(),
        end_date=dt.fromisoformat(data['endDate']).date(),
        target_quota=data['targetQuota']
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201

@app.route('/api/events/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    from datetime import datetime as dt
    event = Event.query.get_or_404(event_id)
    data = request.json

    if 'name' in data:
        event.name = data['name']
    if 'discipline' in data:
        event.discipline = data['discipline']
    if 'startDate' in data:
        event.start_date = dt.fromisoformat(data['startDate']).date()
    if 'endDate' in data:
        event.end_date = dt.fromisoformat(data['endDate']).date()
    if 'targetQuota' in data:
        event.target_quota = data['targetQuota']

    db.session.commit()
    return jsonify(event.to_dict())

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return '', 204

# Routes - Statistics
@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    athletes = Athlete.query.all()
    hotels = Hotel.query.all()

    by_nation = {}
    by_discipline = {}
    assigned_count = 0

    for athlete in athletes:
        if athlete.hotel_id:
            assigned_count += 1

        by_nation[athlete.nation] = by_nation.get(athlete.nation, 0) + 1
        by_discipline[athlete.discipline] = by_discipline.get(athlete.discipline, 0) + 1

    total_single_rooms = sum(h.single_rooms for h in hotels)
    total_double_rooms = sum(h.double_rooms for h in hotels)
    assigned_single = sum(len([a for a in h.athletes if a.room_type == 'single']) for h in hotels)
    assigned_double = sum(len([a for a in h.athletes if a.room_type == 'double']) for h in hotels)

    return jsonify({
        'totalAthletes': len(athletes),
        'assignedAthletes': assigned_count,
        'totalHotels': len(hotels),
        'totalSingleRooms': total_single_rooms,
        'totalDoubleRooms': total_double_rooms,
        'assignedSingleRooms': assigned_single,
        'assignedDoubleRooms': assigned_double,
        'totalCapacity': total_single_rooms + (total_double_rooms * 2),
        'byNation': by_nation,
        'byDiscipline': by_discipline
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
