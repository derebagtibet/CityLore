# CityLore

CityLore is a full-stack cultural discovery platform for Turkiye. It helps users explore historical and cultural places on an interactive map, plan routes, follow cultural events, save places, write reviews, and use optional AI and street-level viewing features.

## Overview

CityLore combines map-based exploration with user-generated content and contextual discovery tools. Users can browse places across Turkiye, filter and search by city or place details, open dedicated place pages, save favorites, add new places, review locations, and create travel routes. The platform also includes real-time cultural event updates, rainy-weather suggestions, a profile dashboard with gamification-style progress, Turkish/English language support, an optional OpenRouter-powered AI assistant, and optional 360 / street-level viewing.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS |
| Map | Leaflet, React Leaflet, OpenStreetMap |
| Routing | Backend `/api/directions`, OpenRouteService optional, OSRM fallback |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| Real-time | Socket.IO |
| AI Assistant | OpenRouter API |
| Weather | Open-Meteo |
| 360 / Street-Level Viewing | Google Maps Embed Street View, Panoramax, stored image/media URLs |

## Features

- **Interactive cultural map**: Browse historical and cultural locations through a Leaflet + OpenStreetMap interface.
- **City and place filtering/search**: Filter places by city and category, and search through place data.
- **Route planning**: Create driving and walking routes through the backend directions API.
- **Weather suggestions**: Use Open-Meteo weather data to suggest indoor places during rainy conditions.
- **Add places**: Authenticated users can submit places with images and optional 360 / street-level fields.
- **Place interactions**: View details, ratings, reviews, entry information, opening hours, website links, and saved places.
- **Profile dashboard**: Track saved places and gamification-style discovery progress.
- **Real-time events**: Follow cultural event updates through Socket.IO.
- **AI assistant**: The frontend calls `/api/chat`; the backend sends requests to OpenRouter.
- **Multilingual UI**: Turkish and English language support.
- **Responsive interface**: Designed for desktop and mobile use.

## Quick Start

Required external service: MongoDB. MongoDB Atlas free M0 is enough for local development.

The default map uses Leaflet + OpenStreetMap and does not require a Google Maps API key. Optional services such as OpenRouter, OpenRouteService, and Google Maps Embed Street View can be configured through environment variables.

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

The backend runs on `http://localhost:5000` by default.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Backend server port. Defaults to `5000`. |
| `MONGO_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens. |
| `CLIENT_URL` | No | Frontend origin used for CORS and Socket.IO. |
| `OPENROUTER_API_KEY` | No | Enables the optional AI assistant. |
| `OPENROUTER_MODEL` | No | OpenRouter model name. |
| `OPENROUTESERVICE_API_KEY` | No | Enables OpenRouteService routing before OSRM fallback. |

Example:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/citylore
JWT_SECRET=change_this_secret
CLIENT_URL=http://localhost:5173
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key_here
```

### Frontend (`frontend/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | No | Optional API base URL if not using the Vite proxy/default setup. |
| `VITE_SOCKET_URL` | No | Optional Socket.IO backend URL. Defaults to `http://localhost:5000`. |
| `VITE_GOOGLE_MAPS_EMBED_API_KEY` | No | Enables Google Maps Embed Street View inside the 360 modal. |

Example:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_MAPS_EMBED_API_KEY=your_google_maps_embed_key_here
```

## Default Seed Users

After running `npm run seed` in the backend, the following users are available:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@citylore.com` | `admin123` |
| User | `test@citylore.com` | `test123` |

## 360 / Street-Level Viewing

The main map uses Leaflet + OpenStreetMap and does not require a Google Maps API key.

Manual image URLs are displayed as images/media. Google Maps Embed Street View provides the draggable street-level experience when `VITE_GOOGLE_MAPS_EMBED_API_KEY` is configured. Panoramax and stored panorama fields can also be used as optional sources.

Supported place fields include:

