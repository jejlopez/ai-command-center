// Shared Google OAuth helpers used by gcal + drive adapters.
// gmail.ts predates this helper and still has its own inline calls — left alone
// on purpose (scope rules: don't modify gmail.ts in this pass).

const GOOGLE_OAUTH_URL = "https://oauth2.googleapis.com/token";

export interface ExchangeOpts {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

export interface ExchangeResult {
  refreshToken: string;
  accessToken: string;
  expiresIn: number;
}

export async function exchangeAuthCode(opts: ExchangeOpts): Promise<ExchangeResult> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_OAUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`oauth exchange failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    refresh_token?: string;
    access_token: string;
    expires_in: number;
  };
  if (!data.refresh_token) {
    throw new Error("no refresh_token returned — revoke prior grant and retry with prompt=consent");
  }
  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export interface RefreshOpts {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
}

export async function refreshAccessToken(opts: RefreshOpts): Promise<RefreshResult> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: opts.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_OAUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`token refresh failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export function buildGoogleAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  scope: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: opts.scope,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
