export interface Athlete {
  id: string;
  name: string;
  nation: string;
  discipline: string;
  hotelId?: string;
  roomType?: 'single' | 'double';
}

export interface Hotel {
  id: string;
  name: string;
  location?: string;
  region?: string;
  singleRooms: number;
  doubleRooms: number;
  assignedSingle: number;
  assignedDouble: number;
  roomCategories?: RoomCategory[];
}

export interface RoomCategory {
  id: string;
  name: string;
  count: number;
  type: 'single' | 'double';
  amenities: string[];
}

export interface Event {
  id: string;
  name: string;
  discipline: string;
  startDate: string;
  endDate: string;
  targetQuota: number;
  currentQuota: number;
}

export interface Assignment {
  athleteId: string;
  hotelId: string;
  roomType: 'single' | 'double';
  timestamp: Date;
}
