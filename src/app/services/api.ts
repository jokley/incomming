import {
  RoomType,
  Hotel,
  HotelRoomInventory,
  Event,
  EventRoomDemand,
  Athlete,
  RoomAssignment,
  RoomAvailability
} from '../types';
import { OfficialQuotaUsage } from './fisRules';

import {
  mockRoomTypes as initialRoomTypes,
  mockHotels as initialHotels,
  mockEvents as initialEvents,
  mockAthletes as initialAthletes,
  mockRoomAvailability
} from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// USE MOCK DATA - Set to true for offline testing
const USE_MOCK_DATA = false;

// Create mutable copies of mock data that persist within the session
let mockRoomTypes = [...initialRoomTypes];
let mockHotels = initialHotels.map(h => ({
  ...h,
  roomInventories: h.roomInventories ? [...h.roomInventories] : []
}));
let mockEvents = initialEvents.map(e => ({
  ...e,
  roomDemands: e.roomDemands ? [...e.roomDemands] : []
}));
let mockAthletes = [...initialAthletes];
let mockRoomAssignments: RoomAssignment[] = [];

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();

    if (!bodyText) {
      return undefined as T;
    }

    if (contentType.includes('application/json')) {
      return JSON.parse(bodyText) as T;
    }

    return bodyText as unknown as T;
  }

  // ============================================================================
  // ROOM TYPES
  // ============================================================================

  async getRoomTypes(): Promise<RoomType[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockRoomTypes);
    }
    return this.request<RoomType[]>('/room-types');
  }

  async createRoomType(data: { name: string; maxPersons: number }): Promise<RoomType> {
    if (USE_MOCK_DATA) {
      const maxId = mockRoomTypes.reduce((max, rt) => Math.max(max, parseInt(rt.id) || 0), 0);
      const newRoomType: RoomType = {
        id: String(maxId + 1),
        name: data.name,
        maxPersons: data.maxPersons,
      };
      mockRoomTypes.push(newRoomType);
      return Promise.resolve(newRoomType);
    }
    return this.request<RoomType>('/room-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoomType(id: string, data: { name?: string; maxPersons?: number }): Promise<RoomType> {
    if (USE_MOCK_DATA) {
      const index = mockRoomTypes.findIndex(rt => rt.id === id);
      if (index === -1) throw new Error('Room type not found');

      if (data.name) mockRoomTypes[index].name = data.name;
      if (data.maxPersons) mockRoomTypes[index].maxPersons = data.maxPersons;

      return Promise.resolve(mockRoomTypes[index]);
    }
    return this.request<RoomType>(`/room-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRoomType(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const index = mockRoomTypes.findIndex(rt => rt.id === id);
      if (index !== -1) {
        mockRoomTypes.splice(index, 1);
      }
      return Promise.resolve();
    }
    return this.request<void>(`/room-types/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // HOTELS
  // ============================================================================

  async getHotels(): Promise<Hotel[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockHotels);
    }
    return this.request<Hotel[]>('/hotels');
  }

  async getHotel(id: string): Promise<Hotel> {
    if (USE_MOCK_DATA) {
      const hotel = mockHotels.find(h => h.id === id);
      if (!hotel) throw new Error('Hotel not found');
      return Promise.resolve(hotel);
    }
    return this.request<Hotel>(`/hotels/${id}`);
  }

  async createHotel(data: { name: string; location?: string; region?: string }): Promise<Hotel> {
    if (USE_MOCK_DATA) {
      const maxId = mockHotels.reduce((max, h) => Math.max(max, parseInt(h.id) || 0), 0);
      const newHotel: Hotel = {
        id: String(maxId + 1),
        name: data.name,
        location: data.location,
        region: data.region,
        roomInventories: [],
      };
      mockHotels.push(newHotel);
      return Promise.resolve(newHotel);
    }
    return this.request<Hotel>('/hotels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHotel(id: string, data: { name?: string; location?: string; region?: string }): Promise<Hotel> {
    if (USE_MOCK_DATA) {
      const hotel = mockHotels.find(h => h.id === id);
      if (!hotel) throw new Error('Hotel not found');

      if (data.name) hotel.name = data.name;
      if (data.location) hotel.location = data.location;
      if (data.region) hotel.region = data.region;

      return Promise.resolve(hotel);
    }
    return this.request<Hotel>(`/hotels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHotel(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const index = mockHotels.findIndex(h => h.id === id);
      if (index !== -1) {
        mockHotels.splice(index, 1);
      }
      return Promise.resolve();
    }
    return this.request<void>(`/hotels/${id}`, {
      method: 'DELETE',
    });
  }

  // Hotel Room Inventory
  async addHotelInventory(hotelId: string, data: {
    roomTypeId: string;
    availableFrom: string;
    availableUntil: string;
    roomCount: number;
    hasHalfBoard?: boolean;
    hasSR?: boolean;
  }): Promise<HotelRoomInventory> {
    if (USE_MOCK_DATA) {
      const hotel = mockHotels.find(h => h.id === hotelId);
      if (!hotel) throw new Error('Hotel not found');

      const roomType = mockRoomTypes.find(rt => rt.id === data.roomTypeId);
      if (!roomType) throw new Error('Room type not found');

      const newInventory: HotelRoomInventory = {
        id: String(Date.now()),
        hotelId: hotelId,
        roomType: roomType,
        availableFrom: data.availableFrom,
        availableUntil: data.availableUntil,
        roomCount: data.roomCount,
        hasHalfBoard: data.hasHalfBoard || false,
        hasSR: data.hasSR || false,
      };

      if (!hotel.roomInventories) hotel.roomInventories = [];
      hotel.roomInventories.push(newInventory);

      return Promise.resolve(newInventory);
    }
    return this.request<HotelRoomInventory>(`/hotels/${hotelId}/inventory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteHotelInventory(hotelId: string, inventoryId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const hotel = mockHotels.find(h => h.id === hotelId);
      if (hotel && hotel.roomInventories) {
        const index = hotel.roomInventories.findIndex(inv => inv.id === inventoryId);
        if (index !== -1) {
          hotel.roomInventories.splice(index, 1);
        }
      }
      return Promise.resolve();
    }
    return this.request<void>(`/hotels/${hotelId}/inventory/${inventoryId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // EVENTS
  // ============================================================================

  async getEvents(): Promise<Event[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockEvents);
    }
    return this.request<Event[]>('/events');
  }

  async createEvent(data: { discipline: string; startDate: string; endDate: string }): Promise<Event> {
    if (USE_MOCK_DATA) {
      const maxId = mockEvents.reduce((max, e) => Math.max(max, parseInt(e.id) || 0), 0);
      const newEvent: Event = {
        id: String(maxId + 1),
        discipline: data.discipline,
        startDate: data.startDate,
        endDate: data.endDate,
        roomDemands: [],
      };
      mockEvents.push(newEvent);
      return Promise.resolve(newEvent);
    }
    return this.request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: { discipline?: string; startDate?: string; endDate?: string }): Promise<Event> {
    if (USE_MOCK_DATA) {
      const event = mockEvents.find(e => e.id === id);
      if (!event) throw new Error('Event not found');

      if (data.discipline) event.discipline = data.discipline;
      if (data.startDate) event.startDate = data.startDate;
      if (data.endDate) event.endDate = data.endDate;

      return Promise.resolve(event);
    }
    return this.request<Event>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const index = mockEvents.findIndex(e => e.id === id);
      if (index !== -1) {
        mockEvents.splice(index, 1);
      }
      return Promise.resolve();
    }
    return this.request<void>(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  // Event Room Demand
  async addEventDemand(eventId: string, data: {
    roomTypeId: string;
    roomCount: number;
  }): Promise<EventRoomDemand> {
    if (USE_MOCK_DATA) {
      const event = mockEvents.find(e => e.id === eventId);
      if (!event) throw new Error('Event not found');

      const roomType = mockRoomTypes.find(rt => rt.id === data.roomTypeId);
      if (!roomType) throw new Error('Room type not found');

      const newDemand: EventRoomDemand = {
        id: String(Date.now()),
        eventId: eventId,
        roomType: roomType,
        roomCount: data.roomCount,
      };

      if (!event.roomDemands) event.roomDemands = [];
      event.roomDemands.push(newDemand);

      return Promise.resolve(newDemand);
    }
    return this.request<EventRoomDemand>(`/events/${eventId}/demand`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteEventDemand(eventId: string, demandId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const event = mockEvents.find(e => e.id === eventId);
      if (event && event.roomDemands) {
        const index = event.roomDemands.findIndex(d => d.id === demandId);
        if (index !== -1) {
          event.roomDemands.splice(index, 1);
        }
      }
      return Promise.resolve();
    }
    return this.request<void>(`/events/${eventId}/demand/${demandId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // ATHLETES
  // ============================================================================

  async getAthletes(): Promise<Athlete[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockAthletes);
    }
    return this.request<Athlete[]>('/athletes');
  }

  async createAthlete(data: {
    lastname: string;
    firstname: string;
    nationCode: string;
    function?: string;
  }): Promise<Athlete> {
    if (USE_MOCK_DATA) {
      const maxId = mockAthletes.reduce((max, a) => Math.max(max, parseInt(a.id) || 0), 0);
      const newAthlete: Athlete = {
        id: String(maxId + 1),
        lastname: data.lastname,
        firstname: data.firstname,
        nationCode: data.nationCode,
        function: data.function || 'Athlete',
      };
      mockAthletes.push(newAthlete);
      return Promise.resolve(newAthlete);
    }
    return this.request<Athlete>('/athletes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // ROOM ASSIGNMENTS
  // ============================================================================

  async getRoomAssignments(): Promise<RoomAssignment[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockRoomAssignments);
    }
    return this.request<RoomAssignment[]>('/room-assignments');
  }

  async createRoomAssignment(data: {
    athleteId: string;
    hotelId: string;
    roomTypeId: string;
    checkInDate?: string;
    checkOutDate?: string;
    sharedWithAthleteId?: string;
  }): Promise<RoomAssignment> {
    if (USE_MOCK_DATA) {
      const athlete = mockAthletes.find(a => a.id === data.athleteId);
      if (!athlete) throw new Error('Athlete not found');

      const hotel = mockHotels.find(h => h.id === data.hotelId);
      if (!hotel) throw new Error('Hotel not found');

      const roomType = mockRoomTypes.find(rt => rt.id === data.roomTypeId);
      if (!roomType) throw new Error('Room type not found');

      const sharedWith = data.sharedWithAthleteId
        ? mockAthletes.find(a => a.id === data.sharedWithAthleteId)
        : undefined;

      const maxId = mockRoomAssignments.reduce((max, ra) => Math.max(max, parseInt(ra.id) || 0), 0);
      const newAssignment: RoomAssignment = {
        id: String(maxId + 1),
        athlete: athlete,
        hotel: { id: hotel.id, name: hotel.name },
        roomType: roomType,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        sharedWith: sharedWith,
      };

      mockRoomAssignments.push(newAssignment);
      return Promise.resolve(newAssignment);
    }
    return this.request<RoomAssignment>('/room-assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRoomAssignment(id: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const index = mockRoomAssignments.findIndex(ra => ra.id === id);
      if (index !== -1) {
        mockRoomAssignments.splice(index, 1);
      }
      return Promise.resolve();
    }
    return this.request<void>(`/room-assignments/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getRoomAvailability(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<RoomAvailability[]> {
    if (USE_MOCK_DATA) {
      // Normiere alle Zimmertypen auf EZ und DZ
      const ezRoomType: RoomType = { id: 'ez', name: 'EZ / DU', maxPersons: 1 };
      const dzRoomType: RoomType = { id: 'dz', name: 'DZ / DU', maxPersons: 2 };

      // Berechne verfügbare Zimmer
      let ezAvailable = 0;
      let dzAvailable = 0;

      mockHotels.forEach(hotel => {
        hotel.roomInventories?.forEach(inv => {
          const beds = inv.roomCount * inv.roomType.maxPersons;
          if (inv.roomType.maxPersons === 1) {
            // EZ: 1 Zimmer = 1 EZ
            ezAvailable += inv.roomCount;
          } else {
            // DZ: 2+ Personen -> auf DZ normieren (Betten / 2)
            dzAvailable += Math.floor(beds / 2);
          }
        });
      });

      // Berechne benötigte Zimmer
      let ezDemand = 0;
      let dzDemand = 0;

      mockEvents.forEach(event => {
        event.roomDemands?.forEach(demand => {
          const beds = demand.roomCount * demand.roomType.maxPersons;
          if (demand.roomType.maxPersons === 1) {
            // EZ: 1 Zimmer = 1 EZ
            ezDemand += demand.roomCount;
          } else {
            // DZ: 2+ Personen -> auf DZ normieren (Betten / 2)
            dzDemand += Math.floor(beds / 2);
          }
        });
      });

      return Promise.resolve([
        {
          roomType: ezRoomType,
          available: ezAvailable,
          demand: ezDemand,
          difference: ezAvailable - ezDemand,
        },
        {
          roomType: dzRoomType,
          available: dzAvailable,
          demand: dzDemand,
          difference: dzAvailable - dzDemand,
        }
      ]);
    }

    const query = new URLSearchParams();
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);

    const queryString = query.toString();
    const url = `/analytics/room-availability${queryString ? '?' + queryString : ''}`;

    return this.request<RoomAvailability[]>(url);
  }

  async getOccupancyTimeline(): Promise<Array<{
    discipline: string;
    startDate: string;
    endDate: string;
    demands: Array<{
      roomType: string;
      roomCount: number;
      maxPersons: number;
      totalBeds: number;
    }>;
  }>> {
    return this.request('/analytics/occupancy-timeline');
  }

  // ============================================================================
  // IMPORT
  // ============================================================================

  async importExcel(file: File): Promise<{
    success: boolean;
    message: string;
    counts?: any;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/import/excel`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Import failed: ${response.statusText}`);
    }

    return response.json();
  }

  // FIS official quotas
  async getOfficialQuotaUsage(params?: { nationCode?: string; discipline?: string; gender?: string; }): Promise<OfficialQuotaUsage[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve([]);
    }
    const query = new URLSearchParams();
    if (params?.nationCode) query.set('nationCode', params.nationCode);
    if (params?.discipline) query.set('discipline', params.discipline);
    if (params?.gender) query.set('gender', params.gender);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<OfficialQuotaUsage[]>(`/fis/official-quotas${suffix}`);
  }

  // ============================================================================
  // LEGACY / BACKWARDS COMPATIBILITY
  // ============================================================================

  // Old endpoints kept for backwards compatibility with existing components
  async getStatistics(): Promise<{
    totalAthletes: number;
    assignedAthletes: number;
    totalHotels: number;
    totalCapacity: number;
    totalSingleRooms: number;
    totalDoubleRooms: number;
    assignedSingleRooms: number;
    assignedDoubleRooms: number;
    byNation: Record<string, number>;
    byDiscipline: Record<string, number>;
  }> {
    // Legacy endpoint - map to new analytics
    const [athletes, hotels, availability] = await Promise.all([
      this.getAthletes(),
      this.getHotels(),
      this.getRoomAvailability(),
    ]);

    const byNation: Record<string, number> = {};
    const byDiscipline: Record<string, number> = {};

    athletes.forEach(athlete => {
      byNation[athlete.nationCode] = (byNation[athlete.nationCode] || 0) + 1;
      if (athlete.discipline) {
        byDiscipline[athlete.discipline] = (byDiscipline[athlete.discipline] || 0) + 1;
      }
    });

    return {
      totalAthletes: athletes.length,
      assignedAthletes: 0, // Legacy field
      totalHotels: hotels.length,
      totalCapacity: 0, // Legacy field
      totalSingleRooms: 0, // Legacy field
      totalDoubleRooms: 0, // Legacy field
      assignedSingleRooms: 0, // Legacy field
      assignedDoubleRooms: 0, // Legacy field
      byNation,
      byDiscipline,
    };
  }

  async assignAthleteToHotel(athleteId: string, hotelId: string, roomType: 'single' | 'double' = 'double'): Promise<void> {
    // Legacy - map to new room assignment
    // Note: This requires roomTypeId which we don't have from the old signature
    console.warn('assignAthleteToHotel is deprecated, use createRoomAssignment instead');
  }

  async removeAssignment(athleteId: string): Promise<void> {
    // Legacy - not implemented in new backend
    console.warn('removeAssignment is deprecated');
  }
}

export const api = new ApiService();


