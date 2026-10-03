// Which back office this build is: the full auto-repair edition, or the Small Engine Edition for shops
// that only work on mowers, saws, generators and other power equipment. Chosen at build time
// (VITE_EDITION=small-engine, see scripts/pages.mjs), so each edition is its own app at its own
// address with its own data on the device.
export const EDITION = import.meta.env?.VITE_EDITION === 'small-engine' ? 'small-engine' : 'auto';
export const SMALL_ENGINE = EDITION === 'small-engine';

/** Shown under the logo (sidebar, sign-in, More) in the Small Engine Edition. */
export const EDITION_LABEL = SMALL_ENGINE ? 'Small Engine Edition' : '';

/**
 * Words the two editions use differently. Records keep the same fields in both (a unit's model
 * number lives in `model`, its serial number in `vin`, engine hours in `mileage`), so every
 * feature works unchanged; only what people read differs.
 */
export const TERMS = SMALL_ENGINE
  ? {
      vehicle: 'Equipment',
      vehicles: 'Equipment',
      aVehicle: 'a unit',
      theVehicle: 'the equipment',
      vehicleLower: 'equipment',
      unit: 'unit',
      make: 'Brand',
      model: 'Model #',
      trim: 'Type',
      vin: 'Serial #',
      mileage: 'Hours',
      mileageIn: 'Hours in',
      mileageOut: 'Hours out',
      mi: 'hrs',
      plate: 'Tag #',
      engine: 'Engine',
    }
  : {
      vehicle: 'Vehicle',
      vehicles: 'Vehicles',
      aVehicle: 'a vehicle',
      theVehicle: 'the vehicle',
      vehicleLower: 'vehicle',
      unit: 'vehicle',
      make: 'Make',
      model: 'Model',
      trim: 'Trim',
      vin: 'VIN',
      mileage: 'Mileage',
      mileageIn: 'Mileage in',
      mileageOut: 'Mileage out',
      mi: 'mi',
      plate: 'Plate',
      engine: 'Engine',
    };

// Storage names for this edition. The auto edition keeps the names it has always used, so existing
// devices keep their data; the Small Engine Edition gets its own so the two never share a shop.
const NS = SMALL_ENGINE ? 'wpi-small-engine' : 'autoshop-pro';
const DB = SMALL_ENGINE ? 'wpi-small-engine' : 'autoshop';
/** A localStorage key, e.g. storageKey('tech') → 'autoshop-pro:tech'. */
export const storageKey = (name) => `${NS}:${name}`;
/** An IndexedDB database name, e.g. dbName('data') → 'autoshop-data'. */
export const dbName = (name) => `${DB}-${name}`;

/** Routes that exist only in one edition (hidden from navigation and search in the other). */
export const AUTO_ONLY_ROUTES = ['/diagnose', '/catalog', '/vin'];
export const SMALL_ENGINE_ONLY_ROUTES = ['/troubleshoot', '/brands'];
export const routeInEdition = (path) =>
  !(SMALL_ENGINE ? AUTO_ONLY_ROUTES : SMALL_ENGINE_ONLY_ROUTES).some((r) => path === r || path.startsWith(`${r}/`));
