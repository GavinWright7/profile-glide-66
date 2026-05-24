/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When `"true"` at build time, native dev bundles run `runDevelopmentResetIfNeeded()` on launch. */
  readonly VITE_DEV_RESET_ON_LAUNCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
