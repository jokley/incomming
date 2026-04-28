import { useState, useEffect } from 'react';
import { Users, Hotel, Globe, Trophy, Loader2, Bed, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../services/api';
import { Athlete, Hotel as HotelType, RoomType, Event, RoomAvailability, RoomAssignment } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function Dashboard() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [availability, setAvailability] = useState<RoomAvailability[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [athletesData, hotelsData, roomTypesData, eventsData, availabilityData, assignmentsData] = await Promise.all([
        api.getAthletes(),
        api.getHotels(),
        api.getRoomTypes(),
        api.getEvents(),
        api.getRoomAvailability(),
        api.getRoomAssignments(),
      ]);
      setAthletes(athletesData);
      setHotels(hotelsData);
      setRoomTypes(roomTypesData);
      setEvents(eventsData);
      setAvailability(availabilityData);
      setAssignments(assignmentsData);
    } catch (err) {
      console.error('Fehler beim Laden der Daten', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total room capacity (available)
  const totalRoomsAvailable = hotels.reduce((sum, hotel) => {
    if (!hotel.roomInventories) return sum;
    return sum + hotel.roomInventories.reduce((hotelSum, inv) => hotelSum + inv.roomCount, 0);
  }, 0);

  // Calculate total bed capacity
  const totalBeds = hotels.reduce((sum, hotel) => {
    if (!hotel.roomInventories) return sum;
    return sum + hotel.roomInventories.reduce((hotelSum, inv) => {
      return hotelSum + (inv.roomCount * inv.roomType.maxPersons);
    }, 0);
  }, 0);

  // Calculate total event demand (room demand across all events)
  const totalRoomsDemand = events.reduce((sum, event) => {
    if (!event.roomDemands) return sum;
    return sum + event.roomDemands.reduce((eventSum, demand) => eventSum + demand.roomCount, 0);
  }, 0);

  // Total assigned rooms
  const totalRoomsAssigned = assignments.length;

  // Calculate remaining capacity
  const totalRoomsRemaining = totalRoomsAvailable - totalRoomsAssigned;
  const roomUtilization = totalRoomsAvailable > 0
    ? ((totalRoomsAssigned / totalRoomsAvailable) * 100).toFixed(1)
    : 0;

  const stats = {
    totalAthletes: athletes.length,
    totalHotels: hotels.length,
    totalRoomsAvailable,
    totalBeds,
    totalEvents: events.length,
    totalRoomsAssigned,
    totalRoomsDemand,
    totalRoomsRemaining,
    roomUtilization,
  };

  // Nation data - safe with nullish coalescing
  const nationData = Object.entries(
    athletes.reduce((acc, athlete) => {
      const nation = athlete.nationCode || 'Unknown';
      acc[nation] = (acc[nation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }))
   .sort((a, b) => b.value - a.value);

  // Discipline data - filter out undefined/null
  const disciplineData = Object.entries(
    athletes.reduce((acc, athlete) => {
      if (athlete.discipline) {
        acc[athlete.discipline] = (acc[athlete.discipline] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }))
   .sort((a, b) => b.value - a.value);

  // Event demand data
  const eventDemandData = events.map(event => {
    const demands = event.roomDemands || [];
    const totalRooms = demands.reduce((sum, d) => sum + d.roomCount, 0);
    const totalBeds = demands.reduce((sum, d) => sum + (d.roomCount * d.roomType.maxPersons), 0);

    return {
      name: event.discipline.substring(0, 15) + (event.discipline.length > 15 ? '...' : ''),
      Zimmer: totalRooms,
      Betten: totalBeds,
    };
  }).filter(e => e.Zimmer > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard Übersicht</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Athleten & Staff</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalAthletes}</p>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Events</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
            <Calendar className="w-12 h-12 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Hotels</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalHotels}</p>
            </div>
            <Hotel className="w-12 h-12 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Betten Gesamt</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBeds}</p>
            </div>
            <Trophy className="w-12 h-12 text-green-500" />
          </div>
        </div>
      </div>

      {/* Zimmerverfügbarkeit Übersicht */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-6">Zimmerverfügbarkeit Gesamt</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Zimmer Verfügbar */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-3">
              <Bed className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1">{stats.totalRoomsAvailable}</div>
            <div className="text-sm text-gray-600 mb-3">Zimmer Verfügbar</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: '100%' }}
              ></div>
            </div>
          </div>

          {/* Zimmer Bedarf */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1">{stats.totalRoomsDemand}</div>
            <div className="text-sm text-gray-600 mb-3">Zimmer Bedarf</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-600 h-2 rounded-full"
                style={{
                  width: `${stats.totalRoomsAvailable > 0 ? Math.min((stats.totalRoomsDemand / stats.totalRoomsAvailable) * 100, 100) : 0}%`
                }}
              ></div>
            </div>
          </div>

          {/* Zimmer Zugewiesen */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1">{stats.totalRoomsAssigned}</div>
            <div className="text-sm text-gray-600 mb-3">Zimmer Zugewiesen</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: `${stats.totalRoomsAvailable > 0 ? (stats.totalRoomsAssigned / stats.totalRoomsAvailable) * 100 : 0}%`
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Auslastung Summary */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">Zimmer Auslastung:</span>
              <span className="ml-2 text-lg font-semibold text-gray-900">{stats.roomUtilization}%</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Noch verfügbar:</span>
              <span className={`ml-2 text-lg font-semibold ${stats.totalRoomsRemaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.totalRoomsRemaining} Zimmer
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Events Übersicht */}
      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Aktuelle Events</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disziplin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ende
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zimmernachfrage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => {
                  const demands = event.roomDemands || [];
                  const totalDemand = demands.reduce((sum, d) => sum + d.roomCount, 0);
                  return (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {event.discipline}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(event.startDate).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(event.endDate).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {totalDemand} Zimmer
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Athleten nach Nation</h3>
          {nationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={nationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {nationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Keine Daten verfügbar
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Athleten nach Disziplin</h3>
          {disciplineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={disciplineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Keine Daten verfügbar
            </div>
          )}
        </div>
      </div>

      {eventDemandData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Event Zimmernachfrage</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={eventDemandData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Zimmer" fill="#8b5cf6" name="Zimmer" />
              <Bar dataKey="Betten" fill="#ec4899" name="Betten" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
