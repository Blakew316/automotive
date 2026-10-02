import { useState } from 'react';
import { ClipboardCheck, Plus, Trash2, Copy, Star } from 'lucide-react';
import { useShop } from '../../store/hooks';
import { Modal, Field } from '../../components/ui';
import Section from './Section';

export default function InspectionTemplates() {
  const { state, saveInspectionTemplate, deleteInspectionTemplate, updateShop } = useShop();
  const [editing, setEditing] = useState(null);
  const defaultId = state.shop.defaultInspectionTemplate || state.inspectionTemplates[0]?.id;
  return (
    <Section
      icon={ClipboardCheck}
      title="Inspection templates"
      subtitle="Checklists for digital vehicle inspections — pick one per repair order"
      actions={
        <button className="btn-plain btn-sm" onClick={() => setEditing({ name: 'New inspection', sections: [{ section: 'General', items: ['Item'] }] })}>
          <Plus size={14} /> New
        </button>
      }
      flush
    >
      <ul className="divide-y divide-line/70">
        {state.inspectionTemplates.map((t) => {
          const count = t.sections.reduce((s, x) => s + x.items.length, 0);
          return (
            <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(structuredClone(t))}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {t.name}
                  {t.id === defaultId && <span className="rounded-[4px] bg-fill/[0.1] px-1.5 text-2xs font-semibold text-ink-3">Default</span>}
                </div>
                <div className="text-xs text-ink-3">
                  {t.sections.length} sections · {count} points
                </div>
              </button>
              {t.id !== defaultId && (
                <button className="btn-ghost btn-sm" onClick={() => updateShop({ defaultInspectionTemplate: t.id })}>
                  <Star size={13} /> Make default
                </button>
              )}
              <button className="btn-ghost btn-icon h-7 w-7" title="Duplicate" onClick={() => setEditing({ ...structuredClone(t), id: undefined, name: `${t.name} (copy)` })}>
                <Copy size={13} />
              </button>
              {state.inspectionTemplates.length > 1 && (
                <button className="hover-reveal btn-ghost btn-icon h-7 w-7" title="Delete" onClick={() => deleteInspectionTemplate(t.id)}>
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">
        Items ending in “(mm)” or “(32nds)” get a measurement field that rates itself — brake pads: 5 mm+ good, 3–4 soon, under 3 urgent; tread: 6/32+ good, 3–5 soon, 2 or less urgent.
      </p>
      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSave={(t) => {
            saveInspectionTemplate(t);
            setEditing(null);
          }}
        />
      )}
    </Section>
  );
}

function TemplateEditor({ template, onClose, onSave }) {
  const [t, setT] = useState({ ...template, sections: template.sections.map((s) => ({ section: s.section, text: s.items.join('\n') })) });
  const setSection = (i, patch) => setT({ ...t, sections: t.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const save = () =>
    onSave({
      id: t.id,
      name: t.name.trim() || 'Inspection',
      sections: t.sections
        .map((s) => ({ section: s.section.trim() || 'Section', items: s.text.split('\n').map((x) => x.trim()).filter(Boolean) }))
        .filter((s) => s.items.length),
    });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t.id ? 'Edit inspection template' : 'New inspection template'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save template</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">{(id) => <input id={id} className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />}</Field>
        {t.sections.map((s, i) => (
          <div key={i} className="rounded-[10px] border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <input className="input h-8 flex-1 font-medium" value={s.section} onChange={(e) => setSection(i, { section: e.target.value })} aria-label="Section name" />
              <button className="btn-ghost btn-icon h-8 w-8" onClick={() => setT({ ...t, sections: t.sections.filter((_, idx) => idx !== i) })} aria-label="Remove section">
                <Trash2 size={14} />
              </button>
            </div>
            <textarea rows={Math.min(10, Math.max(3, s.text.split('\n').length))} className="input font-mono text-[13px]" value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} aria-label={`${s.section} items`} />
            <p className="mt-1 text-2xs text-ink-3">One inspection point per line.</p>
          </div>
        ))}
        <button className="btn-secondary btn-sm" onClick={() => setT({ ...t, sections: [...t.sections, { section: 'New section', text: '' }] })}>
          <Plus size={13} /> Add section
        </button>
      </div>
    </Modal>
  );
}
