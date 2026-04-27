import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, Calendar, X, TrendingUp } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface RoomType {
  id: string;
  name: string;
  maxPersons: number;
}

interface EventRoomDemand {
  id: string;
  roomType: RoomType;
  roomCount: number;
}

interface Event {
  id: string;
  discipline: string;
  startDate: string;
  endDate: string;
  roomDemands: EventRoomDemand[];
}

export function EventsManagement() {
  const [events, setEvents] = useState<Event[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({ discipline: '', startDate: '', endDate: '' });

  // Demand form
  const [showDemandForm, setShowDemandForm] = useState(false);
  const [demandForm, setDemandForm] = useState({
    roomTypeId: '',
    roomCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsRes, roomTypesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/events`),
        fetch(`${API_BASE_URL}/room-types`)
      ]);

      if (!eventsRes.ok || !roomTypesRes.ok) throw new Error('Failed to load');

      const eventsData = await eventsRes.json();
      const roomTypesData = await roomTypesRes.json();

      setEvents(eventsData);
      setRoomTypes(roomTypesData);
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingId
        ? `${API_BASE_URL}/events/${editingId}`
        : `${API_BASE_URL}/events`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save');

      await loadData();
      setFormData({ discipline: '', startDate: '', endDate: '' });
      setIsAdding(false);
      setEditingId(null);
    } catch (err) {
      setError('Fehler beim Speichern');
    }
  };

  const handleEdit = (event: Event) => {
    setFormData({
      discipline: event.discipline,
      startDate: event.startDate,
      endDate: event.endDate
    });
    setEditingId(event.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Event wirklich löschen? Alle Room Demands werden ebenfalls gelöscht.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/events/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await loadData();
      if (selectedEvent?.id === id) {
        setSelectedEvent(null);
      }
    } catch (err) {
      setError('Fehler beim Löschen');
    }
  };

  const handleAddDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      const response = await fetch(`${API_BASE_URL}/events/${selectedEvent.id}/demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demandForm),
      });

      if (!response.ok) throw new Error('Failed to add demand');

      await loadData();
      setShowDemandForm(false);
      setDemandForm({
        roomTypeId: '',
        roomCount: 0
      });

      // Update selected event
      const updatedEvent = events.find(e => e.id === selectedEvent.id);
      if (updatedEvent) setSelectedEvent(updatedEvent);
    } catch (err) {
      setError('Fehler beim Hinzufügen des Bedarfs');
    }
  };

  const handleDeleteDemand = async (eventId: string, demandId: string) => {
    if (!confirm('Bedarf wirklich löschen?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/demand/${demandId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await loadData();

      // Update selected event
      if (selectedEvent) {
        const updatedEvent = events.find(e => e.id === selectedEvent.id);
        if (updatedEvent) setSelectedEvent(updatedEvent);
      }
    } catch (err) {
      setError('Fehler beim Löschen');
    }
  };

  const handleCancel = () => {
    setFormData({ discipline: '', startDate: '', endDate: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const calculateTotalBeds = (demands: EventRoomDemand[]) => {
    return demands.reduce((sum, d) => sum + (d.roomCount * d.roomType.maxPersons), 0);
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Events & Zimmerbedarf</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Event hinzufügen
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Schließen</button>
        </div>
      )}

      {isAdding && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Event bearbeiten' : 'Neues Event'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Disziplin *
                </label>
                <input
                  type="text"
                  value={formData.discipline}
                  onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                  required
                  placeholder="Big Air, Moguls, Slopestyle..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Datum *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Datum *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? 'Aktualisieren' : 'Erstellen'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold">Events ({events.length})</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedEvent?.id === event.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">{event.discipline}</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      {new Date(event.startDate).toLocaleDateString('de-DE')} - {new Date(event.endDate).toLocaleDateString('de-DE')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {event.roomDemands.length} Zimmertypen • {calculateTotalBeds(event.roomDemands)} Betten
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(event);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(event.id);
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Keine Events vorhanden. Fügen Sie das erste Event hinzu!
              </div>
            )}
          </div>
        </div>

        {/* Event Details & Demands */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {selectedEvent ? `${selectedEvent.discipline} - Zimmerbedarf` : 'Event auswählen'}
            </h3>
            {selectedEvent && (
              <button
                onClick={() => setShowDemandForm(true)}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Bedarf
              </button>
            )}
          </div>

          {selectedEvent ? (
            <div className="p-6 space-y-4">
              {showDemandForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-blue-900">Neuer Zimmerbedarf</h4>
                    <button onClick={() => setShowDemandForm(false)}>
                      <X className="w-5 h-5 text-blue-600" />
                    </button>
                  </div>
                  <form onSubmit={handleAddDemand}>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Zimmertyp *
                        </label>
                        <select
                          value={demandForm.roomTypeId}
                          onChange={(e) => setDemandForm({ ...demandForm, roomTypeId: e.target.value })}
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Wählen --</option>
                          {roomTypes.map(rt => (
                            <option key={rt.id} value={rt.id}>{rt.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Benötigte Zimmer *
                        </label>
                        <input
                          type="number"
                          value={demandForm.roomCount || ''}
                          onChange={(e) => setDemandForm({ ...demandForm, roomCount: parseInt(e.target.value) || 0 })}
                          required
                          min="1"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Hinzufügen
                    </button>
                  </form>
                </div>
              )}

              {selectedEvent.roomDemands.length > 0 ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-green-900">Gesamt Bedarf</p>
                        <p className="text-xs text-green-700">
                          {selectedEvent.roomDemands.reduce((sum, d) => sum + d.roomCount, 0)} Zimmer • {calculateTotalBeds(selectedEvent.roomDemands)} Betten
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedEvent.roomDemands.map((demand) => (
                    <div key={demand.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900">{demand.roomType.name}</h5>
                          <p className="text-sm text-gray-600">
                            {demand.roomCount} Zimmer benötigt
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            = {demand.roomCount * demand.roomType.maxPersons} Betten ({demand.roomType.maxPersons} Personen/Zimmer)
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteDemand(selectedEvent.id, demand.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Kein Zimmerbedarf definiert. Fügen Sie den ersten hinzu!
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              Wählen Sie ein Event aus der Liste links, um den Zimmerbedarf zu verwalten.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
