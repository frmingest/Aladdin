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
        background: "#FAFAF9",
        surface: "#FFFFFF",
        border: {
          DEFAULT: "#E5E7EB",
          subtle: "#F0EFED",
        },
        ink: {
          // primary / secondary text — never pure black/gray.
          DEFAULT: "#111111",
          muted: "#6B7280",
          faint: "#9CA3AF",
        },
        accent: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          subtle: "#EFF4FF",
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
