import http from 'node:http';
import { randomUUID } from 'node:crypto';

const users = new Map();
const sessions = new Map();
const revoked = new Set();
const sharedPassword = 'TestPassword123';
const bookings = [];
const payments = [];
const audit = [];
const serviceRequests = [];
const conciergeMessages = [];
const serviceCatalogue = [
  ['Housekeeping','Request room cleaning and housekeeping.'],
  ['Airport Transfer','Airport pickup assistance.'],
  ['Maintenance','Help with room equipment.'],
  ['Room Service','Food and refreshments in your room.'],
  ['Extra Towels','Fresh towels for your room.'],
  ['Laundry','Laundry assistance.'],
  ['Restaurant','Hotel dining requests.'],
].map(([name,description],index) => ({ id: '507f1f77bcf86cd7994390' + String(index + 10), name, description, active: true }));
const checkins = [];
const historicalFiles = ['bookings', 'guests', 'payments', 'service-requests'];
const historicalData = Object.fromEntries(historicalFiles.map(source => [source, []]));
const loyaltyRules = [{ pointsPerNight: 10, effectiveAt: '1970-01-01T00:00:00.000Z' }];
const loyaltyAwards = [];
let simulatedNow = null;

function pageItems(items, url) {
  const page = Number(url.searchParams.get('page') || 1);
  const limit = Number(url.searchParams.get('limit') || 30);
  return { items: items.slice((page - 1) * limit, page * limit), page, limit, total: items.length };
}

function record(action, bookingId, paymentId) {
  audit.unshift({
    id: randomUUID().slice(0, 24), action, bookingId: bookingId || null,
    paymentId: paymentId || null, createdAt: new Date().toISOString(),
  });
}

function publicCheckin(item) {
  const data = { ...item };
  delete data.nonce;
  return data;
}

function hotelToday() {
  const pieces = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = name => pieces.find(part => part.type === name).value;
  return value('year') + '-' + value('month') + '-' + value('day');
}

function historicalReport() {
  const b = historicalData.bookings, g = historicalData.guests, p = historicalData.payments, r = historicalData['service-requests'];
  const profiles = new Map();
  for (const entry of g) {
    const set = profiles.get(entry.Guest_ID) || new Set();
    set.add(JSON.stringify(entry));
    profiles.set(entry.Guest_ID, set);
  }
  const successful = p.filter(entry => entry.Payment_Status === 'Successful');
  const average = values => values.length ? values.reduce((sum, x) => sum + x, 0) / values.length : 0;
  const statuses = (items, field, names) => names.map(name => ({ name, count: items.filter(entry => entry[field] === name).length }));
  const months = [...new Set(p.map(entry => entry.Booking_Date.slice(0, 7)))].sort().map(month => {
    const rows = successful.filter(entry => entry.Booking_Date.startsWith(month));
    return { month, revenue: rows.reduce((sum, entry) => sum + entry.Total_Revenue_NGN, 0), count: rows.length };
  });
  const rooms = [...new Set(b.map(entry => entry.Room_Type))].sort().map(name => {
    const rows = b.filter(entry => entry.Room_Type === name);
    return { name, count: rows.length, averageRate: Math.round(average(rows.map(entry => entry.Nightly_Rate_NGN))) };
  });
  const services = [...new Set(r.map(entry => entry.Service_Request_Type))].sort().map(name => {
    const rows = r.filter(entry => entry.Service_Request_Type === name);
    return {
      name, count: rows.length, response: average(rows.map(entry => entry.Service_Response_Time_Min)),
      resolution: average(rows.map(entry => entry.Service_Resolution_Time_Min)),
      satisfaction: average(rows.map(entry => entry.Guest_Satisfaction_1_5)),
    };
  });
  const dates = b.map(entry => entry.Booking_Date).sort();
  return {
    imported: false, source: 'historical-data-analyst',
    counts: { bookings: b.length, guests: g.length, payments: p.length, requests: r.length },
    distinctGuestIds: profiles.size,
    conflictingGuestIds: [...profiles.values()].filter(values => values.size > 1).length,
    completed: b.filter(entry => entry.Booking_Status === 'Completed').length,
    successfulPayments: successful.length,
    historicalSuccessfulRevenueNGN: successful.reduce((sum, entry) => sum + entry.Total_Revenue_NGN, 0),
    verifiedGatewayPayments: 0, eligibleLoyaltyAwards: 0,
    returningBookings: b.filter(entry => entry.Returning_Guest === 'Yes').length,
    satisfaction: average(r.map(entry => entry.Guest_Satisfaction_1_5)),
    response: average(r.map(entry => entry.Service_Response_Time_Min)),
    resolution: average(r.map(entry => entry.Service_Resolution_Time_Min)),
    bookingOutcomes: statuses(b, 'Booking_Status', ['Completed', 'Cancelled', 'Abandoned']),
    paymentOutcomes: statuses(p, 'Payment_Status', ['Successful', 'Failed', 'Pending', 'Refunded']),
    months, rooms, services, from: dates[0], to: dates.at(-1),
  };
}

