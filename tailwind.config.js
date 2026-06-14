/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#0A0F1E",
          primary: "#1A35A0",
          secondary: "#89B4DE",
        },
        glass: {
          DEFAULT: "rgba(255, 255, 255, 0.04)",
          border: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.08)",
        }
      }
    },
  },
  plugins: [],
};