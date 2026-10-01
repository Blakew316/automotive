import { Diagram, Block, Wire, Label, Node, GroundSymbol, Fuse } from './Svg';

/** Engine management: what the PCM/ECM reads and what it drives, built from this engine's configuration. */
export function EngineControlDiagram({ profile: p }) {
  if (!p.ice) return null;
  const diesel = p.fuelKind === 'diesel';
  const di = p.injection === 'direct' || p.injection === 'dual';
  const modern = (p.year || 2000) >= 1996;
  const etc = p.era.electronicThrottle !== 'unlikely' && !diesel;
  const boosted = p.turbo || p.supercharged;

  const inputs = [
    ['Crankshaft position (CKP)', 'engine speed / position'],
    ['Camshaft position (CMP)', p.layout === 'V' || p.layout === 'H' ? 'one or more per bank' : 'cam phasing feedback'],
    diesel ? ['Mass airflow (MAF)', 'with intake air temp'] : ['MAF and/or MAP', 'air charge'],
    ['Coolant temperature (ECT)', null],
    etc || diesel ? ['Accelerator pedal (APP)', 'redundant tracks'] : ['Throttle position (TPS)', null],
    diesel ? ['Fuel rail pressure', 'high-pressure rail'] : di ? ['Fuel rail pressure', 'high side (direct injection)'] : null,
    boosted ? ['Boost pressure / charge temp', p.turbo ? 'turbo' : 'supercharger'] : null,
    diesel ? null : ['Knock sensor(s)', p.layout === 'V' || p.layout === 'H' ? 'usually one per bank' : null],
    diesel
      ? ['NOx · EGT · DPF ΔP', [p.era.scr ? 'SCR' : null, p.era.dpf ? 'DPF' : null].filter(Boolean).join(' / ') || 'exhaust sensors']
      : modern
        ? ['Upstream & downstream O2 / A-F', p.layout === 'V' || p.layout === 'H' ? 'per bank: S1 before cat, S2 after' : 'S1 before cat, S2 after']
        : ['Oxygen sensor', null],
  ].filter(Boolean);

  const coils = p.era.coilOnPlug === 'likely' ? 'Coil-on-plug' : p.era.coilOnPlug === 'mixed' ? 'Coil-on-plug or coil packs' : 'Distributor or coil pack';
  const outputs = [
    [`Fuel injectors × ${p.cylinders || 'n'}`, diesel ? 'common-rail (high pressure)' : p.injection === 'dual' ? 'port + direct' : di ? 'direct (high pressure)' : p.injection === 'tbi' ? 'throttle body' : 'port, sequential'],
    diesel ? ['Glow plug control', 'cold-start'] : [coils, p.cylinders ? `${p.cylinders} cylinders` : null],
    etc ? ['Electronic throttle (ETC)', 'motor + dual TPS'] : diesel ? ['Intake throttle / EGR valve', null] : ['Idle air control', null],
    diesel || di ? ['High-pressure fuel pump', diesel ? 'rail pressure control' : 'cam-driven, PCM-metered'] : ['Fuel pump relay / module', p.era.returnlessFuel ? 'returnless system typical' : null],
    diesel ? null : ['EVAP purge & vent', null],
    (p.year || 2000) >= 2000 ? ['Variable valve timing', 'cam phaser solenoids'] : null,
    p.turbo ? ['Wastegate / VGT actuator', null] : null,
    diesel && p.era.scr ? ['DEF dosing (SCR)', 'injector + heaters'] : null,
    ['Cooling fan control', null],
  ].filter(Boolean);

  const rowH = 46;
  const h = Math.max(inputs.length, outputs.length) * rowH + 140;
  const pcmY = 60;
  const pcmH = h - 120;
  return (
    <Diagram
      id="enginecontrol"
      title={diesel ? 'Engine control — diesel' : 'Engine control — ignition & fuel'}
      subtitle={`${p.engineCode ? `${p.engineCode} · ` : ''}${diesel ? 'ECM' : 'PCM / ECM'} inputs and outputs`}
      viewBox={`0 0 760 ${h}`}
      legend={['signal', 'power', 'ground']}
      notes={[
        'Check powers and grounds at the control module before condemning sensors — low reference or a bad ground skews every reading.',
        diesel ? 'Most diesel no-starts are fuel-related: verify rail pressure while cranking and check for low-side air or restriction.' : 'Misfires: swap coil and injector to a neighbouring cylinder and see whether the fault follows the part.',
        p.injectionKnown ? null : `Injection type (${p.injection}) is inferred from the model year, not stated in the NHTSA record.`,
      ].filter(Boolean)}
    >
      <Block x={300} y={pcmY} w={160} h={pcmH} label={diesel ? 'ECM' : 'PCM / ECM'} sub="engine control module" tone="accent" />
      {inputs.map(([label, sub], i) => {
        const y = 70 + i * rowH;
        return (
          <g key={label}>
            <Block x={20} y={y} w={210} h={38} label={label} sub={sub} small />
            <Wire d={`M230,${y + 19} H300`} kind="signal" />
          </g>
        );
      })}
      {outputs.map(([label, sub], i) => {
        const y = 70 + i * rowH;
        return (
          <g key={label}>
            <Wire d={`M460,${y + 19} H530`} kind="signal" />
            <Block x={530} y={y} w={210} h={38} label={label} sub={sub} small />
          </g>
        );
      })}
      <Label x={125} y={58} anchor="middle" muted={false} weight={600}>Inputs</Label>
      <Label x={635} y={58} anchor="middle" muted={false} weight={600}>Outputs</Label>
      {/* Power & ground */}
      <Wire d={`M340,${pcmY} V30 H230`} kind="power" />
      <Fuse x={290} y={30} />
      <Label x={222} y={34} anchor="end">Battery · main relay · ignition</Label>
      <Wire d={`M420,${pcmY + pcmH} V${h - 26}`} kind="ground" />
      <GroundSymbol x={420} y={h - 26} />
      <Label x={432} y={h - 12} size={10}>engine & body grounds</Label>
      <Node x={340} y={pcmY} kind="power" />
      <Wire d={`M360,${pcmY + pcmH} V${h - 30} H260`} kind="network" />
      <Label x={150} y={h - 26}>to network / DLC</Label>
    </Diagram>
  );
}

