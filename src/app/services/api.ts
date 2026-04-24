import { Athlete, Hotel, Event } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://incoming.jokley.at/api';

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

  // Athletes
  async getAthletes(): Promise<Athlete[]> {
    return this.request<Athlete[]>('/athletes');
  }

  async createAthlete(athlete: Omit<Athlete, 'id'>): Promise<Athlete> {
    return this.request<Athlete>('/athletes', {
      method: 'POST',
      body: JSON.stringify(athlete),
    });
  }

  async updateAthlete(id: string, athlete: Partial<Athlete>): Promise<Athlete> {
    return this.request<Athlete>(`/athletes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(athlete),
    });
  }

  async deleteAthlete(id: string): Promise<void> {
    return this.request<void>(`/athletes/${id}`, {
      method: 'DELETE',
    });
  }

  // Hotels
  async getHotels(): Promise<Hotel[]> {
    return this.request<Hotel[]>('/hotels');
  }

  async createHotel(hotel: Omit<Hotel, 'id' | 'assignedCount'>): Promise<Hotel> {
    return this.request<Hotel>('/hotels', {
      method: 'POST',
      body: JSON.stringify(hotel),
    });
  }

  async updateHotel(id: string, hotel: Partial<Hotel>): Promise<Hotel> {
    return this.request<Hotel>(`/hotels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(hotel),
    });
  }

  async deleteHotel(id: string): Promise<void> {
    return this.request<void>(`/hotels/${id}`, {
      method: 'DELETE',
    });
  }

  // Assignments
  async assignAthleteToHotel(athleteId: string, hotelId: string, roomType: 'single' | 'double' = 'double'): Promise<void> {
    return this.request<void>('/assignments', {
      method: 'POST',
      body: JSON.stringify({ athleteId, hotelId, roomType }),
    });
  }

  async removeAssignment(athleteId: string): Promise<void> {
    return this.request<void>(`/assignments/${athleteId}`, {
      method: 'DELETE',
    });
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return this.request<Event[]>('/events');
  }

  async createEvent(event: Omit<Event, 'id' | 'currentQuota'>): Promise<Event> {
    return this.request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(id: string, event: Partial<Event>): Promise<Event> {
    return this.request<Event>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    });
  }

  async deleteEvent(id: string): Promise<void> {
    return this.request<void>(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  // Statistics
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
    return this.request('/statistics');
  }
}

export const api = new ApiService();