function reconcileAwards() {
  let created = 0;
  for (const booking of bookings) {
    const checkout = new Date(booking.checkOut + 'T12:00:00+01:00');
    if (booking.status !== 'confirmed' || checkout > (simulatedNow || new Date())) continue;
    const checkin = checkins.find(item => item.bookingId === booking.id && item.status === 'approved');
    const payment = payments.find(item => item.bookingId === booking.id && item.status === 'success' && item.guestId === booking.guestId && item.amount === booking.amount * 100);
    if (!checkin || !payment || loyaltyAwards.some(item => item.bookingId === booking.id)) continue;
    const rule = [...loyaltyRules].filter(item => new Date(item.effectiveAt) <= checkout).at(-1);
    if (!rule) continue;
    const nights = Math.round((Date.parse(booking.checkOut) - Date.parse(booking.checkIn)) / 86400000);
    loyaltyAwards.push({
      id: randomUUID().replaceAll('-', '').slice(0, 24),
      guestId: booking.guestId, bookingId: booking.id, roomName: booking.roomName,
      checkoutDate: booking.checkOut, nights, pointsPerNight: rule.pointsPerNight,
      points: nights * rule.pointsPerNight, awardedAt: (simulatedNow || new Date()).toISOString(), revokedAt: null,
    });
    created++;
  }
  return { created, revoked: 0, guestsChecked: new Set(bookings.map(item => item.guestId)).size };
}

function loyaltySummary(url, guestId) {
  const entries = loyaltyAwards.filter(item => !guestId || item.guestId === guestId);
  return {
    source: 'live-verified-stays', points: entries.filter(item => !item.revokedAt).reduce((sum, item) => sum + item.points, 0),
    ...pageItems(entries, url), awards: pageItems(entries, url).items,
    rules: [loyaltyRules.at(-1)],
  };
}

function publicMessage(item) {
  const data = { ...item };
  delete data.guestName;
  return data;
}

function humanConversations() {
  const grouped = new Map();
  for (const message of conciergeMessages) {
    if (!grouped.has(message.guestId)) grouped.set(message.guestId, {
      guestId: message.guestId, guestName: message.guestName, sender: message.sender,
      lastText: message.text, updatedAt: message.createdAt, waiting: message.sender === 'guest',
    });
  }
  return [...grouped.values()];
}

function bookingForPayment(reference) {
  const payment = payments.find(item => item.reference === reference);
  return { payment, booking: bookings.find(item => item.id === payment?.bookingId) };
}
let hotel = {
  id: 'primary', name: 'Guestly', tagline: 'Your comfort, our priority.',
  description: 'A more thoughtful stay, from the moment you book to the moment you leave.',
  location: 'Lagos, Nigeria', currency: 'NGN', heroImage: '/images/deluxe-executive-suite.jpg',
};
const rooms = [
  {
    id: 'standard-cozy-haven', name: 'Standard Cozy Haven', category: 'Standard',
    image: '/images/standard-cozy-haven.jpg', nightlyRate: 55000, capacity: 2,
    size: 34, bed: 'Queen bed', view: 'City view', amenities: ['Wi-Fi'],
    description: 'A welcoming room', inventory: 3, featured: true,
  },
  {
    id: 'deluxe-executive-suite', name: 'Deluxe Executive Suite', category: 'Executive',
    image: '/images/deluxe-executive-suite.jpg', nightlyRate: 85000, capacity: 2,
    size: 62, bed: 'King bed', view: 'City view', amenities: ['High-speed Wi-Fi'],
    description: 'Room with a view', inventory: 2, featured: true,
  },
];

function addUser(firstName, lastName, email, role, password = sharedPassword) {
  const user = {
    id: randomUUID().replaceAll('-', '').slice(0, 24),
    firstName, lastName, email, role, isActive: true, phone: '',
    password,
  };
  users.set(email, user);
  return user;
}

addUser('Alex', 'Morgan', 'guest@guestly.test', 'guest');
addUser('Amina', 'Bello', 'staff@guestly.test', 'staff');
addUser('Tunde', 'Adeyemi', 'manager@guestly.test', 'manager');
addUser('Guestly', 'Admin', 'admin@guestly.test', 'admin');

function publicUser(user) {
  const { password, ...profile } = user;
  return profile;
}

function json(res, status, success, message, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success, message, ...(data === undefined ? {} : { data }) }));
}

function session(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token || revoked.has(token)) return null;
  const email = sessions.get(token);
  const user = users.get(email);
  return user?.isActive ? { token, user } : null;
}

