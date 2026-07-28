import type { Config } from "tailwindcss";
// Fonte única da identidade visual: ver src/theme/palette.ts
import { brand, neutral, panel, shadows, status } from "./src/theme/palette";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "sans-serif"],
      },
      colors: {
        brand,
        panel,
        status,
        ...neutral,
        slate: {
          950: "#0f172a",
        },
      },
      boxShadow: shadows,
    },
  },
  plugins: [],
} satisfies Config;
