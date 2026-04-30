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
import { getComplianceStatus } from "../services/fisRules";

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
type MatchStatus = "matched" | "unmatched" | "ambiguous";

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

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGender(a: Athlete): "M" | "F" | null {
  const raw = (a.gender || a.forGender || "").toString().trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("m")) return "M";
  if (raw.startsWith("f")) return "F";
  if (raw === "w") return "F";
  if (raw === "h") return "M";
  return null;
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function datesOverlap(startA: string | null | undefined, endA: string | null | undefined, startB: string | null | undefined, endB: string | null | undefined) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && startB <= endA;
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
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
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
  const [athleteNation, setAthleteNation] = useState<string>("");
  const [athleteGender, setAthleteGender] = useState<string>("");
  const [athleteFunction, setAthleteFunction] = useState<string>("");
  const [athleteDiscipline, setAthleteDiscipline] = useState<string>("");
  const [athleteAssigned, setAthleteAssigned] = useState<string>(""); // "", "assigned", "unassigned"
  const [athleteHasShare, setAthleteHasShare] = useState(false);
  const [shareNation, setShareNation] = useState<string>("");
  const [shareGender, setShareGender] = useState<string>("");
  const [shareStatus, setShareStatus] = useState<MatchStatus | "">("");
  const [shareOnlyUnassigned, setShareOnlyUnassigned] = useState(true);

  const [roomsSearch, setRoomsSearch] = useState("");
  const [roomsHotel, setRoomsHotel] = useState<string>("");
  const [roomsRoomType, setRoomsRoomType] = useState<string>("");
  const [roomsNation, setRoomsNation] = useState<string>("");
  const [roomsGender, setRoomsGender] = useState<string>("");
  const [roomsIssuesOnly, setRoomsIssuesOnly] = useState(false);
  const [roomsPageSize, setRoomsPageSize] = useState(100);
  const [roomsPage, setRoomsPage] = useState(1);

  const [quotaNation, setQuotaNation] = useState<string>("");
  const [quotaDiscipline, setQuotaDiscipline] = useState<string>("");
  const [quotaGender, setQuotaGender] = useState<string>("");

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
  const eligibleAthletes = onlyUnassigned ? unassignedAthletes : athletes;

  const occupant1 = athletes.find(a => a.id === occupant1Id);
  const occupant2 = athletes.find(a => a.id === occupant2Id);
  const selectedHotelData = hotels.find(h => h.id === selectedHotel);
  const selectedRoomTypeData = roomTypes.find(rt => rt.id === selectedRoomType);

  const bookingRange = useMemo(() => {
    const a1Start = parseIsoDate(occupant1?.arrivalDate || null);
    const a1End = parseIsoDate(occupant1?.departureDate || null);
    const a2Start = parseIsoDate(occupant2?.arrivalDate || null);
    const a2End = parseIsoDate(occupant2?.departureDate || null);

    if (!a1Start || !a1End) {
      return { start: null as string | null, end: null as string | null };
    }

    if (bookingType !== "double") {
      return { start: toIsoDate(a1Start), end: toIsoDate(a1End) };
    }

    if (!a2Start || !a2End) {
      return { start: null as string | null, end: null as string | null };
    }

    const start = a1Start < a2Start ? a1Start : a2Start;
    const end = a1End > a2End ? a1End : a2End;
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }, [bookingType, occupant1?.arrivalDate, occupant1?.departureDate, occupant2?.arrivalDate, occupant2?.departureDate]);

  const setupMissing = {
    athletes: athletes.length === 0,
    hotels: hotels.length === 0,
    roomTypes: roomTypes.length === 0,
  };
  const setupIncomplete = setupMissing.athletes || setupMissing.hotels || setupMissing.roomTypes;

  const compatibility = useMemo(() => {
    const participants = [occupant1, bookingType === "double" ? occupant2 : undefined].filter(Boolean) as Athlete[];
    if (participants.length < 2) return { ok: true, issues: [] as string[] };

    const issues: string[] = [];
    if (participants[0].nationCode !== participants[1].nationCode) issues.push("Nation mismatch");

    const g1 = normalizeGender(participants[0]);
    const g2 = normalizeGender(participants[1]);
    if (!g1 || !g2) issues.push("Gender unknown");
    else if (g1 !== g2) issues.push("Gender mismatch");

    return { ok: issues.length === 0, issues };
  }, [bookingType, occupant1, occupant2]);

  const canSubmit = useMemo(() => {
    if (setupIncomplete) return false;
    if (!selectedHotel || !selectedRoomType) return false;
    if (!occupant1) return false;
    if (bookingType === "double" && !occupant2) return false;
    if (occupant1Id && occupant1Id === occupant2Id) return false;
    if (bookingType === "double" && !compatibility.ok) return false;
    if (!bookingRange.start || !bookingRange.end) return false;

    const participantIds = [occupant1.id, ...(bookingType === "double" && occupant2 ? [occupant2.id] : [])];
    if (participantIds.some(id => assignedAthleteIds.has(id))) return false;

    return true;
  }, [
    assignedAthleteIds,
    bookingType,
    bookingRange.end,
    bookingRange.start,
    compatibility.ok,
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
        checkInDate: bookingRange.start || undefined,
        checkOutDate: bookingRange.end || undefined,
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

  const bookingRows = useMemo(() => {
    const athleteToCount = new Map<string, number>();
    for (const booking of bookings) {
      for (const occ of booking.occupants || []) {
        const id = occ?.athlete?.id;
        if (!id) continue;
        athleteToCount.set(id, (athleteToCount.get(id) || 0) + 1);
      }
    }

    const rows = bookings.map((b) => {
      const occs = b.occupants || [];
      const nations = Array.from(new Set(occs.map(o => o.athlete?.nationCode).filter(Boolean))) as string[];
      const genders = Array.from(new Set(occs.map(o => normalizeGender(o.athlete)).filter(Boolean))) as string[];
      const functions = Array.from(new Set(occs.map(o => (o.athlete?.function || "").toString()).filter(Boolean))) as string[];
      const names = occs.map(o => `${formatAthleteName(o.athlete)} (${o.athlete.nationCode})`);

      const mixedNation = nations.length > 1;
      const mixedGender = genders.length > 1;
      const missingGender = occs.some(o => !normalizeGender(o.athlete));
      const duplicate = occs.some(o => athleteToCount.get(o.athlete.id)! > 1);

      return {
        booking: b,
        hotelName: b.hotel?.name || "",
        hotelId: b.hotel?.id || "",
        roomTypeName: b.roomType?.name || "",
        roomTypeId: b.roomType?.id || "",
        roomNumber: b.roomNumber || "",
        nations,
        genders,
        functions,
        names,
        issues: {
          mixedNation,
          mixedGender,
          missingGender,
          duplicate,
        },
      };
    });

    return rows;
  }, [bookings]);

  const filteredBookingRows = useMemo(() => {
    const q = roomsSearch.trim().toLowerCase();
    return bookingRows
      .filter(r => !roomsHotel || r.hotelId === roomsHotel)
      .filter(r => !roomsRoomType || r.roomTypeId === roomsRoomType)
      .filter(r => !roomsNation || r.nations.includes(roomsNation))
      .filter(r => !roomsGender || r.genders.includes(roomsGender))
      .filter(r => {
        if (!q) return true;
        const hay = `${r.hotelName} ${r.roomNumber} ${r.roomTypeName} ${r.names.join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .filter(r => {
        if (!roomsIssuesOnly) return true;
        return Object.values(r.issues).some(Boolean);
      });
  }, [bookingRows, roomsGender, roomsHotel, roomsIssuesOnly, roomsNation, roomsRoomType, roomsSearch]);

  const pagedBookingRows = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredBookingRows.length / roomsPageSize));
    const page = Math.min(Math.max(1, roomsPage), totalPages);
    const start = (page - 1) * roomsPageSize;
    const slice = filteredBookingRows.slice(start, start + roomsPageSize);
    return { page, totalPages, slice };
  }, [filteredBookingRows, roomsPage, roomsPageSize]);

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    return athletes
      .filter(a => !athleteNation || a.nationCode === athleteNation)
      .filter(a => !athleteDiscipline || (a.discipline || "") === athleteDiscipline)
      .filter(a => !athleteFunction || (a.function || "") === athleteFunction)
      .filter(a => !athleteGender || (normalizeGender(a) || "") === athleteGender)
      .filter(a => {
        if (!athleteAssigned) return true;
        const isAssigned = assignedAthleteIds.has(a.id);
        return athleteAssigned === "assigned" ? isAssigned : !isAssigned;
      })
      .filter(a => !athleteHasShare || ((a.sharedWithName || "").trim() !== ""))
      .filter(a => {
        if (!q) return true;
        return `${a.firstname} ${a.lastname} ${a.nationCode}`.toLowerCase().includes(q);
      });
  }, [
    athleteAssigned,
    athleteDiscipline,
    athleteFunction,
    athleteGender,
    athleteHasShare,
    athleteNation,
    athleteSearch,
    athletes,
    assignedAthleteIds,
  ]);

  const athleteOptions = useMemo(() => {
    return eligibleAthletes.map(a => ({
      value: a.id,
      label: `${formatAthleteName(a)} (${a.nationCode})`,
    }));
  }, [eligibleAthletes]);

  const occupant2Options = useMemo(() => {
    return eligibleAthletes
      .filter(a => a.id !== occupant1Id)
      .map(a => ({
        value: a.id,
        label: `${formatAthleteName(a)} (${a.nationCode})`,
      }));
  }, [eligibleAthletes, occupant1Id]);

  const hotelOptions = useMemo(
    () => hotels.map(h => ({ value: h.id, label: h.location ? `${h.name} (${h.location})` : h.name })),
    [hotels],
  );
  const roomTypeOptions = useMemo(
    () => roomTypes.map(rt => ({ value: rt.id, label: `${rt.name} (${rt.maxPersons}p)` })),
    [roomTypes],
  );

  const eligibleInventoryByRoomType = useMemo(() => {
    if (!selectedHotelData || !bookingRange.start || !bookingRange.end) return new Map<string, number>();
    const inventories = selectedHotelData.roomInventories || [];
    const map = new Map<string, number>();
    for (const inv of inventories) {
      if (!inv?.roomType?.id) continue;
      if (inv.availableFrom <= bookingRange.start && inv.availableUntil >= bookingRange.end) {
        map.set(inv.roomType.id, (map.get(inv.roomType.id) || 0) + (inv.roomCount || 0));
      }
    }
    return map;
  }, [bookingRange.end, bookingRange.start, selectedHotelData]);

  const roomTypeOptionsForHotel = useMemo(() => {
    if (!selectedHotelData) return roomTypeOptions;
    if (!bookingRange.start || !bookingRange.end) return [];
    return roomTypeOptions.filter(rt => eligibleInventoryByRoomType.has(rt.value));
  }, [bookingRange.end, bookingRange.start, eligibleInventoryByRoomType, roomTypeOptions, selectedHotelData]);

  useEffect(() => {
    if (!selectedHotelData) return;
    if (!bookingRange.start || !bookingRange.end) return;
    if (!selectedRoomType) return;
    if (!eligibleInventoryByRoomType.has(selectedRoomType)) {
      setSelectedRoomType("");
    }
  }, [bookingRange.end, bookingRange.start, eligibleInventoryByRoomType, selectedHotelData, selectedRoomType]);

  const usedRoomsByRoomType = useMemo(() => {
    if (!selectedHotelData || !bookingRange.start || !bookingRange.end) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.hotel?.id !== selectedHotelData.id) continue;
      const rtId = b.roomType?.id;
      if (!rtId) continue;

      const overlaps = b.checkInDate && b.checkOutDate
        ? datesOverlap(b.checkInDate, b.checkOutDate, bookingRange.start, bookingRange.end)
        : true; // unknown dates -> count as used (safe)

      if (!overlaps) continue;
      map.set(rtId, (map.get(rtId) || 0) + 1);
    }
    return map;
  }, [bookingRange.end, bookingRange.start, bookings, selectedHotelData]);

  const kontingentRows = useMemo(() => {
    if (!selectedHotelData || !bookingRange.start || !bookingRange.end) return [];
    const rows = [];
    for (const [roomTypeId, inventoryRooms] of eligibleInventoryByRoomType.entries()) {
      const rt = roomTypes.find(r => r.id === roomTypeId);
      const used = usedRoomsByRoomType.get(roomTypeId) || 0;
      rows.push({
        roomTypeId,
        roomTypeName: rt?.name || roomTypeId,
        inventoryRooms,
        usedRooms: used,
        remainingRooms: Math.max(0, inventoryRooms - used),
      });
    }
    rows.sort((a, b) => a.roomTypeName.localeCompare(b.roomTypeName));
    return rows;
  }, [bookingRange.end, bookingRange.start, eligibleInventoryByRoomType, roomTypes, selectedHotelData, usedRoomsByRoomType]);

  const remainingForSelectedRoomType = useMemo(() => {
    const row = kontingentRows.find(r => r.roomTypeId === selectedRoomType);
    return row ? row.remainingRooms : null;
  }, [kontingentRows, selectedRoomType]);

  const nationOptions = useMemo(() => {
    const set = new Set<string>();
    athletes.forEach(a => a.nationCode && set.add(a.nationCode));
    return Array.from(set).sort();
  }, [athletes]);

  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    athletes.forEach(a => a.discipline && set.add(a.discipline));
    return Array.from(set).sort();
  }, [athletes]);

  const functionOptions = useMemo(() => {
    const set = new Set<string>();
    athletes.forEach(a => a.function && set.add(a.function));
    return Array.from(set).sort();
  }, [athletes]);

  const shareRequests = useMemo(() => {
    const athleteIndex = athletes.map(a => ({
      athlete: a,
      first: normalizeName(a.firstname),
      last: normalizeName(a.lastname),
      full: normalizeName(`${a.firstname} ${a.lastname}`),
    }));

    const results = athletes
      .filter(a => (a.sharedWithName || "").trim() !== "")
      .map((a) => {
        const requestedRaw = a.sharedWithName!.toString();
        const requested = normalizeName(requestedRaw);

        const matches = athleteIndex
          .filter(c => c.athlete.id !== a.id)
          .filter(c => requested.includes(c.first) && requested.includes(c.last))
          .map(c => c.athlete);

        let status: MatchStatus = "unmatched";
        let matched: Athlete | null = null;
        if (matches.length === 1) {
          status = "matched";
          matched = matches[0];
        } else if (matches.length > 1) {
          status = "ambiguous";
        }

        const unassigned = !assignedAthleteIds.has(a.id);
        const matchedUnassigned = matched ? !assignedAthleteIds.has(matched.id) : false;

        const nationOk = matched ? a.nationCode === matched.nationCode : true;
        const g1 = normalizeGender(a);
        const g2 = matched ? normalizeGender(matched) : null;
        const genderOk = matched ? (!!g1 && !!g2 && g1 === g2) : true;

        const start1 = a.arrivalDate || null;
        const end1 = a.departureDate || null;
        const start2 = matched?.arrivalDate || null;
        const end2 = matched?.departureDate || null;
        const datesKnown = !!start1 && !!end1 && !!start2 && !!end2;
        const datesOverlapOk = datesKnown ? datesOverlap(start1, end1, start2, end2) : false;

        return {
          athlete: a,
          requestedRaw,
          status,
          matched,
          unassigned,
          matchedUnassigned,
          nationOk,
          genderOk,
          datesKnown,
          datesOverlapOk,
        };
      });

    return results
      .filter(r => !shareNation || r.athlete.nationCode === shareNation)
      .filter(r => !shareGender || (normalizeGender(r.athlete) || "") === shareGender)
      .filter(r => !shareStatus || r.status === shareStatus)
      .filter(r => !shareOnlyUnassigned || r.unassigned);
  }, [assignedAthleteIds, athletes, shareGender, shareNation, shareOnlyUnassigned, shareStatus]);

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Share requests</h3>
              <p className="mt-1 text-sm text-gray-600">
                Wer möchte mit wem? Matching basiert auf `sharedWithName`.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nation</label>
              <select value={shareNation} onChange={(e) => setShareNation(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All</option>
                {nationOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Gender</label>
              <select value={shareGender} onChange={(e) => setShareGender(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Match</label>
              <select value={shareStatus} onChange={(e) => setShareStatus(e.target.value as any)} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All</option>
                <option value="matched">Matched</option>
                <option value="unmatched">Unmatched</option>
                <option value="ambiguous">Ambiguous</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={shareOnlyUnassigned} onChange={(e) => setShareOnlyUnassigned(e.target.checked)} />
                Only unassigned
              </label>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-3 py-2">Athlete</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2">Matched</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white text-sm">
                {shareRequests.slice(0, 200).map((r) => {
                  const canPrefill =
                    r.status === "matched" &&
                    !!r.matched &&
                    r.unassigned &&
                    r.matchedUnassigned &&
                    r.nationOk &&
                    r.genderOk &&
                    r.datesKnown &&
                    r.datesOverlapOk;

                  return (
                    <tr key={r.athlete.id}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {formatAthleteName(r.athlete)} ({r.athlete.nationCode})
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.requestedRaw}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {r.matched ? `${formatAthleteName(r.matched)} (${r.matched.nationCode})` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                          r.status === "matched" ? "border-green-200 bg-green-50 text-green-800"
                            : r.status === "ambiguous" ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                        )}>
                          {r.status}
                        </span>
                        {r.status === "matched" && (!r.nationOk || !r.genderOk) && (
                          <span className="ml-2 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800">
                            rule mismatch
                          </span>
                        )}
                        {r.status === "matched" && (!r.datesKnown || !r.datesOverlapOk) && (
                          <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                            date mismatch
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!canPrefill}
                          onClick={() => {
                            if (!r.matched) return;
                            setBookingType("double");
                            setOnlyUnassigned(true);
                            setOccupant1Id(r.athlete.id);
                            setOccupant2Id(r.matched.id);
                          }}
                        >
                          Load pair
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {shareRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                      No share requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {shareRequests.length > 200 && (
            <div className="mt-2 text-xs text-gray-500">
              Showing first 200 results. Use filters to narrow down.
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">FIS quota (live)</h3>
              <p className="mt-1 text-sm text-gray-600">
                Officials = athletes entered + 2; single rooms entitlement depends on officials count.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nation</label>
              <select value={quotaNation} onChange={(e) => setQuotaNation(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All</option>
                {nationOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Discipline</label>
              <select value={quotaDiscipline} onChange={(e) => setQuotaDiscipline(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All</option>
                {disciplineOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Gender</label>
              <select value={quotaGender} onChange={(e) => setQuotaGender(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-3 py-2">Nation</th>
                  <th className="px-3 py-2">Disc</th>
                  <th className="px-3 py-2">G</th>
                  <th className="px-3 py-2 text-right">Ath</th>
                  <th className="px-3 py-2 text-right">Officials</th>
                  <th className="px-3 py-2 text-right">Assigned</th>
                  <th className="px-3 py-2 text-right">Singles</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white text-sm">
                {quotaUsage
                  .filter(r => !quotaNation || r.nationCode === quotaNation)
                  .filter(r => !quotaDiscipline || (r.discipline || "") === quotaDiscipline)
                  .filter(r => !quotaGender || r.gender === quotaGender)
                  .slice(0, 200)
                  .map((r) => {
                    const status = getComplianceStatus(r.assignedOfficials, r.officialQuota);
                    return (
                      <tr key={`${r.nationCode}-${r.discipline}-${r.gender}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">{r.nationCode}</td>
                        <td className="px-3 py-2 text-gray-700">{r.discipline || "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{r.gender}</td>
                        <td className="px-3 py-2 text-right">{r.athletesEntered}</td>
                        <td className="px-3 py-2 text-right">{r.officialQuota}</td>
                        <td className="px-3 py-2 text-right">{r.assignedOfficials}</td>
                        <td className="px-3 py-2 text-right">
                          {r.singleRoomsUsed} / {r.singleRoomsAllowed}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                            status === "ok" ? "border-green-200 bg-green-50 text-green-800"
                              : status === "over" ? "border-red-200 bg-red-50 text-red-800"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                          )}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {quotaUsage.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500">
                      No quota data (missing discipline/gender data on athletes or endpoint not available).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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

            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Athletes list</label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => setOnlyUnassigned(e.target.checked)}
                />
                Only unassigned
              </label>
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
                emptyText={onlyUnassigned ? "Keine unassigned Athleten" : "Keine Athleten"}
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
                emptyText={onlyUnassigned ? "Keine passenden unassigned Athleten" : "Keine passenden Athleten"}
              />
            </div>

            <div className="lg:col-span-2">
              <ComboBox
                label="Hotel *"
                placeholder="-- Hotel wählen --"
                value={selectedHotel}
                onChange={(v) => {
                  setSelectedHotel(v);
                  setSelectedRoomType("");
                }}
                options={hotelOptions}
              />
            </div>

            <div className="lg:col-span-2">
              <ComboBox
                label="Room type *"
                placeholder="-- Typ wählen --"
                value={selectedRoomType}
                onChange={setSelectedRoomType}
                options={roomTypeOptionsForHotel}
                disabled={!selectedHotel || !bookingRange.start || !bookingRange.end}
              />
              {selectedHotel && bookingRange.start && bookingRange.end && roomTypeOptionsForHotel.length === 0 && (
                <p className="mt-1 text-xs text-red-700">
                  No kontingent for this hotel in this date range.
                </p>
              )}
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
                    <span className="font-medium">Dates:</span> {bookingRange.start || "-"} → {bookingRange.end || "-"}
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
                {!compatibility.ok && (
                  <div className="mt-2 text-red-700">
                    <span className="font-medium">Blocked (rule):</span> {compatibility.issues.join(", ")}
                  </div>
                )}
                {remainingForSelectedRoomType !== null && (
                  <div className={cn("mt-2", remainingForSelectedRoomType <= 0 ? "text-red-700" : "text-blue-900")}>
                    <span className="font-medium">Kontingent remaining:</span>{" "}
                    {remainingForSelectedRoomType}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-12">
              {selectedHotelData && bookingRange.start && bookingRange.end && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900">
                      Kontingent: {selectedHotelData.name} ({bookingRange.start} → {bookingRange.end})
                    </div>
                    <div className="text-xs text-gray-600">
                      Inventory rows covering this date range • Used counts overlapping bookings
                    </div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-md border bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                        <tr>
                          <th className="px-3 py-2">Room type</th>
                          <th className="px-3 py-2 text-right">Inventory</th>
                          <th className="px-3 py-2 text-right">Used</th>
                          <th className="px-3 py-2 text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {kontingentRows.map(r => (
                          <tr key={r.roomTypeId}>
                            <td className="px-3 py-2">{r.roomTypeName}</td>
                            <td className="px-3 py-2 text-right">{r.inventoryRooms}</td>
                            <td className="px-3 py-2 text-right">{r.usedRooms}</td>
                            <td className={cn("px-3 py-2 text-right font-medium", r.remainingRooms <= 0 ? "text-red-700" : "text-gray-900")}>
                              {r.remainingRooms}
                            </td>
                          </tr>
                        ))}
                        {kontingentRows.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">
                              No kontingent rows cover this date range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-12">
              <Button
                type="button"
                onClick={handleBookingSubmit}
                disabled={!canSubmit || submitting || (remainingForSelectedRoomType !== null && remainingForSelectedRoomType <= 0)}
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
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Input
                  value={roomsSearch}
                  onChange={(e) => {
                    setRoomsSearch(e.target.value);
                    setRoomsPage(1);
                  }}
                  placeholder="Search hotel/room/athlete"
                />
              </div>
              <div>
                <select value={roomsHotel} onChange={(e) => { setRoomsHotel(e.target.value); setRoomsPage(1); }} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">All hotels</option>
                  {hotelOptions.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>
              <div>
                <select value={roomsRoomType} onChange={(e) => { setRoomsRoomType(e.target.value); setRoomsPage(1); }} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">All room types</option>
                  {roomTypeOptions.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                </select>
              </div>
              <div>
                <select value={roomsNation} onChange={(e) => { setRoomsNation(e.target.value); setRoomsPage(1); }} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">All nations</option>
                  {nationOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <select value={roomsGender} onChange={(e) => { setRoomsGender(e.target.value); setRoomsPage(1); }} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">All genders</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={roomsIssuesOnly}
                  onChange={(e) => { setRoomsIssuesOnly(e.target.checked); setRoomsPage(1); }}
                />
                Show only issues
              </label>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-gray-500">Rows:</span>
                <select value={roomsPageSize} onChange={(e) => { setRoomsPageSize(parseInt(e.target.value, 10)); setRoomsPage(1); }} className="rounded-md border px-2 py-1.5 text-sm">
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span className="text-gray-500">
                  {filteredBookingRows.length} total
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Hotel</th>
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Occupants</th>
                      <th className="px-3 py-2">Check-in</th>
                      <th className="px-3 py-2">Check-out</th>
                      <th className="px-3 py-2">Nation</th>
                      <th className="px-3 py-2">Gender</th>
                      <th className="px-3 py-2">Function</th>
                      <th className="px-3 py-2">Issues</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white text-sm">
                    {pagedBookingRows.slice.map((r) => (
                      <tr key={r.booking.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{r.hotelName}</td>
                        <td className="px-3 py-2 text-gray-700">{r.roomNumber || "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{r.roomTypeName}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {r.booking.occupants.map(o => (
                              <span key={o.id} className="rounded-full border bg-gray-50 px-2 py-0.5 text-xs text-gray-800">
                                {formatAthleteName(o.athlete)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{r.booking.checkInDate || "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{r.booking.checkOutDate || "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{r.nations.join(", ") || "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{r.genders.join(", ") || "—"}</td>
                        <td className="px-3 py-2 text-gray-700">{r.functions.join(", ") || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.issues.mixedNation && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800">mixed nation</span>}
                            {r.issues.mixedGender && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800">mixed gender</span>}
                            {r.issues.missingGender && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">missing gender</span>}
                            {r.issues.duplicate && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800">duplicate</span>}
                            {!Object.values(r.issues).some(Boolean) && <span className="text-xs text-gray-400">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBooking(r.booking.id)}
                            className="text-red-600 hover:text-red-700"
                            aria-label="Delete booking"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {pagedBookingRows.slice.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-500">
                          No bookings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
              <div>
                Page {pagedBookingRows.page} / {pagedBookingRows.totalPages}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pagedBookingRows.page <= 1} onClick={() => setRoomsPage(p => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pagedBookingRows.page >= pagedBookingRows.totalPages} onClick={() => setRoomsPage(p => Math.min(pagedBookingRows.totalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Input
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  placeholder="Search athlete (name / nation)"
                />
              </div>
              <div>
                <select value={athleteNation} onChange={(e) => setAthleteNation(e.target.value)} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">All nations</option>
                  {nationOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <select value={athleteGender} onChange={(e) => setAthleteGender(e.target.value)} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">All genders</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
              <div>
                <select value={athleteDiscipline} onChange={(e) => setAthleteDiscipline(e.target.value)} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">All disciplines</option>
                  {disciplineOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <select value={athleteAssigned} onChange={(e) => setAthleteAssigned(e.target.value)} className="w-full rounded-md border px-2 py-2 text-sm">
                  <option value="">Assigned + unassigned</option>
                  <option value="assigned">Assigned only</option>
                  <option value="unassigned">Unassigned only</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                {assignedAthleteIds.size} assigned • {athletes.length - assignedAthleteIds.size} unassigned
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select value={athleteFunction} onChange={(e) => setAthleteFunction(e.target.value)} className="rounded-md border px-2 py-2 text-sm">
                  <option value="">All functions</option>
                  {functionOptions.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={athleteHasShare} onChange={(e) => setAthleteHasShare(e.target.checked)} />
                  Has share request
                </label>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="px-4 py-2">Athlete</th>
                    <th className="px-4 py-2">Nation</th>
                    <th className="px-4 py-2">Gender</th>
                    <th className="px-4 py-2">Function</th>
                    <th className="px-4 py-2">Arr</th>
                    <th className="px-4 py-2">Dep</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Booking</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white text-sm">
                  {filteredAthletes.map(a => {
                    const booking = athleteToBooking.get(a.id);
                    const g = normalizeGender(a) || "—";
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-2 font-medium text-gray-900">{formatAthleteName(a)}</td>
                        <td className="px-4 py-2 text-gray-700">{a.nationCode}</td>
                        <td className="px-4 py-2 text-gray-700">{g}</td>
                        <td className="px-4 py-2 text-gray-700">{a.function || "—"}</td>
                        <td className="px-4 py-2 text-gray-700">{a.arrivalDate || "—"}</td>
                        <td className="px-4 py-2 text-gray-700">{a.departureDate || "—"}</td>
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
                              {booking.checkInDate && booking.checkOutDate ? ` • ${booking.checkInDate}→${booking.checkOutDate}` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                        <td className="px-4 py-2 text-right">
                          {!booking ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setViewMode("rooms");
                                setBookingType("single");
                                setOnlyUnassigned(true);
                                setOccupant1Id(a.id);
                                setOccupant2Id("");
                              }}
                            >
                              Start booking
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setViewMode("rooms");
                                setRoomsHotel(booking.hotel?.id || "");
                                setRoomsRoomType(booking.roomType?.id || "");
                                setRoomsSearch(formatAthleteName(a));
                                setRoomsPage(1);
                              }}
                            >
                              Jump to room
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAthletes.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
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
