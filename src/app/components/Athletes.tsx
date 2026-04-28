import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, Loader2, Filter } from 'lucide-react';
import { api } from '../services/api';
import { Athlete, Hotel } from '../types';

export function Athletes() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [nationFilter, setNationFilter] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAthlete, setNewAthlete] = useState<Partial<Athlete>>({
    lastname: '',
    firstname: '',
    nationCode: '',
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

  // Get unique disciplines and nations for filters
  const uniqueDisciplines = Array.from(new Set(athletes.map(a => a.discipline).filter(Boolean))).sort();
  const uniqueNations = Array.from(new Set(athletes.map(a => a.nationCode).filter(Boolean))).sort();

  const filteredAthletes = athletes.filter(
    athlete => {
      const search = searchTerm.toLowerCase();
      const fullName = `${athlete.firstname} ${athlete.lastname}`.toLowerCase();
      const nation = (athlete.nationCode || '').toLowerCase();
      const discipline = (athlete.discipline || '').toLowerCase();

      const matchesSearch = fullName.includes(search) ||
                           nation.includes(search) ||
                           discipline.includes(search);

      const matchesDiscipline = !disciplineFilter || athlete.discipline === disciplineFilter;
      const matchesNation = !nationFilter || athlete.nationCode === nationFilter;

      return matchesSearch && matchesDiscipline && matchesNation;
    }
  );

  const handleAddAthlete = async () => {
    if (newAthlete.lastname && newAthlete.firstname && newAthlete.nationCode) {
      try {
        await api.createAthlete({
          lastname: newAthlete.lastname,
          firstname: newAthlete.firstname,
          nationCode: newAthlete.nationCode,
          function: 'Athlete',
        });
        await loadData();
        setNewAthlete({ lastname: '', firstname: '', nationCode: '', discipline: '' });
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">Alle Disziplinen</option>
              {uniqueDisciplines.map(discipline => (
                <option key={discipline} value={discipline}>{discipline}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={nationFilter}
              onChange={(e) => setNationFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">Alle Nationen</option>
              {uniqueNations.map(nation => (
                <option key={nation} value={nation}>{nation}</option>
              ))}
            </select>
          </div>
        </div>
        {(disciplineFilter || nationFilter) && (
          <div className="mt-3 flex gap-2">
            <span className="text-sm text-gray-600">Aktive Filter:</span>
            {disciplineFilter && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                Disziplin: {disciplineFilter}
                <button
                  onClick={() => setDisciplineFilter('')}
                  className="ml-1 hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            )}
            {nationFilter && (
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                Nation: {nationFilter}
                <button
                  onClick={() => setNationFilter('')}
                  className="ml-1 hover:text-green-900"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {isAdding && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Neuer Athlet</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <input
              type="text"
              placeholder="Vorname"
              value={newAthlete.firstname || ''}
              onChange={(e) => setNewAthlete({ ...newAthlete, firstname: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Nachname"
              value={newAthlete.lastname || ''}
              onChange={(e) => setNewAthlete({ ...newAthlete, lastname: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Nation (z.B. AUT)"
              value={newAthlete.nationCode || ''}
              onChange={(e) => setNewAthlete({ ...newAthlete, nationCode: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Disziplin (optional)"
              value={newAthlete.discipline || ''}
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
                setNewAthlete({ lastname: '', firstname: '', nationCode: '', discipline: '' });
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
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
                Funktion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Anreise
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Abreise
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zimmertyp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Geteilt mit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAthletes.length > 0 ? (
              filteredAthletes.map((athlete) => (
                <tr key={athlete.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {athlete.firstname} {athlete.lastname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {athlete.nationCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {athlete.discipline || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {athlete.function || 'Athlete'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {athlete.arrivalDate ? new Date(athlete.arrivalDate).toLocaleDateString('de-DE') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {athlete.departureDate ? new Date(athlete.departureDate).toLocaleDateString('de-DE') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {athlete.roomType ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {athlete.roomType}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {athlete.sharedWithName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  Keine Athleten gefunden. {(disciplineFilter || nationFilter) && 'Versuchen Sie andere Filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredAthletes.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            {filteredAthletes.length} von {athletes.length} Athleten angezeigt
          </div>
        )}
      </div>
    </div>
  );
}
