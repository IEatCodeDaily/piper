/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PIPER_REPOSITORY_MODE?: "mock" | "graph-mock" | "graph-live";
  readonly VITE_ENTRA_CLIENT_ID?: string;
  readonly VITE_ENTRA_TENANT_ID?: string;
  readonly VITE_ENTRA_REDIRECT_URI?: string;
  readonly VITE_ENTRA_SCOPES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
