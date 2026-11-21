# Guestly Frontend

Guestly is a Next.js hotel guest experience project connected to the live Node.js/Express API on Render.

## Website

https://soft-nation-dev.github.io/guestly/

## Development

Requires Node.js 22.

```bash
npm ci
npm run dev
```

The frontend uses `https://guestly-api-zxgm.onrender.com` by default. Set `NEXT_PUBLIC_API_URL` in `.env.local` to use another API origin. Do not append `/api/v1`. Backend CORS must allow the website's origin.

## Verification

```bash
npm run test:api
npm run lint
npm run build
```

GitHub Actions also runs browser checks against a local API fixture. The GitHub Pages workflow checks the hosted API's readiness, public endpoints, CORS and protected routes before publishing.

The interface uses live API data only. Guest, staff, manager and admin actions require real backend accounts. An empty room catalogue is expected until a manager adds rooms. Booking confirmation depends on verified Paystack payment.

The published site uses GitHub Pages; only the public API URL belongs in the frontend configuration.
