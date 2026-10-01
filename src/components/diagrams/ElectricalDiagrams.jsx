import { Diagram, Block, Wire, Label, Node, GroundSymbol, Fuse } from './Svg';

/** Starting & charging circuits (12 V). */
export function StartingChargingDiagram({ profile: p }) {
  const fullHybrid = p.powertrain === 'hybrid' || p.powertrain === 'phev';
  const ev = !p.ice;
  if (ev || fullHybrid) {
    return (
      <Diagram
        id="charging"
        title="12-volt supply"
        subtitle={ev ? 'Battery-electric: no starter or alternator' : 'Full hybrid: engine is started by the motor-generator'}
        viewBox="0 0 720 260"
        legend={['power', 'ground', 'hv', 'signal']}
        notes={[
          'The 12 V battery is charged by the DC-DC converter whenever the vehicle is in READY.',
          'A weak 12 V battery is the most common cause of a “no READY” condition — test it first.',
          fullHybrid ? 'Many hybrids locate the 12 V battery in the trunk or under the rear seat, with a remote jump-start terminal under the hood.' : 'Many EVs have a remote 12 V jump terminal in the front trunk or behind the front fascia.',
        ]}
      >
        <Block x={40} y={92} w={150} h={70} label="HV battery" sub="contactors · service plug" tone="hv" />
        <Block x={270} y={92} w={150} h={70} label="DC-DC converter" sub="HV → ~14 V" tone="hv" />
        <Block x={500} y={92} w={150} h={70} label="12 V battery" sub="AGM typical" />
        <Wire d="M190,127 H270" kind="hv" width={4} />
        <Wire d="M420,118 H500" kind="power" />
        <Fuse x={460} y={118} label="main" />
        <Wire d="M575,92 V50 H640" kind="power" />
        <Label x={646} y={54}>12 V loads (fuse box)</Label>
        <Wire d="M420,140 H470 V200" kind="ground" />
        <GroundSymbol x={470} y={200} />
        <Wire d="M575,162 V200" kind="ground" />
        <GroundSymbol x={575} y={200} />
        <Wire d="M345,92 V50 H230" kind="signal" dashed />
        <Label x={150} y={46}>Hybrid / EV control ECU</Label>
      </Diagram>
    );
  }
  const notes = [
    'Voltage-drop each cable under load: typically under ~0.5 V on the cranking positive side and under ~0.2 V on grounds.',
    p.era.smartCharging ? 'Charging is likely PCM-controlled (“smart charging”) — commanded voltage can legitimately vary between roughly 12.5 and 15 V.' : 'Alternator output is set by its internal voltage regulator (typically 13.5–14.8 V).',
  ];
  if (p.era.startStop === 'possible') notes.push('If equipped with start-stop: enhanced starter, AGM/EFB battery and a battery current sensor on the negative terminal.');
  return (
    <Diagram id="charging" title="Starting & charging circuits" subtitle="12 V battery, starter control and alternator" viewBox="0 0 720 360" legend={['power', 'ground', 'signal']} notes={notes}>
      <Block x={36} y={150} w={120} h={70} label="Battery" sub="12 V" />
      <Wire d="M156,170 H228" kind="power" width={3} />
      <Fuse x={200} y={170} label="mega fuse" />
      <Node x={228} y={170} kind="power" />
      {/* Starter */}
      <Wire d="M228,170 V280 H420" kind="power" width={3} />
      <Block x={420} y={250} w={150} h={64} label="Starter motor" sub="B+ · S terminal · solenoid" />
      <Block x={420} y={160} w={110} h={46} label="Starter relay" sub="PCM-controlled" small />
      <Wire d="M228,170 H300 V183 H420" kind="power" />
      <Wire d="M475,206 V250" kind="power" />
      <Label x={482} y={232} size={10}>S terminal</Label>
      <Block x={230} y={40} w={190} h={58} label="PCM / start control" sub="start request · park/neutral · brake" small />
      <Wire d="M420,62 H475 V160" kind="signal" />
      <Wire d="M190,69 H230" kind="signal" />
      <Label x={36} y={64}>Ignition switch or</Label>
      <Label x={36} y={78}>push-button + key fob</Label>
      {/* Alternator */}
      <Block x={560} y={70} w={130} h={64} label="Alternator" sub="B+ output" />
      <Wire d="M228,170 H300 V120 H540 V102 H560" kind="power" width={3} />
      <Fuse x={520} y={120} label="alt fuse" />
      <Wire d="M420,84 H560" kind="signal" dashed />
      <Label x={625} y={60} anchor="middle" size={10}>{p.era.smartCharging ? 'field control (LIN/PWM)' : 'regulator sense'}</Label>
      {/* Grounds */}
      <Wire d="M96,220 V300" kind="ground" width={3} />
      <GroundSymbol x={96} y={300} />
      <Label x={110} y={312} size={10}>engine block & body grounds</Label>
      <Wire d="M625,134 V170" kind="ground" />
      <GroundSymbol x={625} y={170} />
      <Wire d="M495,314 V328" kind="ground" />
      <GroundSymbol x={495} y={328} />
    </Diagram>
  );
}

