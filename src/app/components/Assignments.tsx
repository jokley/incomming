import { useState, useEffect } from 'react';
import { Save, Loader2, Trash2, Users, Info } from 'lucide-react';
import { api } from '../services/api';
import { Athlete, Hotel, RoomType, RoomAssignment } from '../types';

export function Assignments() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<string>('');
  const [selectedHotel, setSelectedHotel] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [athletesData, hotelsData, roomTypesData, assignmentsData] = await Promise.all([
        api.getAthletes(),
        api.getHotels(),
        api.getRoomTypes(),
        api.getRoomAssignments(),
      ]);
      setAthletes(athletesData);
      setHotels(hotelsData);
      setRoomTypes(roomTypesData);
      setAssignments(assignmentsData);
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Get assigned athlete IDs
  const assignedAthleteIds = new Set(assignments.map(a => a.athlete.id));
  const unassignedAthletes = athletes.filter(a => !assignedAthleteIds.has(a.id));

  // Find potential room partners for selected athlete
  const selectedAthleteData = athletes.find(a => a.id === selectedAthlete);
  const normalizeName = (value: string) =>
    value
      .toLowerCase()
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const matchesSharedWithName = (candidate: Athlete, sharedWithName: string) => {
    const target = normalizeName(sharedWithName);
    const first = normalizeName(candidate.firstname);
    const last = normalizeName(candidate.lastname);
    if (!target || !first || !last) return false;
    return target.includes(first) && target.includes(last);
  };

  const potentialPartners = selectedAthleteData
    ? (() => {
        const eligible = athletes.filter(
          a => a.id !== selectedAthlete && !assignedAthleteIds.has(a.id)
        );

        const requested = selectedAthleteData.sharedWithName
          ? eligible.filter(a => matchesSharedWithName(a, selectedAthleteData.sharedWithName!))
          : [];

        const sameNation = eligible.filter(a => a.nationCode === selectedAthleteData.nationCode);

        const merged = [...requested, ...sameNation.filter(a => !requested.some(r => r.id === a.id))];
        return merged;
      })()
    : [];

  const handleAssignment = async () => {
    if (!selectedAthlete || !selectedHotel || !selectedRoomType) {
      setError('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    try {
      const athlete = athletes.find(a => a.id === selectedAthlete);
      await api.createRoomAssignment({
        athleteId: selectedAthlete,
        hotelId: selectedHotel,
        roomTypeId: selectedRoomType,
        checkInDate: athlete?.arrivalDate,
        checkOutDate: athlete?.departureDate,
        sharedWithAthleteId: selectedPartner || undefined,
      });

      await loadData();
      setSelectedAthlete('');
      setSelectedHotel('');
      setSelectedRoomType('');
      setSelectedPartner('');
      setError(null);
    } catch (err) {
      setError('Fehler beim Zuweisen des Athleten');
      console.error(err);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Zuweisung wirklich entfernen?')) return;

    try {
      await api.deleteRoomAssignment(assignmentId);
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

  // Get EZ and DZ room types
  const ezRoomType = roomTypes.find(rt => rt.maxPersons === 1);
  const dzRoomType = roomTypes.find(rt => rt.maxPersons === 2);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Hotelzuweisungen</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Schließen</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Neue Zuweisung</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Athlet auswählen *
            </label>
            <select
              value={selectedAthlete}
              onChange={(e) => {
                setSelectedAthlete(e.target.value);
                setSelectedPartner(''); // Reset partner when athlete changes
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Athlet wählen --</option>
              {unassignedAthletes.map(athlete => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.firstname} {athlete.lastname} ({athlete.nationCode})
                </option>
              ))}
            </select>
            {selectedAthleteData?.sharedWithName && (
              <p className="text-xs text-blue-600 mt-1">
                <Info className="w-3 h-3 inline mr-1" />
                Wunsch: {selectedAthleteData.sharedWithName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hotel *
            </label>
            <select
              value={selectedHotel}
              onChange={(e) => setSelectedHotel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Hotel wählen --</option>
              {hotels.map(hotel => {
                const totalRooms = hotel.roomInventories?.reduce((sum, inv) => sum + inv.roomCount, 0) || 0;
                return (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name} ({hotel.location})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zimmertyp *
            </label>
            <select
              value={selectedRoomType}
              onChange={(e) => setSelectedRoomType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Typ wählen --</option>
              {ezRoomType && (
                <option value={ezRoomType.id}>Einzelzimmer (EZ)</option>
              )}
              {dzRoomType && (
                <option value={dzRoomType.id}>Doppelzimmer (DZ)</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zimmerpartner (optional)
            </label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              disabled={!selectedAthlete || selectedRoomType === ezRoomType?.id}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">-- Kein Partner --</option>
              {potentialPartners.map(athlete => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.firstname} {athlete.lastname}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAssignment}
            disabled={!selectedAthlete || !selectedHotel || !selectedRoomType}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            Zuweisen
          </button>
        </div>

        {selectedAthleteData && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-medium">
                {selectedAthleteData.firstname} {selectedAthleteData.lastname}
              </span>
              <span className="text-gray-500">
                {selectedAthleteData.nationCode}{selectedAthleteData.discipline ? ` • ${selectedAthleteData.discipline}` : ''}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Anreise:</span>{' '}
                {selectedAthleteData.arrivalDate ? new Date(selectedAthleteData.arrivalDate).toLocaleDateString('de-DE') : '-'}
              </div>
              <div>
                <span className="text-gray-500">Abreise:</span>{' '}
                {selectedAthleteData.departureDate ? new Date(selectedAthleteData.departureDate).toLocaleDateString('de-DE') : '-'}
              </div>
              <div>
                <span className="text-gray-500">Präferenz:</span>{' '}
                {selectedAthleteData.roomType || '-'}
                {selectedAthleteData.sharedWithName ? ` (mit ${selectedAthleteData.sharedWithName})` : ''}
              </div>
            </div>
            {(selectedAthleteData.missingFromLatestAthletesImport || selectedAthleteData.missingFromLatestRoomlistImport) && (
              <div className="mt-2 text-xs">
                {selectedAthleteData.missingFromLatestAthletesImport && (
                  <span className="mr-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    Nicht in letzter Athletenliste
                  </span>
                )}
                {selectedAthleteData.missingFromLatestRoomlistImport && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                    Nicht in letzter Roomlist
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assignments by Hotel */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold">
            Zuweisungen nach Hotel ({assignments.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {hotels.map(hotel => {
            const hotelAssignments = assignments.filter(a => a.hotel.id === hotel.id);
            if (hotelAssignments.length === 0) return null;

            return (
              <div key={hotel.id} className="p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  {hotel.name} ({hotel.location}, {hotel.region})
                  <span className="ml-2 text-sm text-gray-500">
                    {hotelAssignments.length} Athleten
                  </span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hotelAssignments.map(assignment => (
                    <div
                      key={assignment.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {assignment.athlete.firstname} {assignment.athlete.lastname}
                        </p>
                        <p className="text-xs text-gray-500">
                          {assignment.athlete.nationCode} • {assignment.athlete.discipline || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {assignment.athlete.arrivalDate ? new Date(assignment.athlete.arrivalDate).toLocaleDateString('de-DE') : '-'}
                          {' '}→{' '}
                          {assignment.athlete.departureDate ? new Date(assignment.athlete.departureDate).toLocaleDateString('de-DE') : '-'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            assignment.roomType.maxPersons === 1
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {assignment.roomType.name}
                          </span>
                          {assignment.sharedWith && (
                            <span className="text-xs text-gray-600 flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              mit {assignment.sharedWith.firstname} {assignment.sharedWith.lastname}
                            </span>
                          )}
                        </div>
                        {assignment.athlete.sharedWithName && !assignment.sharedWith && (
                          <p className="text-xs text-orange-600 mt-1">
                            <Info className="w-3 h-3 inline mr-1" />
                            Wunsch: {assignment.athlete.sharedWithName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {assignments.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              Noch keine Zuweisungen vorhanden. Weisen Sie Athleten zu Hotels zu.
            </div>
          )}
        </div>
      </div>

      {/* Unassigned Athletes */}
      {unassignedAthletes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-yellow-800 mb-3 flex items-center">
            <Info className="w-5 h-5 mr-2" />
            Nicht zugewiesene Athleten ({unassignedAthletes.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {unassignedAthletes.map(athlete => (
              <div key={athlete.id} className="p-3 bg-white rounded-lg border border-yellow-300">
                <p className="font-medium text-gray-900">
                  {athlete.firstname} {athlete.lastname}
                </p>
                <p className="text-xs text-gray-500">
                  {athlete.nationCode} • {athlete.discipline || 'N/A'}
                </p>
                {athlete.sharedWithName && (
                  <p className="text-xs text-blue-600 mt-1">
                    <Users className="w-3 h-3 inline mr-1" />
                    Wunsch: {athlete.sharedWithName}
                  </p>
                )}
                {athlete.roomType && (
                  <p className="text-xs text-gray-500 mt-1">
                    Präferenz: {athlete.roomType}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
