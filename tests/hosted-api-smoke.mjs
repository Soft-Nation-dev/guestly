import assert from "node:assert/strict";

const url = new URL(process.env.NEXT_PUBLIC_API_URL || "");
const frontendOrigin = "https://soft-nation-dev.github.io";
assert.equal(url.protocol, "https:");
assert.equal(url.pathname, "/");
assert.equal(url.search, "");
const base = url.origin;

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { Origin: frontendOrigin, ...(options.headers || {}) },
    signal: AbortSignal.timeout(25000),
  });
  assert.equal(response.headers.get("access-control-allow-origin"), frontendOrigin, path + " CORS");
  if (response.status === 429) {
    assert.ok(response.headers.has("ratelimit") || response.headers.has("retry-after") || response.headers.has("ratelimit-limit"), "Unexpected rate-limit response");
    process.stdout.write("Guestly API reached its request limit. Hosted checks stopped without making additional calls.\n");
    return null;
  }
  return response;
}

async function check(path, status, validate) {
  const response = await request(path);
  if (!response) return null;
  assert.equal(response.status, status, path + " HTTP status");
  const payload = await response.json();
  assert.equal(payload.success, status < 400);
  if (validate) validate(payload.data);
  process.stdout.write("PASS " + path + " (" + status + ")\n");
  return true;
}

async function main() {
  if (!await check("/health", 200, data => assert.equal(data?.status, "ok"))) return;
  if (!await check("/ready", 200, data => assert.equal(data?.database, "connected"))) return;
  if (!await check("/api/v1/rooms", 200, data => assert.ok(Array.isArray(data)))) return;
  if (!await check("/api/v1/servicerequests/catalogue", 200, data => assert.ok(Array.isArray(data)))) return;
  const preflight = await request("/api/v1/auth/login", {
    method: "OPTIONS",
    headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  });
  if (!preflight) return;
  assert.ok(preflight.ok, "Auth CORS preflight failed");
  process.stdout.write("PASS login CORS preflight\n");
  if (!await check("/api/v1/auth/me", 401)) return;
  process.stdout.write("Hosted Guestly API checks passed.\n");
}

main().catch(error => {
  process.stderr.write("Hosted API checks failed: " + error.message + "\n");
  process.exitCode = 1;
});
