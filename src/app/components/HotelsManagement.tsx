import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, Building2, Calendar, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface RoomType {
  id: string;
  name: string;
  maxPersons: number;
}

interface HotelInventory {
  id: string;
  roomType: RoomType;
  availableFrom: string;
  availableUntil: string;
  roomCount: number;
  hasHalfBoard: boolean;
  hasSR: boolean;
}

interface Hotel {
  id: string;
  name: string;
  location?: string;
  region?: string;
  roomInventories: HotelInventory[];
}

export function HotelsManagement() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [formData, setFormData] = useState({ name: '', location: '', region: '' });

  // Inventory form
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    roomTypeId: '',
    availableFrom: '',
    availableUntil: '',
    roomCount: 0,
    hasHalfBoard: false,
    hasSR: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [hotelsRes, roomTypesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/hotels`),
        fetch(`${API_BASE_URL}/room-types`)
      ]);

      if (!hotelsRes.ok || !roomTypesRes.ok) throw new Error('Failed to load');

      const hotelsData = await hotelsRes.json();
      const roomTypesData = await roomTypesRes.json();

      setHotels(hotelsData);
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
        ? `${API_BASE_URL}/hotels/${editingId}`
        : `${API_BASE_URL}/hotels`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save');

      await loadData();
      setFormData({ name: '', location: '', region: '' });
      setIsAdding(false);
      setEditingId(null);
    } catch (err) {
      setError('Fehler beim Speichern');
    }
  };

  const handleEdit = (hotel: Hotel) => {
    setFormData({
      name: hotel.name,
      location: hotel.location || '',
      region: hotel.region || ''
    });
    setEditingId(hotel.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hotel wirklich löschen? Alle Inventories werden ebenfalls gelöscht.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/hotels/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await loadData();
      if (selectedHotel?.id === id) {
        setSelectedHotel(null);
      }
    } catch (err) {
      setError('Fehler beim Löschen');
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHotel) return;

    try {
      const response = await fetch(`${API_BASE_URL}/hotels/${selectedHotel.id}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inventoryForm),
      });

      if (!response.ok) throw new Error('Failed to add inventory');

      await loadData();
      setShowInventoryForm(false);
      setInventoryForm({
        roomTypeId: '',
        availableFrom: '',
        availableUntil: '',
        roomCount: 0,
        hasHalfBoard: false,
        hasSR: false
      });

      // Update selected hotel
      const updatedHotel = hotels.find(h => h.id === selectedHotel.id);
      if (updatedHotel) setSelectedHotel(updatedHotel);
    } catch (err) {
      setError('Fehler beim Hinzufügen des Inventorys');
    }
  };

  const handleDeleteInventory = async (hotelId: string, inventoryId: string) => {
    if (!confirm('Inventory wirklich löschen?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/hotels/${hotelId}/inventory/${inventoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await loadData();

      // Update selected hotel
      if (selectedHotel) {
        const updatedHotel = hotels.find(h => h.id === selectedHotel.id);
        if (updatedHotel) setSelectedHotel(updatedHotel);
      }
    } catch (err) {
      setError('Fehler beim Löschen');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', location: '', region: '' });
    setIsAdding(false);
    setEditingId(null);
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
        <h2 className="text-2xl font-bold text-gray-900">Hotels & Zimmerkontingente</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Hotel hinzufügen
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
            {editingId ? 'Hotel bearbeiten' : 'Neues Hotel'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hotel Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Grand Hotel Alpine"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ort
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Innsbruck"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Region
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="Tirol"
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
        {/* Hotels List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold">Hotels ({hotels.length})</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {hotels.map((hotel) => (
              <div
                key={hotel.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedHotel?.id === hotel.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedHotel(hotel)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">{hotel.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      {hotel.location && hotel.region
                        ? `${hotel.location}, ${hotel.region}`
                        : hotel.location || hotel.region || 'Keine Ortsinformation'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {hotel.roomInventories.length} Zimmerkontingente
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(hotel);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(hotel.id);
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {hotels.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Keine Hotels vorhanden. Fügen Sie das erste Hotel hinzu!
              </div>
            )}
          </div>
        </div>

        {/* Hotel Details & Inventories */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {selectedHotel ? `${selectedHotel.name} - Zimmerkontingente` : 'Hotel auswählen'}
            </h3>
            {selectedHotel && (
              <button
                onClick={() => setShowInventoryForm(true)}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Kontingent
              </button>
            )}
          </div>

          {selectedHotel ? (
            <div className="p-6 space-y-4">
              {showInventoryForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-blue-900">Neues Zimmerkontingent</h4>
                    <button onClick={() => setShowInventoryForm(false)}>
                      <X className="w-5 h-5 text-blue-600" />
                    </button>
                  </div>
                  <form onSubmit={handleAddInventory}>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Zimmertyp *
                        </label>
                        <select
                          value={inventoryForm.roomTypeId}
                          onChange={(e) => setInventoryForm({ ...inventoryForm, roomTypeId: e.target.value })}
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
                          Anzahl Zimmer *
                        </label>
                        <input
                          type="number"
                          value={inventoryForm.roomCount || ''}
                          onChange={(e) => setInventoryForm({ ...inventoryForm, roomCount: parseInt(e.target.value) || 0 })}
                          required
                          min="1"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Verfügbar von *
                        </label>
                        <input
                          type="date"
                          value={inventoryForm.availableFrom}
                          onChange={(e) => setInventoryForm({ ...inventoryForm, availableFrom: e.target.value })}
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Verfügbar bis *
                        </label>
                        <input
                          type="date"
                          value={inventoryForm.availableUntil}
                          onChange={(e) => setInventoryForm({ ...inventoryForm, availableUntil: e.target.value })}
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={inventoryForm.hasHalfBoard}
                          onChange={(e) => setInventoryForm({ ...inventoryForm, hasHalfBoard: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Halbpension (HP)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={inventoryForm.hasSR}
                          onChange={(e) => setInventoryForm({ ...inventoryForm, hasSR: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">SR</span>
                      </label>
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

              {selectedHotel.roomInventories.length > 0 ? (
                <div className="space-y-3">
                  {selectedHotel.roomInventories.map((inv) => (
                    <div key={inv.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-semibold text-gray-900">{inv.roomType.name}</h5>
                          <p className="text-sm text-gray-600">
                            {inv.roomCount} Zimmer • {inv.roomType.maxPersons} Personen/Zimmer
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteInventory(selectedHotel.id, inv.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(inv.availableFrom).toLocaleDateString('de-DE')} - {new Date(inv.availableUntil).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {inv.hasHalfBoard && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">HP</span>
                        )}
                        {inv.hasSR && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">SR</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Keine Zimmerkontingente vorhanden. Fügen Sie das erste hinzu!
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              Wählen Sie ein Hotel aus der Liste links, um Zimmerkontingente zu verwalten.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