- `panoramaUrl`
- `panoramaxImageId`
- `streetViewUrl`
- `panoramas`
- `panoramaItems`
- `streetView`

## AI Assistant

CityLore includes an optional floating AI assistant for place recommendations, historical questions, route help, and general app guidance.

The frontend calls `/api/chat`, and the backend sends the request to OpenRouter. The browser never receives the AI API key. To enable the assistant, set `OPENROUTER_API_KEY` in `backend/.env`.

## API Endpoints

### Auth Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Register a new user | No |
| POST | `/api/auth/login` | Log in and receive a JWT | No |
| GET | `/api/auth/me` | Get current user profile | Yes |
| PUT | `/api/auth/profile` | Update user profile | Yes |
| POST | `/api/auth/save-place/:placeId` | Save or unsave a place | Yes |

### Places Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | `/api/places` | Get places with optional filters | Optional |
| GET | `/api/places/:id` | Get a single place | Optional |
| POST | `/api/places` | Create a new place | Yes |
| PUT | `/api/places/:id` | Update a place | Yes, owner or admin |
| DELETE | `/api/places/:id` | Delete a place | Yes, owner or admin |

### Events Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | `/api/events` | Get cultural events | Optional |
| POST | `/api/events` | Create a cultural event | Yes |
| PUT | `/api/events/:id/like` | Like or unlike an event | Yes |
| DELETE | `/api/events/:id` | Delete an event | Yes, owner or admin |

### Reviews Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | `/api/reviews/place/:placeId` | Get reviews for a place | Optional |
| POST | `/api/reviews/place/:placeId` | Create a review | Yes |
| DELETE | `/api/reviews/:id` | Delete a review | Yes, owner or admin |

### Cities Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | `/api/cities` | Get all cities | No |
| GET | `/api/cities/:id` | Get a single city by ID | No |

### Chat Route

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| POST | `/api/chat` | Send chat messages to the AI assistant through the backend | No |

### Directions Route

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| POST | `/api/directions` | Calculate driving or walking route geometry and travel estimates | No |

## WebSocket Events

| Event | Direction | Description |
| --- | --- | --- |
| `join_city` | Client -> Server | Join a city event room |
| `leave_city` | Client -> Server | Leave a city event room |
| `new_event` | Client -> Server | Broadcast a newly reported event to a city room |
| `event_added` | Server -> Client | Notify clients that an event was added |
| `event_removed` | Server -> Client | Notify clients that an event was deleted |
| `event_liked` | Server -> Client | Notify clients that an event like count changed |

## Project Structure

```text
interactive-map-platform/
├── backend/
│   ├── config/          # Database and JWT configuration
│   ├── controllers/     # Route handler logic
│   ├── middleware/      # Authentication middleware
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express route definitions
│   ├── scripts/         # Maintenance and data scripts
│   ├── test/            # Backend automated tests
│   ├── seed.js          # Sample data seeder
│   └── server.js        # Backend entry point
└── frontend/
    └── src/
        ├── components/  # Reusable UI components
        ├── context/     # React Context providers
        ├── data/        # Local demo/static data
        ├── i18n/        # Translation and language support
        ├── pages/       # Page-level components
        ├── services/    # Axios API helpers
        └── utils/       # Frontend utilities
```

## Testing

```bash
cd backend
npm test
```

Automated tests currently focus on place image resolution utilities.

## Recommended Deployment Options

- **Frontend**: Vercel or a similar static hosting provider.
- **Backend**: Render or a similar Node.js hosting provider.
- **Database**: MongoDB Atlas.

These are recommended deployment options, not live deployment links.

## Notes

- OpenStreetMap/Leaflet map rendering does not require Google Maps.
- OpenRouter is optional unless the chatbot is needed.
- OpenRouteService is optional because the directions endpoint can fall back to OSRM.
- Google Maps Embed Street View is optional and used only inside the street-level viewing modal when configured.
