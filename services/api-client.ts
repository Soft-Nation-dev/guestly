export type ApiResponse<T> = { success: true; message: string; data?: T } | { success: false; message: string };
export type ApiHealth = { status: "ok"; database: "connected" | "disconnected" | "connecting" | "disconnecting" | "unknown" };
export type ApiRequestOptions = Omit<RequestInit, "body"> & { body?: unknown; token?: string; baseUrl?: string };

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function apiBaseUrl(override?: string) {
  const address = (override ?? process.env.NEXT_PUBLIC_API_URL ?? "https://guestly-api-zxgm.onrender.com").trim();
  if (!address) throw new ApiError("The backend API URL has not been configured.");
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new ApiError("The backend API URL is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new ApiError("The backend API URL must be an HTTP(S) origin.");
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol !== "https:") {
    throw new ApiError("The hosted website requires an HTTPS backend API URL.");
  }
  return url.origin;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new ApiError("The API path must be relative to the backend origin.");
  const { body, token, baseUrl, headers: providedHeaders, ...request } = options;
  const origin = apiBaseUrl(baseUrl);
  const headers = new Headers(providedHeaders);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (body instanceof FormData) {
      requestBody = body;
    } else {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, { ...request, credentials: "omit", headers, body: requestBody });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Unable to connect to the Guestly backend.");
  }
  if (response.status === 204 && response.ok) return undefined as T;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The backend returned an unreadable response.", response.status);
  }
  if (!payload || typeof payload !== "object" || !("success" in payload) || typeof payload.success !== "boolean") {
    throw new ApiError("The backend returned an unexpected response.", response.status);
  }
  const result = payload as ApiResponse<T>;
  if (!response.ok || !result.success) {
    throw new ApiError(typeof result.message === "string" && result.message ? result.message : "The request could not be completed.", response.status);
  }
  return result.data as T;
}

export function getApiHealth(options: Pick<ApiRequestOptions, "baseUrl" | "signal"> = {}) {
  return apiRequest<ApiHealth>("/health", options);
}


export async function apiRequestBlob(path: string, options: Pick<ApiRequestOptions, "token" | "baseUrl"> = {}) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new ApiError("The API path must be relative to the backend origin.");
  const origin = apiBaseUrl(options.baseUrl);
  const headers = new Headers({ Accept: "image/jpeg,image/png,image/webp" });
  if (options.token) headers.set("Authorization", "Bearer " + options.token);
  let response: Response;
  try {
    response = await fetch(origin + path, { credentials: "omit", cache: "no-store", headers });
  } catch {
    throw new ApiError("Unable to retrieve the identity document.");
  }
  if (!response.ok) {
    let message = "Identity document not available.";
    try {
      const result = await response.json();
      if (typeof result.message === "string") message = result.message;
    } catch {}
    throw new ApiError(message, response.status);
  }
  const kind = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (!kind || !["image/jpeg", "image/png", "image/webp"].includes(kind)) {
    throw new ApiError("The backend returned an unexpected identity document format.");
  }
  const extension = kind === "image/png" ? "png" : kind === "image/jpeg" ? "jpg" : "webp";
  return { blob: await response.blob(), filename: "guestly-identity-document." + extension };
}
