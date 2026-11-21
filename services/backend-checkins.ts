import { authorizedRequest, authorizedDownload } from "@/services/backend-auth";
import type { Account } from "@/types/auth";
import type { CheckIn, DocumentKind } from "@/types/experience";

export type SimulatedAccess = {
  bookingId: string;
  status: "unavailable" | "scheduled" | "active" | "expired";
  code: string | null;
  simulated: true;
  validFrom: string | null;
  expiresAt: string | null;
};

type Page<T> = { items: T[]; total: number; page: number; limit: number };
type State = { checkIns: CheckIn[]; total: number; page: number; loading: boolean; error: string };

const initial: State = { checkIns: [], total: 0, page: 1, loading: false, error: "" };
const initialSnapshot = JSON.stringify(initial);
const eventName = "guestly:backend-checkins";
let state = initial;
let identity = "";
let loaded = false;
let request: Promise<void> | null = null;
let revision = 0;

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(eventName));
}

function setState(changes: Partial<State>) {
  state = { ...state, ...changes };
  announce();
}

export function checkInSnapshot() {
  return JSON.stringify(state);
}

export function checkInServerSnapshot() {
  return initialSnapshot;
}

export function subscribeCheckIns(listener: () => void) {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}

export function resetBackendCheckIns() {
  revision++;
  identity = "";
  loaded = false;
  request = null;
  state = initial;
  announce();
}

export async function refreshBackendCheckIns(account: Pick<Account, "id" | "role">, force = false) {
  if (!["guest", "staff"].includes(account.role)) return;
  const key = account.role + ":" + account.id;
  if (identity !== key) {
    revision++;
    identity = key;
    loaded = false;
    request = null;
    state = initial;
  }
  if (request) return request;
  if (loaded && !force) return;
  const current = revision;
  setState({ loading: true, error: "" });
  const path = account.role === "guest" ? "/api/v1/checkins/me" : "/api/v1/checkins";
  request = (async () => {
    try {
      const response = await authorizedRequest<Page<CheckIn>>(path + "?page=1&limit=100");
      if (current !== revision) return;
      loaded = true;
      setState({ checkIns: response.items, total: response.total, page: response.page, loading: false, error: "" });
    } catch (cause) {
      if (current !== revision) return;
      setState({ loading: false, error: cause instanceof Error ? cause.message : "Unable to load check-ins." });
      throw cause;
    } finally {
      if (current === revision) request = null;
    }
  })();
  return request;
}

export async function loadMoreCheckIns(account: Pick<Account, "id" | "role">) {
  if (state.loading || identity !== account.role + ":" + account.id || state.checkIns.length >= state.total) return;
  const page = state.page + 1;
  const path = account.role === "guest" ? "/api/v1/checkins/me" : "/api/v1/checkins";
  setState({ loading: true, error: "" });
  try {
    const response = await authorizedRequest<Page<CheckIn>>(path + "?page=" + page + "&limit=100");
    if (identity !== account.role + ":" + account.id) return;
    const known = new Set(state.checkIns.map(item => item.bookingId));
    setState({ checkIns: [...state.checkIns, ...response.items.filter(item => !known.has(item.bookingId))], total: response.total, page, loading: false });
  } catch (cause) {
    setState({ loading: false, error: cause instanceof Error ? cause.message : "Unable to load more check-ins." });
  }
}

export async function submitBackendCheckIn(input: { bookingId: string; arrivalTime: string; documentKind: DocumentKind; document: File }) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(input.document.type) || input.document.size > 2 * 1024 * 1024 || input.document.size < 8) {
    throw new Error("Choose a valid JPEG, PNG or WebP ID image under 2 MB.");
  }
  const data = new FormData();
  data.set("bookingId", input.bookingId);
  data.set("arrivalTime", input.arrivalTime);
  data.set("documentKind", input.documentKind);
  data.set("document", input.document);
  const result = await authorizedRequest<CheckIn>("/api/v1/checkins", { method: "POST", body: data });
  const existing = state.checkIns.some(item => item.bookingId === result.bookingId);
  setState({
    checkIns: [result, ...state.checkIns.filter(item => item.bookingId !== result.bookingId)],
    total: state.total + (existing ? 0 : 1),
  });
  return result;
}

export async function reviewBackendCheckIn(bookingId: string, approved: boolean, note: string) {
  const result = await authorizedRequest<CheckIn>("/api/v1/checkins/" + encodeURIComponent(bookingId) + "/review", {
    method: "PATCH", body: { approved, note },
  });
  setState({ checkIns: state.checkIns.map(item => item.bookingId === bookingId ? result : item) });
  return result;
}

export async function downloadBackendIdentity(bookingId: string) {
  const { blob, filename } = await authorizedDownload("/api/v1/checkins/" + encodeURIComponent(bookingId) + "/document");
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export function getBackendAccess(bookingId: string) {
  return authorizedRequest<SimulatedAccess>("/api/v1/roomkeys/" + encodeURIComponent(bookingId));
}
