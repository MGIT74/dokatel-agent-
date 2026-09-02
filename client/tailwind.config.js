/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#060607',
        surface: '#0c0c0e',
        card: '#111113',
        card2: '#17171b',
        apple: { DEFAULT: '#0a84ff', light: '#4da3ff', deep: '#0071e3' },
        lime: { DEFAULT: '#d9f26b', ink: '#101206' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};