/** Network topology by era (CAN from 2008 in the U.S.; earlier protocols by manufacturer). */
export function NetworkDiagram({ profile: p }) {
  const y = p.year || 2000;
  const make = p.make || '';
  let legacy = null;
  if (!p.era.canLikely) {
    if (!p.era.obd2) legacy = { name: 'OBD-I (pre-1996)', pins: [], note: 'Manufacturer-specific diagnostic connectors and blink codes are common before 1996.' };
    else if (/chevrolet|gmc|buick|cadillac|pontiac|oldsmobile|saturn|hummer/i.test(make)) legacy = { name: 'SAE J1850 VPW (GM Class 2)', pins: [2, 4, 5, 16] };
    else if (/ford|lincoln|mercury|mazda/i.test(make) && /ford|lincoln|mercury/i.test(make)) legacy = { name: 'SAE J1850 PWM (Ford SCP)', pins: [2, 10, 4, 5, 16] };
    else if (/chrysler|dodge|jeep|plymouth|ram/i.test(make)) legacy = { name: 'SAE J1850 VPW (Chrysler PCI)', pins: [2, 4, 5, 16] };
    else legacy = { name: 'ISO 9141-2 / ISO 14230 (KWP2000) K-line', pins: [7, 15, 4, 5, 16] };
  }
  const nodes = [
    'PCM / ECM',
    p.automatic !== false && p.ice ? 'TCM' : null,
    'ABS / ESC',
    'BCM',
    'Cluster (IPC)',
    y >= 1996 ? 'Airbag (SRS)' : null,
    p.era.electricPowerSteering !== 'unlikely' ? 'EPS' : null,
    'HVAC',
    y >= 2008 ? 'Gateway' : null,
    p.era.adas !== 'unlikely' ? 'ADAS' : null,
    p.electrified ? 'Hybrid / EV ECU' : null,
    p.electrified ? 'BMS' : null,
    !p.ice || p.powertrain === 'phev' ? 'Charger (OBC)' : null,
    p.drive === '4wd' || p.drive === 'awd' ? (p.drive === '4wd' ? 'Transfer case' : 'AWD module') : null,
  ].filter(Boolean);

  if (legacy) {
    return (
      <Diagram id="network" title="Diagnostic communication" subtitle={`Likely protocol: ${legacy.name}`} viewBox="0 0 720 150" legend={['network']} notes={[legacy.note || `OBD-II pins used: ${legacy.pins.join(', ')} (4/5 = grounds, 16 = battery).`, 'Pre-CAN vehicles use single-wire or K-line networks; many body functions are hard-wired.']}>
        <Block x={30} y={50} w={130} h={50} label="DLC (OBD-II)" sub={legacy.pins.length ? `pins ${legacy.pins.join(' · ')}` : 'connector varies'} small />
        <Wire d="M160,75 H690" kind="network" width={3} />
        {nodes.slice(0, 5).map((n, i) => (
          <g key={n}>
            <Wire d={`M${220 + i * 100},75 V60`} kind="network" />
            <Block x={180 + i * 100} y={20} w={88} h={40} label={n} small />
          </g>
        ))}
      </Diagram>
    );
  }

  const top = nodes.filter((_, i) => i % 2 === 0);
  const bottom = nodes.filter((_, i) => i % 2 === 1);
  const width = Math.max(top.length, bottom.length) * 98 + 220;
  return (
    <Diagram
      id="network"
      title="Vehicle network (CAN)"
      subtitle={p.era.canRequired ? 'High-speed CAN is required for OBD-II on 2008+ U.S. vehicles' : 'This era commonly uses CAN, sometimes alongside older protocols'}
      viewBox={`0 0 ${width} 300`}
      legend={['network', 'power', 'ground']}
      notes={[
        'DLC pin 6 = CAN-High, pin 14 = CAN-Low. With the battery disconnected, 6↔14 should read about 60 Ω (two 120 Ω terminators).',
        'Real vehicles often have several CAN buses (powertrain, chassis, body, infotainment) joined by a gateway; which modules sit on the diagnostic bus varies.',
        y >= 2018 ? 'Many 2018+ vehicles add a secure gateway that requires an authenticated scan tool for some functions.' : null,
      ].filter(Boolean)}
    >
      <Block x={20} y={124} w={120} h={52} label="DLC (OBD-II)" sub="pins 6 / 14 · 16 · 4/5" small />
      <Wire d={`M140,140 H${width - 40}`} kind="network" width={3} />
      <Wire d={`M140,160 H${width - 40}`} kind="network" width={3} dashed />
      <Label x={150} y={134} size={10}>CAN-H</Label>
      <Label x={150} y={178} size={10}>CAN-L</Label>
      <rect x={width - 46} y={134} width={18} height={32} rx={3} fill="rgb(var(--surface))" stroke="rgb(var(--ink-3))" />
      <Label x={width - 37} y={196} anchor="middle" size={10}>120 Ω</Label>
      {top.map((n, i) => (
        <g key={n}>
          <Wire d={`M${226 + i * 98},140 V96`} kind="network" />
          <Block x={182 + i * 98} y={50} w={88} h={46} label={n} small />
        </g>
      ))}
      {bottom.map((n, i) => (
        <g key={n}>
          <Wire d={`M${226 + i * 98},160 V204`} kind="network" />
          <Block x={182 + i * 98} y={204} w={88} h={46} label={n} small />
        </g>
      ))}
    </Diagram>
  );
}

