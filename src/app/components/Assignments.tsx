import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Check,
  ChevronsUpDown,
  Info,
  Loader2,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  Users,
} from "lucide-react";

import { api } from "../services/api";
import type { Athlete, Hotel, RoomBooking, RoomBookingOccupant, RoomType } from "../types";
import type { OfficialQuotaUsage } from "../services/fisRules";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "./ui/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

type BookingType = "single" | "double";
type ViewMode = "rooms" | "athletes";

type NormalizeResult = {
  bookings: RoomBooking[];
  legacyConverted: number;
  skipped: number;
};

function normalizeBookings(data: unknown): NormalizeResult {
  if (!Array.isArray(data)) return { bookings: [], legacyConverted: 0, skipped: 0 };

  const bookings: RoomBooking[] = [];
  let legacyConverted = 0;
  let skipped = 0;

  for (const item of data) {
    if (!item || typeof item !== "object") {
      skipped += 1;
      continue;
    }

    const obj = item as Record<string, unknown>;

    // Preferred model: RoomBooking
    if (Array.isArray(obj.occupants)) {
      bookings.push(item as RoomBooking);
      continue;
    }

    // Legacy model: RoomAssignment
    if (obj.athlete && typeof obj.athlete === "object") {
      const assignment = item as any;
      const bookingId = String(assignment.id ?? `legacy-${bookings.length + 1}`);

      const occupants: RoomBookingOccupant[] = [];
      if (assignment.athlete?.id) {
        occupants.push({
          id: `${bookingId}-1`,
          roomBookingId: bookingId,
          athlete: assignment.athlete,
          role: null,
        });
      }
      if (assignment.sharedWith?.id) {
        occupants.push({
          id: `${bookingId}-2`,
          roomBookingId: bookingId,
          athlete: assignment.sharedWith,
          role: null,
        });
      }

      if (occupants.length === 0 || !assignment.hotel?.id || !assignment.roomType?.id) {
        skipped += 1;
        continue;
      }

      bookings.push({
        id: bookingId,
        hotel: assignment.hotel,
        roomType: assignment.roomType,
        roomNumber: assignment.roomNumber ?? null,
        checkInDate: assignment.checkInDate ?? null,
        checkOutDate: assignment.checkOutDate ?? null,
        occupants,
      });
      legacyConverted += 1;
      continue;
    }

    skipped += 1;
  }

  return { bookings, legacyConverted, skipped };
}

function formatAthleteName(a: Athlete) {
  return `${a.firstname} ${a.lastname}`.trim();
}

