import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const app = 'http://127.0.0.1:3100';
const api = 'http://127.0.0.1:4100';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Africa/Lagos' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function visit(path) {
  const response = await page.goto(app + path);
  assert.ok(response?.ok(), 'Page unavailable: ' + path);
}
async function login(role) {
  await visit('/login');
  await page.locator('input[name="email"]').fill(role + '@guestly.test');
  await page.locator('input[name="password"]').fill('TestPassword123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/' + role);
}
async function logout() {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/login');
}
async function apiCall(path, options = {}) {
  const token = await page.evaluate(() => sessionStorage.getItem('guestly.api.session.v1'));
  const response = await fetch(api + path, {
    method: options.method || 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json();
  return { status: response.status, ...data };
}
async function setSimulatedClock(value = null) {
  const response = await fetch(api + '/__test/checkin-clock', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ at: value }),
  });
  assert.ok(response.ok);
}

try {
  await setSimulatedClock(null);
  await login('guest');
  const guestLoyalty = await apiCall('/api/v1/loyalty/me');
  assert.equal(guestLoyalty.status, 200);
  assert.equal(guestLoyalty.data.points, 0);
  assert.equal(guestLoyalty.data.source, 'live-verified-stays');
  const oldHistory = await apiCall('/api/v1/reports/historical/bookings');
  assert.equal(oldHistory.status, 403);
  const guestRules = await apiCall('/api/v1/loyalty/rules');
  assert.equal(guestRules.status, 403);
  const suggestions = await apiCall('/api/v1/recommendations/me');
  assert.equal(suggestions.status, 200);
  assert.ok(suggestions.data.length > 0);
  assert.ok(suggestions.data.every(item => item.availabilityConfirmed === false));
  await visit('/guest');
  await page.getByRole('heading', { name: 'Recommended for you' }).waitFor();
  await visit('/guest/loyalty');
  await page.getByRole('heading', { name: 'My loyalty points' }).waitFor();

  const checkin = await apiCall('/api/v1/checkins/me');
  assert.equal(checkin.status, 200);
  const approved = checkin.data.items.find(item => item.status === 'approved');
  assert.ok(approved, 'Earlier approved check-in browser test must leave an approved reservation');
  const approvedBooking = await apiCall('/api/v1/bookings/' + approved.bookingId);
  assert.equal(approvedBooking.status, 200);
  assert.equal(approvedBooking.data.status, 'confirmed');
  await logout();

  await login('manager');
  const reporting = await apiCall('/api/v1/reports/overview');
  assert.equal(reporting.status, 200);
  assert.deepEqual(reporting.data.historical.counts, {
    bookings: 0, guests: 0, payments: 0, requests: 0,
  });
  assert.equal(reporting.data.historical.imported, false);
  assert.equal(reporting.data.historical.distinctGuestIds, 0);
  assert.equal(reporting.data.historical.conflictingGuestIds, 0);
  assert.equal(reporting.data.historical.successfulPayments, 0);
  assert.equal(reporting.data.historical.verifiedGatewayPayments, 0);
  assert.equal(reporting.data.historical.eligibleLoyaltyAwards, 0);
  assert.equal(reporting.data.live.source, 'live-verified');
  assert.ok(reporting.data.live.verifiedPayments > 0);
  assert.ok(reporting.data.live.verifiedRevenueKobo > 0);
  const sourceRows = await apiCall('/api/v1/reports/historical/guests?limit=100');
  assert.equal(sourceRows.status, 200);
  assert.equal(sourceRows.data.total, 0);
  const sourceIds = sourceRows.data.items.map(item => item.sourceId);
  assert.equal(sourceIds.length, 0);
  const bookings = await apiCall('/api/v1/reports/historical/bookings?q=B0001&limit=10');
  assert.equal(bookings.status, 200);
  assert.equal(bookings.data.total, 0);
  assert.deepEqual(bookings.data.items, []);
  const payments = await apiCall('/api/v1/reports/historical/payments?status=Refunded&limit=10');
  assert.equal(payments.status, 200);
  assert.equal(payments.data.total, 0);

  await visit('/manager');
  await page.getByRole('heading', { name: 'Historical Data Analyst records' }).waitFor();
  await page.getByRole('heading', { name: 'Historical import pending' }).waitFor();
  await page.getByText('Verified Paystack revenue').first().waitFor();
  await visit('/manager/bookings');
  await page.getByRole('heading', { name: 'Imported booking records' }).waitFor();
  await page.getByText('No matching historical records', { exact: false }).waitFor();
  await visit('/manager/services');
  await page.getByRole('heading', { name: 'Imported service records' }).waitFor();
  await page.getByText('No matching historical records', { exact: false }).waitFor();

  await visit('/manager/loyalty');
  await page.getByRole('heading', { name: 'Loyalty management' }).waitFor();
  await page.getByRole('spinbutton', { name: 'Points per night' }).fill('23');
  await page.getByRole('button', { name: 'Save future earning rule' }).click();
  await page.getByText('The new rule will apply only to eligible stays').waitFor();
  const newRules = await apiCall('/api/v1/loyalty/rules');
  assert.equal(newRules.status, 200);
  assert.equal(newRules.data.at(-1).pointsPerNight, 23);
  await logout();

  await login('guest');
  await setSimulatedClock(approvedBooking.data.checkOut + 'T13:00:00+01:00');
  await visit('/guest/loyalty');
  await page.getByRole('heading', { name: 'My loyalty points' }).waitFor();
  const after = await apiCall('/api/v1/loyalty/me');
  assert.equal(after.status, 200);
  assert.ok(after.data.points >= 23);
  assert.ok(after.data.awards.some(item => item.bookingId === approvedBooking.data.id));
  const totalBefore = after.data.points;
  const repeated = await apiCall('/api/v1/loyalty/me');
  assert.equal(repeated.data.points, totalBefore);
  assert.equal(repeated.data.total, after.data.total);
  await page.reload();
  await page.getByText('Your verified point balance').waitFor();

  await logout();
  await login('manager');
  const reconciled = await apiCall('/api/v1/loyalty/reconcile', { method: 'POST' });
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.data.created, 0);
  const manager = await apiCall('/api/v1/loyalty/manager');
  assert.equal(manager.status, 200);
  assert.equal(manager.data.points, totalBefore);
  await visit('/manager/loyalty');
  await page.getByText('Total active verified points').waitFor();
  const fit = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, width: window.innerWidth }));
  assert.ok(fit.body <= fit.width + 2, 'Mobile horizontal overflow after Group 7');
  assert.deepEqual(errors, []);
  process.stdout.write('Historical source integrity, verified loyalty and personalized recommendations browser checks passed\n');
} finally {
  await browser.close();
}
