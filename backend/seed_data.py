from app import app, db, Hotel, RoomCategory, Athlete, Event
from datetime import datetime
import json


def seed_database():
    with app.app_context():
        db.drop_all()
        db.create_all()

        # ------------------------
        # HOTELS
        # ------------------------
        hotels_data = [
            {
                "name": "Alpenlodge",
                "location": "Brand",
                "region": "Bludenz",
                "single_rooms": 0,
                "double_rooms": 31,
                "categories": [
                    {"name": "DZ / DU", "count": 31, "type": "double"}
                ]
            },
            {
                "name": "Cube Alpine Stay",
                "location": "Bürs",
                "region": "Bludenz",
                "single_rooms": 0,
                "double_rooms": 17,
                "categories": [
                    {"name": "DZ / DU", "count": 17, "type": "double"},
                    {"name": "APP: 3 DZ + 2 DU", "count": 4, "type": "apartment"},
                    {"name": "APP: 2 DZ + 2 DU", "count": 6, "type": "apartment"}
                ]
            },
            {
                "name": "Hotel Daneu",
                "location": "Nüziders",
                "region": "Bludenz",
                "single_rooms": 5,
                "double_rooms": 9,
                "categories": [
                    {"name": "DZ / DU", "count": 9, "type": "double"},
                    {"name": "EZ / DU", "count": 5, "type": "single"}
                ]
            },
            {
                "name": "Hotel Sonne",
                "location": "Brand",
                "region": "Bludenz",
                "single_rooms": 3,
                "double_rooms": 11,
                "categories": [
                    {"name": "DZ / DU", "count": 11, "type": "double"},
                    {"name": "EZ / DU", "count": 3, "type": "single"}
                ]
            }
        ]

        for h in hotels_data:
            hotel = Hotel(
                name=h["name"],
                location=h["location"],
                region=h["region"],
                single_rooms=h["single_rooms"],
                double_rooms=h["double_rooms"]
            )
            db.session.add(hotel)
            db.session.flush()

            for cat in h["categories"]:
                db.session.add(RoomCategory(
                    hotel_id=hotel.id,
                    name=cat["name"],
                    count=cat["count"],
                    room_type=cat["type"],
                    amenities=json.dumps([])
                ))

        db.session.commit()

        # ------------------------
        # ATHLETES
        # ------------------------
        athletes_data = [
            ("Jakob Dusek", "AUT", "Snowboard Cross", 1, "double"),
            ("Lukas Pachner", "AUT", "Snowboard Cross", 1, "double"),
            ("Alessandro Haemmerle", "AUT", "Snowboard Cross", 2, "single"),
            ("Elias Leitner", "AUT", "Snowboard Cross", 2, "double"),
            ("David Pickl", "AUT", "Snowboard Cross", 2, "double"),
            ("Tanja Kobald", "AUT", "Snowboard Cross", 3, "double"),
            ("Anna Galler", "AUT", "Snowboard Cross", 3, "double"),
            ("Pia Zerkhold", "AUT", "Snowboard Cross", 4, "single"),
        ]

        for name, nation, discipline, hotel_id, room_type in athletes_data:
            db.session.add(Athlete(
                name=name,
                nation=nation,
                discipline=discipline,
                hotel_id=hotel_id,
                room_type=room_type
            ))

        db.session.commit()

        # ------------------------
        # EVENTS (from your quota table)
        # ------------------------
        events_data = [
            ("Big Air", "Big Air", "2027-03-07", "2027-03-14", 141),
            ("Moguls", "Moguls", "2027-03-12", "2027-03-20", 57),
            ("Parallel", "Parallel", "2027-03-04", "2027-03-11", 57),
            ("Slopestyle", "Slopestyle", "2027-03-12", "2027-03-21", 142),
            ("Snowboard Cross", "Snowboard Cross", "2027-03-16", "2027-03-22", 60),
        ]

        for name, discipline, start, end, quota in events_data:
            db.session.add(Event(
                name=name,
                discipline=discipline,
                start_date=datetime.strptime(start, "%Y-%m-%d").date(),
                end_date=datetime.strptime(end, "%Y-%m-%d").date(),
                target_quota=quota
            ))

        db.session.commit()

        print("✅ Seed data loaded successfully!")


if __name__ == "__main__":
    seed_database()