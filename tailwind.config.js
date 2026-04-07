/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        modern: {
          bg: "#080808", // matte black background
          panel: "#121212", // slightly lighter panel
          border: "#262626", // subtle border
          accent: "#D4D4D4", // text accent
          primary: "#FFFFFF", // primary text
          muted: "#737373", // muted text
          alert: "#EF4444", 
          warning: "#F59E0B",
          success: "#10B981",
          highlight: "#8B5CF6", // subtle purple accent for spatial UI
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh': 'radial-gradient(at 40% 20%, rgba(139, 92, 246, 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(59, 130, 246, 0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(139, 92, 246, 0.1) 0px, transparent 50%)',
      }
    },
  },
  plugins: [],
}
