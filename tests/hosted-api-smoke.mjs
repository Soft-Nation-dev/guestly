import assert from "node:assert/strict";

const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const frontendOrigin = "https://soft-nation-dev.github.io";

assert.ok(baseUrl, "NEXT_PUBLIC_API_URL is required for hosted API checks");
const parsed = new URL(baseUrl);
assert.equal(parsed.protocol, "https:", "The hosted API must use HTTPS");
assert.equal(parsed.pathname, "/", "The API URL must not include a path");
assert.equal(parsed.search, "", "The API URL must not include query parameters");
const base = parsed.origin;

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(base + path, {
        ...options,
        headers: { Origin: frontendOrigin, ...(options.headers || {}) },
        signal: AbortSignal.timeout(25000),
      });
      if (response.status < 500 || attempt === 5) return response;
      lastError = new Error(path + " returned HTTP " + response.status);
    } catch (error) {
      lastError = error;
    }
    await pause(3000 * attempt);
  }
  throw new Error("Unable to reach " + path + ": " + (lastError?.message || "unknown error"));
}

async function json(path, status, validate) {
  const response = await request(path);
  assert.equal(response.status, status, path + " returned HTTP " + response.status);
  assert.equal(response.headers.get("access-control-allow-origin"), frontendOrigin, path + " CORS origin");
  const payload = await response.json();
  assert.equal(payload.success, status < 400, path + " success flag");
  assert.equal(typeof payload.message, "string", path + " message");
  if (validate) validate(payload.data);
  process.stdout.write("PASS " + path + " (" + status + ")\n");
  return payload.data;
}

async function run() {
  const health = await json("/health", 200, data => {
    assert.equal(data?.status, "ok");
  });
  assert.ok(health.database, "Missing database state");
  await json("/ready", 200, data => {
    assert.equal(data?.database, "connected");
  });

  const rooms = await json("/api/v1/rooms", 200, data => {
    assert.ok(Array.isArray(data), "Room catalogue must be an array");
    for (const room of data) {
      assert.equal(typeof room.id, "string", "Room ID");
      assert.equal(typeof room.name, "string", "Room name");
      assert.equal(typeof room.nightlyRate, "number", "Nightly rate");
    }
  });
  await json("/api/v1/hotels/current", 200, data => {
    assert.equal(typeof data?.name, "string", "Hotel profile name");
  });
  await json("/api/v1/servicerequests/catalogue", 200, data => {
    assert.ok(Array.isArray(data), "Service catalogue must be an array");
  });

  const start = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  const availability = "/api/v1/rooms/availability?" + new URLSearchParams({
    checkIn: start, checkOut: end, guests: "2",
  });
  await json(availability, 200, data => {
    assert.ok(Array.isArray(data), "Availability must be an array");
    for (const room of data) {
      assert.equal(typeof room.availableInventory, "number", "Available inventory");
    }
  });

  const preflight = await request("/api/v1/auth/login", {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.ok(preflight.ok, "Authentication CORS preflight failed");
  assert.equal(preflight.headers.get("access-control-allow-origin"), frontendOrigin, "CORS origin");
  process.stdout.write("PASS /api/v1/auth/login (CORS preflight)\n");

  for (const path of [
    "/api/v1/auth/me",
    "/api/v1/users/team",
    "/api/v1/bookings/me",
    "/api/v1/bookings",
    "/api/v1/payments/me",
    "/api/v1/payments",
    "/api/v1/checkins/me",
    "/api/v1/checkins",
    "/api/v1/roomkeys/unavailable",
    "/api/v1/servicerequests/me",
    "/api/v1/servicerequests",
    "/api/v1/concierge/me",
    "/api/v1/concierge/conversations",
    "/api/v1/reports/overview",
    "/api/v1/reports/historical/bookings",
    "/api/v1/loyalty/me",
    "/api/v1/loyalty/manager",
    "/api/v1/recommendations/me",
  ]) {
    await json(path, 401);
  }

  const badLogin = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(badLogin.status, 400, "Invalid login input must be rejected");
  process.stdout.write("PASS /api/v1/auth/login (input validation)\n");

  process.stdout.write("Hosted API checks passed. " + rooms.length + " live room types found.\n");
  process.stdout.write("Account workflows, payment, approvals and guest/staff operations still require authorized end-to-end testing.\n");
}

run().catch(error => {
  process.stderr.write("Hosted API checks failed: " + error.message + "\n");
  process.exitCode = 1;
});
