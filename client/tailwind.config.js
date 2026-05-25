/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--bg) / <alpha-value>)',
          soft: 'rgb(var(--bg-soft) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          line: 'rgb(var(--bg-line) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          dim: 'rgb(var(--ink-dim) / <alpha-value>)',
          mute: 'rgb(var(--ink-mute) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 30px rgba(0, 0, 0, 0.18)',
        glow: '0 0 0 3px rgba(124, 92, 255, 0.25)',
        soft: '0 4px 16px rgba(0, 0, 0, 0.06)',
        bubble: '0 1px 2px rgba(0, 0, 0, 0.10), 0 4px 12px rgba(124, 92, 255, 0.10)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.85) translateY(6px)' },
          '60%': { opacity: '1', transform: 'scale(1.02) translateY(0)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'blob': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%':    { transform: 'translate(40px,-30px) scale(1.05)' },
          '66%':    { transform: 'translate(-30px,20px) scale(0.97)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'blob': 'blob 18s ease-in-out infinite',
        'shimmer': 'shimmer 1.8s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
