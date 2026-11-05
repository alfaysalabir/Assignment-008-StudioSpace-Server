# StudioSpace Server

Express.js + MongoDB API for the StudioSpace client.

## Setup
```bash
npm install
cp .env.example .env
npm run seed   # optional demo data
npm run dev
```

## Routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/studios?search&category&sort&limit` | Public | List studios |
| GET | `/api/studios/my` | JWT | My listings |
| GET | `/api/studios/:id` | Public | Studio details |
| POST | `/api/studios` | JWT | Add studio |
| PUT | `/api/studios/:id` | JWT (owner) | Update studio |
| DELETE | `/api/studios/:id` | JWT (owner) | Delete studio |
| POST | `/api/studios/:id/reviews` | JWT | Add review |
| GET | `/api/bookings/slots?studioId&date` | Public | Confirmed slots |
| GET | `/api/bookings/my` | JWT | My reservations |
| GET | `/api/bookings/requests` | JWT (host) | Requests for my studios |
| POST | `/api/bookings` | JWT | Create booking (Pending) with overlap check |
| PATCH | `/api/bookings/:id/cancel` | JWT | Cancel a Pending booking |
| PATCH | `/api/bookings/:id/status` | JWT (host) | Confirm / Complete / Decline |
| GET/POST | `/api/wishlist` | JWT | Saved studios |


## Server Link
https://studiospaceserver-two.vercel.app/