/** High-voltage system (hybrid / EV). */
export function HighVoltageDiagram({ profile: p }) {
  if (!p.electrified || p.powertrain === 'mhev') return null;
  const plug = p.powertrain === 'phev' || !p.ice;
  return (
    <Diagram
      id="hv"
      title="High-voltage system"
      subtitle={[p.values.elec, p.battery.kwh ? `${p.battery.kwh} kWh` : null, p.battery.type].filter(Boolean).join(' · ')}
      viewBox="0 0 720 330"
      legend={['hv', 'power', 'network']}
      notes={[
        'Orange cables carry several hundred volts DC. Disable the system (12 V off, service plug out, wait, verify zero) before working near them.',
        'Contactors inside the pack connect it to the vehicle only when the system is READY or charging.',
      ]}
    >
      <Block x={30} y={120} w={170} h={90} label="HV battery pack" sub="cells · BMS · contactors · fuse" tone="hv" />
      <Block x={70} y={236} w={90} h={40} label="Service plug" tone="hv" small />
      <Wire d="M115,210 V236" kind="hv" width={3} />
      <Wire d="M200,165 H270" kind="hv" width={4} />
      <Block x={270} y={120} w={150} h={90} label="Junction / inverter" sub="DC ↔ AC · power control unit" tone="hv" />
      <Wire d="M420,150 H500" kind="hv" width={4} />
      <Block x={500} y={110} w={180} h={70} label={p.ice ? 'Motor-generator(s)' : 'Drive motor(s)'} sub={p.ice ? 'in transaxle' : p.values.evdu || 'drive unit'} tone="hv" />
      <Wire d="M345,210 V250" kind="hv" width={3} />
      <Block x={270} y={250} w={150} h={50} label="DC-DC converter" sub="→ 12 V system" tone="hv" small />
      <Wire d="M420,275 H500" kind="power" />
      <Block x={500} y={252} w={110} h={46} label="12 V battery" small />
      <Wire d="M345,120 V70" kind="hv" width={3} />
      <Block x={270} y={24} w={150} h={46} label="Electric A/C compressor" tone="hv" small />
      {plug && (
        <>
          <Wire d="M115,120 V70" kind="hv" width={3} />
          <Block x={40} y={24} w={150} h={46} label="On-board charger" sub="AC charge port · DC fast" tone="hv" small />
        </>
      )}
      <Wire d="M590,180 V215 H690" kind="network" dashed />
      <Label x={560} y={232} size={10}>CAN to hybrid/EV ECU & BMS</Label>
    </Diagram>
  );
}
