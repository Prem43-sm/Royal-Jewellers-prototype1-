/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FAFAF8',
        'ivory-dark': '#F5F5F0',
        charcoal: '#2D2D3F',
        'charcoal-light': '#4A4A60',
        gold: '#C9A96E',
        'gold-dark': '#B8944F',
        'gold-light': '#FDF8F0',
        golddark: '#A78540',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        dropdown: '0 4px 12px rgba(0,0,0,0.12)',
        modal: '0 8px 32px rgba(0,0,0,0.16)',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};