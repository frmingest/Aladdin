// Flat config (eslint 9) — was missing entirely, which is why `npm run
// lint` (package.json) has been failing since Phase 0 (see
// docs/decisions/0015-agentic-coding-and-ai-safety-guardrails.md and
// claude/progress.md's known-gaps history). Standard Vite + React + TS
// setup: type-aware-free (`recommended`, not `recommendedTypeChecked`) so
// it stays fast and doesn't need a tsconfig `project` wired up here —
// `tsc --noEmit` (run separately, see CLAUDE.md/CI) is what catches actual
// type errors; this config is for style/correctness lint only.

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Unused vars are a real bug class here (e.g. an unused import left
      // behind after a refactor) but prefixing with `_` is the accepted
      // escape hatch for deliberately-unused function args.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);
