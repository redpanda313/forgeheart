/**
 * Prefab catalog for Game Maker mode.
 */

export type EditorCategory =
  | 'building'
  | 'walkway'
  | 'rail'
  | 'stair'
  | 'fountain'
  | 'fog'
  | 'vehicle'
  | 'tree'
  | 'ground'
  | 'path';

export interface CatalogEntry {
  category: EditorCategory;
  variant: number;
  label: string;
  /** Default uniform scale */
  defaultScale: number;
}

export const CATEGORY_LABELS: Record<EditorCategory, string> = {
  building: 'Buildings',
  walkway: 'Walkways',
  rail: 'Grind rails',
  stair: 'Stairs / ramps',
  fountain: 'Fountains',
  fog: 'Fog zones',
  vehicle: 'Cars / trucks',
  tree: 'Trees / greenery',
  ground: 'Ground pads',
  path: 'Race path',
};

/** 5 variants per multi-choice category */
export const CATALOG: CatalogEntry[] = [
  // Buildings
  { category: 'building', variant: 0, label: 'Brass Tower', defaultScale: 1 },
  { category: 'building', variant: 1, label: 'Factory Block', defaultScale: 1 },
  { category: 'building', variant: 2, label: 'Market Hall', defaultScale: 1 },
  { category: 'building', variant: 3, label: 'Clock Spire', defaultScale: 1 },
  { category: 'building', variant: 4, label: 'Residential Stack', defaultScale: 1 },
  // Walkways
  { category: 'walkway', variant: 0, label: 'Brass Walk (short)', defaultScale: 1 },
  { category: 'walkway', variant: 1, label: 'Brass Walk (long)', defaultScale: 1 },
  { category: 'walkway', variant: 2, label: 'Grate Bridge', defaultScale: 1 },
  { category: 'walkway', variant: 3, label: 'Wide Plaza Link', defaultScale: 1 },
  { category: 'walkway', variant: 4, label: 'Curved Span', defaultScale: 1 },
  // Rails
  { category: 'rail', variant: 0, label: 'Rail 12u', defaultScale: 1 },
  { category: 'rail', variant: 1, label: 'Rail 20u', defaultScale: 1 },
  { category: 'rail', variant: 2, label: 'Rail 32u', defaultScale: 1 },
  { category: 'rail', variant: 3, label: 'Rail short hop', defaultScale: 1 },
  { category: 'rail', variant: 4, label: 'Rail elevated', defaultScale: 1 },
  // Stairs / ramps
  { category: 'stair', variant: 0, label: 'Stair ramp low', defaultScale: 1 },
  { category: 'stair', variant: 1, label: 'Stair ramp mid', defaultScale: 1 },
  { category: 'stair', variant: 2, label: 'Boost ramp steep', defaultScale: 1 },
  { category: 'stair', variant: 3, label: 'Wide ramp', defaultScale: 1 },
  { category: 'stair', variant: 4, label: 'Half-pipe step', defaultScale: 1 },
  // Fountains
  { category: 'fountain', variant: 0, label: 'Basin fountain', defaultScale: 1 },
  { category: 'fountain', variant: 1, label: 'Tall cascade', defaultScale: 1 },
  { category: 'fountain', variant: 2, label: 'Twin jets', defaultScale: 1 },
  { category: 'fountain', variant: 3, label: 'Plaza pool', defaultScale: 1 },
  { category: 'fountain', variant: 4, label: 'Cloudfall spout', defaultScale: 1 },
  // Fog
  { category: 'fog', variant: 0, label: 'Light mist (far 60)', defaultScale: 1 },
  { category: 'fog', variant: 1, label: 'Medium fog (far 40)', defaultScale: 1 },
  { category: 'fog', variant: 2, label: 'Heavy fog (far 25)', defaultScale: 1 },
  { category: 'fog', variant: 3, label: 'Pea soup (far 16)', defaultScale: 1 },
  { category: 'fog', variant: 4, label: 'Night shroud (far 12)', defaultScale: 1 },
  // Vehicles
  { category: 'vehicle', variant: 0, label: 'Red roadster', defaultScale: 1 },
  { category: 'vehicle', variant: 1, label: 'Blue truck', defaultScale: 1 },
  { category: 'vehicle', variant: 2, label: 'Brass cab', defaultScale: 1 },
  { category: 'vehicle', variant: 3, label: 'Steam hauler', defaultScale: 1 },
  { category: 'vehicle', variant: 4, label: 'Courier cart', defaultScale: 1 },
  // Trees
  { category: 'tree', variant: 0, label: 'Oak canopy', defaultScale: 1 },
  { category: 'tree', variant: 1, label: 'Pine spire', defaultScale: 1 },
  { category: 'tree', variant: 2, label: 'Bush cluster', defaultScale: 1 },
  { category: 'tree', variant: 3, label: 'Hedge wall', defaultScale: 1 },
  { category: 'tree', variant: 4, label: 'Flower box', defaultScale: 1 },
  // Ground / floating platforms
  { category: 'ground', variant: 0, label: 'Rect platform', defaultScale: 1 },
  { category: 'ground', variant: 1, label: 'Circle platform', defaultScale: 1 },
  { category: 'ground', variant: 2, label: 'Octagon platform', defaultScale: 1 },
  { category: 'ground', variant: 3, label: 'Hex platform', defaultScale: 1 },
  { category: 'ground', variant: 4, label: 'Diamond platform', defaultScale: 1 },
  // Path (race path segments)
  { category: 'path', variant: 0, label: 'Path segment 10u', defaultScale: 1 },
  { category: 'path', variant: 1, label: 'Path segment 16u', defaultScale: 1 },
  { category: 'path', variant: 2, label: 'Path segment 24u', defaultScale: 1 },
  { category: 'path', variant: 3, label: 'Path curve piece', defaultScale: 1 },
  { category: 'path', variant: 4, label: 'Path start/finish pad', defaultScale: 1 },
];

export function catalogFor(category: EditorCategory): CatalogEntry[] {
  return CATALOG.filter((c) => c.category === category);
}

export const ALL_CATEGORIES: EditorCategory[] = [
  'building',
  'walkway',
  'rail',
  'stair',
  'fountain',
  'fog',
  'vehicle',
  'tree',
  'ground',
  'path',
];