/** Cooling: engine loop (ICE/hybrid) and battery / power-electronics loops (electrified). */
export function CoolingDiagram({ profile: p }) {
  const ev = !p.ice;
  const hybrid = p.ice && p.electrified && p.powertrain !== 'mhev';
  if (ev) {
    return (
      <Diagram
        id="cooling"
        title="Thermal management"
        subtitle="Battery-electric: battery and drive-unit coolant loops with a refrigerant chiller"
        viewBox="0 0 720 300"
        legend={['hot', 'cool']}
        notes={[
          'Battery and power-electronics loops typically use low-conductivity coolant — use only the specified coolant.',
          'Many EVs require a scan-tool-driven fill/bleed routine that cycles valves and pumps.',
          'The A/C system cools the battery via the chiller; an A/C fault can limit DC fast charging.',
        ]}
      >
        <Block x={40} y={110} w={150} h={80} label="HV battery" sub="cold plates" tone="hv" />
        <Block x={290} y={40} w={140} h={50} label="Chiller" sub="refrigerant ↔ coolant" small />
        <Block x={290} y={210} w={140} h={50} label="Coolant heater / heat pump" small />
        <Block x={520} y={110} w={160} h={80} label="Drive unit & inverter" sub="power electronics loop" />
        <Block x={540} y={20} w={120} h={46} label="Radiator" sub="front-mounted" small />
        <Wire d="M190,130 H240 V65 H290" kind="hot" width={3} arrow id="cooling" />
        <Wire d="M430,65 H470 V150 H520" kind="cool" width={3} />
        <Wire d="M520,170 H470 V235 H430" kind="hot" width={3} />
        <Wire d="M290,235 H240 V170 H190" kind="cool" width={3} arrow id="cooling" />
        <Wire d="M600,110 V66" kind="hot" width={3} />
        <Label x={250} y={150} size={10}>multi-way valve</Label>
        <Label x={360} y={140} anchor="middle" size={10}>pumps & valves are module-controlled</Label>
      </Diagram>
    );
  }
  const notes = [
    'Pressure-test the system cold; check the cap separately. Bleed air at the bleeder(s) or with a vacuum filler.',
    p.year && p.year >= 2010 ? 'Many late-model engines use electric water pumps, active grille shutters or electronically controlled thermostats.' : 'A stuck-open thermostat causes slow warm-up and poor heater output; stuck closed causes overheating.',
  ];
  if (p.turbo) notes.push('Turbocharger is coolant- and oil-cooled; check its lines when chasing coolant loss.');
  if (hybrid) notes.push('Hybrids have a separate inverter/motor coolant loop with its own electric pump and reservoir.');
  if (p.fuelKind === 'diesel') notes.push('Diesels add an EGR cooler and often a fuel cooler in the coolant circuit — an EGR cooler leak can cause white smoke and coolant loss.');
  return (
    <Diagram id="cooling" title="Cooling system" subtitle={hybrid ? 'Engine loop + separate inverter loop' : 'Engine coolant flow'} viewBox="0 0 720 320" legend={['hot', 'cool']} notes={notes}>
      <Block x={250} y={120} w={170} h={90} label="Engine" sub="block & heads" />
      <Block x={40} y={110} w={110} h={110} label="Radiator" sub="+ fan(s)" />
      <Block x={270} y={40} w={130} h={40} label="Thermostat" small />
      <Block x={270} y={250} w={130} h={40} label="Water pump" sub={p.year && p.year >= 2010 ? 'mech. or electric' : 'belt / timing driven'} small />
      <Block x={520} y={120} w={130} h={50} label="Heater core" small />
      <Block x={140} y={86} w={100} h={38} label="Reservoir" sub="degas / overflow" small />
      <Wire d="M335,120 V80" kind="hot" width={3} />
      <Wire d="M270,60 H95 V110" kind="hot" width={3} arrow id="cooling" />
      <Wire d="M95,220 V270 H270" kind="cool" width={3} arrow id="cooling" />
      <Wire d="M335,250 V210" kind="cool" width={3} />
      <Wire d="M420,140 H520" kind="hot" width={2} />
      <Wire d="M585,170 V270 H400" kind="cool" width={2} />
      <Wire d="M190,86 V60" kind="cool" dashed />
      {p.turbo && <Block x={520} y={40} w={130} h={40} label="Turbo coolant lines" small />}
      {p.turbo && <Wire d="M420,150 H470 V60 H520" kind="hot" width={1.5} dashed />}
      {hybrid && <Block x={500} y={200} w={180} h={44} label="Inverter loop" sub="electric pump · own radiator" tone="hv" small />}
    </Diagram>
  );
}

