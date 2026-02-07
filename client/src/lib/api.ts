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
