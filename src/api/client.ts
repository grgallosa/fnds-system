const TOKEN_STORAGE_KEY = "isp_auth_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Lets AuthContext react immediately whenever ANY request comes back 401
// (expired token, secret rotation, revoked session, etc.) instead of only
// checking auth once on page load - previously a 401 mid-session cleared the
// stored token but left the React `user` state (and the whole app shell)
// looking logged-in while every subsequent request silently 401'd.
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiRequestError extends Error {
  status: number;
  details?: Array<{ field: string; message: string }>;
  constructor(status: number, message: string, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json() : undefined;

  if (!res.ok) {
    if (res.status === 401) {
      const hadToken = !!token;
      clearToken();
      // Only trigger the "session ended" flow if we actually thought we were
      // logged in - avoids interfering with the logged-out login screen itself.
      if (hadToken) onUnauthorized?.();
    }
    throw new ApiRequestError(
      res.status,
      payload?.error || `Request failed with status ${res.status}`,
      payload?.details
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
