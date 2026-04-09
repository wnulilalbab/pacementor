/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF8FD',
          100: '#D0ECFA',
          200: '#A1D8F4',
          300: '#62BEEC',
          400: '#4AAEE0',
          500: '#2E95CC',
          600: '#1B78AA',
          700: '#125880',
          800: '#0B3A56',
          900: '#061F2E',
        },
        accent: {
          400: '#7ADE97',
          500: '#5DCE7A',
          600: '#3DAF5C',
        },
      },
    },
  },
  plugins: [],
}
