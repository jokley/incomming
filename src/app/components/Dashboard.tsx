import { useState, useEffect } from 'react';
import { Users, Hotel, Globe, Trophy, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../services/api';
import { Athlete, Hotel as HotelType } from '../types';
import { RoomOccupancy } from './RoomOccupancy';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function Dashboard() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [athletesData, hotelsData] = await Promise.all([
        api.getAthletes(),
        api.getHotels(),
      ]);
      setAthletes(athletesData);
      setHotels(hotelsData);
    } catch (err) {
      console.error('Fehler beim Laden der Daten', err);
    } finally {
      setLoading(false);
    }
  };

  const totalSingleRooms = hotels.reduce((sum, h) => sum + h.singleRooms, 0);
  const totalDoubleRooms = hotels.reduce((sum, h) => sum + h.doubleRooms, 0);
  const totalCapacity = totalSingleRooms + (totalDoubleRooms * 2);

  const stats = {
    totalAthletes: athletes.length,
    assignedAthletes: athletes.filter(a => a.hotelId).length,
    totalHotels: hotels.length,
    totalCapacity,
  };

  const nationData = Object.entries(
    athletes.reduce((acc, athlete) => {
      acc[athlete.nation] = (acc[athlete.nation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const disciplineData = Object.entries(
    athletes.reduce((acc, athlete) => {
      acc[athlete.discipline] = (acc[athlete.discipline] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const hotelOccupancy = hotels.map(hotel => {
    const capacity = hotel.singleRooms + (hotel.doubleRooms * 2);
    const occupied = hotel.assignedSingle + hotel.assignedDouble;
    return {
      name: hotel.name,
      Belegt: occupied,
      Verfügbar: capacity - occupied,
    };
  });

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
              <p className="text-sm text-gray-600">Athleten Gesamt</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalAthletes}</p>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Zugewiesen</p>
              <p className="text-3xl font-bold text-green-600">{stats.assignedAthletes}</p>
            </div>
            <UserCheck className="w-12 h-12 text-green-500" />
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
              <p className="text-sm text-gray-600">Kapazität</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalCapacity}</p>
            </div>
            <Trophy className="w-12 h-12 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Athleten nach Nation</h3>
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
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Athleten nach Disziplin</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={disciplineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Hotel-Auslastung</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hotelOccupancy}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Belegt" stackId="a" fill="#10b981" />
            <Bar dataKey="Verfügbar" stackId="a" fill="#e5e7eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <RoomOccupancy />
    </div>
  );
}

function UserCheck({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
