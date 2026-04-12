/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // JARVIS OS semantic palette
        jarvis: {
          bg:     '#05070d',   // near-black navy canvas
          panel:  '#0a0f1a',   // raised panel
          glass:  'rgba(12, 20, 34, 0.6)',
          border: 'rgba(120, 220, 255, 0.12)',
          cyan:   '#5de8ff',   // core intelligence
          teal:   '#2fd4c2',
          blue:   '#4b9dff',   // planning
          amber:  '#f5b642',   // approvals / caution
          red:    '#ff4d6d',   // blocked / urgent
          green:  '#4ade80',   // completed
          purple: '#a78bfa',   // brain / memory
          ink:    '#e6f2ff',   // primary text
          body:   '#9bb3cc',   // body text
          muted:  '#5b6f85',
        },
      },
      boxShadow: {
        'glow-cyan':   '0 0 0 1px rgba(93,232,255,0.25), 0 0 28px rgba(93,232,255,0.12)',
        'glow-amber':  '0 0 0 1px rgba(245,182,66,0.35), 0 0 24px rgba(245,182,66,0.12)',
        'glow-red':    '0 0 0 1px rgba(255,77,109,0.35), 0 0 24px rgba(255,77,109,0.12)',
        'glow-green':  '0 0 0 1px rgba(74,222,128,0.3),  0 0 20px rgba(74,222,128,0.1)',
        'panel':       'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'jarvis-grid': 'linear-gradient(rgba(93,232,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(93,232,255,0.04) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
