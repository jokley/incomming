from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class RoomType(db.Model):
    """Zimmertyp - definiert MaxPersonen pro Zimmertyp"""
    __tablename__ = 'room_type'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # z.B. "DZ / DU"
    max_persons = db.Column(db.Integer, nullable=False)  # z.B. 2
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'maxPersons': self.max_persons
        }


class Hotel(db.Model):
    """Hotel mit Zimmerkontingenten für bestimmte Zeiträume"""
    __tablename__ = 'hotel'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100))  # Ort
    region = db.Column(db.String(100))  # Region
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    room_inventories = db.relationship('HotelRoomInventory', backref='hotel', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'location': self.location,
            'region': self.region,
            'roomInventories': [inv.to_dict() for inv in self.room_inventories]
        }


class HotelRoomInventory(db.Model):
    """Verfügbare Zimmer pro Hotel, Zimmertyp und Zeitraum"""
    __tablename__ = 'hotel_room_inventory'

    id = db.Column(db.Integer, primary_key=True)
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotel.id'), nullable=False)
    room_type_id = db.Column(db.Integer, db.ForeignKey('room_type.id'), nullable=False)
    available_from = db.Column(db.Date, nullable=False)
    available_until = db.Column(db.Date, nullable=False)
    room_count = db.Column(db.Integer, nullable=False)  # Anzahl Zimmer
    has_half_board = db.Column(db.Boolean, default=False)  # HP
    has_sr = db.Column(db.Boolean, default=False)  # SR
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    room_type = db.relationship('RoomType', backref='hotel_inventories')

    def to_dict(self):
        return {
            'id': str(self.id),
            'hotelId': str(self.hotel_id),
            'roomType': self.room_type.to_dict(),
            'availableFrom': self.available_from.isoformat(),
            'availableUntil': self.available_until.isoformat(),
            'roomCount': self.room_count,
            'hasHalfBoard': self.has_half_board,
            'hasSR': self.has_sr
        }


class Event(db.Model):
    """Events/Disziplinen mit Bedarf an Zimmern"""
    __tablename__ = 'event'

    id = db.Column(db.Integer, primary_key=True)
    discipline = db.Column(db.String(100), nullable=False)  # Big Air, Moguls, etc.
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    room_demands = db.relationship('EventRoomDemand', backref='event', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': str(self.id),
            'discipline': self.discipline,
            'startDate': self.start_date.isoformat(),
            'endDate': self.end_date.isoformat(),
            'roomDemands': [demand.to_dict() for demand in self.room_demands]
        }


class EventRoomDemand(db.Model):
    """Bedarf an Zimmern pro Event und Zimmertyp"""
    __tablename__ = 'event_room_demand'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    room_type_id = db.Column(db.Integer, db.ForeignKey('room_type.id'), nullable=False)
    room_count = db.Column(db.Integer, nullable=False)  # Benötigte Zimmer
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    room_type = db.relationship('RoomType', backref='event_demands')

    def to_dict(self):
        return {
            'id': str(self.id),
            'eventId': str(self.event_id),
            'roomType': self.room_type.to_dict(),
            'roomCount': self.room_count
        }


class Athlete(db.Model):
    """Athleten und Staff"""
    __tablename__ = 'athlete'

    id = db.Column(db.Integer, primary_key=True)
    function = db.Column(db.String(50))  # Athlete, NSA Coach, etc.
    competitor_id = db.Column(db.String(50))
    accred_id = db.Column(db.String(50))
    fis_code = db.Column(db.String(50))
    lastname = db.Column(db.String(100), nullable=False)
    firstname = db.Column(db.String(100), nullable=False)
    nation_code = db.Column(db.String(10), nullable=False)
    gender = db.Column(db.String(10))
    for_gender = db.Column(db.String(10))  # Competition gender
    phone = db.Column(db.String(50))
    email = db.Column(db.String(100))

    # Event participation
    wc_sbx_w = db.Column(db.Boolean, default=False)
    wc_sbx_m = db.Column(db.Boolean, default=False)

    # Travel
    arrival_date = db.Column(db.Date)
    arrival_time = db.Column(db.String(20))
    arrival_by = db.Column(db.String(50))
    arrival_airport = db.Column(db.String(50))
    arrival_flight_no = db.Column(db.String(50))
    arrival_need_transportation = db.Column(db.Boolean, default=False)

    departure_date = db.Column(db.Date)
    departure_time = db.Column(db.String(20))
    departure_by = db.Column(db.String(50))
    departure_airport = db.Column(db.String(50))
    departure_flight_no = db.Column(db.String(50))
    departure_need_transportation = db.Column(db.Boolean, default=False)

    # Accommodation
    room_type = db.Column(db.String(50))  # Single, Double shared, etc.
    shared_with_name = db.Column(db.String(200))
    late_checkout = db.Column(db.Boolean, default=False)

    # Meals
    first_meal = db.Column(db.String(50))
    last_meal = db.Column(db.String(50))
    special_meal = db.Column(db.String(200))

    # Additional
    stance = db.Column(db.String(10))  # R/L for snowboard
    tv_picture_status = db.Column(db.String(100))
    tv_picture_date = db.Column(db.Date)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': str(self.id),
            'function': self.function,
            'competitorId': self.competitor_id,
            'accredId': self.accred_id,
            'fisCode': self.fis_code,
            'lastname': self.lastname,
            'firstname': self.firstname,
            'nationCode': self.nation_code,
            'gender': self.gender,
            'forGender': self.for_gender,
            'phone': self.phone,
            'email': self.email,
            'arrivalDate': self.arrival_date.isoformat() if self.arrival_date else None,
            'departureDate': self.departure_date.isoformat() if self.departure_date else None,
            'roomType': self.room_type,
            'sharedWithName': self.shared_with_name,
            'lateCheckout': self.late_checkout,
            'firstMeal': self.first_meal,
            'lastMeal': self.last_meal,
            'specialMeal': self.special_meal
        }


class RoomAssignment(db.Model):
    """Zimmerzuteilungen - wer mit wem"""
    __tablename__ = 'room_assignment'

    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey('athlete.id'), nullable=False)
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotel.id'), nullable=False)
    room_type_id = db.Column(db.Integer, db.ForeignKey('room_type.id'), nullable=False)
    room_number = db.Column(db.String(20))
    check_in_date = db.Column(db.Date)
    check_out_date = db.Column(db.Date)
    shared_with_athlete_id = db.Column(db.Integer, db.ForeignKey('athlete.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    athlete = db.relationship('Athlete', foreign_keys=[athlete_id], backref='room_assignments')
    shared_with = db.relationship('Athlete', foreign_keys=[shared_with_athlete_id])
    hotel = db.relationship('Hotel', backref='room_assignments')
    room_type = db.relationship('RoomType', backref='room_assignments')

    def to_dict(self):
        return {
            'id': str(self.id),
            'athlete': self.athlete.to_dict(),
            'hotel': {'id': str(self.hotel_id), 'name': self.hotel.name},
            'roomType': self.room_type.to_dict(),
            'roomNumber': self.room_number,
            'checkInDate': self.check_in_date.isoformat() if self.check_in_date else None,
            'checkOutDate': self.check_out_date.isoformat() if self.check_out_date else None,
            'sharedWith': self.shared_with.to_dict() if self.shared_with else None
        }
