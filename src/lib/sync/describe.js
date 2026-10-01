// Plain-language summaries of what changed between two versions of a record, for the change history.
import { STATUS } from '../workflow';
import { money } from '../format';
import { same } from './merge';

const LABELS = {
  concern: 'Customer concern',
  promisedAt: 'Promised time',
  techId: 'Technician',
  advisor: 'Advisor',
  mileageIn: 'Mileage in',
  mileageOut: 'Mileage out',
  discount: 'Discount',
  inspection: 'Inspection',
  media: 'Photos & video',
  share: 'Customer link',
  taxExempt: 'Tax exempt',
  firstName: 'First name',
  lastName: 'Last name',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  notes: 'Notes',
  tags: 'Tags',
  vin: 'VIN',
  plate: 'Plate',
  mileage: 'Mileage',
  color: 'Color',
  qty: 'Quantity on hand',
  price: 'Price',
  cost: 'Cost',
  start: 'Time',
  duration: 'Length',
  status: 'Status',
};
const IGNORE = new Set(['updatedAt', 'id']);
const titleOf = (x) => x?.title || x?.description || x?.text || x?.name || 'item';

function listChanges(label, a = [], b = []) {
  const out = [];
  const before = new Map(a.map((x) => [x.id, x]));
  const after = new Map(b.map((x) => [x.id, x]));
  for (const [id, x] of after) if (!before.has(id)) out.push(`${label}: added ${titleOf(x)}`);
  for (const [id, x] of before) if (!after.has(id)) out.push(`${label}: removed ${titleOf(x)}`);
  return out;
}

/** Repair orders get a detailed summary; everything else lists the fields that changed. */
export function describeChange(collection, prev, next) {
  if (!prev && next) return ['Created'];
  if (prev && !next) return ['Deleted'];
  if (!prev || !next) return [];
  const out = [];
  if (collection === 'orders') {
    if (prev.status !== next.status) out.push(`Status: ${STATUS[prev.status]?.label || prev.status} → ${STATUS[next.status]?.label || next.status}`);
    out.push(...listChanges('Service', prev.services, next.services));
    const pb = new Map((prev.services || []).map((x) => [x.id, x]));
    for (const svc of next.services || []) {
      const was = pb.get(svc.id);
      if (!was) continue;
      if (was.status !== svc.status) out.push(`${svc.title}: ${was.status} → ${svc.status}`);
      if (was.done !== svc.done) out.push(`${svc.title}: ${svc.done ? 'marked done' : 'reopened'}`);
      if (!same(was.items, svc.items)) out.push(`${svc.title}: parts & labor edited`);
    }
    for (const p of (next.payments || []).filter((p) => !(prev.payments || []).some((q) => q.id === p.id))) out.push(`Payment recorded: ${money(p.amount)}${p.method ? ` (${p.method})` : ''}`);
    if ((next.authorizations || []).length > (prev.authorizations || []).length) out.push('Customer authorization recorded');
    if ((next.notes || []).length !== (prev.notes || []).length) out.push(`Notes: ${(next.notes || []).length - (prev.notes || []).length > 0 ? 'added' : 'removed'}`);
    if ((next.media || []).length !== (prev.media || []).length) out.push(`Photos & video: ${(next.media || []).length} (was ${(prev.media || []).length})`);
    for (const k of ['concern', 'promisedAt', 'techId', 'advisor', 'mileageIn', 'mileageOut', 'discount', 'taxExempt', 'inspection', 'share']) {
      if (!same(prev[k], next[k])) out.push(`${LABELS[k]} changed`);
    }
    return out.length ? out : ['Minor edit'];
  }
  for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (IGNORE.has(k) || same(prev[k], next[k])) continue;
    out.push(`${LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} changed`);
  }
  return out.length ? out : ['Minor edit'];
}