/** Brake hydraulics: split type, ABS/ESC, and booster type by configuration. */
export function BrakeDiagram({ profile: p }) {
  const air = /air/i.test(p.values.brake || '') || (p.heavyDuty && /air/i.test(p.values.brake || ''));
  if (air) {
    return (
      <Diagram id="brakes" title="Air brake system" subtitle={p.values.brake} viewBox="0 0 720 220" legend={['fluid', 'fluid2']} notes={['Air brakes: verify governor cut-out/cut-in, leak-down and low-pressure warning per the manufacturer’s and FMCSA procedures.', 'Spring brakes apply when air pressure is lost — chock wheels and cage chambers before service.']}>
        <Block x={30} y={80} w={120} h={56} label="Compressor" sub="governor · dryer" small />
        <Block x={220} y={40} w={120} h={46} label="Primary tank" small />
        <Block x={220} y={130} w={120} h={46} label="Secondary tank" small />
        <Block x={420} y={80} w={110} h={56} label="Foot valve" small />
        <Block x={600} y={40} w={100} h={46} label="Rear chambers" small />
        <Block x={600} y={130} w={100} h={46} label="Front chambers" small />
        <Wire d="M150,108 H190 V63 H220 M190,108 V153 H220" kind="fluid" width={3} />
        <Wire d="M340,63 H380 V100 H420" kind="fluid" width={3} />
        <Wire d="M340,153 H380 V116 H420" kind="fluid2" width={3} />
        <Wire d="M530,100 H565 V63 H600" kind="fluid" width={3} />
        <Wire d="M530,116 H565 V153 H600" kind="fluid2" width={3} />
      </Diagram>
    );
  }
  // Diagonal split is typical of front-drive cars; front/rear split of RWD cars and trucks.
  const diagonal = p.drive === 'fwd' || (p.drive === 'awd' && !['pickup', 'chassis', 'heavy', 'van'].includes(p.body) && !/subaru/i.test(p.make));
  const abs = (p.year || 2000) >= 2000 ? 'likely' : (p.year || 2000) >= 1990 ? 'possible' : 'unlikely';
  const booster = !p.ice || p.electrified ? 'Electric / integrated brake booster (regenerative blending)' : p.fuelKind === 'diesel' && ['pickup', 'chassis', 'heavy', 'van'].includes(p.body) ? 'Hydraulic booster (hydro-boost) typical' : 'Vacuum booster typical';
  const W = { lf: [470, 40], rf: [470, 230], lr: [640, 40], rr: [640, 230] };
  const circuitA = diagonal ? ['lf', 'rr'] : ['lf', 'rf'];
  const color = (k) => (circuitA.includes(k) ? 'fluid' : 'fluid2');
  const route = {
    lf: 'M340,120 H440 V62 H470',
    rf: diagonal ? 'M340,170 H420 V252 H470' : 'M340,128 H430 V252 H470',
    lr: diagonal ? 'M340,162 H560 V62 H640' : 'M340,170 H560 V62 H640',
    rr: diagonal ? 'M340,128 H600 V252 H640' : 'M340,176 H600 V252 H640',
  };
  return (
    <Diagram
      id="brakes"
      title="Brake hydraulics"
      subtitle={`${diagonal ? 'Diagonal split' : 'Front / rear split'} (typical for this layout) · ${p.values.brake || 'hydraulic'}`}
      viewBox="0 0 720 300"
      legend={['fluid', 'fluid2']}
      notes={[
        booster + '.',
        abs === 'likely' ? 'ABS/ESC hydraulic unit sits between the master cylinder and the wheels; ESC is required on 2012+ U.S. light vehicles. Bleeding may need a scan-tool automated bleed.' : abs === 'possible' ? 'ABS was optional on many vehicles of this era — check for a hydraulic modulator.' : 'Pre-ABS era: look for a proportioning / combination valve.',
        p.era.electronicParkingBrake === 'possible' ? 'If equipped with an electronic parking brake, retract the rear calipers with a scan tool before pad service.' : 'Mechanical parking brake: adjust after rear service.',
      ]}
    >
      <Block x={30} y={110} w={130} h={70} label="Master cylinder" sub="+ reservoir" />
      <Block x={30} y={30} w={130} h={50} label="Booster" sub={!p.ice || p.electrified ? 'electric' : p.fuelKind === 'diesel' && ['pickup', 'chassis', 'heavy', 'van'].includes(p.body) ? 'hydro-boost' : 'vacuum'} small />
      <Wire d="M95,80 V110" kind="mech" width={4} />
      <Block x={220} y={100} w={120} h={90} label={abs === 'unlikely' ? 'Combination valve' : 'ABS / ESC unit'} sub={abs === 'unlikely' ? 'proportioning' : 'pump · valves · module'} />
      <Wire d="M160,130 H220" kind="fluid" width={3} />
      <Wire d="M160,160 H220" kind="fluid2" width={3} />
      {Object.entries(route).map(([k, d]) => (
        <Wire key={k} d={d} kind={color(k)} width={2.5} />
      ))}
      {Object.entries(W).map(([k, [x, y]]) => (
        <g key={k}>
          <rect x={x} y={y} width={44} height={44} rx={22} fill="rgb(var(--surface))" stroke="rgb(var(--ink-3))" strokeWidth="1.3" />
          <text x={x + 22} y={y + 22} dy="0.35em" textAnchor="middle" className="fill-ink" style={{ fontSize: 11, fontWeight: 600 }}>
            {k.toUpperCase()}
          </text>
        </g>
      ))}
      <Label x={492} y={110} anchor="middle" size={10}>front</Label>
      <Label x={662} y={110} anchor="middle" size={10}>rear</Label>
      {abs !== 'unlikely' && <Label x={280} y={210} anchor="middle" size={10}>wheel-speed sensor at each corner</Label>}
    </Diagram>
  );
}

