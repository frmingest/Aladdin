/** @type {import('tailwindcss').Config} */

// Colours are CSS variables (RGB triplets, defined in src/index.css) so the
// same class names work in the dark theme (default since 2026-09-25) and
// the light one, and alpha modifiers like `bg-negative/90` keep working.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Space Grotesk for headings gives the pages some character; Inter
        // stays the reading face; JetBrains Mono sets figures.
        display: ['"Space Grotesk"', "Inter", "-apple-system", "system-ui", "sans-serif"],
        body: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "SF Mono", "Consolas", "Menlo", "monospace"],
      },
      colors: {
        // Design & UX direction — claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md:
        // near-neutral surfaces, colour reserved for state. 2026-09-25: dark
        // by default (Faiz: easier to read); the warm-gray light palette of
        // 2026-09-23 is kept behind the theme switch.
        background: v("background"),
        surface: v("surface"),
        raised: v("raised"),
        border: {
          DEFAULT: v("border"),
          subtle: v("border-subtle"),
        },
        ink: {
          DEFAULT: v("ink"),
          muted: v("ink-muted"),
          faint: v("ink-faint"),
        },
        accent: {
          DEFAULT: v("accent"),
          hover: v("accent-hover"),
          subtle: v("accent-subtle"),
        },
        // Text on a solid accent/positive/negative fill.
        onfill: v("onfill"),
        // Data semantics — state only, never decorative.
        positive: { DEFAULT: v("positive"), subtle: v("positive-subtle") },
        negative: { DEFAULT: v("negative"), subtle: v("negative-subtle") },
        caution: { DEFAULT: v("caution"), subtle: v("caution-subtle") },
      },
      // "Read report" mode (DocumentReader): the backdrop fades and blurs in,
      // the reader grows out of the eye button that opened it.
      keyframes: {
        "reader-backdrop-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "reader-backdrop-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "reader-panel-in": {
          from: { opacity: "0", transform: "scale(0.6)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "reader-panel-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.6)" },
        },
        "reader-content-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "reader-backdrop-in": "reader-backdrop-in 240ms ease-out both",
        "reader-backdrop-out": "reader-backdrop-out 200ms ease-in both",
        "reader-panel-in": "reader-panel-in 340ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "reader-panel-out": "reader-panel-out 200ms cubic-bezier(0.7, 0, 0.84, 0) both",
        "reader-content-in": "reader-content-in 320ms ease-out 120ms both",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};
