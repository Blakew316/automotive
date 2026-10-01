// Per-vehicle service parts list, generated from the vehicle profile (engine, fuel, drivetrain,
// body, era). Quantities follow from the configuration (e.g. one plug per cylinder); anything that
// depends on an exact build is marked `typical` and explained in `note`. No part numbers are
// invented here — verified numbers are merged in separately from sourced data.

const item = (name, qty, extra = {}) => ({ name, qty, ...extra });

export function generatePartsList(p) {
  const groups = [];
  const add = (system, items) => {
    const list = items.filter(Boolean);
    if (list.length) groups.push({ system, items: list });
  };
  const cyl = p.cylinders || null;
  const banks = p.layout === 'V' || p.layout === 'H' || p.layout === 'W' ? 2 : 1;
  const gas = p.fuelKind === 'gasoline' || p.fuelKind === 'gaseous';
  const diesel = p.fuelKind === 'diesel';
  const fullHybrid = p.powertrain === 'hybrid' || p.powertrain === 'phev';
  const ev = p.powertrain === 'ev' || p.powertrain === 'fcev';
  const driven = { fwd: 'front', rwd: 'rear', awd: 'all four', '4wd': 'all four' }[p.drive];
  const truck = ['pickup', 'chassis', 'heavy', 'van', 'bus', 'motorhome'].includes(p.body);
  const rearHatch = ['hatch', 'suv', 'van'].includes(p.body);
  const plugsPerCyl = p.engineFamily?.id === 'fca-hemi' ? 2 : 1;
  const twinTurbo = p.turbo && (banks === 2 || /twin|biturbo|\bTT\b/i.test(`${p.values.eng || ''} ${p.values.engInfo || ''}`));
  const y = p.year || 2000;

  // ---------------------------------------------------------------- Maintenance
  add('Maintenance & fluids', [
    p.ice && item('Engine oil', null, { note: 'Viscosity, specification and fill capacity: owner’s manual or oil-cap/underhood label.', kw: ['synthetic', 'motor oil', 'engine oil'] }),
    p.ice && item('Oil filter', 1, { note: 'Spin-on or cartridge element depending on engine.', kw: ['oil filter'] }),
    p.ice && item('Oil drain plug gasket / crush washer', 1, { typical: true }),
    !ev && item('Engine air filter', 1, { kw: ['engine air filter'] }),
    p.era.cabinFilter !== 'unlikely' && item('Cabin air filter', 1, { condition: p.era.cabinFilter === 'mixed' ? 'If equipped' : null, kw: ['cabin'] }),
    item('Wiper blades, front', 2, { note: 'Driver and passenger sizes usually differ.', kw: ['wiper'] }),
    rearHatch && item('Wiper blade, rear', 1, { typical: true, kw: ['wiper'] }),
    item('Brake fluid', null, { note: 'DOT type is printed on the master-cylinder cap.', kw: ['brake fluid'] }),
    !ev && item('Engine coolant', null, { note: 'Use the OE-specified chemistry (e.g. Dexcool, Motorcraft Orange, Toyota SLLC, Honda Type 2, G12/G13).', kw: ['coolant'] }),
    (ev || fullHybrid) && item('Inverter / battery coolant', null, { note: 'Electrified drive units use one or more separate coolant loops.', kw: ['coolant'] }),
    p.automatic !== false && !ev && item(p.cvt ? 'CVT fluid' : p.dct ? 'Dual-clutch transmission fluid' : 'Automatic transmission fluid', null, { note: p.transmission ? `Transmission: ${p.transmission}. Use the exact OE fluid.` : 'Use the exact OE fluid type.', kw: ['atf', 'cvt', 'transmission'] }),
    p.automatic === false && item('Manual transmission gear oil', null, { kw: ['gear oil', 'manual'] }),
    ev && item('Drive-unit (reduction gear) oil', null, { kw: ['gear oil'] }),
    ['rwd', 'awd', '4wd'].includes(p.drive) && !ev && item('Rear differential gear oil', null, { note: 'Limited-slip units may need friction modifier.', kw: ['gear oil', 'differential'] }),
    p.drive === '4wd' && item('Front differential gear oil', null, { kw: ['gear oil'] }),
    p.drive === '4wd' && item('Transfer case fluid', null, { kw: ['transfer case'] }),
    p.drive === 'awd' && !ev && item('Power transfer unit / center coupling fluid', null, { typical: true, note: 'Transverse-engine AWD uses a PTU and rear drive unit; longitudinal AWD uses a center differential.' }),
    p.era.electricPowerSteering !== 'likely' && !ev && item('Power steering fluid', null, { condition: p.era.electricPowerSteering === 'mixed' ? 'Hydraulic steering only' : null, kw: ['power steering'] }),
    item(acRefrigerant(y), null, { note: 'Charge amount and oil type are on the underhood A/C label.', kw: y >= 2021 ? ['1234yf'] : y < 2013 ? ['134a'] : ['1234yf', '134a'] }),
    diesel && p.era.scr && item('Diesel exhaust fluid (DEF)', null, { kw: ['def'] }),
    diesel && item('Fuel filter / water separator', '1–2', { note: 'Many diesels use primary and secondary filters.', kw: ['fuel filter'] }),
    gas && item('Fuel filter', 1, { condition: p.era.returnlessFuel ? 'Often in-tank (non-serviceable) on returnless systems' : null, typical: true, kw: ['fuel filter'] }),
    gas && item('PCV valve', 1, { typical: true, condition: 'If serviceable' }),
    item('Tire pressure / TPMS service kits', p.era.tpms ? 4 : null, { condition: p.era.tpms ? null : 'Pre-2008: TPMS optional', kw: ['tpms', 'valve stem'] }),
  ]);

  // ---------------------------------------------------------------- Ignition & fuel
  if (p.ice) {
    add('Ignition & fuel', [
      gas && cyl && item('Spark plugs', cyl * plugsPerCyl, { note: plugsPerCyl === 2 ? 'This engine family uses two plugs per cylinder.' : banks === 2 ? 'Rear-bank plugs on transverse V engines often require removing the intake plenum.' : null, kw: ['spark plug', 'iridium'] }),
      gas && cyl && item(p.era.coilOnPlug === 'likely' ? 'Ignition coils (coil-on-plug)' : 'Ignition coils / coil pack', p.era.coilOnPlug === 'likely' ? cyl : null, { typical: true, note: p.era.coilOnPlug === 'likely' ? null : 'Older designs use a distributor, coil pack or waste-spark coils.', kw: ['coil'] }),
      gas && p.era.coilOnPlug === 'unlikely' && item('Distributor cap, rotor & plug wires', 1, { typical: true, condition: 'Distributor ignition only' }),
      diesel && cyl && item('Glow plugs', cyl, { kw: ['glow plug'] }),
      cyl && item(diesel ? 'Fuel injectors (diesel)' : p.injection === 'dual' ? 'Fuel injectors — direct + port' : p.injection === 'direct' ? 'Fuel injectors (direct injection)' : 'Fuel injectors (port)', p.injection === 'dual' ? cyl * 2 : cyl, { note: p.injectionKnown ? null : 'Injection type inferred from era — confirm.', typical: !p.injectionKnown }),
      (p.injection === 'direct' || p.injection === 'dual') && item('High-pressure fuel pump (cam-driven)', 1),
      diesel && p.injection === 'common-rail' && item('High-pressure fuel pump (common rail)', 1),
      item('Fuel pump module (in tank)', 1, { typical: true }),
      gas && item('Throttle body', 1),
      item('Mass airflow (MAF) and/or MAP sensor', '1–2', { typical: true, kw: ['maf', 'map sensor'] }),
      p.turbo && item(twinTurbo ? 'Turbochargers' : 'Turbocharger', twinTurbo ? 2 : 1),
      (p.turbo || p.supercharged) && item('Intercooler / charge-air cooler & hoses', 1, { typical: true }),
      p.supercharged && item('Supercharger', 1),
    ]);
  }

  // ---------------------------------------------------------------- Engine mechanical & sensors
  if (p.ice) {
    add('Engine mechanical & sensors', [
      item('Accessory (serpentine) drive belt', fullHybrid ? null : 1, { condition: fullHybrid ? 'Many full hybrids have electric A/C and water pumps — check for a belt' : null, kw: ['belt'] }),
      !fullHybrid && item('Belt tensioner & idler pulley(s)', '1–3', { typical: true }),
      item('Timing belt kit or timing chain set', 1, { note: 'Belt vs chain is engine-specific; belts have a replacement interval.', typical: true }),
      item('Water pump', 1, { note: 'Mechanical (belt/chain-driven) or electric.', typical: true }),
      item('Thermostat & housing gasket', 1),
      item('Radiator', 1),
      item('Radiator hoses (upper & lower)', 2),
      item('Coolant reservoir cap / radiator cap', 1),
      item(truck && p.drive !== 'fwd' ? 'Cooling fan (clutch or electric)' : 'Electric cooling fan assembly', 1, { typical: true }),
      item('Valve cover gasket', banks, { note: banks === 2 ? 'One per bank.' : null }),
      item('Intake manifold gasket set', 1),
      item('Engine mounts / transmission mount', '3–4', { typical: true }),
      p.era.obd2 && item('Oxygen sensors — upstream (air/fuel)', banks, { note: banks === 2 ? 'Bank 1 Sensor 1 and Bank 2 Sensor 1. Bank 1 is the side with cylinder 1.' : 'Bank 1 Sensor 1.', kw: ['o2', 'oxygen'] }),
      p.era.obd2 && gas && item('Oxygen sensors — downstream (post-cat)', banks, { typical: banks === 2, note: banks === 2 ? 'Some V engines merge into one downstream sensor.' : null, kw: ['o2', 'oxygen'] }),
      gas && item('Catalytic converter(s)', banks === 2 ? '2–4' : '1–2', { typical: true, note: 'Close-coupled and underbody converters vary by build.' }),
      diesel && p.era.dpf && item('Diesel particulate filter (DPF)', 1),
      diesel && p.era.scr && item('NOx sensors', 2, { typical: true }),
      diesel && item('EGR valve & cooler', 1, { condition: 'If equipped', typical: true }),
      item('Crankshaft position sensor', 1),
      item('Camshaft position sensor(s)', banks === 2 ? '2–4' : '1–2', { typical: true }),
      cyl && item('Knock sensor(s)', banks, { typical: true, condition: diesel ? 'Gasoline engines' : null }),
      item('Coolant temperature sensor', '1–2'),
      p.era.obd2 && gas && item('EVAP purge valve & canister vent valve', 2),
      p.era.electronicThrottle !== 'unlikely' && item('Accelerator pedal position sensor', 1, { condition: p.era.electronicThrottle === 'mixed' ? 'Drive-by-wire only' : null }),
    ]);
  }

  // ---------------------------------------------------------------- Electrified drive
  if (p.electrified && p.powertrain !== 'mhev') {
    add('High-voltage & electric drive', [
      item('High-voltage battery pack', 1, { note: p.battery.kwh ? `${p.battery.kwh} kWh${p.battery.type ? ` · ${p.battery.type}` : ''}` : p.battery.type || null, condition: 'OEM-certified service' }),
      item('HV service disconnect / manual service plug', 1),
      item('Inverter / power control unit', 1),
      item('DC-DC converter (charges the 12 V system)', 1),
      (p.powertrain === 'phev' || ev) && item('On-board charger', 1),
      (p.powertrain === 'phev' || ev) && item('Charge port & door actuator', 1),
      item(ev ? 'Drive motor / drive unit' : 'Motor-generators (MG1/MG2)', ev ? p.motors || 1 : '1–2'),
      item('Electric A/C compressor', 1),
      item('Electric coolant pump(s)', '1–3', { typical: true }),
      fullHybrid && item('HV battery cooling fan & intake filter', 1, { condition: 'Air-cooled packs (e.g. many Toyota/Lexus hybrids)', typical: true }),
      ev && item('Battery coolant heater / chiller', 1, { typical: true }),
    ]);
  }
  if (p.powertrain === 'mhev') {
    add('Mild-hybrid system', [item('Belt starter-generator (BSG) or integrated starter-generator', 1), item('48 V / mild-hybrid battery', 1), item('DC-DC converter', 1)]);
  }

  // ---------------------------------------------------------------- Electrical
  const dualBattery = diesel && (p.body === 'pickup' || p.heavyDuty);
  add('Electrical & lighting', [
    item('12 V battery', dualBattery ? 2 : 1, { note: dualBattery ? 'Most diesel pickups use two batteries.' : y >= 2010 ? 'AGM/EFB on many start-stop and premium vehicles; some need battery registration.' : null, kw: ['battery'] }),
    p.ice && !fullHybrid && item(p.era.startStop === 'possible' ? 'Alternator (smart-charging; start-stop units differ)' : 'Alternator', 1, { kw: ['alternator'] }),
    p.ice && !fullHybrid && item('Starter motor', 1, { kw: ['starter'] }),
    item('Battery cables & terminals', '2–3', { typical: true }),
    item('Headlamp bulbs or assemblies', 2, { note: 'Halogen, HID or LED depending on trim.' }),
    item('Tail / brake lamp bulbs or assemblies', 2, { typical: true }),
    item('Blower motor', 1),
    item('Blower resistor / blower control module', 1),
    !ev && item(fullHybrid ? 'A/C compressor (electric on most full hybrids)' : 'A/C compressor', 1),
    item('A/C condenser', 1),
    item('A/C expansion valve or orifice tube', 1, { typical: true }),
    item('HVAC blend / mode door actuators', '2–5', { typical: true }),
    p.doors && item('Power window regulators / motors', p.doors >= 4 ? 4 : 2, { condition: 'Power windows' }),
    p.doors && item('Door lock actuators', p.doors >= 5 ? 5 : p.doors >= 4 ? 4 : 2, { typical: true }),
    p.era.tpms && item('TPMS sensors', 4, { note: 'Spare may also have a sensor on some trucks.', kw: ['tpms'] }),
    p.era.backupCamera && item('Rear-view camera', 1),
    p.era.adas !== 'unlikely' && item('Front radar / windshield camera (ADAS)', '1–2', { condition: 'If equipped — requires calibration after replacement', typical: true }),
    item('Horn', '1–2'),
    item('Key fob battery', 1, { typical: true }),
  ]);

  // ---------------------------------------------------------------- Brakes
  add('Brakes', [
    item('Front brake pads (axle set)', 1, { kw: ['brake pad', 'front'] }),
    item('Front brake rotors', 2, { kw: ['rotor'] }),
    item('Rear brake pads (axle set) or shoes', 1, { note: 'Rear disc or drum depends on trim and era.', typical: true, kw: ['brake pad', 'rear'] }),
    item('Rear rotors or drums', 2, { typical: true, kw: ['rotor'] }),
    item('Brake caliper hardware kits', 2, { note: 'One per axle.', kw: ['hardware kit'] }),
    item('Front brake calipers', 2),
    item('Rear calipers or wheel cylinders', 2, { typical: true }),
    item('Brake hoses', p.drive === 'rwd' && truck ? 3 : 4, { typical: true, note: 'Solid rear axles often use one center hose.' }),
    item('ABS wheel-speed sensors', 4, { typical: true }),
    p.era.electronicParkingBrake === 'possible' ? item('Electronic parking-brake caliper motors', 2, { condition: 'If equipped (otherwise parking-brake cables)', typical: true }) : item('Parking brake cables', '2–3', { typical: true }),
    item('Brake master cylinder', 1),
    item(ev || fullHybrid ? 'Brake booster / electro-hydraulic brake actuator' : diesel ? 'Brake booster (vacuum pump or hydro-boost)' : 'Brake booster', 1),
  ]);

  // ---------------------------------------------------------------- Steering & suspension
  const solidRear = truck && p.drive !== 'fwd';
  add('Steering & suspension', [
    item(truck ? 'Front shocks (or struts)' : 'Front struts / shock absorbers', 2, { kw: ['strut', 'shock'] }),
    item(solidRear ? 'Rear shocks' : 'Rear struts / shock absorbers', 2, { kw: ['strut', 'shock'] }),
    item(solidRear ? 'Front coil springs or torsion bars; rear leaf springs' : 'Coil springs', 4, { typical: true }),
    item('Front lower control arms (with bushings / ball joints)', 2),
    (truck || ['rwd', '4wd'].includes(p.drive)) && item('Front upper control arms / ball joints', 2, { condition: 'Double-wishbone / SLA front suspension', typical: true }),
    item('Outer tie rod ends', 2),
    item('Inner tie rods', 2),
    item('Sway bar end links', '2–4', { typical: true }),
    item('Sway bar bushings', '2–4', { typical: true }),
    item('Front wheel hub / bearing assemblies', 2, { kw: ['hub', 'bearing'] }),
    item(solidRear ? 'Rear axle shaft bearings & seals' : 'Rear wheel hub / bearing assemblies', 2, { kw: ['hub', 'bearing'] }),
    item(p.era.electricPowerSteering === 'likely' ? 'Steering rack (electric power steering)' : truck && y < 2010 ? 'Steering gear or rack' : 'Steering rack', 1, { typical: true }),
    p.era.electricPowerSteering !== 'likely' && !ev && item('Power steering pump', 1, { condition: 'Hydraulic power steering', typical: true }),
  ]);

  // ---------------------------------------------------------------- Driveline
  const dl = [];
  if (p.drive === 'fwd') {
    dl.push(item('Front CV axles (halfshafts)', 2), item('CV boot kits', 4, { note: 'Inner and outer, each side.' }), item('Axle / differential seals', 2));
  } else if (p.drive === 'rwd') {
    dl.push(
      item('Driveshaft (propeller shaft)', 1, { note: 'One- or two-piece depending on wheelbase.' }),
      item('Universal joints or flex coupler', '2–3', { typical: true }),
      truck ? item('Driveshaft center support bearing', 1, { condition: 'Two-piece shafts' }) : null,
      item(solidRear ? 'Rear axle shafts' : 'Rear CV axles (halfshafts)', 2, { typical: true }),
      item('Pinion seal', 1),
      item('Axle seals', 2),
    );
  } else if (p.drive === 'awd') {
    dl.push(
      item('Front CV axles', 2),
      item('Rear CV axles', 2, { typical: true }),
      item('Rear driveshaft', 1),
      item('Power transfer unit (PTU) or center differential', 1, { typical: true }),
      item('Rear drive unit / coupling', 1, { typical: true }),
      item('CV boot kits', '4–8', { typical: true }),
    );
  } else if (p.drive === '4wd') {
    dl.push(
      item('Transfer case', 1),
      item('Transfer case shift motor / encoder', 1, { condition: 'Electronic-shift 4WD', typical: true }),
      item('Front driveshaft', 1),
      item('Rear driveshaft', 1),
      item('Front CV axles or front axle shafts & U-joints', 2, { note: 'Independent front suspension uses CV axles; solid front axles use shafts with U-joints.', typical: true }),
      item('Universal joints', '3–6', { typical: true }),
      item('Front differential', 1),
      item('Rear differential', 1),
      item('Rear axle shafts', 2, { typical: true }),
      item('Front axle disconnect / locking hub actuators', '1–2', { condition: 'If equipped', typical: true }),
    );
  }
  if (ev) dl.push(item('Drive unit halfshafts', p.motors >= 2 ? 4 : 2));
  if (!ev && p.automatic !== false) dl.push(item(p.cvt ? 'CVT assembly' : 'Automatic transmission assembly', 1, { condition: 'Replacement unit' }), item('Transmission filter / pan gasket', 1, { condition: 'Serviceable units', typical: true }));
  if (p.automatic === false) dl.push(item('Clutch kit (disc, pressure plate, release bearing)', 1), item('Flywheel', 1, { note: 'Single- or dual-mass.' }), item('Clutch master & slave cylinders', 2));
  add(`Driveline · ${driven ? `${driven} wheels driven` : 'drive unknown'}`, dl);

  // ---------------------------------------------------------------- Exhaust & body
  add('Exhaust & body', [
    p.ice && item('Exhaust gaskets & hangers', null, { typical: true }),
    p.ice && item('Muffler / resonator', '1–2', { typical: true }),
    item('Windshield', 1),
    item('Side mirror glass / assemblies', 2),
    item('Hood & liftgate / trunk struts', rearHatch ? 4 : 2, { condition: 'Gas-strut supported', typical: true }),
  ]);

  return groups;
}

function acRefrigerant(y) {
  if (y < 1994) return 'A/C refrigerant — R-12 (pre-1994; usually retrofitted)';
  if (y < 2013) return 'A/C refrigerant — R-134a';
  if (y < 2021) return 'A/C refrigerant — R-134a or R-1234yf (transition years)';
  return 'A/C refrigerant — R-1234yf';
}

export function countParts(groups) {
  return groups.reduce((s, g) => s + g.items.length, 0);
}
