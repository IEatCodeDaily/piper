import {
  type AccountInfo,
  PublicClientApplication,
  type AuthenticationResult,
  type SilentRequest,
} from "@azure/msal-browser";
import { getMicrosoftAuthConfig } from "@/features/auth/auth-config";

let clientPromise: Promise<PublicClientApplication> | null = null;

async function getClient() {
  const authConfig = getMicrosoftAuthConfig();
  if (!authConfig) {
    throw new Error("Microsoft authentication is not configured.");
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new PublicClientApplication({
        auth: {
          clientId: authConfig.clientId,
          authority: `https://login.microsoftonline.com/${authConfig.tenantId}`,
          redirectUri: authConfig.redirectUri,
        },
        cache: {
          cacheLocation: "localStorage",
          storeAuthStateInCookie: false,
        },
      });
      await client.initialize();
      await client.handleRedirectPromise().catch(() => null);
      return client;
    })();
  }

  return clientPromise;
}

export function isMicrosoftAuthConfigured() {
  return getMicrosoftAuthConfig() !== null;
}

export async function getMicrosoftAccounts() {
  const client = await getClient();
  return client.getAllAccounts();
}

export async function getPrimaryMicrosoftAccount(): Promise<AccountInfo | null> {
  const accounts = await getMicrosoftAccounts();
  return accounts[0] ?? null;
}

async function buildSilentRequest(account: AccountInfo): Promise<SilentRequest> {
  const authConfig = getMicrosoftAuthConfig();
  if (!authConfig) {
    throw new Error("Microsoft authentication is not configured.");
  }

  return {
    account,
    scopes: authConfig.scopes,
    redirectUri: authConfig.redirectUri,
  };
}

export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  const client = await getClient();
  const authConfig = getMicrosoftAuthConfig();
  if (!authConfig) {
    throw new Error("Microsoft authentication is not configured.");
  }

  return client.loginPopup({
    scopes: authConfig.scopes,
    redirectUri: authConfig.redirectUri,
    prompt: "select_account",
  });
}

export async function signOutMicrosoft() {
  const client = await getClient();
  const account = await getPrimaryMicrosoftAccount();
  await client.logoutPopup({
    account: account ?? undefined,
    mainWindowRedirectUri: window.location.origin,
  });
}

export async function acquireMicrosoftGraphAccessToken() {
  const client = await getClient();
  const account = await getPrimaryMicrosoftAccount();
  if (!account) {
    throw new Error("No Microsoft account is currently signed in.");
  }

  const request = await buildSilentRequest(account);
  const result = await client.acquireTokenSilent(request);
  return result.accessToken;
}
