import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#051F20',
        'bg-tertiary': '#163832',
        'text-primary': '#E2F1E7',
        'text-secondary': '#8EB69B',
        'text-muted': '#235347',
        accent: '#00F5D4',
        'accent-hover': '#00D2B4',
        success: '#3CD070',
        warning: '#FFD166',
        error: '#FF6B6B',
        info: '#0EA5E9',
      },
      fontFamily: {
        sans: ['"Comic Sans MS"', 'cursive'],
      },
      borderRadius: {
        card: '16px',
        input: '10px',
        pill: '9999px',
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config
