// Connected cars (Smartcar): with the vehicle owner's consent, the shop reads the car's odometer,
// oil life, tire pressures, fuel and battery straight from the car maker's connected services.
// Readings are kept on the vehicle record (vehicle.connected) so every device and the service
// reminders can use them; the access tokens stay on the shop's server.
import { vehicleName } from './format';

export const CAR_MODES = [
  { value: 'live', label: 'Real cars' },
  { value: 'simulated', label: 'Simulated (testing)' },
];

/** Below this a tire is flagged; the door-jamb placard has the exact spec. */
export const LOW_TIRE_PSI = 28;
export const LOW_OIL_PCT = 15;

export function connectMessage(shop, customer, vehicle, url) {
  const first = customer?.firstName || 'there';
  return `Hi ${first}, it’s ${shop.name}. Want us to keep an eye on your ${vehicleName(vehicle)}? Connect it here and we’ll see its mileage, oil life and tire pressures (read-only — we can’t unlock, start or track it), so we can let you know when service is due: ${url}`;
}

/** The vehicle record's snapshot from a reading (and a higher mileage if the car reports one). */
export function vehiclePatch(vehicle, car) {
  const patch = { id: vehicle.id, connected: { connectedAt: car.connectedAt, readAt: car.readAt || null, reading: car.reading || null, make: car.make || null, model: car.model || null } };
  const odo = Number(car.reading?.odometer);
  if (odo && odo > (Number(vehicle.mileage) || 0)) patch.mileage = odo;
  return patch;
}

export const tireList = (tires) =>
  tires
    ? [
        ['Front left', tires.fl],
        ['Front right', tires.fr],
        ['Rear left', tires.rl],
        ['Rear right', tires.rr],
      ].filter(([, v]) => typeof v === 'number')
    : [];

/** What's worth a heads-up from a reading. */
export function readingAlerts(reading) {
  if (!reading) return [];
  const out = [];
  if (typeof reading.oilLife === 'number' && reading.oilLife <= LOW_OIL_PCT) out.push(`Oil life ${reading.oilLife}% — due for an oil change`);
  const low = tireList(reading.tires).filter(([, v]) => v < LOW_TIRE_PSI);
  if (low.length) out.push(`Low tire pressure: ${low.map(([k, v]) => `${k.toLowerCase()} ${Math.round(v)} psi`).join(', ')}`);
  return out;
}
