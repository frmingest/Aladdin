/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Backend origin for production builds where frontend/backend are separate
  // services (e.g. two Railway apps) — see docs/decisions/0010. Unset in
  // local dev, where Vite's dev-server proxy handles /api and /health
  // same-origin (see vite.config.ts).
  readonly VITE_API_BASE_URL?: string;
  // Sent as the X-API-Key header on every request — pairs with the
  // backend's optional APP_AUTH_TOKEN (see backend/app/api/auth.py).
  readonly VITE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
