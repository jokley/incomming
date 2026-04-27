import { useState, useEffect } from 'react';
import { Plus, Calendar, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Event } from '../types';

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newEvent, setNewEvent] = useState({
    discipline: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getEvents();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden der Events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async () => {
    if (newEvent.discipline && newEvent.startDate && newEvent.endDate) {
      try {
        await api.createEvent({
          discipline: newEvent.discipline,
          startDate: newEvent.startDate,
          endDate: newEvent.endDate,
        });
        await loadData();
        setNewEvent({ discipline: '', startDate: '', endDate: '' });
        setIsAdding(false);
      } catch (err) {
        setError('Fehler beim Hinzufügen des Events');
        console.error(err);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Event wirklich löschen?')) {
      try {
        await api.deleteEvent(id);
        await loadData();
      } catch (err) {
        setError('Fehler beim Löschen des Events');
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Calculate Gantt chart dimensions
  const allDates = events.flatMap(e => [new Date(e.startDate), new Date(e.endDate)]);
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const getEventPosition = (event: Event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const startOffset = Math.ceil((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
    };
  };

  const getEventBeds = (event: Event) => {
    if (!event.roomDemands) return 0;
    return event.roomDemands.reduce((total, demand) => {
      return total + (demand.roomCount * demand.roomType.maxPersons);
    }, 0);
  };

  const getEventRooms = (event: Event) => {
    if (!event.roomDemands) return 0;
    return event.roomDemands.reduce((total, demand) => total + demand.roomCount, 0);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Veranstaltungen & Timeline</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Event hinzufügen
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Neues Event</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Disziplin (z.B. Big Air)"
              value={newEvent.discipline}
              onChange={(e) => setNewEvent({ ...newEvent, discipline: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="date"
              placeholder="Start Datum"
              value={newEvent.startDate}
              onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="date"
              placeholder="End Datum"
              value={newEvent.endDate}
              onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddEvent}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Speichern
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewEvent({ discipline: '', startDate: '', endDate: '' });
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Gantt Chart - Zeitlicher Verlauf
          </h3>

          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Date header */}
              <div className="flex mb-2 text-sm text-gray-600">
                <div className="w-48 flex-shrink-0"></div>
                <div className="flex-1 flex justify-between px-4">
                  {Array.from({ length: Math.min(totalDays, 30) }, (_, i) => {
                    const date = new Date(minDate);
                    date.setDate(date.getDate() + Math.floor(i * totalDays / Math.min(totalDays, 30)));
                    return (
                      <span key={i} className="text-xs">
                        {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Events */}
              <div className="space-y-3">
                {events.map((event) => {
                  const position = getEventPosition(event);
                  const totalBeds = getEventBeds(event);
                  const totalRooms = getEventRooms(event);

                  return (
                    <div key={event.id} className="flex items-center group">
                      <div className="w-48 flex-shrink-0 pr-4">
                        <div className="text-sm font-medium text-gray-900">{event.discipline}</div>
                        <div className="text-xs text-gray-500">
                          {totalRooms} Zimmer · {totalBeds} Betten
                        </div>
                      </div>
                      <div className="flex-1 relative h-12 bg-gray-100 rounded">
                        <div
                          className="absolute top-1 h-10 rounded flex items-center px-3 text-white text-sm font-medium transition-all bg-blue-500 hover:bg-blue-600"
                          style={position}
                          title={`${event.discipline}: ${totalRooms} Zimmer, ${totalBeds} Betten`}
                        >
                          <div className="relative z-10 flex items-center justify-between w-full">
                            <span className="truncate">
                              {totalRooms} Zimmer
                            </span>
                            <span className="text-xs ml-2">
                              {totalBeds} Betten
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="ml-2 opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition-opacity"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold">Event Übersicht</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disziplin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zimmer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betten</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => {
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const totalRooms = getEventRooms(event);
              const totalBeds = getEventBeds(event);

              return (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {event.discipline}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {start.toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {end.toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {duration} {duration === 1 ? 'Tag' : 'Tage'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {totalRooms}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {totalBeds}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {events.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            Keine Events vorhanden. Klicken Sie auf "Event hinzufügen" um ein neues Event zu erstellen.
          </div>
        )}
      </div>
    </div>
  );
}
