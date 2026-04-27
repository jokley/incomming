import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Athlete, Hotel } from '../types';

export function Athletes() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAthlete, setNewAthlete] = useState<Partial<Athlete>>({
    name: '',
    nation: '',
    discipline: '',
  });

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

  const filteredAthletes = athletes.filter(
    athlete =>
      athlete.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      athlete.nation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      athlete.discipline.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddAthlete = async () => {
    if (newAthlete.name && newAthlete.nation && newAthlete.discipline) {
      try {
        await api.createAthlete({
          name: newAthlete.name,
          nation: newAthlete.nation,
          discipline: newAthlete.discipline,
        });
        await loadData();
        setNewAthlete({ name: '', nation: '', discipline: '' });
        setIsAdding(false);
      } catch (err) {
        setError('Fehler beim Hinzufügen des Athleten');
        console.error(err);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Athleten wirklich löschen?')) {
      try {
        await api.deleteAthlete(id);
        await loadData();
      } catch (err) {
        setError('Fehler beim Löschen des Athleten');
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Athletenverwaltung</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Athlet hinzufügen
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Athleten suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {isAdding && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Neuer Athlet</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Name"
              value={newAthlete.name}
              onChange={(e) => setNewAthlete({ ...newAthlete, name: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Nation"
              value={newAthlete.nation}
              onChange={(e) => setNewAthlete({ ...newAthlete, nation: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Disziplin"
              value={newAthlete.discipline}
              onChange={(e) => setNewAthlete({ ...newAthlete, discipline: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddAthlete}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Speichern
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewAthlete({ name: '', nation: '', discipline: '' });
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Disziplin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hotel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAthletes.map((athlete) => (
              <tr key={athlete.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {athlete.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {athlete.nation}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {athlete.discipline}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {athlete.hotelId ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      {hotels.find(h => h.id === athlete.hotelId)?.name}
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                      Nicht zugewiesen
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(athlete.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
