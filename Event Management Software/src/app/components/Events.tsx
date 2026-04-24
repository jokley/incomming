import { useState, useEffect } from 'react';
import { Plus, Calendar, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Event } from '../types';

export function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    name: '',
    discipline: '',
    startDate: '',
    endDate: '',
    targetQuota: 0,
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
    if (newEvent.name && newEvent.discipline && newEvent.startDate && newEvent.endDate && newEvent.targetQuota) {
      try {
        await api.createEvent({
          name: newEvent.name,
          discipline: newEvent.discipline,
          startDate: newEvent.startDate,
          endDate: newEvent.endDate,
          targetQuota: newEvent.targetQuota,
        });
        await loadData();
        setNewEvent({ name: '', discipline: '', startDate: '', endDate: '', targetQuota: 0 });
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

  const getQuotaColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Event Name"
              value={newEvent.name}
              onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Disziplin"
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
            <input
              type="number"
              placeholder="Soll-Kontingent"
              value={newEvent.targetQuota || ''}
              onChange={(e) => setNewEvent({ ...newEvent, targetQuota: parseInt(e.target.value) || 0 })}
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
                setNewEvent({ name: '', discipline: '', startDate: '', endDate: '', targetQuota: 0 });
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
          <h3 className="text-lg font-semibold mb-6">Gantt Chart - Zeitlicher Verlauf</h3>

          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
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

              <div className="space-y-3">
                {events.map((event) => {
                  const position = getEventPosition(event);
                  const quotaPercentage = (event.currentQuota / event.targetQuota) * 100;

                  return (
                    <div key={event.id} className="flex items-center group">
                      <div className="w-48 flex-shrink-0 pr-4">
                        <div className="text-sm font-medium text-gray-900">{event.name}</div>
                        <div className="text-xs text-gray-500">{event.discipline}</div>
                      </div>
                      <div className="flex-1 relative h-12 bg-gray-100 rounded">
                        <div
                          className="absolute top-1 h-10 rounded flex items-center px-3 text-white text-sm font-medium transition-all"
                          style={position}
                          title={`${event.currentQuota} / ${event.targetQuota}`}
                        >
                          <div className={`absolute inset-0 rounded ${getQuotaColor(event.currentQuota, event.targetQuota)}`} />
                          <div className="relative z-10 flex items-center justify-between w-full">
                            <span className="truncate">
                              {event.currentQuota} / {event.targetQuota}
                            </span>
                            <span className="text-xs ml-2">
                              {quotaPercentage.toFixed(0)}%
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

          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Legende:</h4>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-600">≥100% Kontingent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-gray-600">75-99% Kontingent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-gray-600">50-74% Kontingent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-gray-600">&lt;50% Kontingent</span>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disziplin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Soll-Kontingent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ist-Kontingent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => {
              const percentage = (event.currentQuota / event.targetQuota) * 100;
              return (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {event.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.discipline}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.startDate).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.endDate).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.targetQuota}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {event.currentQuota}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      percentage >= 100 ? 'bg-green-100 text-green-800' :
                      percentage >= 75 ? 'bg-yellow-100 text-yellow-800' :
                      percentage >= 50 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
