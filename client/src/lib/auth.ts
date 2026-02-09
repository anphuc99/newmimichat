export interface AuthUser {
  id: number;
  username: string;
  levelId?: number | null;
  level?: string | null;
  levelDescription?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

const STORAGE_KEY = "mimi_auth";

let hasLoggedStoredAuthParseFailure = false;

/**
 * Loads the stored auth session from local storage.
 *
 * @returns The stored session or null.
 */
export const getStoredAuth = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch (caught) {
    if (!hasLoggedStoredAuthParseFailure) {
      console.warn("Failed to parse stored auth session; clearing stored auth.", caught);
      hasLoggedStoredAuthParseFailure = true;
    }
    return null;
  }
};

/**
 * Persists the auth session to local storage.
 *
 * @param session - Auth session to store.
 */
export const setStoredAuth = (session: AuthSession) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

/**
 * Removes the stored auth session.
 */
export const clearStoredAuth = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};

/**
 * Builds auth headers for API requests.
 *
 * @returns Headers containing the bearer token when available.
 */
export const buildAuthHeaders = () => {
  const session = getStoredAuth();

  if (!session?.token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.token}`
  };
};

/**
 * Wraps fetch to automatically attach authorization headers.
 *
 * @param input - Fetch input.
 * @param init - Fetch init options.
 * @returns A fetch response promise.
 */
export const authFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {});
  const authHeaders = buildAuthHeaders();

  Object.entries(authHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return fetch(input, {
    ...init,
    headers
  });
};
