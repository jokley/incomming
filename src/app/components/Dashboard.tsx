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

  // Calculate date range from both hotels and events (same as Analytics)
  const hotelDates = hotels.flatMap(h =>
    (h.roomInventories || []).flatMap(inv => [
      new Date(inv.availableFrom),
      new Date(inv.availableUntil)
    ])
  );

  const eventDates = events.flatMap(e => [
    new Date(e.startDate),
    new Date(e.endDate)
  ]);

  const allDates = [...hotelDates, ...eventDates];

  let totalBedsAvailable = 0;
  let totalBedsDemand = 0;
  let totalRoomsAvailable = 0;
  let totalRoomsDemand = 0;

  if (allDates.length > 0) {
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate daily availability (hotels) - same logic as Analytics
    const dailyAvailableBeds: number[] = new Array(totalDays).fill(0);
    hotels.forEach(hotel => {
      hotel.roomInventories?.forEach(inv => {
        const start = new Date(inv.availableFrom);
        const end = new Date(inv.availableUntil);
        const beds = inv.roomCount * inv.roomType.maxPersons;

        for (let d = 0; d < totalDays; d++) {
          const currentDate = new Date(minDate);
          currentDate.setDate(currentDate.getDate() + d);

          if (currentDate >= start && currentDate <= end) {
            dailyAvailableBeds[d] += beds;
          }
        }
      });
    });

    // Calculate daily demand (events) - same logic as Analytics
    const dailyDemandBeds: number[] = new Array(totalDays).fill(0);
    events.forEach(event => {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      const eventBeds = event.roomDemands?.reduce((sum, d) => sum + (d.roomCount * d.roomType.maxPersons), 0) || 0;

      for (let d = 0; d < totalDays; d++) {
        const currentDate = new Date(minDate);
        currentDate.setDate(currentDate.getDate() + d);

        if (currentDate >= start && currentDate <= end) {
          dailyDemandBeds[d] += eventBeds;
        }
      }
    });

    // Calculate rooms from beds: Betten / 1.5 = Zimmer
    const dailyAvailableRooms = dailyAvailableBeds.map(beds => Math.ceil(beds / 1.5));
    const dailyDemandRooms = dailyDemandBeds.map(beds => Math.ceil(beds / 1.5));

    // Take MAXIMUM of daily values (same as Analytics)
    totalBedsAvailable = Math.max(...dailyAvailableBeds, 0);
    totalBedsDemand = Math.max(...dailyDemandBeds, 0);
    totalRoomsAvailable = Math.max(...dailyAvailableRooms, 0);
    totalRoomsDemand = Math.max(...dailyDemandRooms, 0);
  }

  // Total assigned rooms
  const totalRoomsAssigned = assignments.length;

  // Calculate differences
  const bedsDifference = totalBedsAvailable - totalBedsDemand;
  const roomsDifference = totalRoomsAvailable - totalRoomsDemand;

  // Calculate utilization based on demand vs available
  const demandUtilization = totalRoomsAvailable > 0
    ? ((totalRoomsDemand / totalRoomsAvailable) * 100).toFixed(1)
    : 0;
  const assignmentUtilization = totalRoomsAvailable > 0
    ? ((totalRoomsAssigned / totalRoomsAvailable) * 100).toFixed(1)
    : 0;

  const stats = {
    totalAthletes: athletes.length,
    totalHotels: hotels.length,
    totalBedsAvailable,
    totalBedsDemand,
    totalRoomsAvailable,
    totalRoomsDemand,
    totalEvents: events.length,
    totalRoomsAssigned,
    bedsDifference,
    roomsDifference,
    demandUtilization,
    assignmentUtilization,
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
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-100">Athleten & Staff</p>
              <p className="text-4xl font-bold mt-2">{stats.totalAthletes}</p>
            </div>
            <Users className="w-14 h-14 text-blue-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-100">Events</p>
              <p className="text-4xl font-bold mt-2">{stats.totalEvents}</p>
            </div>
            <Calendar className="w-14 h-14 text-indigo-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-100">Hotels</p>
              <p className="text-4xl font-bold mt-2">{stats.totalHotels}</p>
            </div>
            <Hotel className="w-14 h-14 text-orange-200 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-teal-100">Zuweisungen</p>
              <p className="text-4xl font-bold mt-2">{stats.totalRoomsAssigned}</p>
            </div>
            <TrendingUp className="w-14 h-14 text-teal-200 opacity-80" />
          </div>
        </div>
      </div>

      {/* Zimmerverfügbarkeit Übersicht - SOLL/IST */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4">
          <h3 className="text-xl font-bold text-white">Soll/Ist Analyse - Verfügbarkeit vs. Bedarf</h3>
          <p className="text-sm text-gray-300 mt-1">Berechnung: Zimmer = Betten ÷ 1,5</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* IST - Verfügbarkeit */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-300">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-green-800">IST - Verfügbarkeit</h4>
                <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                  <Bed className="w-6 h-6 text-green-700" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 shadow">
                  <div className="text-xs text-gray-600 mb-1">Betten verfügbar</div>
                  <div className="text-3xl font-bold text-green-700">{stats.totalBedsAvailable}</div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow">
                  <div className="text-xs text-gray-600 mb-1">Zimmer verfügbar (÷1,5)</div>
                  <div className="text-3xl font-bold text-green-700">{stats.totalRoomsAvailable}</div>
                </div>
              </div>
            </div>

            {/* SOLL - Bedarf */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-300">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-blue-800">SOLL - Bedarf</h4>
                <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-blue-700" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 shadow">
                  <div className="text-xs text-gray-600 mb-1">Betten benötigt</div>
                  <div className="text-3xl font-bold text-blue-700">{stats.totalBedsDemand}</div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow">
                  <div className="text-xs text-gray-600 mb-1">Zimmer benötigt (÷1,5)</div>
                  <div className="text-3xl font-bold text-blue-700">{stats.totalRoomsDemand}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Differenz & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`rounded-xl p-6 border-2 ${
              stats.bedsDifference >= 0
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300'
                : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
            }`}>
              <div className="text-xs font-medium text-gray-600 mb-2">Δ Betten</div>
              <div className={`text-4xl font-bold ${stats.bedsDifference >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {stats.bedsDifference >= 0 ? '+' : ''}{stats.bedsDifference}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {stats.bedsDifference >= 0 ? 'Überkapazität' : 'Unterkapazität'}
              </div>
            </div>

            <div className={`rounded-xl p-6 border-2 ${
              stats.roomsDifference >= 0
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300'
                : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
            }`}>
              <div className="text-xs font-medium text-gray-600 mb-2">Δ Zimmer</div>
              <div className={`text-4xl font-bold ${stats.roomsDifference >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {stats.roomsDifference >= 0 ? '+' : ''}{stats.roomsDifference}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {stats.roomsDifference >= 0 ? 'Überkapazität' : 'Unterkapazität'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-300">
              <div className="text-xs font-medium text-gray-600 mb-2">Zimmer Zugewiesen</div>
              <div className="text-4xl font-bold text-purple-700">{stats.totalRoomsAssigned}</div>
              <div className="text-xs text-gray-600 mt-1">{stats.assignmentUtilization}% Auslastung</div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Bedarf vs. Verfügbarkeit</span>
                <span className="text-sm font-bold text-gray-900">{stats.demandUtilization}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${
                    Number(stats.demandUtilization) > 100
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : Number(stats.demandUtilization) > 85
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                      : 'bg-gradient-to-r from-green-500 to-green-600'
                  }`}
                  style={{ width: `${Math.min(Number(stats.demandUtilization), 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Zuweisungen vs. Verfügbarkeit</span>
                <span className="text-sm font-bold text-gray-900">{stats.assignmentUtilization}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all bg-gradient-to-r from-purple-500 to-purple-600"
                  style={{ width: `${Math.min(Number(stats.assignmentUtilization), 100)}%` }}
                ></div>
              </div>
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
