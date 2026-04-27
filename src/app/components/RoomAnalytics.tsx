import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { Hotel, Event } from '../types';

export function RoomAnalytics() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [hotelsData, eventsData] = await Promise.all([
        api.getHotels(),
        api.getEvents()
      ]);
      setHotels(hotelsData);
      setEvents(eventsData);
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

  // Calculate date range from both hotels and events
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

  if (allDates.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
        Keine Daten verfügbar. Bitte fügen Sie Hotels mit Kontingenten und Events mit Bedarf hinzu.
      </div>
    );
  }

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Calculate daily availability (hotels)
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

  // Calculate daily demand (events)
  const dailyDemandBeds: number[] = new Array(totalDays).fill(0);
  events.forEach(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const totalBeds = event.roomDemands?.reduce((sum, d) => sum + (d.roomCount * d.roomType.maxPersons), 0) || 0;

    for (let d = 0; d < totalDays; d++) {
      const currentDate = new Date(minDate);
      currentDate.setDate(currentDate.getDate() + d);

      if (currentDate >= start && currentDate <= end) {
        dailyDemandBeds[d] += totalBeds;
      }
    }
  });

  // Calculate rooms from beds: Betten / 1.5 = Zimmer
  const dailyAvailableRooms = dailyAvailableBeds.map(beds => Math.ceil(beds / 1.5));
  const dailyDemandRooms = dailyDemandBeds.map(beds => Math.ceil(beds / 1.5));

  // Calculate EZ/DZ (50/50 split)
  const dailyAvailableEZ = dailyAvailableRooms.map(rooms => Math.ceil(rooms / 2));
  const dailyAvailableDZ = dailyAvailableRooms.map(rooms => Math.ceil(rooms / 2));
  const dailyDemandEZ = dailyDemandRooms.map(rooms => Math.ceil(rooms / 2));
  const dailyDemandDZ = dailyDemandRooms.map(rooms => Math.ceil(rooms / 2));

  // Calculate differences
  const dailyDiffBeds = dailyAvailableBeds.map((avail, idx) => avail - dailyDemandBeds[idx]);
  const dailyDiffRooms = dailyAvailableRooms.map((avail, idx) => avail - dailyDemandRooms[idx]);
  const dailyDiffEZ = dailyAvailableEZ.map((avail, idx) => avail - dailyDemandEZ[idx]);
  const dailyDiffDZ = dailyAvailableDZ.map((avail, idx) => avail - dailyDemandDZ[idx]);

  // Generate date labels
  const dateLabels: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(minDate);
    date.setDate(date.getDate() + i);
    dateLabels.push(date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
  }

  // Overall statistics (EZ/DZ normalized)
  const totalAvailableEZ = Math.max(...dailyAvailableEZ);
  const totalAvailableDZ = Math.max(...dailyAvailableDZ);
  const totalDemandEZ = Math.max(...dailyDemandEZ);
  const totalDemandDZ = Math.max(...dailyDemandDZ);

  // Prepare chart data
  const chartData = dateLabels.map((label, idx) => ({
    date: label,
    'Verfügbar': dailyAvailableRooms[idx],
    'Bedarf': dailyDemandRooms[idx],
  }));

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">Soll/Ist Analyse - Verfügbarkeit vs. Bedarf</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-md font-semibold mb-4 text-green-700">Verfügbarkeit (IST)</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">EZ verfügbar (max)</span>
              <span className="text-2xl font-bold text-green-600">{totalAvailableEZ}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">DZ verfügbar (max)</span>
              <span className="text-2xl font-bold text-green-600">{totalAvailableDZ}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-md font-semibold mb-4 text-blue-700">Bedarf (SOLL)</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">EZ benötigt (max)</span>
              <span className="text-2xl font-bold text-blue-600">{totalDemandEZ}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">DZ benötigt (max)</span>
              <span className="text-2xl font-bold text-blue-600">{totalDemandDZ}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-md font-semibold mb-4">Zimmer-Übersicht pro Tag</h4>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Verfügbar" fill="#10b981" />
            <Bar dataKey="Bedarf" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-md font-semibold mb-4">Tägliche Gegenüberstellung</h4>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header */}
            <div className="flex mb-2 border-b-2 border-gray-300 pb-2">
              <div className="w-48 flex-shrink-0 font-semibold text-xs text-gray-700">Kategorie</div>
              <div className="flex-1 flex">
                {dateLabels.map((label, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs font-medium text-gray-600 border-l border-gray-200 px-1"
                    style={{ minWidth: '40px' }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Betten verfügbar */}
            <div className="flex mb-1 bg-green-50">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs font-semibold text-green-700">Betten verfügbar</p>
              </div>
              <div className="flex-1 flex">
                {dailyAvailableBeds.map((beds, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-green-700 font-medium border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {beds > 0 ? beds : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* Betten benötigt */}
            <div className="flex mb-1 bg-blue-50">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs font-semibold text-blue-700">Betten benötigt</p>
              </div>
              <div className="flex-1 flex">
                {dailyDemandBeds.map((beds, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-blue-700 font-medium border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {beds > 0 ? beds : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* Differenz Betten */}
            <div className="flex mb-3 bg-gray-50">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs font-bold text-gray-900">Δ Betten</p>
              </div>
              <div className="flex-1 flex">
                {dailyDiffBeds.map((diff, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 text-center text-xs font-bold border-l border-gray-200 px-1 py-1 ${
                      diff >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                    style={{ minWidth: '40px' }}
                  >
                    {diff !== 0 ? (diff >= 0 ? `+${diff}` : diff) : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* Zimmer verfügbar */}
            <div className="flex mb-1">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs text-green-600">Zimmer verfügbar (÷1,5)</p>
              </div>
              <div className="flex-1 flex">
                {dailyAvailableRooms.map((rooms, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-green-600 border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {rooms > 0 ? rooms : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* Zimmer benötigt */}
            <div className="flex mb-1">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs text-blue-600">Zimmer benötigt (÷1,5)</p>
              </div>
              <div className="flex-1 flex">
                {dailyDemandRooms.map((rooms, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-blue-600 border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {rooms > 0 ? rooms : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* Differenz Zimmer */}
            <div className="flex mb-3">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs font-bold text-gray-900">Δ Zimmer</p>
              </div>
              <div className="flex-1 flex">
                {dailyDiffRooms.map((diff, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 text-center text-xs font-bold border-l border-gray-200 px-1 py-1 ${
                      diff >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                    style={{ minWidth: '40px' }}
                  >
                    {diff !== 0 ? (diff >= 0 ? `+${diff}` : diff) : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* EZ verfügbar */}
            <div className="flex mb-1">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs text-gray-600">EZ verfügbar</p>
              </div>
              <div className="flex-1 flex">
                {dailyAvailableEZ.map((ez, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-gray-600 border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {ez > 0 ? ez : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* EZ benötigt */}
            <div className="flex mb-1">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs text-gray-600">EZ benötigt</p>
              </div>
              <div className="flex-1 flex">
                {dailyDemandEZ.map((ez, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-gray-600 border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {ez > 0 ? ez : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* Differenz EZ */}
            <div className="flex mb-3">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs font-semibold text-gray-700">Δ EZ</p>
              </div>
              <div className="flex-1 flex">
                {dailyDiffEZ.map((diff, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 text-center text-xs font-semibold border-l border-gray-200 px-1 py-1 ${
                      diff >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                    style={{ minWidth: '40px' }}
                  >
                    {diff !== 0 ? (diff >= 0 ? `+${diff}` : diff) : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* DZ verfügbar */}
            <div className="flex mb-1">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs text-gray-600">DZ verfügbar</p>
              </div>
              <div className="flex-1 flex">
                {dailyAvailableDZ.map((dz, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-gray-600 border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {dz > 0 ? dz : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* DZ benötigt */}
            <div className="flex mb-1">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs text-gray-600">DZ benötigt</p>
              </div>
              <div className="flex-1 flex">
                {dailyDemandDZ.map((dz, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-xs text-gray-600 border-l border-gray-200 px-1 py-1"
                    style={{ minWidth: '40px' }}
                  >
                    {dz > 0 ? dz : '-'}
                  </div>
                ))}
              </div>
            </div>

            {/* Differenz DZ */}
            <div className="flex">
              <div className="w-48 flex-shrink-0 pr-4 py-1">
                <p className="text-xs font-semibold text-gray-700">Δ DZ</p>
              </div>
              <div className="flex-1 flex">
                {dailyDiffDZ.map((diff, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 text-center text-xs font-semibold border-l border-gray-200 px-1 py-1 ${
                      diff >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                    style={{ minWidth: '40px' }}
                  >
                    {diff !== 0 ? (diff >= 0 ? `+${diff}` : diff) : '-'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Berechnungslogik</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Betten</strong> = Zimmeranzahl × maxPersons vom Zimmertyp</li>
          <li><strong>Zimmer</strong> = Betten ÷ 1,5 (aufgerundet)</li>
          <li><strong>EZ / DZ</strong> = Zimmer ÷ 2 (je 50%, aufgerundet)</li>
          <li>Ein Doppelzimmer kann auch als Einzelzimmer gebucht werden</li>
        </ul>
      </div>
    </div>
  );
}
