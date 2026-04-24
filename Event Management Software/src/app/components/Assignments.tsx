import { useState, useEffect } from 'react';
import { ArrowRight, Save, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Athlete, Hotel } from '../types';

export function Assignments() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<string>('');
  const [selectedHotel, setSelectedHotel] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<'single' | 'double'>('double');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const unassignedAthletes = athletes.filter(a => !a.hotelId);
  const assignedAthletes = athletes.filter(a => a.hotelId);

  const handleAssignment = async () => {
    if (!selectedAthlete || !selectedHotel) return;

    const hotel = hotels.find(h => h.id === selectedHotel);
    if (!hotel) return;

    const capacity = hotel.singleRooms + (hotel.doubleRooms * 2);
    const occupied = hotel.assignedSingle + hotel.assignedDouble;

    if (selectedRoomType === 'single' && hotel.assignedSingle >= hotel.singleRooms) {
      alert('Keine Einzelzimmer verfügbar!');
      return;
    }

    if (selectedRoomType === 'double' && hotel.assignedDouble >= hotel.doubleRooms * 2) {
      alert('Keine Doppelzimmer verfügbar!');
      return;
    }

    try {
      await api.assignAthleteToHotel(selectedAthlete, selectedHotel, selectedRoomType);
      await loadData();
      setSelectedAthlete('');
      setSelectedHotel('');
      setSelectedRoomType('double');
    } catch (err) {
      setError('Fehler beim Zuweisen des Athleten');
      console.error(err);
    }
  };

  const handleRemoveAssignment = async (athleteId: string) => {
    try {
      await api.removeAssignment(athleteId);
      await loadData();
    } catch (err) {
      setError('Fehler beim Entfernen der Zuweisung');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      <h2 className="text-2xl font-bold text-gray-900">Hotelzuweisungen</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Neue Zuweisung</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Athlet auswählen
            </label>
            <select
              value={selectedAthlete}
              onChange={(e) => setSelectedAthlete(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Athlet wählen --</option>
              {unassignedAthletes.map(athlete => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.name} ({athlete.nation} - {athlete.discipline})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zimmertyp
            </label>
            <select
              value={selectedRoomType}
              onChange={(e) => setSelectedRoomType(e.target.value as 'single' | 'double')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="single">Einzelzimmer (EZ)</option>
              <option value="double">Doppelzimmer (DZ)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hotel auswählen
            </label>
            <select
              value={selectedHotel}
              onChange={(e) => setSelectedHotel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Hotel wählen --</option>
              {hotels.map(hotel => {
                const availableSingle = hotel.singleRooms - hotel.assignedSingle;
                const availableDouble = (hotel.doubleRooms * 2) - hotel.assignedDouble;
                const available = selectedRoomType === 'single' ? availableSingle : availableDouble;

                return (
                  <option
                    key={hotel.id}
                    value={hotel.id}
                    disabled={available <= 0}
                  >
                    {hotel.name} ({available} {selectedRoomType === 'single' ? 'EZ' : 'DZ-Plätze'} frei)
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={handleAssignment}
            disabled={!selectedAthlete || !selectedHotel}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            Zuweisen
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold">
            Aktuelle Zuweisungen ({assignedAthletes.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {hotels.map(hotel => {
            const hotelAthletes = assignedAthletes.filter(a => a.hotelId === hotel.id);
            if (hotelAthletes.length === 0) return null;

            return (
              <div key={hotel.id} className="p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  {hotel.name}
                  <span className="ml-2 text-sm text-gray-500">
                    ({hotelAthletes.length} / {hotel.capacity})
                  </span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hotelAthletes.map(athlete => (
                    <div
                      key={athlete.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{athlete.name}</p>
                        <p className="text-sm text-gray-500">
                          {athlete.nation} • {athlete.discipline}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          athlete.roomType === 'single'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {athlete.roomType === 'single' ? 'EZ' : 'DZ'}
                        </span>
                        <button
                          onClick={() => handleRemoveAssignment(athlete.id)}
                          className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unassignedAthletes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-yellow-800 mb-3">
            Nicht zugewiesene Athleten ({unassignedAthletes.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedAthletes.map(athlete => (
              <div key={athlete.id} className="p-3 bg-white rounded-lg">
                <p className="font-medium text-gray-900">{athlete.name}</p>
                <p className="text-sm text-gray-500">
                  {athlete.nation} • {athlete.discipline}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
