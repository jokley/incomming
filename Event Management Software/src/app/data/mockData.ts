import { Athlete, Hotel } from '../types';

export const mockAthletes: Athlete[] = [
  { id: '1', name: 'Anna Schmidt', nation: 'Deutschland', discipline: 'Moguls', hotelId: '1' },
  { id: '2', name: 'John Smith', nation: 'USA', discipline: 'Big Air', hotelId: '1' },
  { id: '3', name: 'Sophie Martin', nation: 'Frankreich', discipline: 'Slopestyle', hotelId: '2' },
  { id: '4', name: 'Yuki Tanaka', nation: 'Japan', discipline: 'Halfpipe', hotelId: '2' },
  { id: '5', name: 'Lars Hansen', nation: 'Norwegen', discipline: 'Moguls', hotelId: '3' },
  { id: '6', name: 'Maria Garcia', nation: 'Spanien', discipline: 'Big Air' },
  { id: '7', name: 'Pietro Rossi', nation: 'Italien', discipline: 'Slopestyle' },
  { id: '8', name: 'Emma Johnson', nation: 'Kanada', discipline: 'Halfpipe', hotelId: '3' },
  { id: '9', name: 'Max Müller', nation: 'Deutschland', discipline: 'Big Air', hotelId: '1' },
  { id: '10', name: 'Lisa Andersson', nation: 'Schweden', discipline: 'Moguls' },
];

export const mockHotels: Hotel[] = [
  { id: '1', name: 'Grand Hotel Alpine', capacity: 50, assignedCount: 3 },
  { id: '2', name: 'Mountain Resort', capacity: 40, assignedCount: 2 },
  { id: '3', name: 'Snow Peak Lodge', capacity: 35, assignedCount: 2 },
  { id: '4', name: 'Vista Hotel', capacity: 30, assignedCount: 0 },
];
