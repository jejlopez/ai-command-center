/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas:  'var(--color-canvas)',
        surface: { DEFAULT: '#111111', raised: '#161616', input: '#1c1c1c' },
        text: {
          primary:  '#e8e8ed',
          body:     '#a1a1aa',
          muted:    '#71717a',
          disabled: '#3f3f46',
        },
        border: {
          subtle:  'rgba(255,255,255,0.05)',
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong:  'rgba(255,255,255,0.14)',
        },
        aurora: {
          teal:   'var(--color-aurora-teal)',
          violet: 'var(--color-aurora-violet)',
          rose:   'var(--color-aurora-rose)',
          amber:  'var(--color-aurora-amber)',
          blue:   'var(--color-aurora-blue)',
          green:  'var(--color-aurora-green)',
        },
      },
      boxShadow: {
        'glow-teal':   '0 0 0 1px rgba(0,217,200,0.25),   0 0 20px rgba(0,217,200,0.1)',
        'glow-violet': '0 0 0 1px rgba(167,139,250,0.25),  0 0 20px rgba(167,139,250,0.1)',
        'glow-rose':   '0 0 0 1px rgba(251,113,133,0.25),  0 0 20px rgba(251,113,133,0.08)',
        'card':        'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 8px rgba(0,0,0,0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