async function requestMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!match) throw new Error('Expected multipart body');
  const boundary = '--' + (match[1] || match[2]);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 3 * 1024 * 1024) throw new Error('Body too large');
    chunks.push(chunk);
  }
  const sections = Buffer.concat(chunks).toString('latin1').split(boundary);
  const fields = {};
  let validDocument = false;
  for (const section of sections) {
    const start = section.indexOf('\r\n\r\n');
    if (start < 0) continue;
    const header = section.slice(0, start);
    const name = header.match(/name="([^"]+)"/)?.[1];
    const value = section.slice(start + 4).replace(/\r\n$/, '');
    if (name === 'document') validDocument = header.includes('image/png') && value.startsWith('\x89PNG');
    else if (name) fields[name] = value;
  }
  return { fields, validDocument };
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', part => { value += part; if (value.length > 100000) reject(new Error('Body too large')); });
    req.on('end', () => {
      try { resolve(value ? JSON.parse(value) : {}); }
      catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3100');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Email');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url || '/', 'http://127.0.0.1:4100');
  try {
    if (url.pathname === '/api/v1/auth/register' && req.method === 'POST') {
      const data = await requestBody(req);
      if (users.has(data.email)) return json(res, 409, false, 'Email is already registered');
      if (data.password !== data.confirmPassword) return json(res, 400, false, 'Passwords do not match');
      const user = addUser(data.firstName, data.lastName, data.email, 'guest', data.password);
      return json(res, 201, true, 'Account created successfully', publicUser(user));
    }
    if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') {
      const data = await requestBody(req);
      const user = users.get(data.email);
      if (!user || user.password !== data.password) return json(res, 401, false, 'Invalid email or password');
      if (!user.isActive) return json(res, 403, false, 'Your account is inactive');
      const token = randomUUID();
      sessions.set(token, user.email);
      return json(res, 200, true, 'Login successful', { token, user: publicUser(user) });
    }
    if (url.pathname === '/__test/revoke' && req.method === 'POST') {
      for (const [token, email] of sessions) {
        if (email === req.headers['x-email']) revoked.add(token);
      }
      return json(res, 200, true, 'Revoked');
    }
    if (url.pathname === '/api/v1/hotels/current' && req.method === 'GET') {
      return json(res, 200, true, 'Hotel retrieved', hotel);
    }
    if (url.pathname === '/api/v1/servicerequests/catalogue' && req.method === 'GET') {
      return json(res, 200, true, 'Service catalogue retrieved', serviceCatalogue.filter(item => item.active));
    }
    if (url.pathname === '/api/v1/rooms' && req.method === 'GET') {
      return json(res, 200, true, 'Rooms retrieved', rooms);
    }
    if (url.pathname === '/api/v1/rooms/availability' && req.method === 'GET') {
      const guests = Number(url.searchParams.get('guests'));
      const available = rooms.filter(room => room.capacity >= guests && room.inventory > 0)
        .map(room => {
          const held = bookings.filter(item => item.roomId === room.id && ['pending', 'confirmed'].includes(item.status) &&
            item.checkIn < url.searchParams.get('checkOut') && item.checkOut > url.searchParams.get('checkIn')).length;
          return { ...room, availableInventory: Math.max(0, room.inventory - 1 - held) };
        })
        .filter(room => room.availableInventory > 0);
      return json(res, 200, true, 'Availability retrieved', available);
    }
    if (url.pathname === '/__test/checkin-clock' && req.method === 'POST') {
      const data = await requestBody(req);
      simulatedNow = data.at ? new Date(data.at) : null;
      return json(res, 200, true, 'Clock updated');
    }
    if (url.pathname === '/__test/pay' && req.method === 'POST') {
      const data = await requestBody(req);
      const { payment, booking } = bookingForPayment(data.reference);
      if (!payment || !booking) return json(res, 404, false, 'Missing payment');
      if (booking.status === 'pending') {
        booking.status = 'confirmed';
        payment.status = 'success';
        record('payment.succeeded', booking.id, payment.id);
        record('booking.confirmed', booking.id, payment.id);
      } else {
        payment.status = 'refund_required';
        record('payment.refund_required', booking.id, payment.id);
      }
      payment.paidAt = new Date().toISOString();
      return json(res, 200, true, 'Payment verified', { reference: payment.reference, status: payment.status });
    }
    const active = session(req);
    if (!active) return json(res, 401, false, 'Invalid or expired session');
    if (url.pathname === '/api/v1/auth/me' && req.method === 'GET') {
      return json(res, 200, true, 'Profile retrieved', publicUser(active.user));
    }
    if (url.pathname === '/api/v1/auth/me' && req.method === 'PATCH') {
      const data = await requestBody(req);
      for (const field of ['firstName', 'lastName', 'phone']) {
        if (typeof data[field] === 'string') active.user[field] = data[field];
      }
      return json(res, 200, true, 'Profile updated', publicUser(active.user));
    }
    if (url.pathname === '/api/v1/auth/logout' && req.method === 'POST') {
      revoked.add(active.token);
      return json(res, 200, true, 'Signed out');
    }
    if (url.pathname === '/api/v1/hotels/current' && req.method === 'PATCH') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const fields = await requestBody(req);
      hotel = { ...hotel, ...fields };
      return json(res, 200, true, 'Hotel updated', hotel);
    }
    if (url.pathname === '/api/v1/rooms' && req.method === 'POST') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const fields = await requestBody(req);
      const room = { ...fields, id: fields.name.toLowerCase().replaceAll(/\s+/g, '-') + '-new' };
      rooms.push(room);
      return json(res, 201, true, 'Room created', room);
    }
    const roomMatch = url.pathname.match(/^\/api\/v1\/rooms\/([a-z0-9-]+)$/);
    if (roomMatch && req.method === 'PATCH') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const room = rooms.find(item => item.id === roomMatch[1]);
      if (!room) return json(res, 404, false, 'Room type not found');
      Object.assign(room, await requestBody(req));
      return json(res, 200, true, 'Room updated', room);
    }
    if (url.pathname === '/api/v1/bookings' && req.method === 'POST') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const data = await requestBody(req);
      if (data.totalAmount || data.status) return json(res, 400, false, 'Invalid booking fields');
      const old = bookings.find(item => item.guestId === active.user.id && item.requestId === data.requestId);
      if (old) return json(res, 201, true, 'Booking hold created', old);
      const room = rooms.find(item => item.id === data.roomId);
      if (!room || room.inventory <= 0 || data.guests > room.capacity || data.checkIn >= data.checkOut) {
        return json(res, 409, false, 'Room unavailable');
      }
      const nights = Math.round((Date.parse(data.checkOut) - Date.parse(data.checkIn)) / 86400000);
      const confirmed = bookings.filter(item => item.roomId === room.id && ['pending', 'confirmed'].includes(item.status) &&
        item.checkIn < data.checkOut && item.checkOut > data.checkIn);
      if (confirmed.length >= room.inventory) return json(res, 409, false, 'Room unavailable');
      const booking = {
        id: randomUUID().replaceAll('-', '').slice(0, 24),
        guestId: active.user.id, guestName: active.user.firstName + ' ' + active.user.lastName,
        roomId: room.id, roomName: room.name, checkIn: data.checkIn, checkOut: data.checkOut,
        guests: data.guests, quantity: 1, nightlyRate: room.nightlyRate,
        amount: room.nightlyRate * nights, currency: 'NGN', status: 'pending',
        paymentReference: '', requestId: data.requestId, createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      };
      bookings.unshift(booking);
      record('booking.held', booking.id);
      return json(res, 201, true, 'Booking hold created', booking);
    }
    if (url.pathname === '/api/v1/bookings/me' && req.method === 'GET') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Bookings retrieved', pageItems(bookings.filter(item => item.guestId === active.user.id), url));
    }
    if (url.pathname === '/api/v1/bookings' && req.method === 'GET') {
      if (!['staff', 'manager'].includes(active.user.role)) return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Bookings retrieved', pageItems(bookings, url));
    }
    const bookingRoute = url.pathname.match(/^\/api\/v1\/bookings\/([a-f0-9]{24})(\/cancel)?$/);
    if (bookingRoute) {
      const booking = bookings.find(item => item.id === bookingRoute[1]);
      if (!booking || active.user.role === 'guest' && booking.guestId !== active.user.id) {
        return json(res, 404, false, 'Booking not found');
      }
      if (req.method === 'GET' && !bookingRoute[2]) return json(res, 200, true, 'Booking retrieved', booking);
      if (req.method === 'POST' && bookingRoute[2]) {
        if (active.user.role !== 'guest' || booking.status !== 'pending') return json(res, 409, false, 'Not cancellable');
        booking.status = 'cancelled';
        record('booking.cancelled', booking.id);
        return json(res, 200, true, 'Hold cancelled', booking);
      }
    }
    if (url.pathname === '/api/v1/payments/initialize' && req.method === 'POST') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const data = await requestBody(req);
      const booking = bookings.find(item => item.id === data.bookingId && item.guestId === active.user.id);
      if (!booking || booking.status !== 'pending') return json(res, 409, false, 'No active hold');
      let payment = payments.find(item => item.bookingId === booking.id && item.status === 'pending');
      if (!payment) {
        const reference = 'GST-TEST-' + (payments.length + 1);
        payment = {
          id: randomUUID().replaceAll('-', '').slice(0, 24),
          reference, bookingId: booking.id, guestId: active.user.id, status: 'pending',
          amount: booking.amount * 100, currency: 'NGN', refundStatus: 'none',
          paidAt: null, createdAt: new Date().toISOString(),
        };
        payments.unshift(payment);
        booking.paymentReference = reference;
        record('payment.initialized', booking.id, payment.id);
      }
      return json(res, 200, true, 'Payment initialized', {
        bookingId: booking.id, reference: payment.reference, amount: payment.amount,
        currency: 'NGN', expiresAt: booking.expiresAt,
        authorizationUrl: 'https://checkout.paystack.com/fixture?reference=' + payment.reference,
      });
    }
    const paymentStatus = url.pathname.match(/^\/api\/v1\/payments\/([a-zA-Z0-9_-]+)\/status$/);
    if (paymentStatus && req.method === 'GET') {
      const { payment, booking } = bookingForPayment(paymentStatus[1]);
      if (!payment || active.user.role === 'guest' && payment.guestId !== active.user.id) return json(res, 404, false, 'Payment not found');
      return json(res, 200, true, 'Payment status retrieved', {
        reference: payment.reference, status: payment.status, amount: payment.amount,
        currency: 'NGN', booking: payment.bookingId, bookingStatus: booking?.status,
        paidAt: payment.paidAt, refundStatus: payment.refundStatus,
        needsRefund: payment.status === 'refund_required',
      });
    }
    if (url.pathname === '/api/v1/payments' && req.method === 'GET') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Payments retrieved', pageItems(payments, url));
    }
    if (url.pathname === '/api/v1/auditlogs' && req.method === 'GET') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Audit retrieved', pageItems(audit, url));
    }
    const refund = url.pathname.match(/^\/api\/v1\/payments\/([a-zA-Z0-9_-]+)\/refund$/);
    if (refund && req.method === 'POST') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const { payment } = bookingForPayment(refund[1]);
      if (!payment || payment.status !== 'refund_required' || payment.refundStatus !== 'none') return json(res, 409, false, 'Refund not eligible');
      payment.refundStatus = 'pending';
      record('refund.requested', payment.bookingId, payment.id);
      return json(res, 200, true, 'Refund submitted', { reference: payment.reference, refundStatus: 'pending' });
    }
    if (url.pathname === '/api/v1/checkins' && req.method === 'POST') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const { fields, validDocument } = await requestMultipart(req);
      if (!validDocument) return json(res, 400, false, 'Invalid ID image');
      const booking = bookings.find(item => item.id === fields.bookingId && item.guestId === active.user.id);
      if (!booking || booking.status !== 'confirmed') return json(res, 409, false, 'Confirmed booking required');
      let item = checkins.find(record => record.bookingId === booking.id);
      if (item && item.status !== 'rejected') return json(res, 409, false, 'Check-in already submitted');
      const now = new Date().toISOString();
      if (!item) {
        item = {
          id: randomUUID().replaceAll('-', '').slice(0, 24),
          bookingId: booking.id, guestId: booking.guestId, guestName: booking.guestName,
          roomName: booking.roomName, checkIn: booking.checkIn, checkOut: booking.checkOut,
          history: [],
        };
        checkins.unshift(item);
      }
      Object.assign(item, {
        arrivalTime: fields.arrivalTime, documentKind: fields.documentKind,
        status: 'pending', submittedAt: now, reviewedAt: null, reviewNote: '',
        documentAvailable: true, nonce: null,
      });
      item.history.push({ status: 'pending', at: now });
      return json(res, 201, true, 'Check-in submitted', publicCheckin(item));
    }
    if (url.pathname === '/api/v1/checkins/me' && req.method === 'GET') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'My check-ins', pageItems(checkins.filter(item => item.guestId === active.user.id).map(publicCheckin), url));
    }
    if (url.pathname === '/api/v1/checkins' && req.method === 'GET') {
      if (active.user.role !== 'staff') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Check-in queue', pageItems(checkins.map(publicCheckin), url));
    }
    const documentMatch = url.pathname.match(/^\/api\/v1\/checkins\/([a-f0-9]{24})\/document$/);
    if (documentMatch && req.method === 'GET') {
      if (active.user.role !== 'staff') return json(res, 403, false, 'Access denied');
      const item = checkins.find(value => value.bookingId === documentMatch[1]);
      if (!item?.documentAvailable) return json(res, 404, false, 'Document unavailable');
      const bytes = Buffer.from('89504e470d0a1a0a123456789abcdef0', 'hex');
      res.writeHead(200, {
        'Content-Type': 'image/png', 'Cache-Control': 'private, no-store',
        'Content-Disposition': 'attachment; filename="identity-document.png"',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(bytes);
      return;
    }
    const reviewMatch = url.pathname.match(/^\/api\/v1\/checkins\/([a-f0-9]{24})\/review$/);
    if (reviewMatch && req.method === 'PATCH') {
      if (active.user.role !== 'staff') return json(res, 403, false, 'Access denied');
      const item = checkins.find(value => value.bookingId === reviewMatch[1]);
      if (!item || item.status !== 'pending') return json(res, 409, false, 'Not pending');
      const data = await requestBody(req);
      if (typeof data.approved !== 'boolean' || (!data.approved && !String(data.note || '').trim())) {
        return json(res, 400, false, 'A rejection reason is required');
      }
      item.status = data.approved ? 'approved' : 'rejected';
      item.reviewNote = String(data.note || '');
      item.reviewedAt = new Date().toISOString();
      item.history.push({ status: item.status, at: item.reviewedAt });
      item.nonce = data.approved ? randomUUID() : null;
      return json(res, 200, true, 'Check-in reviewed', publicCheckin(item));
    }
    const keyMatch = url.pathname.match(/^\/api\/v1\/roomkeys\/([a-f0-9]{24})$/);
    if (keyMatch && req.method === 'GET') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const booking = bookings.find(value => value.id === keyMatch[1] && value.guestId === active.user.id);
      if (!booking) return json(res, 404, false, 'Booking not found');
      const item = checkins.find(value => value.bookingId === booking.id);
      const empty = { bookingId: booking.id, status: 'unavailable', code: null, simulated: true, validFrom: null, expiresAt: null };
      if (booking.status !== 'confirmed' || item?.status !== 'approved') return json(res, 200, true, 'Access unavailable', empty);
      const from = new Date(Math.max(Date.parse(booking.checkIn + 'T14:00:00+01:00'), Date.parse(item.reviewedAt))).toISOString();
      const until = new Date(booking.checkOut + 'T12:00:00+01:00').toISOString();
      const current = simulatedNow || new Date();
      const status = current >= new Date(until) ? 'expired' : current < new Date(from) ? 'scheduled' : 'active';
      return json(res, 200, true, 'Access retrieved', {
        bookingId: booking.id, status, simulated: true, validFrom: from, expiresAt: until,
        code: status === 'active' ? 'SIM-' + item.nonce.replaceAll('-', '').slice(0, 8).toUpperCase() : null,
      });
    }
    if (url.pathname === '/api/v1/servicerequests/catalogue/manage' && req.method === 'GET') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Service catalogue retrieved', serviceCatalogue);
    }
    if (url.pathname === '/api/v1/servicerequests/catalogue' && req.method === 'POST') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const fields = await requestBody(req);
      if (!fields.name?.trim() || !fields.description?.trim() || typeof fields.active !== 'boolean') return json(res, 400, false, 'Invalid service');
      if (serviceCatalogue.some(item => item.name.toLowerCase() === fields.name.trim().toLowerCase())) return json(res, 409, false, 'Duplicate service');
      const category = { id: randomUUID().replaceAll('-', '').slice(0, 24), name: fields.name.trim(), description: fields.description.trim(), active: fields.active };
      serviceCatalogue.push(category);
      return json(res, 201, true, 'Service saved', category);
    }
    const catalogueEdit = url.pathname.match(/^\/api\/v1\/servicerequests\/catalogue\/([a-f0-9]{24})$/);
    if (catalogueEdit && req.method === 'PATCH') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const category = serviceCatalogue.find(item => item.id === catalogueEdit[1]);
      if (!category) return json(res, 404, false, 'Service not found');
      Object.assign(category, await requestBody(req));
      return json(res, 200, true, 'Service updated', category);
    }
    if (url.pathname === '/api/v1/servicerequests' && req.method === 'POST') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const fields = await requestBody(req);
      if (fields.status || !fields.bookingId || !fields.categoryId) return json(res, 400, false, 'Invalid request');
      const booking = bookings.find(item => item.id === fields.bookingId && item.guestId === active.user.id);
      if (!booking) return json(res, 404, false, 'Reservation not found');
      const today = hotelToday();
      if (booking.status !== 'confirmed' || !(booking.checkIn <= today && today < booking.checkOut)) return json(res, 409, false, 'Active confirmed stay required');
      const category = serviceCatalogue.find(item => item.id === fields.categoryId && item.active);
      if (!category) return json(res, 409, false, 'Category unavailable');
      const now = new Date().toISOString();
      const entry = {
        id: randomUUID().replaceAll('-', '').slice(0, 24),
        bookingId: booking.id, guestId: active.user.id, guestName: active.user.firstName + ' ' + active.user.lastName,
        roomName: booking.roomName, categoryId: category.id, category: category.name,
        details: String(fields.details || '').trim(), status: 'received', createdAt: now,
        history: [{ status: 'received', at: now }],
      };
      serviceRequests.unshift(entry);
      return json(res, 201, true, 'Service request received', entry);
    }
    if (url.pathname === '/api/v1/servicerequests/me' && req.method === 'GET') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'My service requests', pageItems(serviceRequests.filter(item => item.guestId === active.user.id), url));
    }
    if (url.pathname === '/api/v1/servicerequests' && req.method === 'GET') {
      if (!['staff', 'manager'].includes(active.user.role)) return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Service requests', pageItems(serviceRequests, url));
    }
    const requestProgress = url.pathname.match(/^\/api\/v1\/servicerequests\/([a-f0-9]{24})\/status$/);
    if (requestProgress && req.method === 'PATCH') {
      if (active.user.role !== 'staff') return json(res, 403, false, 'Access denied');
      const entry = serviceRequests.find(item => item.id === requestProgress[1]);
      const data = await requestBody(req);
      const next = entry?.status === 'received' ? 'in-progress' : entry?.status === 'in-progress' ? 'done' : null;
      if (!entry || !next || data.status !== next) return json(res, 409, false, 'Invalid request transition');
      entry.status = next;
      entry.history.push({ status: next, at: new Date().toISOString() });
      return json(res, 200, true, 'Service request updated', entry);
    }
    if (url.pathname === '/api/v1/concierge/me' && req.method === 'POST') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const data = await requestBody(req);
      if (!data.text?.trim() || data.text.trim().length > 1000) return json(res, 400, false, 'Invalid message');
      const entry = {
        id: randomUUID().replaceAll('-', '').slice(0, 24), guestId: active.user.id,
        guestName: active.user.firstName + ' ' + active.user.lastName,
        sender: 'guest', senderName: active.user.firstName + ' ' + active.user.lastName,
        text: data.text.trim(), createdAt: new Date().toISOString(),
      };
      conciergeMessages.unshift(entry);
      return json(res, 201, true, 'Message sent', publicMessage(entry));
    }
    if (url.pathname === '/api/v1/concierge/me' && req.method === 'GET') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const page = pageItems(conciergeMessages.filter(item => item.guestId === active.user.id).map(publicMessage), url);
      page.items.reverse();
      return json(res, 200, true, 'Messages retrieved', page);
    }
    if (url.pathname === '/api/v1/concierge/conversations' && req.method === 'GET') {
      if (active.user.role !== 'staff') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Conversations retrieved', pageItems(humanConversations(), url));
    }
    const conciergeGuest = url.pathname.match(/^\/api\/v1\/concierge\/([a-f0-9]{24})$/);
    if (conciergeGuest && req.method === 'GET') {
      if (active.user.role !== 'staff') return json(res, 403, false, 'Access denied');
      const page = pageItems(conciergeMessages.filter(item => item.guestId === conciergeGuest[1]).map(publicMessage), url);
      page.items.reverse();
      return json(res, 200, true, 'Messages retrieved', page);
    }
    if (conciergeGuest && req.method === 'POST') {
      if (active.user.role !== 'staff') return json(res, 403, false, 'Access denied');
      const guest = [...users.values()].find(item => item.id === conciergeGuest[1] && item.role === 'guest' && item.isActive);
      if (!guest || !conciergeMessages.some(item => item.guestId === guest.id)) return json(res, 404, false, 'Conversation not found');
      const data = await requestBody(req);
      if (!data.text?.trim() || data.text.trim().length > 1000) return json(res, 400, false, 'Invalid message');
      const entry = {
        id: randomUUID().replaceAll('-', '').slice(0, 24), guestId: guest.id,
        guestName: guest.firstName + ' ' + guest.lastName,
        sender: 'staff', senderName: active.user.firstName + ' ' + active.user.lastName,
        text: data.text.trim(), createdAt: new Date().toISOString(),
      };
      conciergeMessages.unshift(entry);
      return json(res, 201, true, 'Reply sent', publicMessage(entry));
    }
    if (url.pathname === '/api/v1/reports/overview' && req.method === 'GET') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const verified = payments.filter(item => item.status === 'success');
      const earned = verified.reduce((sum, item) => sum + item.amount, 0);
      const live = {
        source: 'live-verified',
        confirmedBookings: bookings.filter(item => item.status === 'confirmed').length,
        allBookings: bookings.length, paymentCount: payments.length, verifiedPayments: verified.length,
        verifiedRevenueKobo: earned, verifiedRevenueNGN: earned / 100,
        serviceRequests: serviceRequests.length,
        completedServiceRequests: serviceRequests.filter(item => item.status === 'done').length,
        serviceCompletionPercent: serviceRequests.length ? Math.round(serviceRequests.filter(item => item.status === 'done').length / serviceRequests.length * 100) : null,
        roomInventory: rooms.reduce((sum, item) => sum + item.inventory, 0),
        loyaltyPointsAwarded: loyaltyAwards.filter(item => !item.revokedAt).reduce((sum, item) => sum + item.points, 0),
      };
      return json(res, 200, true, 'Source-separated performance', { historical: historicalReport(), live });
    }
    const recordsMatch = url.pathname.match(/^\/api\/v1\/reports\/historical\/([a-z-]+)$/);
    if (recordsMatch && req.method === 'GET') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const source = recordsMatch[1];
      if (!historicalFiles.includes(source)) return json(res, 400, false, 'Unknown historical source');
      const sourceIdKey = { bookings: 'Booking_ID', guests: 'Guest_ID', payments: 'Payment_ID', 'service-requests': 'Request_ID' }[source];
      const statusKey = { bookings: 'Booking_Status', payments: 'Payment_Status' }[source];
      const q = url.searchParams.get('q')?.toLowerCase() || '';
      const status = url.searchParams.get('status') || '';
      const rows = historicalData[source].map((item, index) => ({ ...item, sourceId: item[sourceIdKey], sourceRow: index + 1 }))
        .filter(item => (!q || String(item[sourceIdKey]).toLowerCase().includes(q)) && (!status || !statusKey || item[statusKey] === status));
      return json(res, 200, true, 'Historical rows retrieved', { source, ...pageItems(rows, url) });
    }
    if (url.pathname === '/api/v1/loyalty/me' && req.method === 'GET') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      reconcileAwards();
      return json(res, 200, true, 'Verified guest loyalty', loyaltySummary(url, active.user.id));
    }
    if (url.pathname === '/api/v1/loyalty/manager' && req.method === 'GET') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Loyalty manager overview', loyaltySummary(url));
    }
    if (url.pathname === '/api/v1/loyalty/rules' && req.method === 'GET') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Loyalty rules', loyaltyRules);
    }
    if (url.pathname === '/api/v1/loyalty/rules' && req.method === 'POST') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      const data = await requestBody(req);
      if (!Number.isInteger(data.pointsPerNight) || data.pointsPerNight < 0 || data.pointsPerNight > 10000) return json(res, 400, false, 'Invalid earning rate');
      const rule = { pointsPerNight: data.pointsPerNight, effectiveAt: new Date().toISOString() };
      loyaltyRules.push(rule);
      return json(res, 201, true, 'Loyalty rule saved', rule);
    }
    if (url.pathname === '/api/v1/loyalty/reconcile' && req.method === 'POST') {
      if (active.user.role !== 'manager') return json(res, 403, false, 'Access denied');
      return json(res, 200, true, 'Reconciliation complete', reconcileAwards());
    }
    if (url.pathname === '/api/v1/recommendations/me' && req.method === 'GET') {
      if (active.user.role !== 'guest') return json(res, 403, false, 'Access denied');
      const limit = Number(url.searchParams.get('limit') || 3);
      if (!Number.isInteger(limit) || limit < 1 || limit > 6) return json(res, 400, false, 'Invalid limit');
      const history = bookings.filter(item => item.guestId === active.user.id && item.status === 'confirmed' &&
        payments.some(payment => payment.bookingId === item.id && payment.status === 'success'));
      const preferred = new Map();
      for (const booking of history) {
        const room = rooms.find(item => item.id === booking.roomId);
        if (room) preferred.set(room.category, (preferred.get(room.category) || 0) + 1);
      }
      const popularity = new Map();
      for (const row of historicalData.bookings.filter(item => item.Booking_Status === 'Completed')) popularity.set(row.Room_Type, (popularity.get(row.Room_Type) || 0) + 1);
      const max = Math.max(1, ...popularity.values());
      const suggestions = rooms.filter(item => item.inventory > 0).map(room => {
        const personalized = preferred.get(room.category) || 0;
        const historical = popularity.get(room.category) || 0;
        return {
          room, score: personalized * 12 + Math.round(historical / max * 3) + (room.featured ? 2 : 0),
          reason: personalized ? 'Similar to your verified reservations' : historical ? 'Popular room category in historical hotel records' : room.featured ? 'Featured by the hotel' : 'Explore this room type',
          source: personalized ? 'verified-guest-stays' : historical ? 'historical-aggregate' : 'hotel-catalogue',
          availabilityConfirmed: false,
        };
      }).sort((a, b) => b.score - a.score || a.room.nightlyRate - b.room.nightlyRate).slice(0, limit);
      return json(res, 200, true, 'Room suggestions', suggestions);
    }
    if (active.user.role !== 'admin') return json(res, 403, false, 'Access denied');
    if (url.pathname === '/api/v1/users/team' && req.method === 'GET') {
      return json(res, 200, true, 'Team retrieved', [...users.values()].filter(u => ['staff', 'manager'].includes(u.role)).map(publicUser));
    }
    if (url.pathname === '/api/v1/users/team' && req.method === 'POST') {
      const data = await requestBody(req);
      if (!['staff', 'manager'].includes(data.role)) return json(res, 400, false, 'Invalid role');
      const user = addUser(data.firstName, data.lastName, data.email, data.role, data.password);
      return json(res, 201, true, 'Team created', publicUser(user));
    }
    const match = url.pathname.match(/^\/api\/v1\/users\/team\/([a-f0-9]{24})\/access$/);
    if (match && req.method === 'PATCH') {
      const user = [...users.values()].find(u => u.id === match[1] && ['staff', 'manager'].includes(u.role));
      if (!user) return json(res, 404, false, 'Team account not found');
      const data = await requestBody(req);
      user.role = data.role;
      user.isActive = data.isActive;
      for (const [token, email] of sessions) {
        if (email === user.email) revoked.add(token);
      }
      return json(res, 200, true, 'Team updated', publicUser(user));
    }
    return json(res, 404, false, 'Not found');
  } catch {
    return json(res, 500, false, 'Request failed');
  }
});

server.listen(4100, '127.0.0.1');
