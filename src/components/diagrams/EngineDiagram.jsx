import { Diagram, Label, Block } from './Svg';
import { WIRE } from './tokens';

const CYL = 30;

function Cylinder({ x, y, n, emphasis }) {
  return (
    <g>
      <circle cx={x} cy={y} r={CYL / 2} fill={emphasis ? 'rgb(var(--accent) / 0.12)' : 'rgb(var(--surface))'} stroke={emphasis ? 'rgb(var(--accent))' : 'rgb(var(--ink-3))'} strokeWidth="1.4" />
      {n != null && (
        <text x={x} y={y} dy="0.35em" textAnchor="middle" className="fill-ink" style={{ fontSize: 13, fontWeight: 700 }}>
          {n}
        </text>
      )}
    </g>
  );
}

export default function EngineDiagram({ profile: p }) {
  if (!p.ice) return <MotorLayout p={p} />;
  const n = p.cylinders;
  const title = 'Engine layout, cylinder numbering & firing order';
  if (!n) {
    return (
      <Diagram id="engine" title={title} subtitle="Cylinder count not in the NHTSA record for this configuration" viewBox="0 0 720 120">
        <Label x={360} y={64} anchor="middle" muted={false} size={13}>Select an engine above, or decode a VIN, to draw the cylinder layout.</Label>
      </Diagram>
    );
  }
  const W = 720;
  const notes = [];
  if (p.firingOrder) notes.push(`Firing order ${p.firingOrder}${p.firingOrderSource === 'family' ? ` — ${p.engineFamily.name}` : ` — standard for ${p.layout}${n} engines`}.`);
  else notes.push('Firing order: confirm in OEM service information for this engine family.');
  notes.push('OBD-II “Bank 1” is always the bank that contains cylinder 1; Sensor 1 is upstream of the catalyst, Sensor 2 downstream.');
  if (p.sizeSource === 'code') notes.push(`Cylinder count${p.displacement ? ' and displacement' : ''} derived from the engine model code ${p.engineCode} — not stated in the VIN data.`);
  if (p.sizeSource === 'make') notes.push(`The VIN data gives only the displacement; every ${p.displacement?.toFixed(1)} L engine ${p.make} has filed with NHTSA is a ${p.layout || ''}${p.cylinders}, so that layout is shown — verify on the vehicle.`);

  let body;
  let h;
  if (p.layout === 'I' || p.layout === 'R' || !p.layout) {
    // Inline: cylinder 1 is at the front (timing/accessory-drive end).
    h = 210;
    const gap = Math.min(70, 520 / n);
    const x0 = W / 2 - ((n - 1) * gap) / 2;
    body = (
      <>
        <rect x={x0 - 40} y={56} width={(n - 1) * gap + 80} height={70} rx={14} fill="rgb(var(--fill) / 0.06)" stroke="rgb(var(--ink-3))" strokeWidth="1.3" />
        {Array.from({ length: n }, (_, i) => (
          <Cylinder key={i} x={x0 + i * gap} y={91} n={p.layout === 'I' ? i + 1 : null} emphasis={i === 0} />
        ))}
        <Label x={x0 - 52} y={95} anchor="end" muted={false} weight={600}>Front</Label>
        <Label x={x0 - 52} y={110} anchor="end" size={10}>timing / belts</Label>
        <Label x={x0 + (n - 1) * gap + 52} y={95} muted={false} weight={600}>Rear</Label>
        <Label x={x0 + (n - 1) * gap + 52} y={110} size={10}>flywheel / trans</Label>
        <path d={`M${x0 - 20},150 H${x0 + (n - 1) * gap + 20}`} stroke={WIRE.hot} strokeWidth="6" strokeLinecap="round" opacity="0.7" />
        <Label x={W / 2} y={172} anchor="middle" size={11}>Exhaust · Bank 1 · B1S1 upstream, B1S2 downstream</Label>
        {!p.layout && <Label x={W / 2} y={40} anchor="middle">Cylinder arrangement not recorded — numbering shown is illustrative only</Label>}
      </>
    );
  } else {
    // Two banks (V, W or horizontally opposed), front at the top, viewed from the flywheel end.
    const per = Math.ceil(n / 2);
    h = 130 + per * 52;
    const left = p.banks?.left;
    const right = p.banks?.right;
    const lx = 260;
    const rx = 460;
    const rows = Array.from({ length: per }, (_, i) => 92 + i * 52);
    const opposed = p.layout === 'H';
    body = (
      <>
        <Label x={W / 2} y={28} anchor="middle" muted={false} weight={600}>Front · timing / accessory drive</Label>
        <rect x={lx - 40} y={60} width={rx - lx + 80} height={per * 52 + 10} rx={16} fill="rgb(var(--fill) / 0.06)" stroke="rgb(var(--ink-3))" strokeWidth="1.3" />
        <line x1={W / 2} y1={66} x2={W / 2} y2={60 + per * 52} stroke="rgb(var(--ink-4))" strokeDasharray="4 4" />
        <Label x={W / 2} y={60 + per * 52 + 28} anchor="middle" size={10}>{opposed ? 'crankshaft (horizontally opposed)' : 'crankshaft / valley'}</Label>
        <Label x={lx - 70} y={rows[rows.length - 1] + 30} anchor="middle" size={10}>exhaust</Label>
        <Label x={rx + 70} y={rows[rows.length - 1] + 30} anchor="middle" size={10}>exhaust</Label>
        {rows.map((y, i) => (
          <g key={i}>
            <Cylinder x={lx} y={y} n={left ? left[i] : null} emphasis={left ? left[i] === 1 : false} />
            {i < n - per ? <Cylinder x={rx} y={y} n={right ? right[i] : null} emphasis={right ? right[i] === 1 : false} /> : null}
          </g>
        ))}
        <path d={`M${lx - 70},${rows[0] - 10} V${rows[rows.length - 1] + 10}`} stroke={WIRE.hot} strokeWidth="6" strokeLinecap="round" opacity="0.7" />
        <path d={`M${rx + 70},${rows[0] - 10} V${rows[rows.length - 1] + 10}`} stroke={WIRE.hot} strokeWidth="6" strokeLinecap="round" opacity="0.7" />
        <Label x={lx - 70} y={rows[0] - 40} anchor="middle" muted={false} weight={600}>Left bank</Label>
        <Label x={rx + 70} y={rows[0] - 40} anchor="middle" muted={false} weight={600}>Right bank</Label>
        <Label x={lx - 70} y={rows[0] - 26} anchor="middle" size={10}>{left ? (left.includes(1) ? 'Bank 1' : 'Bank 2') : 'Bank 1 or 2'}</Label>
        <Label x={rx + 70} y={rows[0] - 26} anchor="middle" size={10}>{right ? (right.includes(1) ? 'Bank 1' : 'Bank 2') : 'Bank 1 or 2'}</Label>
        {!left && <Label x={W / 2} y={h - 8} anchor="middle" size={10}>Cylinder numbering for this engine family is not in the verified table — see OEM data. Left/right as viewed from the flywheel end.</Label>}
      </>
    );
  }

  const sub = [
    p.displacement ? `${p.displacement.toFixed(1)} L` : null,
    p.layout ? `${{ I: 'Inline', V: 'V', H: 'Horizontally opposed', W: 'W', R: 'Rotary' }[p.layout]}${p.layout === 'R' ? '' : `-${n}`}${p.layoutKnown ? '' : ' (inferred)'}` : `${n} cylinders`,
    p.engineCode,
    p.turbo ? 'turbocharged' : p.supercharged ? 'supercharged' : null,
    p.fuelKind === 'diesel' ? 'diesel' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Diagram id="engine" title={title} subtitle={sub} viewBox={`0 0 ${W} ${h}`} notes={notes} caveat="Cylinder numbering is shown only where it is documented for the engine family or universal for the layout. Highlighted = cylinder 1.">
      {body}
    </Diagram>
  );
}

