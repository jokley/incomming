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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

    return response.json();
  }

  // ============================================================================
  // ROOM TYPES
  // ============================================================================

  async getRoomTypes(): Promise<RoomType[]> {
    return this.request<RoomType[]>('/room-types');
  }

  async createRoomType(data: { name: string; maxPersons: number }): Promise<RoomType> {
    return this.request<RoomType>('/room-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoomType(id: string, data: { name?: string; maxPersons?: number }): Promise<RoomType> {
    return this.request<RoomType>(`/room-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRoomType(id: string): Promise<void> {
    return this.request<void>(`/room-types/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // HOTELS
  // ============================================================================

  async getHotels(): Promise<Hotel[]> {
    return this.request<Hotel[]>('/hotels');
  }

  async getHotel(id: string): Promise<Hotel> {
    return this.request<Hotel>(`/hotels/${id}`);
  }

  async createHotel(data: { name: string; location?: string; region?: string }): Promise<Hotel> {
    return this.request<Hotel>('/hotels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHotel(id: string, data: { name?: string; location?: string; region?: string }): Promise<Hotel> {
    return this.request<Hotel>(`/hotels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHotel(id: string): Promise<void> {
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
    return this.request<HotelRoomInventory>(`/hotels/${hotelId}/inventory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteHotelInventory(hotelId: string, inventoryId: string): Promise<void> {
    return this.request<void>(`/hotels/${hotelId}/inventory/${inventoryId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // EVENTS
  // ============================================================================

  async getEvents(): Promise<Event[]> {
    return this.request<Event[]>('/events');
  }

  async createEvent(data: { discipline: string; startDate: string; endDate: string }): Promise<Event> {
    return this.request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: { discipline?: string; startDate?: string; endDate?: string }): Promise<Event> {
    return this.request<Event>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string): Promise<void> {
    return this.request<void>(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  // Event Room Demand
  async addEventDemand(eventId: string, data: {
    roomTypeId: string;
    roomCount: number;
  }): Promise<EventRoomDemand> {
    return this.request<EventRoomDemand>(`/events/${eventId}/demand`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteEventDemand(eventId: string, demandId: string): Promise<void> {
    return this.request<void>(`/events/${eventId}/demand/${demandId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // ATHLETES
  // ============================================================================

  async getAthletes(): Promise<Athlete[]> {
    return this.request<Athlete[]>('/athletes');
  }

  async createAthlete(data: {
    lastname: string;
    firstname: string;
    nationCode: string;
    function?: string;
  }): Promise<Athlete> {
    return this.request<Athlete>('/athletes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // ROOM ASSIGNMENTS
  // ============================================================================

  async getRoomAssignments(): Promise<RoomAssignment[]> {
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
    return this.request<RoomAssignment>('/room-assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getRoomAvailability(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<RoomAvailability[]> {
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
