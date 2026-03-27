export const defaultGraphScopes = ["User.Read", "Sites.Read.All", "Lists.ReadWrite"] as const;

export interface MicrosoftAuthConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export function getMicrosoftAuthConfig(): MicrosoftAuthConfig | null {
  const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID?.trim();
  const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID?.trim();
  const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI?.trim() || window.location.origin;
  const scopes =
    import.meta.env.VITE_ENTRA_SCOPES?.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean) ?? [...defaultGraphScopes];

  if (!clientId || !tenantId) {
    return null;
  }

  return {
    clientId,
    tenantId,
    redirectUri,
    scopes,
  };
}
