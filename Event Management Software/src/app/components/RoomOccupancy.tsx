import { useEffect, useState } from 'react';
import { Loader2, Bed, DoorOpen } from 'lucide-react';
import { api } from '../services/api';
import { Hotel } from '../types';

export function RoomOccupancy() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getHotels();
      setHotels(data);
    } catch (err) {
      console.error('Fehler beim Laden der Hotels', err);
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

  const totalSingleRooms = hotels.reduce((sum, h) => sum + h.singleRooms, 0);
  const totalDoubleRooms = hotels.reduce((sum, h) => sum + h.doubleRooms, 0);
  const assignedSingle = hotels.reduce((sum, h) => sum + h.assignedSingle, 0);
  const assignedDouble = hotels.reduce((sum, h) => sum + h.assignedDouble, 0);

  const totalCapacity = totalSingleRooms + (totalDoubleRooms * 2);
  const currentOccupancy = assignedSingle + assignedDouble;

  const singlePercentage = totalSingleRooms > 0 ? (assignedSingle / totalSingleRooms) * 100 : 0;
  const doublePercentage = totalDoubleRooms > 0 ? (assignedDouble / (totalDoubleRooms * 2)) * 100 : 0;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Zimmerbelegung Übersicht</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <Bed className="w-10 h-10 text-blue-600" />
            <span className="text-3xl font-bold text-blue-600">{totalSingleRooms}</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Einzelzimmer Gesamt</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Belegt:</span>
              <span className="font-semibold text-blue-600">{assignedSingle}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Verfügbar:</span>
              <span className="font-semibold text-green-600">{totalSingleRooms - assignedSingle}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all"
                style={{ width: `${singlePercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">{singlePercentage.toFixed(1)}% belegt</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <DoorOpen className="w-10 h-10 text-purple-600" />
            <span className="text-3xl font-bold text-purple-600">{totalDoubleRooms}</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Doppelzimmer Gesamt</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Belegt (Personen):</span>
              <span className="font-semibold text-purple-600">{assignedDouble}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Max. Kapazität:</span>
              <span className="font-semibold text-gray-700">{totalDoubleRooms * 2}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all"
                style={{ width: `${doublePercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">{doublePercentage.toFixed(1)}% belegt</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-3xl font-bold text-green-600">{totalCapacity}</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Gesamtkapazität</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Belegt:</span>
              <span className="font-semibold text-green-600">{currentOccupancy}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Verfügbar:</span>
              <span className="font-semibold text-gray-700">{totalCapacity - currentOccupancy}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
              <div
                className="bg-green-600 h-2.5 rounded-full transition-all"
                style={{ width: `${(currentOccupancy / totalCapacity) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">
              {((currentOccupancy / totalCapacity) * 100).toFixed(1)}% belegt
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h4 className="text-md font-semibold">Detaillierte Belegung pro Hotel</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hotel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">EZ Gesamt</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">EZ Belegt</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">DZ Gesamt</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">DZ Belegt</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Kapazität</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Auslastung</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {hotels.map((hotel) => {
                const capacity = hotel.singleRooms + (hotel.doubleRooms * 2);
                const occupied = hotel.assignedSingle + hotel.assignedDouble;
                const occupancyRate = capacity > 0 ? (occupied / capacity) * 100 : 0;

                return (
                  <tr key={hotel.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{hotel.name}</div>
                      <div className="text-xs text-gray-500">{hotel.region}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {hotel.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {hotel.singleRooms}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        hotel.assignedSingle === hotel.singleRooms
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {hotel.assignedSingle}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {hotel.doubleRooms}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        hotel.assignedDouble === hotel.doubleRooms * 2
                          ? 'bg-red-100 text-red-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {hotel.assignedDouble} / {hotel.doubleRooms * 2}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {occupied} / {capacity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              occupancyRate >= 90
                                ? 'bg-red-500'
                                : occupancyRate >= 70
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${occupancyRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12 text-right">
                          {occupancyRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Hinweis zur Zimmerverwaltung</h4>
        <p className="text-sm text-blue-800">
          <strong>50/50 Regel:</strong> Pro Nation und Disziplin werden idealerweise 50% Einzelzimmer und 50%
          Doppelzimmer angestrebt. Bei {totalDoubleRooms} Doppelzimmern können bis zu {totalDoubleRooms * 2} Athleten
          untergebracht werden. Kombiniert mit {totalSingleRooms} Einzelzimmern ergibt sich eine Gesamtkapazität
          von {totalCapacity} Plätzen.
        </p>
      </div>
    </div>
  );
}
