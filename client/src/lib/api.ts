/**
 * Builds an API URL using an optional base URL from Vite environment.
 *
 * If VITE_API_BASE_URL is not set, this returns the input path unchanged,
 * allowing same-origin requests (e.g. behind a reverse proxy).
 *
 * @param apiPath - API path starting with "/" (e.g. "/api/health").
 * @returns The final URL string.
 */
export const apiUrl = (apiPath: string) => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

  if (!baseUrl) {
    return apiPath;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;

  return `${normalizedBase}${normalizedPath}`;
};

/**
 * Resolves a relative path into an absolute URL using the API base or window origin.
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

  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const normalizedBase = baseUrl
    ? baseUrl.endsWith("/")
      ? baseUrl.slice(0, -1)
      : baseUrl
    : window.location.origin;
  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;

  return `${normalizedBase}${normalizedPath}`;
};
