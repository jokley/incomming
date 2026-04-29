export interface RoomType {
  id: string;
  name: string;
  maxPersons: number;
}

export interface HotelRoomInventory {
  id: string;
  hotelId: string;
  roomType: RoomType;
  availableFrom: string; // ISO date
  availableUntil: string; // ISO date
  roomCount: number;
  hasHalfBoard?: boolean;
  hasSR?: boolean;
}

export interface Hotel {
  id: string;
  name: string;
  location?: string;
  region?: string;
  roomInventories?: HotelRoomInventory[];
}

export interface EventRoomDemand {
  id: string;
  eventId: string;
  roomType: RoomType;
  roomCount: number;
}

export interface Event {
  id: string;
  discipline: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  roomDemands?: EventRoomDemand[];
}

export interface Athlete {
  id: string;
  function?: string;
  competitorId?: string;
  accredId?: string;
  fisCode?: string;
  lastname: string;
  firstname: string;
  nationCode: string;
  discipline?: string;
  gender?: string;
  forGender?: string;
  phone?: string;
  email?: string;

  arrivalDate?: string | null; // ISO date
  departureDate?: string | null; // ISO date

  roomType?: string | null;
  sharedWithName?: string | null;
  lateCheckout?: boolean;
  firstMeal?: string | null;
  lastMeal?: string | null;
  specialMeal?: string | null;

  athletesLastSeenAt?: string | null; // ISO datetime
  roomlistLastSeenAt?: string | null; // ISO datetime
  roomlistChangedAt?: string | null; // ISO datetime
  roomlistChangeSummary?: string | null;

  missingFromLatestAthletesImport?: boolean;
  missingFromLatestRoomlistImport?: boolean;
}

export interface RoomAssignment {
  id: string;
  athlete: Athlete;
  hotel: { id: string; name: string };
  roomType: RoomType;
  roomNumber?: string | null;
  checkInDate?: string | null; // ISO date
  checkOutDate?: string | null; // ISO date
  sharedWith?: Athlete | null;
}

export interface RoomAvailability {
  roomType: RoomType;
  available: number;
  demand: number;
  difference: number;
}



export interface HotelCapacityOverview {
  hotel: { id: string; name: string; location?: string; region?: string };
  roomTypes: {
    roomType: RoomType;
    inventoryRooms: number;
    inventoryBeds: number;
    occupiedBeds: number;
    occupiedRooms: number;
    remainingRooms: number;
    remainingBeds: number;
  }[];
  totals: {
    inventoryRooms: number;
    inventoryBeds: number;
    occupiedRooms: number;
    occupiedBeds: number;
    remainingRooms: number;
    remainingBeds: number;
  };
}

export interface HotelReservationRow {
  assignmentId: string;
  roomNumber?: string | null;
  roomType: RoomType;
  occupancy: number;
  guestName: string;
  sharedWithName?: string | null;
  nationCode?: string;
  discipline?: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  specialNotes?: string | null;
}
