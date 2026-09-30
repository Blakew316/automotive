// Live data from the U.S. National Highway Traffic Safety Administration.
// vPIC (VIN decoding) and api.nhtsa.gov (recalls, complaints, NCAP ratings) are free,
// keyless and CORS-enabled, so the browser calls them directly. Responses are cached locally.

const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const API = 'https://api.nhtsa.gov';
const CACHE_PREFIX = 'nhtsa:';
const DAY = 86400000;

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    return Date.now() - at < ttl ? data : null;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Storage full or unavailable: caching is best-effort.
  }
}

async function getJSON(url, { timeout = 15000, signal, emptyOn400 = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    // Some api.nhtsa.gov endpoints answer 400 instead of an empty list when nothing matches.
    if (res.status === 400 && emptyOn400) return { results: [] };
    if (!res.ok) throw new Error(`NHTSA responded ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(signal?.aborted ? 'Cancelled' : 'NHTSA did not respond in time');
    if (err instanceof TypeError) throw new Error('Could not reach NHTSA — check your connection');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function cached(key, ttl, loader) {
  const hit = readCache(key, ttl);
  if (hit) return hit;
  const data = await loader();
  writeCache(key, data);
  return data;
}

const val = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s && s !== 'Not Applicable' && s !== '0' ? s : null;
};
// NHTSA returns many fields in capitals ("FREMONT", "TESLA, INC."). Title-case them but keep acronyms.
const ACRONYMS = new Set(['LLC', 'USA', 'US', 'AG', 'GMBH', 'NA', 'BMW', 'GM', 'FCA', 'SUV', 'MPV', 'AWD', 'FWD', 'RWD', 'EV', 'KG', 'SA', 'SPA', 'AB']);
const nice = (v) => {
  const s = val(v);
  if (!s || /[a-z]/.test(s)) return s;
  return s
    .toLowerCase()
    .replace(/\s*\((usa|u\.s\.a\.)\)$/i, '')
    .replace(/[a-z]+/g, (w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
};
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function engineLabel(r) {
  const disp = num(r.DisplacementL);
  const cyl = num(r.EngineCylinders);
  const config = val(r.EngineConfiguration);
  const layout = cyl ? (config?.startsWith('V') ? `V${cyl}` : config?.startsWith('In-Line') ? `I${cyl}` : config?.startsWith('Horizontally') ? `H${cyl}` : `${cyl}-cyl`) : null;
  const parts = [disp ? `${disp.toFixed(1)}L` : null, val(r.Turbo) === 'Yes' ? 'Turbo' : null, layout].filter(Boolean);
  if (!parts.length && val(r.ElectrificationLevel)?.includes('BEV')) return 'Electric';
  return parts.join(' ') || null;
}

/** Normalizes a vPIC DecodeVinValuesExtended row into the shape the app uses. */
export function normalizeDecode(r) {
  const errorCodes = String(r.ErrorCode || '0').split(',').map((s) => s.trim());
  const year = num(r.ModelYear);
  const hp = num(r.EngineHP);
  const specs = [
    ['Body', val(r.BodyClass)],
    ['Doors', val(r.Doors)],
    ['Drive', val(r.DriveType)],
    ['Engine', engineLabel(r)],
    ['Engine code', val(r.EngineModel)],
    ['Horsepower', hp ? `${Math.round(hp)} hp` : null],
    ['Fuel', [val(r.FuelTypePrimary), val(r.FuelTypeSecondary)].filter(Boolean).join(' / ') || null],
    ['Fuel injection', val(r.FuelInjectionType)],
    ['Valve train', val(r.ValveTrainDesign)],
    ['Electrification', val(r.ElectrificationLevel)],
    ['Battery', num(r.BatteryKWh) ? `${r.BatteryKWh} kWh` : val(r.BatteryType)],
    ['Transmission', [val(r.TransmissionStyle), num(r.TransmissionSpeeds) ? `${r.TransmissionSpeeds}-speed` : null].filter(Boolean).join(', ') || null],
    ['Brakes', val(r.BrakeSystemType)],
    ['GVWR', val(r.GVWR)],
    ['Wheelbase', num(r.WheelBaseShort) ? `${r.WheelBaseShort} in` : null],
    ['Wheel size', num(r.WheelSizeFront) ? `${r.WheelSizeFront} in` : null],
    ['Seats', val(r.Seats)],
    ['Vehicle type', nice(r.VehicleType)],
    ['Manufacturer', nice(r.Manufacturer)],
    ['Plant', [nice(r.PlantCity), nice(r.PlantState), nice(r.PlantCountry)].filter(Boolean).map((s) => s.replace(/\s*\(.*\)$/, '')).join(', ') || null],
  ].filter(([, v]) => v);

  const safety = [
    ['ABS', val(r.ABS)],
    ['Electronic stability control', val(r.ESC)],
    ['Traction control', val(r.TractionControl)],
    ['TPMS', val(r.TPMS)],
    ['Backup camera', val(r.RearVisibilitySystem)],
    ['Forward collision warning', val(r.ForwardCollisionWarning)],
    ['Automatic emergency braking', val(r.CIB)],
    ['Blind spot warning', val(r.BlindSpotMon)],
    ['Lane departure warning', val(r.LaneDepartureWarning)],
    ['Lane keep assist', val(r.LaneKeepSystem)],
    ['Adaptive cruise', val(r.AdaptiveCruiseControl)],
    ['Front airbags', val(r.AirBagLocFront)],
    ['Side airbags', val(r.AirBagLocSide)],
    ['Curtain airbags', val(r.AirBagLocCurtain)],
    ['Knee airbags', val(r.AirBagLocKnee)],
    ['Keyless ignition', val(r.KeylessIgnition)],
    ['Daytime running lights', val(r.DaytimeRunningLight)],
    ['Headlamp type', val(r.LowerBeamHeadlampLightSource)],
  ].filter(([, v]) => v);

  return {
    vin: r.VIN,
    year,
    make: val(r.Make) ? titleMake(r.Make) : null,
    model: val(r.Model),
    trim: [val(r.Trim), val(r.Series)].filter(Boolean).join(' ') || null,
    body: val(r.BodyClass),
    engine: engineLabel(r),
    engineCode: val(r.EngineModel),
    drive: val(r.DriveType),
    transmission: val(r.TransmissionStyle),
    fuel: val(r.FuelTypePrimary),
    specs,
    safety,
    errorCodes,
    errorText: val(r.ErrorText),
    suggestedVin: val(r.SuggestedVIN),
    complete: errorCodes.includes('0'),
  };
}

const MAKE_CASE = { BMW: 'BMW', GMC: 'GMC', MINI: 'MINI', RAM: 'Ram', 'MERCEDES-BENZ': 'Mercedes-Benz', 'LAND ROVER': 'Land Rover', 'ALFA ROMEO': 'Alfa Romeo' };
export const titleMake = (m = '') => MAKE_CASE[m.toUpperCase()] || m.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

export function decodeVin(vin, opts) {
  return cached(`vin:${vin}`, 30 * DAY, async () => {
    const json = await getJSON(`${VPIC}/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`, opts);
    const row = json?.Results?.[0];
    if (!row) throw new Error('No decode result');
    return normalizeDecode(row);
  });
}

// Recall/complaint endpoints key on make + model + model year, and only match NHTSA's own model
// spelling (e.g. "F-150" vs "F150", "NEW BEETLE"). Resolve the name against NHTSA's product list first.
const q = (o) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();
const squash = (s = '') => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function resolveModelName({ make, model, year }, issueType = 'r', opts) {
  try {
    const models = await cached(`products:${issueType}:${year}:${make}`.toLowerCase(), 7 * DAY, async () => {
      const json = await getJSON(`${API}/products/vehicle/models?${q({ modelYear: year, make, issueType })}`, { ...opts, emptyOn400: true });
      return (json?.results || []).map((r) => r.model).filter(Boolean);
    });
    const target = squash(model);
    return (
      models.find((m) => squash(m) === target) ||
      models.find((m) => squash(m).startsWith(target) || target.startsWith(squash(m))) ||
      models.find((m) => squash(m).includes(target)) ||
      model
    );
  } catch {
    return model;
  }
}

export function getRecalls({ make, model, year }, opts) {
  return cached(`recalls:${year}:${make}:${model}`.toLowerCase(), DAY, async () => {
    const name = await resolveModelName({ make, model, year }, 'r', opts);
    const json = await getJSON(`${API}/recalls/recallsByVehicle?${q({ make, model: name, modelYear: year })}`, { ...opts, emptyOn400: true });
    return (json?.results || json?.Results || [])
      .map((r) => ({
        campaign: r.NHTSACampaignNumber,
        date: parseNhtsaDate(r.ReportReceivedDate, 'dmy'),
        component: r.Component,
        summary: r.Summary,
        consequence: r.Consequence,
        remedy: r.Remedy,
        notes: r.Notes,
        manufacturer: r.Manufacturer,
        parkIt: Boolean(r.parkIt),
        parkOutside: Boolean(r.parkOutSide),
        ota: Boolean(r.overTheAirUpdate),
      }))
      .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
  });
}

export function getComplaints({ make, model, year }, opts) {
  return cached(`complaints:${year}:${make}:${model}`.toLowerCase(), 7 * DAY, async () => {
    const name = await resolveModelName({ make, model, year }, 'c', opts);
    const json = await getJSON(`${API}/complaints/complaintsByVehicle?${q({ make, model: name, modelYear: year })}`, { ...opts, emptyOn400: true });
    return (json?.results || json?.Results || [])
      .map((r) => ({
        id: r.odiNumber,
        date: parseNhtsaDate(r.dateComplaintFiled || r.dateOfIncident, 'mdy'),
        components: String(r.components || '').split(',').map((s) => s.trim()).filter(Boolean),
        summary: r.summary,
        crash: Boolean(r.crash),
        fire: Boolean(r.fire),
        injuries: r.numberOfInjuries || 0,
        deaths: r.numberOfDeaths || 0,
      }))
      .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
  });
}

export function getSafetyRatings({ make, model, year }, opts) {
  return cached(`ncap:${year}:${make}:${model}`.toLowerCase(), 30 * DAY, async () => {
    const list = await getJSON(`${API}/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`, { ...opts, emptyOn400: true });
    const variants = list?.Results || list?.results || [];
    const detailed = await Promise.all(
      variants.slice(0, 4).map(async (v) => {
        const d = await getJSON(`${API}/SafetyRatings/VehicleId/${v.VehicleId}`, opts);
        const r = d?.Results?.[0] || {};
        return {
          id: v.VehicleId,
          description: v.VehicleDescription,
          overall: r.OverallRating,
          front: r.OverallFrontCrashRating,
          side: r.OverallSideCrashRating,
          rollover: r.RolloverRating,
          rolloverRisk: r.RolloverPossibility,
          picture: r.VehiclePicture,
          complaints: r.ComplaintsCount,
          recalls: r.RecallsCount,
          investigations: r.InvestigationCount,
        };
      }),
    );
    return detailed;
  });
}

export function getModelsForMakeYear(make, year, opts) {
  return cached(`models:${year}:${make}`.toLowerCase(), 30 * DAY, async () => {
    const json = await getJSON(`${VPIC}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`, opts);
    return [...new Set((json?.Results || []).map((r) => r.Model_Name))].sort((a, b) => a.localeCompare(b));
  });
}

/** Recalls use DD/MM/YYYY, complaints use MM/DD/YYYY; some endpoints return /Date(ms)/ or ISO. */
function parseNhtsaDate(s, order = 'dmy') {
  if (!s) return null;
  const ms = /\/Date\((\d+)/.exec(s);
  if (ms) return new Date(Number(ms[1]));
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (parts) {
    const [a, b] = [Number(parts[1]), Number(parts[2])];
    const [day, month] = order === 'mdy' ? [b, a] : [a, b];
    return new Date(Number(parts[3]), month - 1, day);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Official page for open-recall status on a specific VIN (manufacturer-reported, includes repair status). */
export const nhtsaVinRecallUrl = (vin) => `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`;
export const nhtsaVehicleUrl = ({ year, make, model }) =>
  `https://www.nhtsa.gov/vehicle/${year}/${encodeURIComponent(String(make).toUpperCase())}/${encodeURIComponent(String(model).toUpperCase())}`;
