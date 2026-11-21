import { apiRequest } from "@/services/api-client";
import { authorizedRequest } from "@/services/backend-auth";
import type { Account, Role } from "@/types/auth";
import type { ServiceCategory } from "@/types/management";
import type { ServiceRequest, RequestStatus } from "@/types/experience";

type Page<T> = { items: T[]; total: number; page: number; limit: number };
type CatalogueState = { services: ServiceCategory[]; loaded: boolean; loading: boolean; error: string };
type RequestsState = { requests: ServiceRequest[]; total: number; page: number; loading: boolean; error: string };

const event = "guestly:live-services";
const initialCatalogue: CatalogueState = { services: [], loaded: false, loading: false, error: "" };
const initialRequests: RequestsState = { requests: [], total: 0, page: 1, loading: false, error: "" };
let catalogue = initialCatalogue;
let requests = initialRequests;
let catalogueScope = "";
let requestIdentity = "";
let catalogueRevision = 0;
let requestRevision = 0;
let cataloguePromise: Promise<void> | null = null;
let requestPromise: Promise<void> | null = null;
let requestsLoaded = false;

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(event));
}

function setCatalogue(changes: Partial<CatalogueState>) {
  catalogue = { ...catalogue, ...changes };
  announce();
}

function setRequests(changes: Partial<RequestsState>) {
  requests = { ...requests, ...changes };
  announce();
}

export function subscribeLiveServices(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}

export function catalogueSnapshot() {
  return JSON.stringify(catalogue);
}

export function catalogueServerSnapshot() {
  return JSON.stringify(initialCatalogue);
}

export function requestsSnapshot() {
  return JSON.stringify(requests);
}

export function requestsServerSnapshot() {
  return JSON.stringify(initialRequests);
}

export function resetLiveRequests() {
  requestRevision++;
  requestIdentity = "";
  requestPromise = null;
  requestsLoaded = false;
  requests = initialRequests;
  announce();
}

export async function refreshServiceCatalogue(role: Role | null, force = false) {
  const scope = role === "manager" ? "manager" : "public";
  if (scope !== catalogueScope) {
    catalogueRevision++;
    catalogueScope = scope;
    cataloguePromise = null;
    catalogue = initialCatalogue;
  }
  if (cataloguePromise) return cataloguePromise;
  if (catalogue.loaded && !force) return;
  const revision = catalogueRevision;
  setCatalogue({ loading: true, error: "" });
  cataloguePromise = (async () => {
    try {
      const path = scope === "manager" ? "/api/v1/servicerequests/catalogue/manage" : "/api/v1/servicerequests/catalogue";
      const result = scope === "manager" ? await authorizedRequest<ServiceCategory[]>(path) : await apiRequest<ServiceCategory[]>(path);
      if (revision !== catalogueRevision) return;
      setCatalogue({ services: result, loaded: true, loading: false, error: "" });
    } catch (cause) {
      if (revision !== catalogueRevision) return;
      setCatalogue({ loading: false, error: cause instanceof Error ? cause.message : "Could not load hotel services." });
      throw cause;
    } finally {
      if (revision === catalogueRevision) cataloguePromise = null;
    }
  })();
  return cataloguePromise;
}

export async function saveBackendService(input: Omit<ServiceCategory, "id">, id?: string) {
  const result = await authorizedRequest<ServiceCategory>(
    id ? "/api/v1/servicerequests/catalogue/" + encodeURIComponent(id) : "/api/v1/servicerequests/catalogue",
    { method: id ? "PATCH" : "POST", body: input },
  );
  setCatalogue({
    services: id ? catalogue.services.map(item => item.id === id ? result : item) : [...catalogue.services, result],
    loaded: true, error: "",
  });
  return result;
}

export async function refreshLiveRequests(account: Pick<Account, "id" | "role">, force = false) {
  if (!["guest", "staff", "manager"].includes(account.role)) return;
  const key = account.role + ":" + account.id;
  if (requestIdentity !== key) {
    requestRevision++;
    requestIdentity = key;
    requestPromise = null;
    requestsLoaded = false;
    requests = initialRequests;
  }
  if (requestPromise) return requestPromise;
  if (requestsLoaded && !force) return;
  const revision = requestRevision;
  setRequests({ loading: true, error: "" });
  const path = account.role === "guest" ? "/api/v1/servicerequests/me" : "/api/v1/servicerequests";
  requestPromise = (async () => {
    try {
      const result = await authorizedRequest<Page<ServiceRequest>>(path + "?page=1&limit=100");
      if (revision !== requestRevision) return;
      requestsLoaded = true;
      setRequests({ requests: result.items, total: result.total, page: result.page, loading: false, error: "" });
    } catch (cause) {
      if (revision !== requestRevision) return;
      setRequests({ loading: false, error: cause instanceof Error ? cause.message : "Could not retrieve requests." });
      throw cause;
    } finally {
      if (revision === requestRevision) requestPromise = null;
    }
  })();
  return requestPromise;
}

export async function loadMoreLiveRequests(account: Pick<Account, "id" | "role">) {
  if (requests.loading || requestIdentity !== account.role + ":" + account.id || requests.requests.length >= requests.total) return;
  const next = requests.page + 1;
  const path = account.role === "guest" ? "/api/v1/servicerequests/me" : "/api/v1/servicerequests";
  setRequests({ loading: true, error: "" });
  try {
    const result = await authorizedRequest<Page<ServiceRequest>>(path + "?page=" + next + "&limit=100");
    if (requestIdentity !== account.role + ":" + account.id) return;
    const known = new Set(requests.requests.map(item => item.id));
    setRequests({ requests: [...requests.requests, ...result.items.filter(item => !known.has(item.id))], total: result.total, page: result.page, loading: false });
  } catch (cause) {
    setRequests({ loading: false, error: cause instanceof Error ? cause.message : "Could not load more requests." });
  }
}

export async function createBackendServiceRequest(input: { bookingId: string; categoryId: string; details: string }) {
  const result = await authorizedRequest<ServiceRequest>("/api/v1/servicerequests", { method: "POST", body: input });
  setRequests({ requests: [result, ...requests.requests], total: requests.total + 1 });
  return result;
}

export async function advanceBackendServiceRequest(id: string, next: Exclude<RequestStatus, "received">) {
  const result = await authorizedRequest<ServiceRequest>("/api/v1/servicerequests/" + encodeURIComponent(id) + "/status", {
    method: "PATCH", body: { status: next },
  });
  setRequests({ requests: requests.requests.map(item => item.id === id ? result : item) });
  return result;
}
