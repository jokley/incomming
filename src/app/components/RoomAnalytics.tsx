import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface RoomAvailability {
  roomType: {
    id: string;
    name: string;
    maxPersons: number;
  };
  available: number;
  demand: number;
  difference: number;
}

export function RoomAnalytics() {
  const [data, setData] = useState<RoomAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/analytics/room-availability`);
      if (!response.ok) throw new Error('Failed to load data');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  // Calculate totals
  const totalAvailable = data.reduce((sum, item) => sum + item.available, 0);
  const totalDemand = data.reduce((sum, item) => sum + item.demand, 0);
  const totalDifference = totalAvailable - totalDemand;

  // Prepare chart data
  const chartData = data.map(item => ({
    name: item.roomType.name,
    Verfügbar: item.available,
    Bedarf: item.demand,
    Differenz: item.difference
  }));

  // Calculate bed capacity
  const bedData = data.map(item => {
    const availableBeds = item.available * item.roomType.maxPersons;
    const requiredBeds = item.demand * item.roomType.maxPersons;
    return {
      name: item.roomType.name,
      'Verfügbare Betten': availableBeds,
      'Benötigte Betten': requiredBeds,
      difference: availableBeds - requiredBeds
    };
  });

  const totalAvailableBeds = bedData.reduce((sum, item) => sum + item['Verfügbare Betten'], 0);
  const totalRequiredBeds = bedData.reduce((sum, item) => sum + item['Benötigte Betten'], 0);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Zimmerverfügbarkeit vs. Bedarf</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Verfügbare Zimmer</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalAvailable}</p>
          <p className="text-sm text-gray-500 mt-1">{totalAvailableBeds} Betten</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Benötigte Zimmer</span>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalDemand}</p>
          <p className="text-sm text-gray-500 mt-1">{totalRequiredBeds} Betten</p>
        </div>

        <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
          totalDifference >= 0 ? 'border-green-500' : 'border-red-500'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Differenz</span>
            {totalDifference >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className={`text-3xl font-bold ${
            totalDifference >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {totalDifference >= 0 ? '+' : ''}{totalDifference}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {totalAvailableBeds - totalRequiredBeds >= 0 ? '+' : ''}
            {totalAvailableBeds - totalRequiredBeds} Betten
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-md font-semibold mb-4">Zimmer nach Typ</h4>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Verfügbar" fill="#3b82f6" />
            <Bar dataKey="Bedarf" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-md font-semibold mb-4">Betten-Kapazität nach Typ</h4>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={bedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Verfügbare Betten" fill="#10b981" />
            <Bar dataKey="Benötigte Betten" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h4 className="text-md font-semibold">Detaillierte Aufschlüsselung</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zimmertyp</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Max Personen</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Verfügbar</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bedarf</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Differenz</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Betten Verfügbar</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Betten Bedarf</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((item, index) => {
                const bedDiff = (item.available - item.demand) * item.roomType.maxPersons;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.roomType.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.roomType.maxPersons}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {item.available}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {item.demand}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-center text-sm font-medium ${
                      item.difference >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item.difference >= 0 ? '+' : ''}{item.difference}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.available * item.roomType.maxPersons}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.demand * item.roomType.maxPersons}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {item.difference >= 0 ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          Ausreichend
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          Fehlend: {Math.abs(item.difference)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
