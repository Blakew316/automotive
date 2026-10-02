import { BARS, BRAND, DRIVELINE, TAGLINE, VIEWBOX, WPI, otherName } from './artwork';

const glyph = (p, fill) => <path transform={`translate(${p.x} ${p.y})`} style={{ fill }} d={p.d} />;
const bar = ([x, y, width, height], fill) => <rect x={x} y={y} width={width} height={height} style={{ fill }} />;

/**
 * The WPI Driveline logo. The navy parts follow the text color (text-brand: the logo's navy in light
 * mode, near-white in dark), the bars keep the logo's blue and green, and the tagline is slate.
 *   full    the stacked logo with "Shop Management System" (sign-in)
 *   lockup  WPI, bars and DRIVELINE — the tagline drops out where it would be too small to read
 *   mark    WPI over its bars
 * Size it with a height or a width class; the other side follows the logo's proportions. With no title
 * it's decorative (hidden from screen readers).
 */
export function Logo({ variant = 'lockup', className = 'h-10', title = BRAND }) {
  const [x, y, w, h] = VIEWBOX[variant];
  const label = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} className={`shrink-0 text-brand ${className}`} style={{ aspectRatio: `${w} / ${h}` }} {...label}>
      {glyph(WPI, 'currentColor')}
      {bar(BARS.blue, 'rgb(var(--logo-blue))')}
      {bar(BARS.green, 'rgb(var(--logo-green))')}
      {variant !== 'mark' && glyph(DRIVELINE, 'currentColor')}
      {variant === 'full' && glyph(TAGLINE, 'rgb(var(--logo-sub))')}
    </svg>
  );
}

/** The app icon: the mark on its pale blue tile, as on the Home Screen. */
export function AppIcon({ size = 28 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[22.5%] bg-[linear-gradient(135deg,#f8fbff,#e3edfa)] shadow-[0_0_0_0.5px_rgb(15_43_76/0.14),0_1px_2px_rgb(15_43_76/0.08)]"
      style={{ width: size, height: size }}
    >
      <Logo variant="mark" className="w-[66%] !text-[#0F2B4C]" title="" />
    </span>
  );
}

/** The top of a customer page: the logo, then the shop's own name if it goes by another one. */
export function ShopBrand({ name, className = 'h-9' }) {
  const other = otherName(name);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Logo className={className} />
      {other && <div className="min-w-0 truncate border-l border-line pl-3 text-sm font-medium text-ink-2">{other}</div>}
    </div>
  );
}
