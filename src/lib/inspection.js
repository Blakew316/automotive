// Digital vehicle inspection templates and measurement-based ratings.
import { DEFAULT_INSPECTION_TEMPLATE } from '../store/defaults';

export function inspectionTemplateFor(state, order) {
  const list = state.inspectionTemplates?.length ? state.inspectionTemplates : [DEFAULT_INSPECTION_TEMPLATE];
  return list.find((t) => t.id === order?.inspectionTemplateId) || list.find((t) => t.id === state.shop?.defaultInspectionTemplate) || list[0];
}

export const inspectionPoints = (template) => template.sections.flatMap((s) => s.items.map((label) => ({ key: `${s.section}::${label}`, section: s.section, label })));

/** Items labelled "(mm)" or "(32nds)" take a measurement. */
export function measurementKind(label) {
  if (/\(mm\)/i.test(label)) return 'mm';
  if (/\(32nds\)/i.test(label)) return '32nds';
  return null;
}

/** Brake friction in mm and tread depth in 32nds of an inch, using common replacement guidance. */
export function ratingForMeasurement(kind, value) {
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return null;
  if (kind === 'mm') return v >= 5 ? 'good' : v >= 3 ? 'soon' : 'now';
  if (kind === '32nds') return v >= 6 ? 'good' : v >= 3 ? 'soon' : 'now';
  return null;
}
