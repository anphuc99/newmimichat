/**
 * Builds an API URL using a dev-only base URL from Vite environment.
 *
 * In dev, uses VITE_API_BASE_URL when provided. In production, always
 * returns a root-relative path for same-origin requests.
 *
 * @param apiPath - API path starting with "/" (e.g. "/api/health").
 * @returns The final URL string.
 */
export const apiUrl = (apiPath: string) => {
  const isDev = import.meta.env.DEV === true;
  const baseUrl = isDev ? (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "" : "/";

  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;

  if (!baseUrl || baseUrl === "/") {
    return normalizedPath;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return `${normalizedBase}${normalizedPath}`;
};

/**
 * Resolves a relative path into a dev-only base URL or a root-relative path in production.
 *
 * @param assetPath - Path or URL for the asset.
 * @returns Absolute URL string.
 */
export const toAbsoluteUrl = (assetPath: string) => {
  if (!assetPath) {
    return assetPath;
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;

  const isDev = import.meta.env.DEV === true;
  const baseUrl = isDev ? (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "" : "/";

  if (!baseUrl || baseUrl === "/") {
    return normalizedPath;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return `${normalizedBase}${normalizedPath}`;
};
