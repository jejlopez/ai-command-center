/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas:  '#080808',
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
          teal:   '#00D9C8',   // AI activity / processing / healthy
          violet: '#a78bfa',   // memory / intelligence
          rose:   '#fb7185',   // errors / critical
          amber:  '#fbbf24',   // warnings / degraded
          blue:   '#60a5fa',   // pipeline / tasks / network
          green:  '#34d399',   // success
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
