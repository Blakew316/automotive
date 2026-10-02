import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronLeft, Copy, Search, X } from 'lucide-react';
import { STATUS } from '../lib/workflow';
import { initials } from '../lib/format';
import { setNavBar, useIsPhone } from '../lib/viewport';

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
  const owner = useId();
  const titleRef = useRef(null);
  const section = eyebrow ?? (back ? null : SECTIONS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1]);
  const backTo = back || null;
  const backName = back ? backText || (typeof back === 'string' ? backLabel(back) : 'Back') : null;
  // On iPhone and iPad portrait the navigation bar carries the back button, and this title once it scrolls away.
  useEffect(() => {
    setNavBar(owner, { title: typeof title === 'string' ? title : null, back: backTo, backText: backName });
  }, [owner, title, backTo, backName]);
  useEffect(() => () => setNavBar(owner, null), [owner]);
  useEffect(() => {
    const el = titleRef.current;
    const root = document.getElementById('main-scroll');
    if (!el || !root || typeof IntersectionObserver === 'undefined') return undefined;
    const top = parseFloat(getComputedStyle(root).paddingTop) || 0;
    // Collapsed once the title has scrolled up under the bar (not while it's still laying out, hidden or 0×0).
    const io = new IntersectionObserver(
      ([e]) => setNavBar(owner, { collapsed: !e.isIntersecting && e.boundingClientRect.height > 0 && e.boundingClientRect.bottom <= (e.rootBounds?.top ?? top) }),
      { root, rootMargin: `-${Math.round(top)}px 0px 0px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [owner]);
  return (
    <header className="mb-6">
      {back && (
        <button onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))} className="btn-plain -ml-2 mb-1 hidden h-7 px-1.5 text-sm lg:inline-flex">
          <ChevronLeft size={17} strokeWidth={2} className="-mr-0.5" />
          {backName}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {section && <div className="eyebrow mb-2">{section}</div>}
          <h1 ref={titleRef} className="text-3xl font-bold text-ink">
            {title}
          </h1>
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

/**
 * Icon tile tints by tone — the website's foil hues, as a light wash with a hairline ring, so color
 * adds life without ever becoming a block. Older tone names map onto the same palette.
 */
const TINT = {
  navy: 'bg-accent/[0.09] text-accent ring-accent/[0.12]',
  indigo: 'bg-hue-indigo/[0.1] text-hue-indigo ring-hue-indigo/[0.14]',
  lilac: 'bg-hue-lilac/[0.1] text-hue-lilac ring-hue-lilac/[0.14]',
  azure: 'bg-hue-azure/[0.1] text-hue-azure ring-hue-azure/[0.14]',
  teal: 'bg-hue-teal/[0.1] text-hue-teal ring-hue-teal/[0.14]',
  amber: 'bg-hue-amber/[0.11] text-hue-amber ring-hue-amber/[0.16]',
  rose: 'bg-hue-rose/[0.1] text-hue-rose ring-hue-rose/[0.14]',
  green: 'bg-ok/[0.1] text-ok ring-ok/[0.14]',
  grey: 'bg-fill/[0.12] text-ink-2 ring-fill/[0.1]',
};
const TONES = { ...TINT, blue: TINT.indigo, sky: TINT.azure, graphite: TINT.navy, slate: TINT.lilac };
/** A stable hue for something without one of its own (a card title, a person's name). */
const AUTO = ['indigo', 'azure', 'lilac', 'teal', 'navy'];
const autoTone = (key = '', list = AUTO) => {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

export function IconTile({ icon, tone = 'blue', size = 32, className = '' }) {
  const Icon = icon;
  return (
    <span className={`icon-tile ring-1 ring-inset ${TONES[tone] || TONES.blue} ${className}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}

export function CardHeader({ title, subtitle, actions, icon: Icon, tone }) {
  return (
    <div className="card-header">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <IconTile icon={Icon} tone={tone || autoTone(typeof title === 'string' ? title : '')} size={28} />}
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
      <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 coarse:left-3" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Search on the iOS keyboard just closes it — results are already live.
          if (e.key === 'Enter' && matchMedia('(pointer: coarse)').matches) e.currentTarget.blur();
          onKeyDown?.(e);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="input h-8 border-transparent bg-fill/[0.1] pl-8 shadow-none focus:bg-surface coarse:h-9 coarse:pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-ink-3/70 text-surface after:absolute after:-inset-3 hover:bg-ink-3 coarse:right-2.5 coarse:h-[18px] coarse:w-[18px]"
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
    <div role="tablist" className={`no-scrollbar inline-flex max-w-full overflow-x-auto rounded-[8px] bg-fill/[0.12] p-[2px] coarse:rounded-[9px] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-all duration-150 coarse:rounded-[7px] ${
              size === 'sm' ? 'h-6 px-2.5 text-xs coarse:h-[30px] coarse:px-3' : 'h-7 px-3 text-sm coarse:h-8 coarse:px-3.5'
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
  const ref = useRef(null);
  // Keep the selected tab visible when the bar scrolls (e.g. opened by a link to a later tab).
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector('[data-active="true"]');
    if (!el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left < b.left) box.scrollLeft += r.left - b.left - 12;
    else if (r.right > b.right) box.scrollLeft += r.right - b.right + 12;
  }, [value]);
  return (
    <div ref={ref} className={`no-scrollbar flex gap-5 overflow-x-auto border-b border-line ${className}`}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            data-active={active}
            onClick={() => onChange(t.value)}
            className={`relative -mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent pb-2.5 pt-1 text-sm font-medium transition-colors coarse:pb-3 coarse:pt-2 ${
              active ? 'text-ink' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {active && <span className="bg-foil-ink absolute inset-x-0 -bottom-[2px] h-[2px] rounded-full" />}
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

const AVATAR = {
  indigo: 'bg-hue-indigo/[0.13] text-hue-indigo',
  lilac: 'bg-hue-lilac/[0.13] text-hue-lilac',
  azure: 'bg-hue-azure/[0.13] text-hue-azure',
  teal: 'bg-hue-teal/[0.13] text-hue-teal',
  amber: 'bg-hue-amber/[0.14] text-hue-amber',
  rose: 'bg-hue-rose/[0.12] text-hue-rose',
};

export function Avatar({ person, name, size = 32, className = '' }) {
  const text = person ? initials(person) : (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${AVATAR[autoTone(text + (person?.id || name || ''), Object.keys(AVATAR))]} ${className}`}
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

/** Swipe a sheet down to dismiss it (phones): from its top bar, or from its content when that's scrolled to the top. */
function useSheetDrag(sheetRef, open, dismiss) {
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet) return undefined;
    let start = null;
    let dragging = false;
    const blocked = (el) => {
      // Drawing (signatures, markup), sliders and anything already scrolled keep the gesture.
      for (let n = el; n && n !== sheet; n = n.parentElement) {
        if (n.matches('canvas, input[type=range], [data-sheet-nodrag]')) return true;
        if (n.scrollTop > 0) return true;
      }
      return false;
    };
    const onStart = (e) => {
      if (e.touches.length !== 1 || window.innerWidth >= 640 || blocked(e.target)) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
      dragging = false;
    };
    const onMove = (e) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          start = null;
          return;
        }
        if (dy < -4) {
          start = null;
          return;
        }
        if (dy < 8) return;
        dragging = true;
        sheet.style.transition = 'none';
      }
      e.preventDefault();
      sheet.style.transform = `translateY(${Math.max(0, dy - 8)}px)`;
    };
    const onEnd = (e) => {
      if (!start) return;
      const dy = (e.changedTouches[0]?.clientY ?? start.y) - start.y;
      const speed = dy / Math.max(1, performance.now() - start.t);
      const was = dragging;
      start = null;
      dragging = false;
      if (!was) return;
      if (dy > Math.min(160, sheet.offsetHeight * 0.3) || speed > 0.7) dismiss();
      else {
        sheet.style.transition = 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)';
        sheet.style.transform = '';
      }
    };
    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [sheetRef, open, dismiss]);
}

/**
 * Dialog. On a phone it's an iOS sheet: it rises from the bottom, has a grabber, swipes down to
 * close, keeps clear of the home indicator and sits above the keyboard.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', layer = 'z-50' }) {
  const titleId = useId();
  const sheetRef = useRef(null);
  const phone = useIsPhone();
  // On a phone the sheet slides away before it closes.
  const dismiss = useCallback(() => {
    const el = sheetRef.current;
    if (!el || window.innerWidth >= 640 || matchMedia('(prefers-reduced-motion: reduce)').matches) return onClose?.();
    el.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)';
    el.style.transform = 'translateY(105%)';
    setTimeout(() => {
      onClose?.();
      // Still open (the page kept it, e.g. to confirm something first): bring it back.
      requestAnimationFrame(() => {
        if (el.isConnected) el.style.transform = '';
      });
    }, 220);
    return undefined;
  }, [onClose]);
  useSheetDrag(sheetRef, open && Boolean(onClose), dismiss);
  useEffect(() => {
    if (!open) return undefined;
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
    <div
      className={`fixed inset-x-0 ${layer} flex items-end justify-center pt-[calc(var(--safe-t)+10px)] sm:items-center sm:p-6`}
      style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-height, 100%)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div className="absolute inset-0 animate-fade-in bg-black/30 sm:bg-black/25 sm:backdrop-blur-[2px]" onClick={onClose ? dismiss : undefined} />
      <div
        ref={sheetRef}
        data-sheet
        className={`relative flex max-h-full w-full ${width} animate-sheet-up flex-col overflow-hidden rounded-t-[14px] bg-surface shadow-sheet sm:max-h-[92vh] sm:animate-sheet-in sm:rounded-xl`}
      >
        {phone && <div aria-hidden="true" className="mx-auto mt-[6px] h-[5px] w-9 shrink-0 rounded-full bg-ink-4/50" />}
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-3 sm:pt-4">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
            </div>
            {onClose && (
              <button onClick={dismiss} aria-label="Close" className="btn-ghost btn-icon -mr-1.5 h-7 w-7 shrink-0 rounded-full bg-fill/[0.12] text-ink-2 sm:bg-transparent coarse:h-[30px] coarse:w-[30px]">
                <X size={16} strokeWidth={phone ? 2.6 : 2} />
              </button>
            )}
          </div>
        )}
        <div className={`flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? 'pb-5' : 'pb-[calc(20px+var(--safe-b))] sm:pb-5'}`}>{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-raised px-5 pb-[max(12px,var(--safe-b))] pt-3 sm:py-3">{footer}</div>
        )}
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
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40 coarse:h-[31px] coarse:w-[51px] ${checked ? 'bg-ok' : 'bg-fill/30'}`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2)] transition-transform duration-200 coarse:h-[27px] coarse:w-[27px] coarse:shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] ${
          checked ? 'translate-x-[18px] coarse:translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
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

/** Lightweight dropdown menu anchored to its trigger; an iOS action sheet on phones. */
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const phone = useIsPhone();
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && !e.target.closest?.('[data-action-sheet]') && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const list = items.filter(Boolean);
  const choose = (it) => {
    setOpen(false);
    it.onClick?.();
  };
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && !phone && (
        <div className={`absolute top-full z-40 mt-1 min-w-[200px] animate-fade-in rounded-[10px] bg-surface p-1 shadow-pop ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {list.map((it, i) =>
            it === '-' ? (
              <div key={i} className="mx-2 my-1 h-px bg-line" />
            ) : (
              <button
                key={it.label}
                disabled={it.disabled}
                onClick={() => choose(it)}
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
      {open && phone && <ActionSheet items={list} onChoose={choose} onCancel={() => setOpen(false)} />}
    </div>
  );
}

/** iOS action sheet: the choices in a rounded group above a separate Cancel, within thumb reach. */
function ActionSheet({ items, onChoose, onCancel }) {
  const groups = items.reduce((g, it) => (it === '-' ? [...g, []] : (g[g.length - 1].push(it), g)), [[]]).filter((g) => g.length);
  return createPortal(
    <div data-action-sheet className="fixed inset-x-0 z-[70] flex flex-col justify-end px-2 pb-[max(8px,var(--safe-b))]" style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-height, 100%)' }} role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/30" onClick={onCancel} />
      <div className="relative mx-auto flex max-h-full w-full max-w-md animate-sheet-up flex-col gap-2">
        <div className="min-h-0 overflow-y-auto overscroll-contain rounded-[14px] bg-surface/95 shadow-sheet backdrop-blur-xl">
          {groups.map((g, gi) => (
            <div key={gi} className={gi ? 'border-t-[6px] border-fill/[0.1]' : ''}>
              {g.map((it) => (
                <button
                  key={it.label}
                  disabled={it.disabled}
                  onClick={() => onChoose(it)}
                  className={`press flex min-h-[56px] w-full items-center gap-3.5 border-b-[0.5px] border-line px-5 text-left text-[17px] last:border-b-0 disabled:opacity-35 ${it.danger ? 'text-bad' : 'text-ink'}`}
                >
                  {it.icon && <it.icon size={21} strokeWidth={1.8} className={`shrink-0 ${it.danger ? '' : 'text-accent'}`} />}
                  <span className="min-w-0 flex-1">{it.label}</span>
                  {it.hint && <span className="text-[15px] text-ink-3">{it.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button onClick={onCancel} className="press flex h-14 w-full shrink-0 items-center justify-center rounded-[14px] bg-surface text-[17px] font-semibold text-accent shadow-sheet">
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** The iOS disclosure chevron at the end of a tappable row. */
export const Disclosure = ({ className = '' }) => (
  <svg width="7" height="12" viewBox="0 0 7 12" className={`shrink-0 text-ink-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 1l5 5-5 5" />
  </svg>
);

/** A row in an inset grouped list (iOS Settings style). */
export function ListRow({ to, onClick, children, chevron = true, className = '' }) {
  const cls = `group flex items-center gap-3 px-4 py-2.5 transition-colors coarse:min-h-[48px] ${to || onClick ? 'press cursor-pointer hover:bg-fill/[0.05]' : ''} ${className}`;
  const inner = (
    <>
      {children}
      {chevron && (to || onClick) && <Disclosure className="transition-transform group-hover:translate-x-0.5" />}
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
export function InlineText({ value, onCommit, className = '', multiline = false, submitOnEnter = !multiline, ...rest }) {
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
        if (e.key === 'Enter' && submitOnEnter && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
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
