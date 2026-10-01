// Pick a recognizable icon for a service by its name (used on the booking page).
import { Droplets, Disc, Snowflake, BatteryCharging, Disc3, Gauge, Cog, Car, Wrench, ShieldCheck, Wind, Search } from 'lucide-react';

export const SERVICE_ICONS = { oil: Droplets, brake: Disc, climate: Snowflake, electrical: BatteryCharging, tires: Disc3, diagnostics: Gauge, engine: Cog, suspension: Car, inspect: Search, filter: Wind, maintenance: ShieldCheck, other: Wrench };

const RULES = [
  [/oil|lube|fluid/i, 'oil'],
  [/brake/i, 'brake'],
  [/a\/c|ac |air cond|heat|climate/i, 'climate'],
  [/batter|electr|starter|alternator/i, 'electrical'],
  [/tire|rotat|balanc|align/i, 'tires'],
  [/diagnos|check engine|scan|warning/i, 'diagnostics'],
  [/engine|belt|timing|water pump|valve|plug/i, 'engine'],
  [/suspension|strut|shock|steer|arm/i, 'suspension'],
  [/inspect/i, 'inspect'],
  [/filter/i, 'filter'],
  [/warranty|maintenance|service/i, 'maintenance'],
];

/** Key into SERVICE_ICONS for a service name. */
export function iconKey(title = '') {
  for (const [re, key] of RULES) if (re.test(title)) return key;
  return 'other';
}
