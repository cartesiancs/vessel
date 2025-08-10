/** @type {import('tailwindcss').Config} */

import { createThemes } from "@shadcn/tailwind-config";

module.exports = {
  presets: [createThemes()],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
