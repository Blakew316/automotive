import { Diagram, Block, Label } from './Svg';
import { WIRE } from './tokens';
import { DRIVE_LABEL } from '../../lib/profile';

// Top view, front of the vehicle at the top.
const WHEELS = { lf: [196, 52], rf: [500, 52], lr: [196, 262], rr: [500, 262] };
const shaft = (d, w = 5) => <path d={d} stroke={WIRE.mech} strokeWidth={w} strokeLinecap="round" fill="none" />;

export default function DrivetrainDiagram({ profile: p }) {
  const driven = {
    fwd: ['lf', 'rf'],
    rwd: ['lr', 'rr'],
    awd: ['lf', 'rf', 'lr', 'rr'],
    '4wd': ['lf', 'rf', 'lr', 'rr'],
  }[p.drive] || [];
  const ev = p.powertrain === 'ev' || p.powertrain === 'fcev';
  const hybrid = ['hybrid', 'phev'].includes(p.powertrain);
  const longitudinal = p.drive === 'rwd' || p.drive === '4wd' || /subaru|audi/i.test(p.make) && p.drive === 'awd';

  let parts = null;
  if (ev) {
    const front = driven.includes('lf');
    const rear = driven.includes('lr');
    parts = (
      <>
        <Block x={276} y={128} w={168} h={90} label="HV battery" sub="under floor" tone="hv" />
        {front && <Block x={300} y={50} w={120} h={44} label="Front motor" sub="+ gearbox" small />}
        {rear && <Block x={300} y={256} w={120} h={44} label="Rear motor" sub="+ gearbox" small />}
        {front && shaft('M224,72 H300 M420,72 H496')}
        {rear && shaft('M224,278 H300 M420,278 H496')}
      </>
    );
  } else if (p.drive === 'fwd' || (p.drive === 'awd' && !longitudinal)) {
    parts = (
      <>
        <Block x={258} y={42} w={120} h={60} label={p.cylinders ? `Engine ${p.layout || ''}${p.cylinders}` : 'Engine'} sub="transverse" small />
        <Block x={378} y={48} w={84} h={48} label={p.cvt ? 'CVT' : p.automatic === false ? 'Manual' : 'Transaxle'} small />
        {shaft('M224,72 H258 M462,72 H496')}
        {hybrid && <Block x={262} y={140} w={196} h={44} label="HV battery" sub="typically under rear seat / cargo floor" tone="hv" small />}
        {p.drive === 'awd' && (
          <>
            <Block x={396} y={108} w={52} h={30} label="PTU" small />
            {shaft('M422,138 V244', 4)}
            <Block x={396} y={244} w={52} h={34} label="RDU" small />
            {shaft('M224,272 H396 M448,272 H496')}
          </>
        )}
      </>
    );
  } else {
    // Longitudinal: RWD, 4WD or longitudinal AWD.
    const fourwd = p.drive === '4wd';
    const awd = p.drive === 'awd';
    parts = (
      <>
        {(fourwd || awd) && (
          <>
            {shaft('M224,72 H496')}
            {shaft('M318,168 C272,168 272,130 272,92', 4)}
          </>
        )}
        {shaft(`M360,${fourwd || awd ? 186 : 144} V246`)}
        {shaft('M224,272 H332 M388,272 H496')}
        <Block x={300} y={34} w={120} h={58} label={p.cylinders ? `Engine ${p.layout || ''}${p.cylinders}` : 'Engine'} sub="longitudinal" small />
        <Block x={318} y={98} w={84} h={46} label={p.automatic === false ? 'Manual' : 'Transmission'} small />
        {(fourwd || awd) && <Block x={318} y={150} w={84} h={36} label={fourwd ? 'Transfer case' : 'Center diff'} small />}
        <Block x={332} y={246} w={56} h={44} label="Rear diff" small />
        {(fourwd || awd) && <Block x={250} y={52} w={44} h={40} label="Front" sub="diff" small />}
        {hybrid && <Block x={430} y={150} w={110} h={40} label="HV battery" tone="hv" small />}
      </>
    );
  }

  const notes = [];
  if (!p.driveKnown) notes.push(p.values.drive ? `NHTSA lists this as “${p.values.drive}” (two-wheel drive). Front- vs. rear-drive was inferred from the body and model line — switch it above if needed.` : 'Drive type not in the NHTSA record — inferred; switch it above if needed.');
  if (p.drive === 'awd' && !longitudinal) notes.push('Transverse-engine AWD: a power transfer unit (PTU) at the transaxle drives a rear drive unit (RDU) with an electronically controlled coupling.');
  if (p.drive === '4wd') notes.push('Part-time systems lock front and rear together in 4HI/4LO — avoid 4WD on dry pavement. Full-time systems have a center differential.');
  if (p.heavyDuty) notes.push('Medium/heavy-duty chassis: axle ratings and configurations vary — check the chassis data plate.');

  return (
    <Diagram
      id="drivetrain"
      title="Drivetrain layout"
      subtitle={`${DRIVE_LABEL[p.drive] || 'Drive unknown'}${p.transmission ? ` · ${p.transmission}` : ''}`}
      viewBox="0 0 720 330"
      legend={ev || hybrid ? ['mech', 'hv'] : ['mech']}
      notes={notes}
      caveat="Top view, front at the top. Driven wheels are shaded. Layout is representative of this drivetrain type."
    >
      <rect x={210} y={20} width={300} height={290} rx={46} fill="none" stroke="rgb(var(--ink-4))" strokeWidth="1.3" />
      <Label x={360} y={14} anchor="middle" size={10}>front</Label>
      {Object.entries(WHEELS).map(([k, [x, y]]) => (
        <rect key={k} x={x} y={y} width={24} height={42} rx={6} fill={driven.includes(k) ? 'rgb(var(--ink-2))' : 'rgb(var(--surface))'} stroke="rgb(var(--ink-3))" strokeWidth="1.3" />
      ))}
      {parts}
    </Diagram>
  );
}
