/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        body: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Consolas", "Menlo", "monospace"],
      },
      colors: {
        // Design & UX direction — claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md
        // "investment-grade, clean, simple, beautiful" (Mercury/Stripe/Wealthfront
        // survey): light-first, near-white/near-black, color reserved for state.
        // 2026-09-23: toned down from near-white (#FAFAF9 page / #FFFFFF
        // cards), which Faiz found too bright. Warm-gray page, off-white
        // cards — still light-first, just easier on the eyes; text shades
        // darkened slightly to keep contrast on the darker surfaces.
        background: "#E4E2DD",
        surface: "#F2F1ED",
        border: {
          DEFAULT: "#D2CFC8",
          subtle: "#E8E6E1",
        },
        ink: {
          // primary / secondary text — never pure black/gray.
          DEFAULT: "#111111",
          muted: "#5B616B",
          faint: "#858B95",
        },
        accent: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          subtle: "#E2E9FA",
        },
        // Data semantics — state only, never decorative.
        positive: { DEFAULT: "#16A34A", subtle: "#F0FDF4" },
        negative: { DEFAULT: "#DC2626", subtle: "#FEF2F2" },
        caution: { DEFAULT: "#D97706", subtle: "#FFFBEB" },
      },
    },
  },
  plugins: [],
};
