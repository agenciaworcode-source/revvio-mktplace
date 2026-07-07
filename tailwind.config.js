/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#10b981",
          dark: "#059669",
          light: "#d1fae5",
        },
        slate: {
          950: "#0f172a",
        },
        // paleta clara do marketplace (protótipo)
        ink: "#08090c",
        cloud: "#f4f5f7",
        hair: "#ecedf1",
      },
    },
  },
  plugins: [],
};
