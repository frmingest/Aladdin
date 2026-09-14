/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["IBM Plex Sans", "-apple-system", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "-apple-system", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "SF Mono", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
