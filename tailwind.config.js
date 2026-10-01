/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        raised: token('raised'),
        sidebar: {
          DEFAULT: token('sidebar'),
          2: token('sidebar-2'),
          ink: token('sidebar-ink'),
          'ink-2': token('sidebar-ink-2'),
          line: token('sidebar-line'),
        },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          3: token('ink-3'),
          4: token('ink-4'),
        },
        line: token('line'),
        fill: token('fill'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        brand: token('brand'),
        sky: token('sky'),
        slate: token('slate'),
        graphite: token('graphite'),
        ok: token('ok'),
        warn: token('warn'),
        bad: token('bad'),
        info: token('info'),
        violet: token('violet'),
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"',
          '"Inter Variable"', 'Inter', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '14px', letterSpacing: '0.005em' }],
        xs: ['12px', { lineHeight: '16px', letterSpacing: '0' }],
        sm: ['13px', { lineHeight: '18px', letterSpacing: '-0.003em' }],
        base: ['14px', { lineHeight: '20px', letterSpacing: '-0.006em' }],
        md: ['15px', { lineHeight: '22px', letterSpacing: '-0.009em' }],
        lg: ['17px', { lineHeight: '24px', letterSpacing: '-0.016em' }],
        xl: ['20px', { lineHeight: '26px', letterSpacing: '-0.019em' }],
        '2xl': ['24px', { lineHeight: '30px', letterSpacing: '-0.021em' }],
        '3xl': ['28px', { lineHeight: '34px', letterSpacing: '-0.022em' }],
        '4xl': ['34px', { lineHeight: '40px', letterSpacing: '-0.024em' }],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 0 0 0.5px rgb(var(--shadow-ring) / 0.10), 0 1px 2px rgb(0 0 0 / 0.04)',
        pop: '0 0 0 0.5px rgb(var(--shadow-ring) / 0.12), 0 12px 32px -4px rgb(0 0 0 / 0.14), 0 2px 6px rgb(0 0 0 / 0.06)',
        sheet: '0 0 0 0.5px rgb(var(--shadow-ring) / 0.14), 0 32px 64px -12px rgb(0 0 0 / 0.28)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'sheet-in': { from: { opacity: 0, transform: 'translateY(8px) scale(0.985)' }, to: { opacity: 1, transform: 'none' } },
        'toast-in': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'sheet-in': 'sheet-in 220ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        'toast-in': 'toast-in 240ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        'slide-in': 'slide-in 220ms cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
    },
  },
  plugins: [],
};