function MotorLayout({ p }) {
  const front = p.drive === 'fwd' || p.drive === 'awd' || p.drive === '4wd' || p.motors >= 2;
  const rear = p.drive === 'rwd' || p.drive === 'awd' || p.drive === '4wd' || p.motors >= 2 || !front;
  return (
    <Diagram id="engine" title="Electric drive layout" subtitle={[p.values.evdu, p.battery.kwh ? `${p.battery.kwh} kWh` : null, p.battery.type].filter(Boolean).join(' · ') || 'Battery-electric'} viewBox="0 0 720 300" legend={['hv']}>
      <rect x={210} y={30} width={300} height={240} rx={40} fill="none" stroke="rgb(var(--ink-4))" strokeWidth="1.3" />
      <Label x={360} y={22} anchor="middle" size={10}>front</Label>
      <Block x={250} y={110} w={220} h={80} label="HV battery pack" sub="floor-mounted, liquid-cooled" tone="hv" />
      {front && <Block x={295} y={44} w={130} h={40} label="Front drive unit" sub="motor · inverter · gearbox" small />}
      {rear && <Block x={295} y={216} w={130} h={40} label="Rear drive unit" sub="motor · inverter · gearbox" small />}
      {front && <path d="M360,84 V110" stroke={WIRE.hv} strokeWidth="3" />}
      {rear && <path d="M360,190 V216" stroke={WIRE.hv} strokeWidth="3" />}
      {[[200, 50], [496, 50], [200, 214], [496, 214]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={24} height={40} rx={6} fill={(i < 2 && front) || (i >= 2 && rear) ? 'rgb(var(--ink-2))' : 'rgb(var(--surface))'} stroke="rgb(var(--ink-3))" />
      ))}
      <Label x={560} y={150} size={11}>Driven wheels shaded</Label>
    </Diagram>
  );
}
