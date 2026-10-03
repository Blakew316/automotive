import { BARS, DRIVELINE, PRODUCT, TAGLINE, VIEWBOX, WPI, otherName } from './artwork';
import { productSite } from '../lib/booking';

const glyph = (p, fill) => <path transform={`translate(${p.x} ${p.y})`} style={{ fill }} d={p.d} />;
const bar = ([x, y, width, height], fill) => <rect x={x} y={y} width={width} height={height} style={{ fill }} />;

/**
 * The WPI Driveline Shop Management System logo. The navy parts follow the text color (text-brand: the
 * logo's navy in light mode, near-white in dark), the bars keep the logo's blue and green, and the
 * tagline is slate.
 *   full    the stacked logo with "Shop Management System" (sign-in)
 *   lockup  WPI, bars and DRIVELINE — the tagline drops out where it would be too small to read
 *   mark    WPI over its bars
 * Size it with a height or a width class; the other side follows the logo's proportions. Screen readers
 * hear the product's full name; with title="" it's decorative (hidden from them).
 */
export function Logo({ variant = 'lockup', className = 'h-10', title = PRODUCT }) {
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
      role="img"
      aria-label={PRODUCT}
      className="flex shrink-0 items-center justify-center rounded-[22.5%] bg-[linear-gradient(135deg,#f8fbff,#e3edfa)] shadow-[0_0_0_0.5px_rgb(15_43_76/0.14),0_1px_2px_rgb(15_43_76/0.08)]"
      style={{ width: size, height: size }}
    >
      <Logo variant="mark" className="w-[66%] !text-[#0F2B4C]" title="" />
    </span>
  );
}

const WORDMARK = { md: 'text-2xl', xl: 'text-4xl' };
const LOCKUP = { md: 'h-9', xl: 'h-16' };

/**
 * The top of a customer page. Another shop's name leads, set as its wordmark (md on phones, xl on the
 * lobby TV) — customers see who they're dealing with, and the product signs off at the bottom with
 * <PoweredBy>. Only when the shop is the product's own, or has no name, does the logo show here
 * (className sizes it).
 */
export function ShopBrand({ name, size = 'md', className }) {
  const other = otherName(name);
  if (!other) return <Logo className={className || LOCKUP[size]} />;
  return <h2 className={`min-w-0 truncate font-bold tracking-tight text-ink ${WORDMARK[size] || WORDMARK.md}`}>{other}</h2>;
}

/**
 * One quiet line at the end of a customer page for another shop: the mark and "Powered by WPI Driveline
 * Shop Management System", linking to the product's site where the app is published with it. Nothing
 * for the product's own shop, whose header already shows the logo.
 */
export function PoweredBy({ name, className = '' }) {
  if (!otherName(name)) return null;
  const site = productSite();
  const line = (
    <>
      <Logo variant="mark" className="h-3" title="" />
      <span>{`Powered by ${PRODUCT}`}</span>
    </>
  );
  return (
    <p className={`flex justify-center text-center text-[11px] leading-4 text-ink-4 ${className}`}>
      {site ? (
        <a href={site} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-ink-3">
          {line}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5">{line}</span>
      )}
    </p>
  );
}
