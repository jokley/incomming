from app import app, db, Athlete, Hotel, Event, RoomCategory
from datetime import datetime, timedelta
import json

def seed_database():
    with app.app_context():
        # Clear existing data
        db.drop_all()
        db.create_all()

        # Create hotels with room details
        hotels_data = [
            {
                'name': 'Grand Hotel Alpine',
                'location': 'Innsbruck',
                'region': 'Tirol',
                'single_rooms': 20,
                'double_rooms': 25,
                'categories': [
                    {'name': '1x DZ + DU', 'count': 15, 'type': 'double', 'amenities': ['Dusche', 'TV', 'WLAN']},
                    {'name': '2x DZ + 2x DU', 'count': 10, 'type': 'double', 'amenities': ['2 Duschen', 'TV', 'WLAN', 'Balkon']},
                    {'name': '1x EZ + DU', 'count': 20, 'type': 'single', 'amenities': ['Dusche', 'TV', 'WLAN']}
                ]
            },
            {
                'name': 'Mountain Resort',
                'location': 'St. Anton',
                'region': 'Tirol',
                'single_rooms': 15,
                'double_rooms': 20,
                'categories': [
                    {'name': '1x DZ + DU', 'count': 20, 'type': 'double', 'amenities': ['Dusche', 'TV']},
                    {'name': '1x EZ + DU', 'count': 15, 'type': 'single', 'amenities': ['Dusche', 'TV']}
                ]
            },
            {
                'name': 'Snow Peak Lodge',
                'location': 'Sölden',
                'region': 'Tirol',
                'single_rooms': 12,
                'double_rooms': 18,
                'categories': [
                    {'name': '1x DZ + DU', 'count': 18, 'type': 'double', 'amenities': ['Dusche', 'TV', 'WLAN']},
                    {'name': '1x EZ + DU', 'count': 12, 'type': 'single', 'amenities': ['Dusche', 'TV']}
                ]
            },
            {
                'name': 'Vista Hotel',
                'location': 'Kitzbühel',
                'region': 'Tirol',
                'single_rooms': 10,
                'double_rooms': 15,
                'categories': [
                    {'name': '1x DZ + DU', 'count': 15, 'type': 'double', 'amenities': ['Dusche', 'Safe']},
                    {'name': '1x EZ + DU', 'count': 10, 'type': 'single', 'amenities': ['Dusche']}
                ]
            }
        ]

        for hotel_data in hotels_data:
            hotel = Hotel(
                name=hotel_data['name'],
                location=hotel_data['location'],
                region=hotel_data['region'],
                single_rooms=hotel_data['single_rooms'],
                double_rooms=hotel_data['double_rooms']
            )
            db.session.add(hotel)
            db.session.flush()  # Get hotel.id

            # Add room categories
            for cat in hotel_data['categories']:
                room_cat = RoomCategory(
                    hotel_id=hotel.id,
                    name=cat['name'],
                    count=cat['count'],
                    room_type=cat['type'],
                    amenities=json.dumps(cat['amenities'])
                )
                db.session.add(room_cat)

        db.session.commit()

        # Create athletes with room types
        athletes_data = [
            ('Anna Schmidt', 'Deutschland', 'Moguls', 1, 'single'),
            ('John Smith', 'USA', 'Big Air', 1, 'double'),
            ('Sophie Martin', 'Frankreich', 'Slopestyle', 2, 'double'),
            ('Yuki Tanaka', 'Japan', 'Halfpipe', 2, 'double'),
            ('Lars Hansen', 'Norwegen', 'Moguls', 3, 'single'),
            ('Maria Garcia', 'Spanien', 'Big Air', None, None),
            ('Pietro Rossi', 'Italien', 'Slopestyle', None, None),
            ('Emma Johnson', 'Kanada', 'Halfpipe', 3, 'double'),
            ('Max Müller', 'Deutschland', 'Big Air', 1, 'double'),
            ('Lisa Andersson', 'Schweden', 'Moguls', None, None),
        ]

        for name, nation, discipline, hotel_id, room_type in athletes_data:
            athlete = Athlete(
                name=name,
                nation=nation,
                discipline=discipline,
                hotel_id=hotel_id,
                room_type=room_type
            )
            db.session.add(athlete)

        db.session.commit()

        # Create events
        base_date = datetime(2026, 2, 1)
        events_data = [
            ('Big Air Qualifikation', 'Big Air', base_date, base_date + timedelta(days=2), 50),
            ('Big Air Finale', 'Big Air', base_date + timedelta(days=3), base_date + timedelta(days=4), 30),
            ('Moguls Qualifikation', 'Moguls', base_date + timedelta(days=5), base_date + timedelta(days=6), 60),
            ('Moguls Finale', 'Moguls', base_date + timedelta(days=7), base_date + timedelta(days=8), 40),
            ('Slopestyle Training', 'Slopestyle', base_date + timedelta(days=9), base_date + timedelta(days=10), 70),
            ('Slopestyle Wettkampf', 'Slopestyle', base_date + timedelta(days=11), base_date + timedelta(days=13), 50),
            ('Halfpipe Qualifikation', 'Halfpipe', base_date + timedelta(days=14), base_date + timedelta(days=15), 55),
            ('Halfpipe Finale', 'Halfpipe', base_date + timedelta(days=16), base_date + timedelta(days=17), 35),
        ]

        for name, discipline, start, end, quota in events_data:
            event = Event(
                name=name,
                discipline=discipline,
                start_date=start.date(),
                end_date=end.date(),
                target_quota=quota
            )
            db.session.add(event)

        db.session.commit()
        print('✅ Datenbank erfolgreich initialisiert!')

if __name__ == '__main__':
    seed_database()
