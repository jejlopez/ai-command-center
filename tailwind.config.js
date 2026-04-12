/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg:      'var(--jarvis-bg)',
          surface: 'var(--jarvis-surface)',
          'surface-hover': 'var(--jarvis-surface-hover)',
          border:  'var(--jarvis-border)',
          'border-hover': 'var(--jarvis-border-hover)',
          ink:     'var(--jarvis-ink)',
          body:    'var(--jarvis-body)',
          muted:   'var(--jarvis-muted)',
          ghost:   'var(--jarvis-ghost)',
          // These stay the same in both themes:
          primary: '#00E0D0',
          'primary-muted': 'rgba(0,224,208,0.15)',
          success: '#00E0A0',
          warning: '#FFB340',
          danger:  '#FF5577',
          purple:  '#a78bfa',
        },
      },
      boxShadow: {
        'glow-primary': '0 0 0 1px rgba(0,224,208,0.2), 0 0 20px rgba(0,224,208,0.08)',
        'panel': '0 2px 12px rgba(0,0,0,0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'jarvis-grid': 'linear-gradient(rgba(93,232,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(93,232,255,0.04) 1px, transparent 1px)',
      },
      animation: {
        fadeIn: "fadeIn 200ms ease-out",
        slideUp: "slideUp 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
}
