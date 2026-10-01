// General repair and diagnostic procedures, tailored to a vehicle profile. These are standard
// workshop practice; vehicle-specific torque values, capacities and connector pin-outs are always
// deferred to OEM service information rather than guessed.

export function proceduresFor(p) {
  const list = [];
  const gas = p.fuelKind === 'gasoline' || p.fuelKind === 'gaseous';
  const diesel = p.fuelKind === 'diesel';
  const hv = p.electrified && p.powertrain !== 'mhev';
  const banks = p.layout === 'V' || p.layout === 'H' || p.layout === 'W' ? 2 : 1;
  const plugs = p.cylinders ? p.cylinders * (p.engineFamily?.id === 'fca-hemi' ? 2 : 1) : null;
  const add = (x) => list.push(x);

  if (hv) {
    add({
      id: 'hv-safety',
      title: 'High-voltage safety & system disable',
      system: 'Safety',
      first: true,
      tools: ['Class 0 (1,000 V) insulated gloves with leather protectors — air-test before each use', 'CAT III/IV 1,000 V meter', 'Insulated tools', 'HV warning signage'],
      steps: [
        'Park, set the parking brake, switch the vehicle off and move the smart key at least 5 m away (or remove the key).',
        'Disconnect the 12 V battery negative terminal.',
        'Remove the HV service disconnect / service plug per the OEM procedure and keep it in your pocket.',
        'Wait the OEM-specified time for the inverter capacitors to discharge (commonly 5–10 minutes).',
        'Verify zero voltage at the inverter / HV terminals with a meter you have just proven on a known source (live-dead-live).',
        'Treat all orange cables and components as live until verified.',
      ],
      cautions: ['Never pierce, cut or probe orange HV cables.', 'Damaged packs can re-ignite hours later — follow OEM emergency response guidance.'],
    });
  }

  if (p.ice) {
    add({
      id: 'oil',
      title: 'Engine oil & filter service',
      system: 'Maintenance',
      tools: ['Drain pan', 'Filter wrench or cartridge cap socket', 'Torque wrench', 'Scan tool or menu to reset the oil-life monitor'],
      steps: [
        'Warm the engine briefly, then shut off and raise the vehicle level.',
        'Remove the drain plug, drain fully, and fit a new crush washer / gasket.',
        'Replace the filter: lubricate the new seal with clean oil (cartridge elements: replace the cap O-ring too).',
        'Refill to the specified capacity with oil meeting the OEM specification, run, check for leaks, recheck level on the dipstick or electronic gauge.',
        'Reset the oil-life / maintenance reminder.',
      ],
      specs: ['Oil specification & viscosity', 'Capacity with filter', 'Drain plug & cartridge cap torque'],
    });
  }

  if (gas && p.cylinders) {
    add({
      id: 'plugs',
      title: `Spark plug replacement (${plugs} plug${plugs === 1 ? '' : 's'})`,
      system: 'Ignition',
      tools: ['Spark plug socket with rubber insert', 'Extensions & swivel', 'Torque wrench', 'Gap gauge (wire type)', 'Dielectric grease'],
      steps: [
        'Work on a cold engine. Blow debris out of the plug wells before removing coils.',
        p.era.coilOnPlug === 'likely' ? 'Disconnect and remove each coil-on-plug; inspect boots for carbon tracking.' : 'Mark and remove plug wires or coils.',
        banks === 2 && p.layout === 'V' ? 'Rear-bank access on transverse V engines often requires removing the upper intake plenum — have the plenum gasket on hand.' : null,
        'Remove the plugs one at a time and read them (fouling, oil, overheating) — note the cylinder for each.',
        'Check the new plug gap (most iridium/platinum plugs are pre-gapped — do not pry on fine-wire tips).',
        'Thread in by hand, then torque to spec. Most OEMs specify no anti-seize on plated plugs.',
        'Apply a thin film of dielectric grease inside the coil boots and reinstall.',
      ].filter(Boolean),
      specs: ['Plug part number & gap', 'Plug torque (gasket vs tapered seat)', p.firingOrder ? `Firing order ${p.firingOrder}` : 'Firing order'],
    });
  }

  add({
    id: 'brakes',
    title: 'Front brake pads & rotors',
    system: 'Brakes',
    tools: ['Lug wrench / impact', 'Caliper piston tool', 'Torque wrench', 'Brake cleaner', 'Brake lubricant (high-temp, for slides & contact points)', 'Dial indicator (runout)'],
    steps: [
      'Loosen lug nuts, raise and support the vehicle, remove wheels.',
      'Remove the caliper (hang it — never by the hose) and the caliper bracket.',
      'Remove the rotor; clean the hub face of rust so the new rotor seats flat.',
      'Install the new rotor and check lateral runout.',
      'Clean and lubricate slide pins and abutment clips; install new hardware.',
      'Retract the piston (open the bleeder if contaminated fluid would be pushed back), install pads and caliper, torque bracket bolts.',
      'Torque wheels to spec in a star pattern. Pump the pedal before moving the vehicle; bed in the pads.',
    ],
    specs: ['Rotor minimum thickness', 'Caliper bracket bolt torque', 'Wheel lug torque'],
    cautions: p.era.electronicParkingBrake === 'possible' ? ['Rear brakes with an electronic parking brake must be put in service / maintenance mode with a scan tool before retracting pistons.'] : null,
  });

  add({
    id: 'battery',
    title: '12 V battery test & replacement',
    system: 'Electrical',
    tools: ['Conductance battery tester', 'Memory saver (optional)', 'Terminal brush', 'Scan tool (battery registration)'],
    steps: [
      'Test: state of charge (open-circuit ~12.6 V fully charged) and conductance vs. the rated CCA.',
      'Note radio presets/security codes; connect a memory saver if desired.',
      'Disconnect negative first, then positive; remove the hold-down.',
      'Clean terminals and tray; fit the battery of the correct group size and type (flooded / EFB / AGM).',
      'Connect positive first, then negative; torque terminals.',
      p.year >= 2010 ? 'If the vehicle has an intelligent battery sensor or start-stop, register the new battery with a scan tool so the charging strategy adapts.' : null,
      'Relearn windows/sunroof pinch protection and idle if required.',
    ].filter(Boolean),
    specs: ['Group size', 'CCA rating', 'Battery type (flooded/EFB/AGM)'],
    cautions: hv ? ['On hybrids/EVs the 12 V battery may be in the trunk or under a seat and is charged by the DC-DC converter, not an alternator.'] : null,
  });

  if (p.ice && !(p.powertrain === 'hybrid' || p.powertrain === 'phev')) {
    add({
      id: 'charging',
      title: 'Charging system test',
      system: 'Electrical',
      tools: ['DMM', 'Inductive amp clamp', 'Scan tool'],
      steps: [
        'Confirm the battery is charged and passes a load/conductance test first.',
        'Engine running, loads off: measure battery voltage. Conventional systems typically regulate ~13.5–14.8 V.',
        p.era.smartCharging ? 'This era commonly uses PCM-controlled (“smart”) charging that may intentionally hold ~12.5–13 V at cruise — check commanded vs. actual in the scan tool before condemning the alternator.' : null,
        'Load the system (blower high, headlamps, rear defrost) and confirm output current with an amp clamp against the alternator rating.',
        'Check AC ripple at the battery: more than ~0.5 V AC points to failed diodes.',
        'Voltage-drop the B+ cable and the alternator ground under load (typically under 0.2–0.3 V each).',
      ].filter(Boolean),
      specs: ['Alternator rated output', 'Charging control strategy (OEM)'],
    });
    add({
      id: 'starting',
      title: 'No-crank / slow-crank diagnosis',
      system: 'Electrical',
      tools: ['DMM', 'Amp clamp', 'Remote starter switch'],
      steps: [
        'Verify battery state of charge and terminals.',
        'Measure cranking voltage at the battery (should stay above ~9.6 V on a healthy system).',
        'Voltage-drop test while cranking: positive cable battery-to-starter and ground starter-to-battery — each typically under ~0.5 V.',
        'Check the control side: start request, neutral/clutch switch, starter relay (PCM-controlled on most modern vehicles), and the solenoid “S” terminal voltage.',
        'If the starter receives full voltage on both terminals and grounds are good but will not turn, suspect the starter or a seized engine — try turning the crankshaft by hand.',
      ],
    });
  }

  add({
    id: 'parasitic',
    title: 'Parasitic battery drain test',
    system: 'Electrical',
    tools: ['Inductive low-amp clamp or DMM with mA range', 'Fuse-voltage-drop chart (OEM) or mV meter'],
    steps: [
      'Fully charge the battery. Close doors (latch them with a screwdriver if you need access), lock the vehicle and let modules go to sleep — this can take 10–60 minutes on modern vehicles.',
      'Measure draw with a clamp on the negative cable (avoids waking modules by breaking the circuit).',
      'Typical sleep draw is under about 50 mA; much higher points to a module or circuit staying awake.',
      'Find the circuit by measuring millivolt drop across each fuse rather than pulling fuses (pulling can wake modules).',
      p.era.canLikely ? 'On networked vehicles, use the scan tool to see which module is keeping the bus awake.' : null,
    ].filter(Boolean),
  });

  if (p.ice) {
    add({
      id: 'cooling',
      title: 'Cooling system service & air bleeding',
      system: 'Cooling',
      tools: ['Pressure tester & adapters', 'Coolant vacuum fill tool', 'Refractometer'],
      steps: [
        'Pressure-test the cold system to the cap rating and inspect for external leaks; test the cap.',
        'Drain from the radiator petcock (and block drains if specified).',
        'Refill with the OE-specified coolant, ideally with a vacuum filler to avoid air pockets.',
        'Open bleeder screws if equipped, run to operating temperature with heater on high, top off, and verify the thermostat opens (upper hose heats).',
        'Check freeze protection with a refractometer.',
      ],
      cautions: [hv ? 'Hybrid/EV inverter and battery loops have their own fill and bleed procedures — often requiring a scan tool to run the electric pumps.' : null, 'Never open a hot pressurized system.'].filter(Boolean),
      specs: ['Coolant type & capacity', 'Bleed procedure'],
    });
  }

  if (gas && p.cylinders) {
    add({
      id: 'misfire',
      title: 'Misfire diagnosis (P0300–P03xx)',
      system: 'Ignition',
      tools: ['Scan tool with misfire counters / Mode 6', 'Compression & leak-down tester', 'Noid light or scope', 'Spark tester'],
      steps: [
        'Read freeze-frame and per-cylinder misfire counters to find the cylinder and the conditions (cold, load, idle).',
        'Swap the coil (and plug) with a neighboring cylinder: if the misfire follows, the part is bad.',
        'Check injector pulse and balance; swap injectors if accessible.',
        'Perform a relative compression test, then a compression / leak-down test on the affected cylinder.',
        'Check for vacuum leaks near the cylinder and review fuel trims per bank.',
        p.firingOrder ? `Firing order for reference: ${p.firingOrder}.` : null,
      ].filter(Boolean),
    });
  }

  if (p.era.canLikely) {
    add({
      id: 'can',
      title: 'Network / no-communication diagnosis (U-codes)',
      system: 'Network',
      tools: ['DMM', 'Oscilloscope (recommended)', 'Breakout box for the DLC'],
      steps: [
        'Confirm DLC power (pin 16) and grounds (pins 4/5).',
        'Battery disconnected: measure resistance between pins 6 and 14 — about 60 Ω means both 120 Ω terminators are present.',
        '120 Ω → one terminator or one branch is open; ~0 Ω → CAN-H shorted to CAN-L; very low resistance to ground → a leg shorted to ground.',
        'Key on: CAN-H should average ~2.6 V and CAN-L ~2.4 V; a scope should show mirror-image square waves.',
        'Disconnect modules one at a time to find one dragging the bus down.',
      ],
    });
  }

  if (p.era.tpms) {
    add({
      id: 'tpms',
      title: 'TPMS sensor service & relearn',
      system: 'Tires',
      tools: ['TPMS activation/programming tool', 'Valve core torque driver'],
      steps: [
        'Read all sensors with the TPMS tool before dismounting to identify any dead sensor.',
        'Replace valve cores, seals and caps (service kit) whenever a tire is dismounted.',
        'Program a replacement sensor (if using programmable sensors) by copying the old ID or creating a new one.',
        'Perform the vehicle-specific relearn: automatic drive-cycle, stationary tool relearn, or OBD relearn.',
      ],
    });
  }

  if (p.drive === 'fwd' || p.drive === 'awd' || p.drive === '4wd') {
    add({
      id: 'cv',
      title: 'CV axle replacement',
      system: 'Driveline',
      tools: ['Axle nut socket', 'Torque wrench', 'Pry bar / slide hammer', 'Ball joint separator'],
      steps: [
        'Loosen the axle nut with the wheel on the ground (or with brakes applied).',
        'Raise the vehicle, remove the wheel, separate the lower ball joint or tie rod as needed.',
        'Push the outer joint out of the hub and pry the inner joint from the transmission/differential.',
        'Install a new circlip/seal as required, seat the new axle until the clip locks.',
        'Reassemble and torque the new (usually single-use) axle nut to spec.',
      ],
      specs: ['Axle nut torque', 'Fluid level after removal'],
    });
  }

  if (p.drive === 'rwd' || p.drive === '4wd' || p.drive === 'awd') {
    add({
      id: 'driveshaft',
      title: 'Driveshaft & U-joint inspection',
      system: 'Driveline',
      steps: [
        'Index-mark the driveshaft to the pinion flange before removal to keep balance.',
        'Check U-joints for play and notchiness; check the center support bearing (two-piece shafts) and slip yoke.',
        'Inspect the pinion seal and transfer-case/transmission output seal for leaks.',
        'Reinstall aligned to the marks; torque flange bolts to spec.',
      ],
    });
  }

  if (diesel) {
    add({
      id: 'diesel-aftertreatment',
      title: 'Diesel aftertreatment basics (DPF / SCR)',
      system: 'Emissions',
      steps: [
        p.era.dpf ? 'Check DPF soot load and differential-pressure sensor data in the scan tool before attempting a regeneration.' : null,
        'Look for the root cause of excess soot: injectors, EGR, boost leaks, short-trip duty cycle.',
        p.era.scr ? 'For SCR faults: test DEF quality with a refractometer (~32.5% urea), inspect the doser, and compare upstream/downstream NOx sensor readings.' : null,
        'Run OEM-commanded service regenerations only with the exhaust area clear and the vehicle outdoors.',
      ].filter(Boolean),
    });
  }

  if (p.era.adas !== 'unlikely') {
    add({
      id: 'adas',
      title: 'ADAS calibration triggers',
      system: 'ADAS',
      steps: [
        'Windshield replacement, camera/radar removal, alignment changes, ride-height changes and collision repair commonly require static and/or dynamic calibration.',
        'Confirm which systems are fitted from the build data or trim, then follow the OEM calibration procedure (targets, level floor, specified distances).',
        'Document pre- and post-calibration scans.',
      ],
    });
  }

  if (p.era.electronicThrottle !== 'unlikely' && gas) {
    add({
      id: 'throttle',
      title: 'Throttle body cleaning & relearn',
      system: 'Fuel & air',
      steps: [
        'Key off; disconnect the intake duct and inspect the throttle plate and bore for carbon.',
        'Clean with throttle-body cleaner on a rag (do not force the plate on electronic throttle bodies).',
        'Perform the idle/throttle relearn if the OEM requires it (scan-tool function or key-cycle procedure).',
      ],
    });
  }

  return list;
}
