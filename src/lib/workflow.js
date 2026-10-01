// Repair-order lifecycle. An RO starts as an estimate and becomes the invoice once work is done.
export const STATUSES = [
  { id: 'estimate', label: 'Estimate', short: 'Estimate', dot: 'bg-slate', tone: 'slate', hint: 'Waiting on customer approval' },
  { id: 'approved', label: 'Approved', short: 'Approved', dot: 'bg-sky', tone: 'sky', hint: 'Authorized — ready to dispatch' },
  { id: 'in_progress', label: 'In Progress', short: 'In progress', dot: 'bg-accent', tone: 'accent', hint: 'Tech is working on it' },
  { id: 'waiting_parts', label: 'Waiting on Parts', short: 'Parts', dot: 'bg-warn', tone: 'warn', hint: 'Blocked on parts delivery' },
  { id: 'ready', label: 'Ready for Pickup', short: 'Ready', dot: 'bg-ok', tone: 'ok', hint: 'Invoiced — awaiting payment/pickup' },
  { id: 'closed', label: 'Closed', short: 'Closed', dot: 'bg-ink-4', tone: 'ink-4', hint: 'Paid and picked up' },
];

export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
export const OPEN_STATUSES = ['estimate', 'approved', 'in_progress', 'waiting_parts', 'ready'];
export const WIP_STATUSES = ['approved', 'in_progress', 'waiting_parts'];
export const isInvoiced = (o) => o.status === 'ready' || o.status === 'closed';

export const INSPECTION_RATINGS = {
  good: { label: 'Good', dot: 'bg-ok' },
  soon: { label: 'Needs attention soon', short: 'Soon', dot: 'bg-warn' },
  now: { label: 'Needs immediate attention', short: 'Urgent', dot: 'bg-bad' },
  na: { label: 'Not inspected', short: 'N/A', dot: 'bg-ink-4' },
};

export const INSPECTION_TEMPLATE = [
  { section: 'Under hood', items: ['Engine oil level & condition', 'Coolant level & condition', 'Brake fluid', 'Power steering fluid', 'Drive belts', 'Radiator & heater hoses', 'Battery & terminals (test)', 'Engine air filter', 'Cabin air filter'] },
  { section: 'Brakes', items: ['Front pads (mm)', 'Rear pads/shoes (mm)', 'Front rotors', 'Rear rotors/drums', 'Brake lines & hoses', 'Parking brake'] },
  { section: 'Tires & wheels', items: ['LF tread (32nds)', 'RF tread (32nds)', 'LR tread (32nds)', 'RR tread (32nds)', 'Tire pressure / TPMS', 'Alignment wear pattern'] },
  { section: 'Steering & suspension', items: ['Shocks / struts', 'Ball joints', 'Tie rod ends', 'Control arm bushings', 'Sway bar links', 'CV axles & boots'] },
  { section: 'Exterior & safety', items: ['Headlights / taillights', 'Turn signals & hazards', 'Wiper blades', 'Windshield', 'Horn'] },
  { section: 'Underbody', items: ['Engine oil leaks', 'Transmission leaks', 'Exhaust system', 'Differential / transfer case', 'Fuel lines'] },
];

export const PAYMENT_METHODS = ['Card', 'Cash', 'Check', 'ACH', 'Financing', 'Warranty', 'Fleet account'];
