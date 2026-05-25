/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b1020',
          soft: '#121831',
          card: '#161d3a',
          line: '#222a4e',
        },
        brand: {
          DEFAULT: '#7c5cff',
          hover: '#9277ff',
          soft: '#2a2154',
        },
        ink: {
          DEFAULT: '#e7ebff',
          dim: '#9aa3c7',
          mute: '#6b7299',
        },
        success: '#3ddc97',
        danger: '#ff6b6b',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 30px rgba(0,0,0,0.35)',
        glow: '0 0 0 3px rgba(124,92,255,0.25)',
      },
      animation: {
        'pulse-soft': 'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