const DLC_PINS = {
  2: 'J1850 bus +',
  4: 'Chassis ground',
  5: 'Signal ground',
  6: 'CAN high',
  7: 'K-line (ISO 9141 / 14230)',
  10: 'J1850 bus − (PWM)',
  14: 'CAN low',
  15: 'L-line (ISO 9141)',
  16: 'Battery +12 V',
};

/** OBD-II data link connector (J1962) with the pins this vehicle's era/make is likely to use. */
export function DlcDiagram({ profile: p }) {
  if (!p.era.obd2) return null;
  const make = p.make || '';
  const used = new Set([4, 5, 16]);
  if (p.era.canLikely) [6, 14].forEach((n) => used.add(n));
  if (!p.era.canRequired) {
    if (/chevrolet|gmc|buick|cadillac|pontiac|oldsmobile|saturn|hummer|chrysler|dodge|jeep|plymouth/i.test(make)) used.add(2);
    else if (/ford|lincoln|mercury/i.test(make)) [2, 10].forEach((n) => used.add(n));
    else [7, 15].forEach((n) => used.add(n));
  }
  const pin = (n) => {
    const top = n <= 8;
    const i = top ? n - 1 : n - 9;
    return [132 + i * 44, top ? 70 : 118];
  };
  return (
    <Diagram
      id="dlc"
      title="Diagnostic connector (OBD-II)"
      subtitle="SAE J1962, 16-pin · usually under the dash, driver side"
      viewBox="0 0 720 260"
      notes={[
        'Pin 16 should read battery voltage and pins 4/5 ground with the key off — no power at 16 is the classic “scan tool won’t power up” fault (check the DLC/cigar fuse).',
        p.heavyDuty ? 'Medium/heavy-duty diesel chassis often use a 9-pin Deutsch J1939 connector instead of (or alongside) the 16-pin DLC.' : 'Highlighted pins are the ones this era and manufacturer typically populate; unused positions may carry OEM-specific circuits.',
      ]}
      caveat="Pin functions are defined by SAE J1962; which pins are populated varies by vehicle."
    >
      <path d="M100,40 H500 L470,150 H130 Z" fill="rgb(var(--fill) / 0.06)" stroke="rgb(var(--ink-3))" strokeWidth="1.4" strokeLinejoin="round" />
      {Array.from({ length: 16 }, (_, k) => {
        const n = k + 1;
        const [x, y] = pin(n);
        const on = used.has(n);
        return (
          <g key={n}>
            <rect x={x - 13} y={y - 15} width={26} height={30} rx={5} fill={on ? 'rgb(var(--accent) / 0.12)' : 'rgb(var(--surface))'} stroke={on ? 'rgb(var(--accent))' : 'rgb(var(--ink-4))'} strokeWidth="1.3" />
            <text x={x} y={y} dy="0.35em" textAnchor="middle" className={on ? 'fill-ink' : 'fill-ink-3'} style={{ fontSize: 12, fontWeight: on ? 700 : 500 }}>
              {n}
            </text>
          </g>
        );
      })}
      {[...used]
        .sort((a, b) => a - b)
        .map((n, i) => (
          <text key={n} x={540} y={52 + i * 22} className="fill-ink-2" style={{ fontSize: 11.5 }}>
            <tspan style={{ fontWeight: 700 }} className="fill-ink">{n}</tspan> · {DLC_PINS[n]}
          </text>
        ))}
      <Label x={300} y={186} anchor="middle" size={10}>face of the vehicle connector</Label>
    </Diagram>
  );
}