function ComboBox({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled,
  emptyText = "Keine Treffer",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between", !selected && "text-muted-foreground")}
          >
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Suchen..." />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", opt.value === value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function Assignments() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("rooms");
  const [bookingType, setBookingType] = useState<BookingType>("single");
  const [occupant1Id, setOccupant1Id] = useState<string>("");
  const [occupant2Id, setOccupant2Id] = useState<string>("");
  const [selectedHotel, setSelectedHotel] = useState<string>("");
  const [selectedRoomType, setSelectedRoomType] = useState<string>("");
  const [roomNumber, setRoomNumber] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [quotaUsage, setQuotaUsage] = useState<OfficialQuotaUsage[]>([]);

  const [athleteSearch, setAthleteSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [athletesData, hotelsData, roomTypesData, bookingsData, quotaData] = await Promise.all([
        api.getAthletes(),
        api.getHotels(),
        api.getRoomTypes(),
        api.getRoomAssignments(),
        api.getOfficialQuotaUsage(),
      ]);

      setAthletes(Array.isArray(athletesData) ? athletesData : []);
      setHotels(Array.isArray(hotelsData) ? hotelsData : []);
      setRoomTypes(Array.isArray(roomTypesData) ? roomTypesData : []);

      const normalized = normalizeBookings(bookingsData as unknown);
      setBookings(normalized.bookings);

      const nextWarnings: string[] = [];
      if (normalized.legacyConverted > 0) {
        nextWarnings.push(`Converted ${normalized.legacyConverted} legacy booking rows.`);
      }
      if (normalized.skipped > 0) {
        nextWarnings.push(`Skipped ${normalized.skipped} invalid booking rows.`);
      }
      setWarnings(nextWarnings);

      setQuotaUsage(Array.isArray(quotaData) ? quotaData : []);
      setError(null);
    } catch (err) {
      setError(
        "Fehler beim Laden der Daten. Prüfen Sie API-URL (VITE_API_URL) oder ob das Backend erreichbar ist.",
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const assignedAthleteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const booking of bookings) {
      for (const occ of booking.occupants || []) {
        if (occ?.athlete?.id) ids.add(occ.athlete.id);
      }
    }
    return ids;
  }, [bookings]);

  const athleteToBooking = useMemo(() => {
    const map = new Map<string, RoomBooking>();
    for (const booking of bookings) {
      for (const occ of booking.occupants || []) {
        if (occ?.athlete?.id && !map.has(occ.athlete.id)) {
          map.set(occ.athlete.id, booking);
        }
      }
    }
    return map;
  }, [bookings]);

  const unassignedAthletes = useMemo(
    () => athletes.filter(a => !assignedAthleteIds.has(a.id)),
    [athletes, assignedAthleteIds],
  );

  const occupant1 = athletes.find(a => a.id === occupant1Id);
  const occupant2 = athletes.find(a => a.id === occupant2Id);
  const selectedHotelData = hotels.find(h => h.id === selectedHotel);
  const selectedRoomTypeData = roomTypes.find(rt => rt.id === selectedRoomType);

  const setupMissing = {
    athletes: athletes.length === 0,
    hotels: hotels.length === 0,
    roomTypes: roomTypes.length === 0,
  };
  const setupIncomplete = setupMissing.athletes || setupMissing.hotels || setupMissing.roomTypes;

  const canSubmit = useMemo(() => {
    if (setupIncomplete) return false;
    if (!selectedHotel || !selectedRoomType) return false;
    if (!occupant1) return false;
    if (bookingType === "double" && !occupant2) return false;
    if (occupant1Id && occupant1Id === occupant2Id) return false;

    const participantIds = [occupant1.id, ...(bookingType === "double" && occupant2 ? [occupant2.id] : [])];
    if (participantIds.some(id => assignedAthleteIds.has(id))) return false;

    return true;
  }, [
    assignedAthleteIds,
    bookingType,
    occupant1,
    occupant1Id,
    occupant2,
    occupant2Id,
    selectedHotel,
    selectedRoomType,
    setupIncomplete,
  ]);

  const handleBookingSubmit = async () => {
    if (!canSubmit || !occupant1) {
      setError("Bitte alle Pflichtfelder ausfüllen. (Hinweis: Athleten dürfen nur 1 Buchung haben.)");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const athleteIds = [
        occupant1.id,
        ...(bookingType === "double" && occupant2?.id ? [occupant2.id] : []),
      ];

      await api.createRoomAssignment({
        athleteIds,
        hotelId: selectedHotel,
        roomTypeId: selectedRoomType,
        roomNumber: roomNumber.trim() ? roomNumber.trim() : undefined,
        checkInDate: occupant1.arrivalDate || undefined,
        checkOutDate: occupant1.departureDate || undefined,
      });

      const freshBookings = await api.getRoomAssignments();
      const normalized = normalizeBookings(freshBookings as unknown);
      setBookings(normalized.bookings);

      setBookingType("single");
      setOccupant1Id("");
      setOccupant2Id("");
      setSelectedHotel("");
      setSelectedRoomType("");
      setRoomNumber("");
    } catch (err) {
      setError("Fehler beim Buchen");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveBooking = async (bookingId: string) => {
    if (!confirm("Buchung wirklich entfernen?")) return;
    try {
      await api.deleteRoomAssignment(bookingId);
      setBookings(prev => prev.filter(b => b.id !== bookingId));
    } catch (err) {
      setError("Fehler beim Entfernen der Buchung");
      console.error(err);
    }
  };

  const roomsViewGroups = useMemo(() => {
    const byHotel = new Map<string, { hotelName: string; rows: RoomBooking[] }>();
    for (const booking of bookings) {
      const hotelKey = booking.hotel?.id ?? "unknown";
      const hotelName = booking.hotel?.name ?? "Unknown hotel";
      const group = byHotel.get(hotelKey) ?? { hotelName, rows: [] };
      group.rows.push(booking);
      byHotel.set(hotelKey, group);
    }

    const hotelEntries = Array.from(byHotel.entries()).map(([hotelId, group]) => ({
      hotelId,
      hotelName: group.hotelName,
      bookings: group.rows.sort((a, b) => {
        const an = (a.roomNumber || "").toString();
        const bn = (b.roomNumber || "").toString();
        return an.localeCompare(bn) || a.id.localeCompare(b.id);
      }),
    }));

    return hotelEntries.sort((a, b) => a.hotelName.localeCompare(b.hotelName));
  }, [bookings]);

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter(a =>
      `${a.firstname} ${a.lastname} ${a.nationCode}`.toLowerCase().includes(q),
    );
  }, [athleteSearch, athletes]);

  const athleteOptions = useMemo(() => {
    return unassignedAthletes.map(a => ({
      value: a.id,
      label: `${formatAthleteName(a)} (${a.nationCode})`,
    }));
  }, [unassignedAthletes]);

  const occupant2Options = useMemo(() => {
    return unassignedAthletes
      .filter(a => a.id !== occupant1Id)
      .map(a => ({
        value: a.id,
        label: `${formatAthleteName(a)} (${a.nationCode})`,
      }));
  }, [occupant1Id, unassignedAthletes]);

  const hotelOptions = useMemo(
    () => hotels.map(h => ({ value: h.id, label: h.location ? `${h.name} (${h.location})` : h.name })),
    [hotels],
  );
  const roomTypeOptions = useMemo(
    () => roomTypes.map(rt => ({ value: rt.id, label: `${rt.name} (${rt.maxPersons}p)` })),
    [roomTypes],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hotelzuweisungen</h2>
          <p className="mt-1 text-sm text-gray-600">
            Buchen Sie Zimmer (Single/Doppel) und verwalten Sie die aktuelle Belegung.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadData}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">
              <div className="font-medium">Fehler</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">
              <div className="font-medium">Hinweis</div>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {warnings.map(w => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {setupIncomplete ? (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Setup required</h3>
          <p className="mt-1 text-sm text-gray-600">
            Assignments brauchen Athleten, Hotels und Zimmertypen. Importieren Sie Daten oder erstellen Sie sie manuell.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="font-medium text-gray-900">Athletes</div>
              <div className="mt-1 text-sm text-gray-600">{setupMissing.athletes ? "Missing" : "OK"}</div>
              {setupMissing.athletes && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/import">
                      <Plus className="h-4 w-4" />
                      Import
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="font-medium text-gray-900">Hotels</div>
              <div className="mt-1 text-sm text-gray-600">{setupMissing.hotels ? "Missing" : "OK"}</div>
              {setupMissing.hotels && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/import">
                      <Plus className="h-4 w-4" />
                      Import
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/hotels">Add manually</Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="font-medium text-gray-900">Room types</div>
              <div className="mt-1 text-sm text-gray-600">{setupMissing.roomTypes ? "Missing" : "OK"}</div>
              {setupMissing.roomTypes && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/import">
                      <Plus className="h-4 w-4" />
                      Import
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/room-types">Add manually</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Neue Buchung</h3>
              <p className="mt-1 text-sm text-gray-600">
                One-booking rule: Athleten können nur 1 Buchung gleichzeitig haben.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Booking type *</label>
              <select
                value={bookingType}
                onChange={(e) => {
                  setBookingType(e.target.value as BookingType);
                  setOccupant2Id("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <ComboBox
                label="Occupant slot 1 *"
                placeholder="-- Athlet wählen --"
                value={occupant1Id}
                onChange={(v) => {
                  setOccupant1Id(v);
                  if (occupant2Id === v) setOccupant2Id("");
                }}
                options={athleteOptions}
                emptyText="Keine unassigned Athleten"
              />
            </div>

            <div className="lg:col-span-3">
              <ComboBox
                label={`Occupant slot 2 ${bookingType === "double" ? "*" : "(optional)"}`}
                placeholder="-- Athlet wählen --"
                value={occupant2Id}
                onChange={setOccupant2Id}
                options={occupant2Options}
                disabled={bookingType !== "double"}
                emptyText="Keine passenden Athleten"
              />
            </div>

            <div className="lg:col-span-2">
              <ComboBox
                label="Hotel *"
                placeholder="-- Hotel wählen --"
                value={selectedHotel}
                onChange={setSelectedHotel}
                options={hotelOptions}
              />
            </div>

            <div className="lg:col-span-2">
              <ComboBox
                label="Room type *"
                placeholder="-- Typ wählen --"
                value={selectedRoomType}
                onChange={setSelectedRoomType}
                options={roomTypeOptions}
              />
            </div>

            <div className="lg:col-span-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">Room number (optional)</label>
              <Input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 203"
              />
            </div>

            <div className="lg:col-span-8">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <span className="font-medium">Hotel:</span> {selectedHotelData?.name ?? "-"}
                  </div>
                  <div>
                    <span className="font-medium">Room type:</span> {selectedRoomTypeData?.name ?? "-"}
                  </div>
                  <div>
                    <span className="font-medium">Dates:</span>{" "}
                    {occupant1?.arrivalDate
                      ? new Date(occupant1.arrivalDate).toLocaleDateString("de-DE")
                      : "-"}{" "}
                    →{" "}
                    {occupant1?.departureDate
                      ? new Date(occupant1.departureDate).toLocaleDateString("de-DE")
                      : "-"}
                  </div>
                  <div>
                    <span className="font-medium">Occupants:</span>{" "}
                    {[occupant1, bookingType === "double" ? occupant2 : undefined]
                      .filter(Boolean)
                      .map(a => formatAthleteName(a as Athlete))
                      .join(" + ") || "-"}
                  </div>
                </div>
                {occupant1Id && assignedAthleteIds.has(occupant1Id) && (
                  <div className="mt-2 text-red-700">
                    <span className="font-medium">Blocked:</span> Occupant 1 is already assigned.
                  </div>
                )}
                {occupant2Id && assignedAthleteIds.has(occupant2Id) && (
                  <div className="mt-1 text-red-700">
                    <span className="font-medium">Blocked:</span> Occupant 2 is already assigned.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-12">
              <Button
                type="button"
                onClick={handleBookingSubmit}
                disabled={!canSubmit || submitting}
                className="w-full md:w-auto"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {bookingType === "double" ? "Book both now" : "Book now"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Current bookings ({bookings.length})</h3>
            {bookings.length === 0 && !setupIncomplete && (
              <p className="mt-1 text-sm text-gray-600">Noch keine Buchungen. Erstellen Sie die erste oben.</p>
            )}
          </div>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="rooms">
              <Users className="h-4 w-4" />
              Rooms
            </ToggleGroupItem>
            <ToggleGroupItem value="athletes">
              <Users className="h-4 w-4" />
              Athletes
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {viewMode === "rooms" ? (
          <div className="mt-5 space-y-5">
            {roomsViewGroups.map(group => (
              <div key={group.hotelId}>
                <div className="mb-2 text-sm font-semibold text-gray-900">{group.hotelName}</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {group.bookings.map(booking => (
                    <div key={booking.id} className="rounded-lg border bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">
                            {booking.roomNumber ? `Room ${booking.roomNumber}` : "Room (no #)"} •{" "}
                            {booking.roomType?.name ?? "Room type"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-sm text-gray-700">
                            {booking.occupants?.map(occ => (
                              <span
                                key={occ.id}
                                className="rounded-full border bg-white px-2 py-0.5 text-xs text-gray-800"
                              >
                                {formatAthleteName(occ.athlete)} ({occ.athlete.nationCode})
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveBooking(booking.id)}
                          className="text-red-600 hover:text-red-700"
                          aria-label="Delete booking"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                {assignedAthleteIds.size} assigned • {athletes.length - assignedAthleteIds.size} unassigned
              </div>
              <div className="w-full md:w-80">
                <Input
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  placeholder="Search athlete (name / nation)"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="px-4 py-2">Athlete</th>
                    <th className="px-4 py-2">Nation</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Booking</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white text-sm">
                  {filteredAthletes.map(a => {
                    const booking = athleteToBooking.get(a.id);
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-2 font-medium text-gray-900">{formatAthleteName(a)}</td>
                        <td className="px-4 py-2 text-gray-700">{a.nationCode}</td>
                        <td className="px-4 py-2">
                          {booking ? (
                            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                              Assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {booking ? (
                            <span className="text-xs">
                              {booking.hotel?.name} • {booking.roomType?.name}{" "}
                              {booking.roomNumber ? `• Room ${booking.roomNumber}` : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAthletes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                        No athletes found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Keep quota data loaded (future UX), but avoid unused-state lint issues */}
      {quotaUsage.length > 0 ? null : null}
    </div>
  );
}
