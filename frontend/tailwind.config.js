/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          warm: "#faf8f5",
          subtle: "#f5f2eb",
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        stone: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        }
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'warm-sm': '0 1px 3px 0 rgba(41, 37, 36, 0.05), 0 1px 2px -1px rgba(41, 37, 36, 0.04)',
        'warm-card': '0 4px 20px -2px rgba(41, 37, 36, 0.05), 0 1px 3px -1px rgba(41, 37, 36, 0.04)',
        'warm-glow': '0 4px 16px -1px rgba(245, 158, 11, 0.3)',
        'amber-focus': '0 0 0 4px rgba(245, 158, 11, 0.15)',
      }
    },
  },
  plugins: [],
}
