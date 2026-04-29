import { useState, useEffect, useMemo } from 'react';
import { Save, Loader2, Trash2, Users, Info } from 'lucide-react';
import { api } from '../services/api';
import { Athlete, Hotel, RoomType, RoomAssignment } from '../types';
import { OfficialQuotaUsage, getComplianceStatus } from '../services/fisRules';

type BookingType = 'single' | 'double';

type AssignmentGroup = {
  key: string;
  assignment: RoomAssignment;
  members: Athlete[];
};

export function Assignments() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [bookingType, setBookingType] = useState<BookingType>('single');
  const [occupant1Id, setOccupant1Id] = useState<string>('');
  const [occupant2Id, setOccupant2Id] = useState<string>('');
  const [selectedHotel, setSelectedHotel] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaUsage, setQuotaUsage] = useState<OfficialQuotaUsage[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [athletesData, hotelsData, roomTypesData, assignmentsData, quotaData] = await Promise.all([
        api.getAthletes(),
        api.getHotels(),
        api.getRoomTypes(),
        api.getRoomAssignments(),
        api.getOfficialQuotaUsage(),
      ]);
      setAthletes(athletesData);
      setHotels(hotelsData);
      setRoomTypes(roomTypesData);
      setAssignments(assignmentsData);
      setQuotaUsage(quotaData);
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const assignedAthleteIds = new Set(assignments.map(a => a.athlete.id));
  const unassignedAthletes = athletes.filter(a => !assignedAthleteIds.has(a.id));

  const occupant1 = athletes.find(a => a.id === occupant1Id);
  const occupant2 = athletes.find(a => a.id === occupant2Id);
  const selectedHotelData = hotels.find(h => h.id === selectedHotel);
  const selectedRoomTypeData = roomTypes.find(rt => rt.id === selectedRoomType);

  const assignmentGroups = useMemo<AssignmentGroup[]>(() => {
    const grouped = new Map<string, AssignmentGroup>();

    assignments.forEach((assignment) => {
      const partnerId = assignment.sharedWith?.id;
      const groupKey = partnerId
        ? [assignment.athlete.id, partnerId].sort().join('-')
        : `single-${assignment.athlete.id}-${assignment.id}`;

      if (!grouped.has(groupKey)) {
        const members = [assignment.athlete, ...(assignment.sharedWith ? [assignment.sharedWith] : [])]
          .filter((member, index, arr) => arr.findIndex(a => a.id === member.id) === index);
        grouped.set(groupKey, { key: groupKey, assignment, members });
      }
    });

    return Array.from(grouped.values());
  }, [assignments]);

  const roomBookingOutcome = useMemo(() => {
    const issues: string[] = [];
    const participants = [occupant1, bookingType === 'double' ? occupant2 : undefined].filter(Boolean) as Athlete[];

    if (!occupant1) issues.push('Belegung 1 fehlt');
    if (bookingType === 'double' && !occupant2) issues.push('Belegung 2 fehlt');
    if (occupant1Id && occupant1Id === occupant2Id) issues.push('Athlet darf nicht doppelt gewählt werden');

    if (participants.length > 1) {
      const genders = participants.map(p => p.gender || p.forGender).filter(Boolean);
      if (genders.length > 1 && new Set(genders).size > 1) issues.push('Gender-Check: gemischte Belegung');
    }

    if (selectedHotelData && selectedRoomTypeData) {
      const inventory = selectedHotelData.roomInventories?.find(inv => inv.roomType.id === selectedRoomTypeData.id);
      const used = assignments.filter(
        a => a.hotel.id === selectedHotelData.id && a.roomType.id === selectedRoomTypeData.id
      ).length;
      if (inventory && used >= inventory.roomCount) issues.push('Quota-Check: keine freien Kontingente mehr');
    }

    const overlapParticipant = participants.find(participant =>
      assignments.some(a =>
        a.athlete.id === participant.id || a.sharedWith?.id === participant.id
      )
    );
    if (overlapParticipant) issues.push(`Overlap-Check: ${overlapParticipant.firstname} ist bereits zugewiesen`);

    return {
      participants,
      issues,
      canSubmit:
        !!occupant1 &&
        !!selectedHotel &&
        !!selectedRoomType &&
        (bookingType === 'single' || !!occupant2) &&
        issues.length === 0,
    };
  }, [bookingType, occupant1, occupant1Id, occupant2, occupant2Id, selectedHotel, selectedHotelData, selectedRoomType, selectedRoomTypeData, assignments]);

  const handleBookingSubmit = async () => {
    if (!roomBookingOutcome.canSubmit || !occupant1) {
      setError('Bitte alle Pflichtfelder ausfüllen und Rule-Checks erfüllen');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const athleteIds = [
        occupant1.id,
        ...(bookingType === 'double' && occupant2?.id ? [occupant2.id] : []),
      ];

      if (new Set(athleteIds).size !== athleteIds.length) {
        setError('Athlet darf nicht doppelt gewählt werden');
        return;
      }

      await api.createRoomAssignment({
        athleteIds,
        hotelId: selectedHotel,
        roomTypeId: selectedRoomType,
        checkInDate: occupant1.arrivalDate || undefined,
        checkOutDate: occupant1.departureDate || undefined,
      });

      const freshAssignments = await api.getRoomAssignments();
      setAssignments(freshAssignments);

      setBookingType('single');
      setOccupant1Id('');
      setOccupant2Id('');
      setSelectedHotel('');
      setSelectedRoomType('');
    } catch (err) {
      setError('Fehler beim Buchen');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Buchung wirklich entfernen?')) return;
    try {
      await api.deleteRoomAssignment(assignmentId);
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) {
      setError('Fehler beim Entfernen der Buchung');
      console.error(err);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Hotelzuweisungen</h2>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold">Room Booking Form</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Booking type *</label>
            <select value={bookingType} onChange={(e) => setBookingType(e.target.value as BookingType)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              <option value="single">Single</option>
              <option value="double">Double</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Occupant slot 1 *</label>
            <select value={occupant1Id} onChange={(e) => setOccupant1Id(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              <option value="">-- Athlet wählen --</option>
              {unassignedAthletes.map(a => <option key={a.id} value={a.id}>{a.firstname} {a.lastname}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Occupant slot 2 {bookingType === 'double' ? '*' : '(optional)'}</label>
            <select value={occupant2Id} disabled={bookingType !== 'double'} onChange={(e) => setOccupant2Id(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100">
              <option value="">-- Athlet wählen --</option>
              {unassignedAthletes.filter(a => a.id !== occupant1Id).map(a => <option key={a.id} value={a.id}>{a.firstname} {a.lastname}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hotel *</label>
            <select value={selectedHotel} onChange={(e) => setSelectedHotel(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">-- Hotel wählen --</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Room type *</label>
            <select value={selectedRoomType} onChange={(e) => setSelectedRoomType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">-- Typ wählen --</option>{roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}</select>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-blue-50">
          <h4 className="font-semibold text-gray-900 mb-2">Live Preview</h4>
          <div className="text-sm text-gray-700 grid md:grid-cols-2 gap-2">
            <div>Hotel: {selectedHotelData?.name || '-'}</div>
            <div>Room type: {selectedRoomTypeData?.name || '-'}</div>
            <div>Date span: {occupant1?.arrivalDate ? new Date(occupant1.arrivalDate).toLocaleDateString('de-DE') : '-'} → {occupant1?.departureDate ? new Date(occupant1.departureDate).toLocaleDateString('de-DE') : '-'}</div>
            <div>Occupants: {roomBookingOutcome.participants.map(p => `${p.firstname} ${p.lastname}`).join(' + ') || '-'}</div>
          </div>
          <div className="mt-2 text-sm">
            <span className="font-medium">Rule checks:</span>
            {roomBookingOutcome.issues.length === 0 ? <span className="text-green-700"> OK (gender, quota, overlap)</span> : (
              <ul className="list-disc ml-5 text-red-700">
                {roomBookingOutcome.issues.map(issue => <li key={issue}>{issue}</li>)}
              </ul>
            )}
          </div>
        </div>

        <button onClick={handleBookingSubmit} disabled={!roomBookingOutcome.canSubmit || submitting} className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300">
          {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
          {bookingType === 'double' ? 'Book both now' : 'Book now'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Current booking list ({assignmentGroups.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assignmentGroups.map(group => (
            <div key={group.key} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{group.assignment.hotel.name} • {group.assignment.roomType.name}</p>
                  <p className="text-xs text-gray-500">{group.members.map(m => `${m.firstname} ${m.lastname}`).join(' + ')}</p>
                </div>
                <button onClick={() => handleRemoveAssignment(group.assignment.id)} className="text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
