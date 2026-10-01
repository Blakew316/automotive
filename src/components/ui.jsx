import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronLeft, Copy, Search, X } from 'lucide-react';
import { STATUS } from '../lib/workflow';
import { initials } from '../lib/format';

// Which part of the shop a page belongs to — shown as the label above each page title.
const SECTIONS = [
  ['/workflow', 'Shop floor'], ['/orders', 'Shop floor'], ['/calendar', 'Shop floor'], ['/messages', 'Shop floor'],
  ['/customers', 'Customers'], ['/vehicles', 'Customers'], ['/marketing', 'Customers'],
  ['/tech', 'Technical'], ['/catalog', 'Technical'], ['/vin', 'Technical'], ['/parts', 'Technical'], ['/library', 'Technical'],
  ['/team', 'Business'], ['/reports', 'Business'], ['/accounting', 'Business'], ['/integrations', 'Business'], ['/import', 'Business'], ['/settings', 'Business'],
];

export function PageHeader({ title, subtitle, actions, back, backText, eyebrow, children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = eyebrow ?? (back ? null : SECTIONS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1]);
  return (
    <header className="mb-6">
      {back && (
        <button onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))} className="btn-plain -ml-2 mb-1 h-7 px-1.5 text-sm">
          <ChevronLeft size={17} strokeWidth={2} className="-mr-0.5" />
          {backText || (typeof back === 'string' ? backLabel(back) : 'Back')}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {section && <div className="eyebrow mb-2">{section}</div>}
          <h1 className="text-3xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-md text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

const BACK_LABELS = { '/catalog': 'Vehicle Database', '/orders': 'Repair Orders', '/customers': 'Customers', '/vehicles': 'Vehicles', '/workflow': 'Workflow', '/library': 'Library', '/parts': 'Parts' };
const backLabel = (path) => BACK_LABELS[path] || 'Back';

export function Card({ className = '', children, ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** Icon tile tints by tone — navy or neutral grey, kept light so color never dominates. */
const NAVY = 'bg-accent/[0.09] text-accent';
const GREY = 'bg-fill/[0.12] text-ink-2';
const TONES = { blue: NAVY, sky: NAVY, graphite: NAVY, green: NAVY, slate: GREY, teal: GREY };

export function IconTile({ icon, tone = 'blue', size = 32, className = '' }) {
  const Icon = icon;
  return (
    <span className={`icon-tile ${TONES[tone] || TONES.blue} ${className}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}

export function CardHeader({ title, subtitle, actions, icon: Icon, tone }) {
  return (
    <div className="card-header">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (tone ? <IconTile icon={Icon} tone={tone} size={28} /> : <Icon size={16} strokeWidth={1.75} className="shrink-0 text-ink-3" />)}
        <div className="min-w-0">
          <h2 className="card-title truncate">{title}</h2>
          {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`block ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {typeof children === 'function' ? children(id) : children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className = '', autoFocus, onKeyDown, inputRef }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="input h-8 border-transparent bg-fill/[0.1] pl-8 shadow-none focus:bg-surface [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-ink-3/70 text-surface hover:bg-ink-3"
        >
          <X size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

/** Apple-style segmented control. */
export function Segmented({ options, value, onChange, className = '', size = 'md' }) {
  return (
    <div role="tablist" className={`inline-flex rounded-[8px] bg-fill/[0.12] p-[2px] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-all duration-150 ${
              size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-sm'
            } ${active ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)]' : 'text-ink-2 hover:text-ink'}`}
          >
            {o.icon && <o.icon size={14} strokeWidth={1.9} />}
            {o.label}
            {o.count != null && <span className={`tabular text-2xs ${active ? 'text-ink-3' : 'text-ink-4'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Underline tabs for page sections. */
export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-5 overflow-x-auto border-b border-line ${className}`}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`relative -mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors ${
              active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t.icon && <t.icon size={15} strokeWidth={1.8} className={active ? 'text-accent' : ''} />}
            {t.label}
            {t.count != null && <span className="tabular text-xs text-ink-4">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const Dot = ({ className = 'bg-ink-4', size = 8 }) => (
  <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size }}>
    <span className={`block h-full w-full rounded-full ${className}`} />
  </span>
);

export function StatusLabel({ status, className = '' }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-2 ${className}`}>
      <Dot className={s.dot} size={7} />
      {s.label}
    </span>
  );
}

export function Avatar({ person, name, size = 32, className = '' }) {
  const text = person ? initials(person) : (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-fill/[0.16] font-semibold text-ink-2 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {text}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, body, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {Icon && <Icon size={30} strokeWidth={1.4} className="mb-3 text-ink-4" />}
      <p className="text-md font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', layer = 'z-50' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className={`fixed inset-0 ${layer} flex items-end justify-center p-0 sm:items-center sm:p-6`} role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full ${width} animate-sheet-in flex-col overflow-hidden rounded-t-xl bg-surface shadow-sheet sm:rounded-xl`}>
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
            <div className="min-w-0">
              {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Close" className="btn-ghost btn-icon -mr-1.5 h-7 w-7 rounded-full">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Stat({ label, value, sub, to, className = '' }) {
  const body = (
    <>
      <div className="text-sm text-ink-2">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </>
  );
  const cls = `block px-4 py-3.5 ${className}`;
  return to ? (
    <Link to={to} className={`${cls} rounded-lg transition-colors hover:bg-fill/[0.05]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function KV({ label, children, mono = false, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${className}`}>
      <dt className="shrink-0 text-sm text-ink-3">{label}</dt>
      <dd className={`min-w-0 text-right text-sm text-ink ${mono ? 'font-mono text-[12.5px]' : ''}`}>{children ?? '—'}</dd>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40 ${checked ? 'bg-ok' : 'bg-fill/30'}`}
    >
      <span className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2)] transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
    </button>
  );
}

export const Spinner = ({ size = 16, className = '' }) => (
  <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-60 ${className}`} style={{ width: size, height: size }} />
);

export function ExternalLink({ href, children, className = '', icon = true }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-0.5 text-accent hover:underline ${className}`}>
      {children}
      {icon && <ArrowUpRight size={13} strokeWidth={2} className="shrink-0 opacity-80" />}
    </a>
  );
}

export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [done, setDone] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1400);
        } catch {
          // Clipboard blocked (e.g. insecure context) — nothing else to do.
        }
      }}
      className={`btn-ghost btn-sm ${className}`}
      aria-label={label}
      title={label}
    >
      {done ? <Check size={13} strokeWidth={2.4} className="text-ok" /> : <Copy size={13} strokeWidth={1.8} />}
    </button>
  );
}

/** Lightweight dropdown menu anchored to its trigger. */
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`absolute top-full z-40 mt-1 min-w-[200px] animate-fade-in rounded-[10px] bg-surface p-1 shadow-pop ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.filter(Boolean).map((it, i) =>
            it === '-' ? (
              <div key={i} className="mx-2 my-1 h-px bg-line" />
            ) : (
              <button
                key={it.label}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
                className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink ${
                  it.danger ? 'text-bad' : 'text-ink'
                }`}
              >
                {it.icon && <it.icon size={15} strokeWidth={1.8} className="shrink-0 opacity-80" />}
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="text-xs opacity-60">{it.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** A row in an inset grouped list (iOS Settings style). */
export function ListRow({ to, onClick, children, chevron = true, className = '' }) {
  const cls = `group flex items-center gap-3 px-4 py-2.5 transition-colors ${to || onClick ? 'cursor-pointer hover:bg-fill/[0.05]' : ''} ${className}`;
  const inner = (
    <>
      {children}
      {chevron && (to || onClick) && (
        <svg width="7" height="12" viewBox="0 0 7 12" className="shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l5 5-5 5" />
        </svg>
      )}
    </>
  );
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`w-full text-left ${cls}`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function Mono({ children, className = '' }) {
  return <span className={`font-mono text-[12.5px] tracking-tight ${className}`}>{children}</span>;
}

/** Number input that keeps a text draft while focused and commits a parsed number on blur/Enter. */
export function NumInput({ value, onCommit, format, className = '', align = 'right', ...rest }) {
  const [draft, setDraft] = useState(null);
  const cancel = useRef(false);
  const shown = draft ?? (value === '' || value == null ? '' : format ? format(value) : String(value));
  return (
    <input
      inputMode="decimal"
      value={shown}
      onFocus={(e) => {
        setDraft(value === '' || value == null ? '' : String(value));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && !cancel.current) {
          const n = parseFloat(String(draft).replace(/[^0-9.-]/g, ''));
          const next = Number.isFinite(n) ? n : 0;
          if (next !== Number(value)) onCommit(next);
        }
        cancel.current = false;
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancel.current = true;
          e.currentTarget.blur();
        }
      }}
      className={`tabular ${align === 'right' ? 'text-right' : ''} ${className}`}
      {...rest}
    />
  );
}

/** Text input that commits on blur/Enter — for inline editing inside tables. */
export function InlineText({ value, onCommit, className = '', multiline = false, ...rest }) {
  const [draft, setDraft] = useState(null);
  const cancel = useRef(false);
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Tag
      value={draft ?? value ?? ''}
      onFocus={() => setDraft(value ?? '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value && !cancel.current) onCommit(draft);
        cancel.current = false;
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !multiline) e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancel.current = true;
          e.currentTarget.blur();
        }
      }}
      className={className}
      {...rest}
    />
  );
}
