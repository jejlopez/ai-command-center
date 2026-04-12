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
          bg:      '#08080a',
          surface: 'rgba(255,255,255,0.015)',
          'surface-hover': 'rgba(255,255,255,0.03)',
          border:  'rgba(255,255,255,0.04)',
          'border-hover': 'rgba(255,255,255,0.08)',
          primary: '#00E0D0',
          'primary-muted': 'rgba(0,224,208,0.15)',
          ink:     'rgba(255,255,255,0.85)',
          body:    'rgba(255,255,255,0.45)',
          muted:   'rgba(255,255,255,0.2)',
          ghost:   'rgba(255,255,255,0.08)',
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
