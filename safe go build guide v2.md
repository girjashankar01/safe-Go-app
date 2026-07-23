# SafeGo — Sprint Build Guide v2
**BMSIT&M | IDP | 1BY25CS116 | 2-3 Day Build with Claude Code**

---

## What This Guide Is

This is not a code reference. Claude Code writes the code. This guide covers:
- **Manual steps** only you can do (Supabase schema, Resend setup, seed data)
- **Concepts** you need to understand before/during each phase
- **Verbatim Claude Code prompts** — copy-paste these exactly
- **Verification checkpoints** — don't move forward without these passing

---

## Architecture (Read Once, Internalize)

```
Mobile App (Expo RN)
  │
  ├── WebSocket (Socket.io) ──► Backend (Node.js + Express)
  │     GPS stream every 5s            │
  │                                    ├── Algorithms (pure JS):
  └── HTTP (REST)                      │     stop detection, deviation,
        register/login                 │     check-in timer, priority score
        start/end trip                 │
        SOS trigger                    ├── Supabase (DB + Auth + Storage)
                                       │     PostgreSQL tables
                                       │     audio-clips bucket
                                       │
                                       ├── Resend (Email)
                                       │     SOS alerts → contacts
                                       │
                                       └── Socket.io Broadcast
                                             → Police Dashboard (React + Leaflet)
                                             → Tracking page (public URL)
```

**Critical design decisions baked in:**
- **Custom JWT auth** (not Supabase Auth) — simpler, full control
- **OSRM** for route polylines (free, no key, public API) — not Google Maps
- **Service key on backend** (bypasses RLS), **anon key on mobile** (subject to RLS)
- **In-memory Map** for trip state (stop detection timers) — no Redis needed
- `app.set('io', io)` — passes Socket.io to routes without global pollution

---

## Free Stack Reference

| Service | Purpose | Limit | Key |
|---------|---------|-------|-----|
| Supabase | DB + Storage + Realtime | 500MB DB, 1GB Storage | From project settings |
| Resend | Email alerts | 3000/month free | From dashboard |
| OSRM | Route polyline | No limit, public server | None needed |
| OpenStreetMap | Map tiles | No limit | None needed |
| Overpass API | Lighting GeoJSON | Rate limited, run once | None needed |
| Render | Backend hosting | 750 hrs/month, sleeps after 15min | Deploy from GitHub |
| Vercel | Dashboard hosting | Unlimited hobby | Deploy from GitHub |

---

## Part 0: Manual Setup (~1 hour)

Do this before writing a single line of code.

### 0.1 Supabase Project Setup

**Concept — Supabase keys:**
- `anon key` → safe to expose in mobile app. Subject to RLS policies.
- `service_role key` → never expose client-side. Bypasses RLS. Use only on backend.
- RLS (Row Level Security) → PostgreSQL policy that restricts which rows a query can touch based on `auth.uid()`. Since we use custom JWT (not Supabase Auth), `auth.uid()` won't resolve — so RLS on the backend is bypassed via service key anyway. We still enable RLS as defense-in-depth for the anon key path.

**Steps:**
1. Go to [supabase.com](https://supabase.com) → New Project → name: `safego` → region: Singapore (closest to India)
2. Wait for project to provision (~2 min)
3. Go to **Project Settings → API** → copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY`
4. Go to **SQL Editor** → run the following in order:

**Step 1 — Enable PostGIS:**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Step 2 — Schema:**
```sql
-- Users (custom auth, NOT Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  blood_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency contacts (up to 3 per user)
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL
);

-- Trips
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  destination_lat DOUBLE PRECISION,
  destination_lng DOUBLE PRECISION,
  destination_name TEXT,
  route_polyline JSONB,           -- [{lat, lng}, ...] decoded from OSRM
  status TEXT DEFAULT 'active',   -- active | ended | sos
  tracking_token TEXT UNIQUE,     -- short-lived JWT for public tracking URL
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- GPS stream (one row per update, ~every 5s while active)
CREATE TABLE location_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,         -- km/h
  accuracy DOUBLE PRECISION,      -- meters
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compound index: fetch latest point for a trip fast
CREATE INDEX idx_location_trip_time ON location_points(trip_id, recorded_at DESC);

-- SOS events
CREATE TABLE sos_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  trigger_type TEXT NOT NULL,     -- manual-sos | missed-checkin | auto-stop | route-deviation
  priority_level TEXT,            -- CRITICAL | HIGH | MEDIUM
  priority_score INTEGER,
  audio_clip_url TEXT,
  nearest_station_id UUID,
  status TEXT DEFAULT 'active',   -- active | acknowledged | resolved
  fired_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bangalore police stations (you'll seed this in Part 4)
CREATE TABLE police_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  phone TEXT
);

-- Danger zones (seed in Part 4)
CREATE TABLE danger_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER DEFAULT 300,
  risk_level TEXT DEFAULT 'medium', -- low | medium | high
  source TEXT DEFAULT 'static'
);
```

**Step 3 — RLS policies:**
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Public read for police stations and danger zones (no auth needed for heatmap)
ALTER TABLE police_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE danger_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read police_stations" ON police_stations FOR SELECT USING (true);
CREATE POLICY "Public read danger_zones" ON danger_zones FOR SELECT USING (true);

-- Service key bypasses RLS — the above is just for anon key path defense
```

> **Why no user-level RLS policies?** Our backend always uses the service key (bypasses RLS). Mobile app uses the anon key only for Supabase Storage (audio upload). Everything else goes through our backend → service key. Keeps it simple.

**Step 4 — Storage bucket (manual, can't do via SQL):**
1. Supabase Dashboard → **Storage** → **New Bucket**
2. Name: `audio-clips`
3. Toggle **Public bucket: ON** (so email links work without auth)
4. Click Create

---

### 0.2 Resend Setup

**Concept — Why Resend over Nodemailer/SMTP:**
Nodemailer with SMTP (Gmail, etc.) has rate limits, auth headaches, and spam issues. Resend is an API-first email service. Free tier = 3000 emails/month + `onboarding@resend.dev` as sender for testing (no domain setup needed).

**Steps:**
1. Go to [resend.com](https://resend.com) → Sign up (free)
2. Dashboard → **API Keys** → Create API Key → name: `safego-dev` → copy it
3. For testing: use `from: 'SafeGo <onboarding@resend.dev>'` — works without domain verification, but **emails only deliver to the account's registered email address in test mode**. For demo day with real contacts, you'll need a domain.
4. For free domain for demo: use Cloudflare (free DNS) + any free domain, then add Resend DNS records. Or use your college email domain if IT allows.

**What you need from this step:**
- `RESEND_API_KEY=re_xxxxxxxxxxxxx`

---

### 0.3 Environment Variables

Create these files before running Claude Code. Claude Code will reference them but won't create them with real values.

**`safego-backend/.env`:**
```env
PORT=3000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
JWT_SECRET=some-long-random-string-here-min-32-chars
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM=SafeGo <onboarding@resend.dev>
DASHBOARD_URL=http://localhost:5173
```

**`safego-mobile/.env`:**
```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.x.x:3000
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```
> Use your machine's LAN IP (not localhost) for the mobile app during dev — Expo runs on your phone/emulator, so `localhost` resolves to the device, not your machine. Run `ifconfig | grep "inet "` to find it.

**`safego-dashboard/.env`:**
```env
VITE_BACKEND_URL=http://localhost:3000
```

---

## Part 1: Backend (Day 1, ~4 hours)

### Concepts

**JWT flow (custom auth):**
```
Register: bcrypt.hash(password) → store in DB → sign JWT({userId, email}, JWT_SECRET) → return token
Login:    bcrypt.compare(password, hash) → sign JWT → return token
Request:  Authorization: Bearer <token> → middleware verifies → attaches req.user
```

**Socket.io rooms:**
Socket.io lets you group sockets into named "rooms". `socket.join('police-room')` puts a socket in that room. `io.to('police-room').emit(...)` broadcasts to all sockets in that room. Each active trip also gets a room: `trip-{tripId}`. The mobile app joins its own trip room; the police dashboard joins `police-room`; tracking page joins `trip-{tripId}`.

**OSRM route API (free, no key):**
```
GET http://router.project-osrm.org/route/v1/driving/{startLng},{startLat};{destLng},{destLat}?overview=full&geometries=geojson
```
Returns GeoJSON LineString. Coordinates are `[lng, lat]` (GeoJSON order). Flip to `{lat, lng}` before storing. Store decoded route in `trips.route_polyline` as JSONB.

**Stop detection state (in-memory Map):**
The server keeps a `Map<tripId, {stoppedSince, checkInSent, checkInReceived}>` in memory. This resets on server restart — acceptable for MVP. Each `location:update` event mutates this map. When stopped >3min and no checkin received in 90s → auto-trigger SOS.

**Haversine formula:**
Gives great-circle distance between two lat/lng points in meters. Used for: deviation check (is current point >200m from nearest route point?), nearest station lookup, danger zone check.

---

### Claude Code Prompt — Backend

> Open Claude Code in `safego-backend/` (empty directory). Use this prompt:

```
Build the SafeGo backend — a women's safety app. Node.js + Express + Socket.io.

STACK: express, socket.io, @supabase/supabase-js, jsonwebtoken, bcryptjs, dotenv, cors, axios, resend, nodemon (dev)

SUPABASE TABLES (already exist, do not generate migration):
- users: id (uuid), name, phone, email, password_hash, blood_group, created_at
- emergency_contacts: id, user_id (fk→users), name, phone, email
- trips: id, user_id (fk→users), origin_lat, origin_lng, destination_lat, destination_lng, destination_name, route_polyline (jsonb), status (active|ended|sos), tracking_token, started_at, ended_at
- location_points: id (bigserial), trip_id (fk→trips), lat, lng, speed, accuracy, recorded_at
- sos_events: id, trip_id, user_id, lat, lng, trigger_type, priority_level, priority_score, audio_clip_url, nearest_station_id, status, fired_at
- police_stations: id, name, address, lat, lng, phone
- danger_zones: id, name, lat, lng, radius_meters, risk_level, source

ENV VARS (already in .env, don't hardcode):
PORT, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, RESEND_API_KEY, RESEND_FROM, DASHBOARD_URL

BUILD THESE FILES:

1. index.js
   - Express + http.createServer + Socket.io (cors: origin '*')
   - Mount routes: /auth → auth.js, /trips → trips.js, /sos → sos.js
   - GET /track/:token → track.js (public, no auth)
   - GET /heatmap/danger-zones → query danger_zones, return JSON
   - GET /heatmap/lighting → serve static file from data/bangalore-lighting.json (may not exist yet, handle gracefully)
   - Store io with app.set('io', io)
   - Require socket/handlers.js and call it with io

2. config/supabase.js
   - createClient with SUPABASE_URL + SUPABASE_SERVICE_KEY (service key bypasses RLS)

3. middleware/auth.js
   - Verify JWT from Authorization header
   - Attach decoded payload to req.user
   - 401 if missing or invalid

4. routes/auth.js
   POST /auth/register
   - Body: {name, phone, email, password, blood_group?, emergencyContacts: [{name,phone,email}]}
   - Hash password with bcryptjs (rounds: 10)
   - Insert into users table
   - Insert emergency_contacts (loop)
   - Sign JWT: {userId: user.id, email: user.email}, secret: JWT_SECRET, expiresIn: '30d'
   - Return: {token, user: {id, name, email, phone}}

   POST /auth/login
   - Body: {email, password}
   - Fetch user by email
   - bcrypt.compare
   - Sign JWT, return same shape

5. routes/trips.js
   POST /trips/start (auth required)
   - Body: {originLat, originLng, destinationLat?, destinationLng?, destinationName?}
   - If destination provided: fetch OSRM route
     URL: `http://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`
     Extract: routes[0].geometry.coordinates → array of [lng,lat] → map to [{lat, lng}]
     Handle OSRM failure gracefully (null polyline, trip still starts)
   - Generate tracking_token: JWT({tripId}, JWT_SECRET, {expiresIn: '7d'}) — generate after trip insert using the new trip id
   - Insert trip with route_polyline, tracking_token
   - Email tracking link to emergency_contacts: GET contacts from DB, use Resend
     Subject: "{userName} has started a trip"
     Body: include tracking link = ${DASHBOARD_URL}/track/${tracking_token}
   - Return: {tripId, trackingToken, routePolyline}

   POST /trips/:id/end (auth required)
   - Update trips set status='ended', ended_at=NOW() where id=:id and user_id=req.user.userId
   - Return: {success: true}

6. routes/sos.js
   POST /sos/trigger (auth required)
   - Body: {tripId, lat, lng, triggerType, audioClipUrl?}
   - Fetch trip + user join with emergency_contacts
   - Compute priority score (see utils/priorityScore.js)
   - Check if in danger zone: fetch danger_zones, compute haversine, check radius
   - Find nearest police station (see utils/nearestStation.js)
   - Insert sos_events
   - Update trips set status='sos'
   - Send SOS email to all emergency contacts via Resend (HTML email with: user name, trigger type, priority, Google Maps link https://maps.google.com/?q={lat},{lng}, tracking link, nearest station name+phone, audio link if provided)
   - Broadcast to 'police-room' via req.app.get('io')
   - Return: {success: true, sosId, priority}

7. routes/track.js
   GET (no auth — public tracking link)
   - Verify tracking_token JWT (from req.params.token)
   - Return: latest location point for that trip + trip status + destination

8. socket/handlers.js
   io.on('connection') handler:

   'trip:join' event: {tripId, role}
   - socket.join(`trip-${tripId}`)
   - if role === 'police': socket.join('police-room')

   'location:update' event: {tripId, userId, lat, lng, speed, accuracy, timestamp}
   - Insert into location_points
   - Broadcast to police-room and trip-{tripId} via io.to().emit('location:fan-out', data)
   - Fetch trip's route_polyline from Supabase (cache in memory Map to avoid DB hit every 5s — use a Map<tripId, polyline>)
   - If polyline exists: run isDeviating(lat, lng, polyline, 200) from utils/deviation.js — if true: socket.emit('checkin:prompt', {message, reason: 'route-deviation', responseWindowMs: 90000}) + setTimeout 90s auto-SOS
   - Run updateStopDetection(tripId, speed, lat, lng, io) from utils/stopDetection.js

   'checkin:response' event: {tripId}
   - Call cancelAutoSos(tripId) from utils/stopDetection.js
   - io.to(`trip-${tripId}`).emit('checkin:confirmed')

   'sos:broadcast' event (for completeness): forward to police-room

9. utils/deviation.js
   haversineDistance(lat1, lon1, lat2, lon2): returns meters
   isDeviating(currentLat, currentLng, routePolyline, thresholdMeters=200): boolean
   - Loop through all route points, find min haversine distance to current position
   - Return true if minDist > thresholdMeters

10. utils/stopDetection.js
    - In-memory Map: tripStates = new Map()
    - autoSosTimers = new Map() (for cancellation)
    - updateStopDetection(tripId, speed, lat, lng, io):
      speed in km/h. SPEED_THRESHOLD=5. STOP_DURATION=3min.
      If speed < threshold: start/track stoppedSince timestamp
      If stopped > 3min and !checkInSent: emit 'checkin:prompt' to trip room, set checkInSent=true
      Start 90s timeout → if !checkInReceived → call triggerAutoSOS(tripId, lat, lng)
      If speed >= threshold: reset state
    - cancelAutoSos(tripId): clear timeout, set checkInReceived=true
    - triggerAutoSOS: internal HTTP POST to /sos/trigger or direct Supabase insert + email (implement whichever is cleaner)
    - Export: { updateStopDetection, cancelAutoSos }

11. utils/priorityScore.js
    computePriorityScore({triggerType, timeOfDay, inDangerZone, speed}):
    Weighted scoring:
    - manual-sos: +40, missed-checkin: +25, auto-stop/route-deviation: +20
    - Hour 22-6: +30, hour 18-22: +15
    - inDangerZone: +20
    - speed < 2 km/h: +10
    Returns: {score, level: 'CRITICAL'|'HIGH'|'MEDIUM'} (≥70=CRITICAL, ≥40=HIGH, else MEDIUM)

12. utils/nearestStation.js
    findNearestStation(lat, lng, supabase):
    - Fetch all police_stations
    - Loop, compute haversineDistance to each
    - Return {station, distanceMeters} of nearest

13. utils/email.js
    sendSOSEmail({contacts, userName, lat, lng, triggerType, priorityLevel, trackingLink, audioClipUrl, nearestStation}):
    - Use Resend SDK
    - from: process.env.RESEND_FROM
    - HTML email with all fields, Google Maps link, priority color coding
    - Loop contacts, send to each

    sendTripStartEmail({contacts, userName, trackingLink}):
    - Lighter email: "{userName} has started a trip. Track here: {trackingLink}"

package.json scripts:
  "dev": "nodemon index.js"
  "start": "node index.js"

Add .gitignore: node_modules, .env
Add README.md with: npm install, npm run dev, env vars list
```

### Verification Checkpoint 1

Don't proceed to mobile app until all of these pass:

```bash
# Start server
npm run dev

# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","phone":"9999999999","email":"your@email.com","password":"test1234","emergencyContacts":[{"name":"Contact 1","phone":"8888888888","email":"contact@email.com"}]}'
# Expected: {token: "...", user: {...}}

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"test1234"}'
# Expected: {token: "..."}

# Start a trip (use the token from above)
curl -X POST http://localhost:3000/trips/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"originLat":12.9716,"originLng":77.5946,"destinationLat":12.9279,"destinationLng":77.6271,"destinationName":"Koramangala"}'
# Expected: {tripId: "...", routePolyline: [...], trackingToken: "..."}
# Also: tracking link email delivered to contact's inbox

# Trigger SOS
curl -X POST http://localhost:3000/sos/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tripId":"<tripId>","lat":12.9716,"lng":77.5946,"triggerType":"manual-sos"}'
# Expected: SOS email in contacts' inbox + {success: true, priority: {...}}
```

Check Supabase dashboard → Table Editor → `trips`, `sos_events` have rows.

---

## Part 2: Mobile App (Day 1-2, ~5 hours)

### Concepts

**Expo managed workflow vs bare:**
Managed = Expo handles native build config. You can't write native modules but get `expo-location`, `expo-av`, `expo-notifications` working with zero native setup. Eject only if you need something outside Expo SDK. For SafeGo MVP: never eject.

**`expo-location` watchPositionAsync:**
```
Location.watchPositionAsync(options, callback)
  options: {accuracy: High, timeInterval: 5000, distanceInterval: 10}
  callback: receives {coords: {latitude, longitude, speed, accuracy}}
  speed: in m/s from GPS — multiply by 3.6 for km/h
  returns: subscription object — call subscription.remove() on cleanup
```
Always request `foregroundPermissionsAsync` before watching. For background tracking (app minimized), you need `requestBackgroundPermissionsAsync` + `startLocationUpdatesAsync` + a task — complex, skip for MVP demo.

**WebSocket client lifecycle:**
```
mount → socket.connect() → emit 'trip:join'
GPS update → emit 'location:update'
listen → 'checkin:prompt' → show modal
listen → 'sos:alert' (if police) or listen → 'location:fan-out' (tracking page)
unmount → socket.disconnect()
```
Keep one socket instance (singleton in `lib/socket.js`). Don't create new instances per component.

**React Navigation stack:**
```
LoginScreen (no tab, full screen)
  └──► HomeScreen (after login)
         └──► TripScreen (during active trip)
```
Pass `tripId`, `routePolyline`, `authToken` as navigation params to TripScreen.

**Supabase Storage upload from Expo (audio):**
`expo-av` gives you a local `file://` URI. Fetch it as a blob, upload to Supabase Storage:
```js
const response = await fetch(localUri);
const blob = await response.blob();
await supabase.storage.from('audio-clips').upload(filename, blob, {contentType: 'audio/mp4'});
```

---

### Claude Code Prompt — Mobile App

> Run `npx create-expo-app safego-mobile --template blank` first, then open in Claude Code:

```
Build the SafeGo mobile app — Expo React Native (managed workflow).

INSTALL (run these first):
npx expo install expo-location expo-av
npm install socket.io-client @supabase/supabase-js axios @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler

BACKEND URL: process.env.EXPO_PUBLIC_BACKEND_URL (set in .env)
SUPABASE: process.env.EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (anon key, not service key)

The backend already exists with these endpoints:
- POST /auth/register: {name, phone, email, password, emergencyContacts:[{name,phone,email}]}
- POST /auth/login: {email, password} → returns {token, user}
- POST /trips/start (auth): {originLat, originLng, destinationLat?, destinationLng?, destinationName?} → {tripId, trackingToken, routePolyline}
- POST /trips/:id/end (auth): ends trip
- POST /sos/trigger (auth): {tripId, lat, lng, triggerType, audioClipUrl?}

Socket.io events emitted FROM app:
- 'trip:join': {tripId, role: 'user'}
- 'location:update': {tripId, lat, lng, speed (km/h), accuracy, timestamp}
- 'checkin:response': {tripId}

Socket.io events received BY app:
- 'checkin:prompt': {message, reason, responseWindowMs} → show modal
- 'checkin:confirmed': dismiss modal
- 'location:fan-out': ignore on mobile

BUILD THESE FILES:

lib/supabase.js
- createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)
- Export supabase client

lib/socket.js
- Singleton socket using io(BACKEND_URL, {transports:['websocket'], autoConnect:false})
- Export: getSocket(), connectSocket(tripId, role='user'), disconnectSocket()
- connectSocket: socket.connect(), then emit 'trip:join'

lib/api.js
- Axios instance with baseURL=EXPO_PUBLIC_BACKEND_URL
- Interceptor: attach Authorization: Bearer {token} from AsyncStorage
- Export typed functions: register(data), login(email, password), startTrip(data, token), endTrip(tripId, token), triggerSOS(data, token)

screens/LoginScreen.js
- Two tabs: Login | Register
- Login: email + password fields → call api.login → store token+user in AsyncStorage → navigate to HomeScreen
- Register: name, phone, email, password + add up to 3 emergency contacts (name, phone, email each)
  - "Add Contact" button shows inline form, removable
  - On submit: api.register → auto-login → navigate to HomeScreen
- Basic validation (non-empty, valid email format)
- Show loading state during API call

screens/HomeScreen.js
- Show logged-in user name from AsyncStorage
- "Start Trip" button → opens bottom sheet or modal:
  - Destination text input (optional)
  - Two buttons: "Start with Destination" | "Start without Destination"
  - If "with Destination": use current GPS location as origin, destination is the text input
    (For MVP: just store destination as name string, coords optional — skip geocoding)
  - Call api.startTrip → navigate to TripScreen with {tripId, routePolyline, token}
- Logout button (clear AsyncStorage, navigate to Login)

screens/TripScreen.js
- Full screen with MapView background + SOS button overlaid

MAP:
- Use react-native-maps MapView (uses device's native map — Google Maps on Android, Apple Maps on iOS)
- Show Marker at current user location
- Show Polyline of routePolyline if present (blue, strokeWidth 3)
- Show Circle components for danger zones (fetch GET /heatmap/danger-zones on mount, red semi-transparent circles, radius from data)
- Auto-follow user position (animate map camera to current location)

GPS STREAMING:
- On mount: request foreground location permission
- Location.watchPositionAsync({accuracy:High, timeInterval:5000, distanceInterval:10}, callback)
- callback: update currentLocation state, emit 'location:update' to socket
- Cleanup: subscription.remove() on unmount

SOS BUTTON:
- Large red circular button (120x120, position:absolute, bottom:40, centered)
- onPress: start 5-second countdown (setSosCountdown(5))
- Show countdown text + "Cancel" button during countdown
- On countdown reaching 0: call fireSOS()
- fireSOS():
  1. Request Audio.requestPermissionsAsync()
  2. If granted: start 15s recording (Audio.Recording.createAsync(HIGH_QUALITY preset))
  3. After 15s: stop recording, upload to Supabase Storage bucket 'audio-clips'
     filename: sos-{tripId}-{Date.now()}.m4a
     get public URL from supabase.storage.from('audio-clips').getPublicUrl(filename)
  4. Call api.triggerSOS({tripId, lat, lng, triggerType:'manual-sos', audioClipUrl})
  5. If audio permission denied or recording fails: call api.triggerSOS without audioClipUrl (don't block SOS)
- After SOS fires: show "SOS Sent" confirmation overlay, disable SOS button for 60s

CHECK-IN MODAL:
- Listen to 'checkin:prompt' socket event
- Show Modal (transparent overlay) with message from event
- Single button: "I'm Safe ✓" → emit 'checkin:response', dismiss modal
- Show 90s countdown in modal (auto-dismiss if user doesn't respond, but SOS will fire server-side anyway)

END TRIP:
- "End Trip" button in top-right corner
- Call api.endTrip(tripId, token) → disconnectSocket() → navigate back to HomeScreen

STYLE REQUIREMENTS:
- Dark background (#0f0f0f)
- SOS button: #dc2626 red, white text, large shadow/elevation
- Countdown text: large (48px), bold, red
- Check-in modal: slides up from bottom (animationType='slide')
- Keep it minimal — function over form

App.js:
- NavigationContainer wrapping NativeStackNavigator
- Check AsyncStorage on app load for existing token → if exists go to HomeScreen, else LoginScreen
- Routes: Login, Home, Trip

app.json: name="SafeGo", slug="safego"
.gitignore: node_modules, .expo, .env
```

### Verification Checkpoint 2

```bash
# Start Expo
npx expo start

# On phone (Expo Go app) or emulator:
# 1. Register a new user with 1 emergency contact
# 2. Login
# 3. Start a trip → check backend terminal shows 'Client connected' and 'trip:join' received
# 4. Watch backend terminal — should see 'location:update' events every 5s
# 5. Press SOS → see 5s countdown → let it fire
# 6. Check emergency contact email inbox — SOS email should arrive
# 7. Check Supabase sos_events table — has a row
```

---

## Part 3: Police Dashboard (Day 3, ~2 hours)

### Concepts

**Leaflet.js vs react-leaflet:**
Leaflet is vanilla JS. react-leaflet wraps it in React components. `MapContainer` is the root — must have a fixed height. `TileLayer` sets the map tiles. `Marker` + `Popup` for pins. `Circle` for radius zones.

**OSM tile URL:**
```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```
`{s}` = subdomain (a/b/c for load balancing). `{z}` = zoom. `{x}/{y}` = tile coords. No API key. Must include attribution.

**Leaflet default icon bug in webpack/Vite:**
Leaflet imports marker images relative to the CSS file path. This breaks in bundled apps. Fix: manually set `L.Icon.Default.mergeOptions({...require paths...})` or use a CDN icon URL.

**Socket.io as police client:**
Dashboard connects to backend and joins `police-room` by emitting `trip:join` with `role:'police'`. Then listens for `sos:alert` and `location:fan-out` events. Socket reconnects automatically by default.

---

### Claude Code Prompt — Police Dashboard

> Run `npm create vite@latest safego-dashboard -- --template react` first, then open in Claude Code:

```
Build the SafeGo police dashboard — React + Vite + Leaflet.

INSTALL:
npm install socket.io-client leaflet react-leaflet axios

Backend URL: import.meta.env.VITE_BACKEND_URL

BACKEND SOCKET EVENTS RECEIVED:
- 'sos:alert': {sosId, tripId, userId, lat, lng, triggerType, priorityLevel, priorityScore, nearestStation:{name,phone,address}, firedAt}
- 'location:fan-out': {tripId, lat, lng, speed, timestamp}

BACKEND REST ENDPOINTS:
- GET /heatmap/danger-zones → [{id, name, lat, lng, radius_meters, risk_level}]

BUILD:

src/App.jsx
- Left sidebar (320px wide, dark bg #111827): SOS alert list
- Right panel (flex:1): Leaflet map

SOCKET:
- Connect to VITE_BACKEND_URL on mount
- Emit 'trip:join': {tripId:'all', role:'police'} immediately after connect
- On 'sos:alert': prepend to alerts state array
  - Play alert sound: new Audio('/alert.mp3').play() (catch errors — user gesture may block)
  - Auto-pan map to alert location
- On 'location:fan-out': update liveLocations state Map (tripId → latest point)
- Reconnect on disconnect (socket.io does this by default)
- Disconnect on component unmount

MAP (react-leaflet MapContainer):
- center: [12.9716, 77.5946] (Bangalore), zoom: 12
- TileLayer: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
  attribution: '© OpenStreetMap contributors'
- Fix Leaflet default icon by importing icon images directly and calling L.Icon.Default.mergeOptions
- For each alert in alerts: red Marker at [alert.lat, alert.lng]
  Popup content: priority badge, triggerType, nearestStation name, time
  Use a custom red icon (CDN URL: https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png)
- For each liveLocation: blue Marker (default leaflet icon) at latest position
  Popup: tripId, speed, last updated
- Fetch GET /heatmap/danger-zones on mount: render Circle for each zone
  fillColor based on risk_level: high=#dc2626, medium=#ea580c, low=#d97706, fillOpacity 0.2, no stroke
- Component 'FlyToAlert' (useMap hook): when new SOS arrives, flyTo([lat,lng], zoom:15, duration:1.5s)

SIDEBAR:
- Header: "🚨 SafeGo — Police Dashboard" + live clock (IST, updates every second)
- Connection status indicator (green dot "Connected" / red dot "Disconnected")
- Alert count badge
- Alert cards (newest first):
  - Left border color: CRITICAL=#dc2626, HIGH=#ea580c, MEDIUM=#d97706
  - Show: priority badge, triggerType, coordinates (5 decimal places), time (IST locale), nearestStation name
  - "View on Map" button: flyTo alert location
  - "Acknowledge" button: just changes card opacity (no backend call for MVP)
- Empty state: gray text "No active alerts. Monitoring..."

STYLE: dark theme, monospace font for coordinates, no external CSS libraries — pure inline styles or CSS modules only
```

### Verification Checkpoint 3

```bash
# Terminal 1: backend running
cd safego-backend && npm run dev

# Terminal 2: dashboard dev server
cd safego-dashboard && npm run dev

# Open dashboard in browser: http://localhost:5173
# Should show: Bangalore map, "Connected" status, empty alert list

# From another terminal: trigger a test SOS
curl -X POST http://localhost:3000/sos/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tripId":"<tripId>","lat":12.9716,"lng":77.5946,"triggerType":"manual-sos"}'

# Dashboard should: show alert card in sidebar, drop red pin on map, pan to location
```

---

## Part 4: Static Seed Data (~1 hour, mostly SQL + one script)

### Police Stations — Run in Supabase SQL Editor

```sql
INSERT INTO police_stations (name, address, lat, lng, phone) VALUES
  ('Indiranagar Police Station',    '100 Feet Road, Indiranagar',          12.9784, 77.6408, '080-25202590'),
  ('Koramangala Police Station',    '80 Feet Road, Koramangala 4th Block', 12.9279, 77.6271, '080-25504225'),
  ('HSR Layout Police Station',     'Sector 1, HSR Layout',                12.9081, 77.6476, '080-22942025'),
  ('BTM Layout Police Station',     'BTM 2nd Stage, Bengaluru',            12.9165, 77.6101, '080-26862093'),
  ('Jayanagar Police Station',      '9th Block, Jayanagar',                12.9250, 77.5938, '080-26630700'),
  ('Marathahalli Police Station',   'Marathahalli Bridge, ITPL Road',      12.9563, 77.7011, '080-28522722'),
  ('Whitefield Police Station',     'Whitefield Main Road',                12.9698, 77.7500, '080-28450026'),
  ('Electronic City Police Station','Phase 1, Electronic City',            12.8454, 77.6640, '080-25535290'),
  ('MG Road Police Station',        'MG Road, Brigade Road Junction',      12.9756, 77.6099, '080-25584100'),
  ('Hebbal Police Station',         'Hebbal Kempapura, Bengaluru',         13.0358, 77.5970, '080-23637633'),
  ('Yelahanka Police Station',      'Yelahanka New Town',                  13.1004, 77.5963, '080-28561357'),
  ('Kengeri Police Station',        'Kengeri Satellite Town',              12.9085, 77.4842, '080-28482045'),
  ('Rajajinagar Police Station',    '1st Block, Rajajinagar',              12.9912, 77.5526, '080-23155700'),
  ('Bannerghatta Road PS',          'JP Nagar 7th Phase',                  12.8886, 77.6027, '080-26485700'),
  ('Cubbon Park Police Station',    'Ambedkar Veedhi, Cubbon Park',        12.9766, 77.5993, '080-22866666');
```

### Danger Zones — Run in Supabase SQL Editor

```sql
-- Based on Bangalore crime pattern data (public knowledge, adjust as needed for IDP)
INSERT INTO danger_zones (name, lat, lng, radius_meters, risk_level, source) VALUES
  ('Majestic / KSR Bus Stand',        12.9767, 77.5713, 400, 'high',   'static'),
  ('Shivajinagar Market Area',         12.9839, 77.5968, 350, 'high',   'static'),
  ('Hosur Road Industrial Stretch',    12.8741, 77.6399, 500, 'medium', 'static'),
  ('Silk Board Junction',              12.9170, 77.6232, 300, 'medium', 'static'),
  ('KR Market / City Market',          12.9634, 77.5773, 350, 'high',   'static'),
  ('Electronic City Phase 2 (night)',  12.8397, 77.6602, 400, 'medium', 'static'),
  ('Bannerghatta Road late night',     12.8886, 77.6027, 300, 'low',    'static'),
  ('Whitefield Industrial Area',       12.9698, 77.7500, 400, 'medium', 'static'),
  ('Hennur Road Junction',             13.0390, 77.6400, 300, 'medium', 'static'),
  ('Ejipura / Viveknagar Junction',    12.9479, 77.6186, 250, 'medium', 'static');
```

### Lighting Data — OSM Overpass (Run Once, Offline)

This fetches which roads in Bangalore have street lighting tagged in OpenStreetMap. It's a one-shot script you run locally and commit the output JSON.

```bash
# In safego-backend directory
mkdir -p data
node utils/fetchLightingData.js
# This creates data/bangalore-lighting.json (~5-15MB)
# Commit this file to your repo
```

The backend serves it at `GET /heatmap/lighting`. In the mobile app, render:
- `lit=yes` roads → green Polyline (strokeColor: '#16a34a', low strokeWidth)
- `lit=no` roads → orange Polyline (strokeColor: '#ea580c')

**Claude Code prompt for this fetch script** (run in `safego-backend/`):
```
Create utils/fetchLightingData.js — a one-shot Node.js script (not part of the server).

Query the Overpass API for all roads in Bengaluru tagged lit=yes OR lit=no.
URL: https://overpass-api.de/api/interpreter
POST body (form-encoded, key=data):
  [out:json][timeout:90];
  area["name"="Bengaluru"]["admin_level"="8"]->.a;
  (
    way["highway"]["lit"="yes"](area.a);
    way["highway"]["lit"="no"](area.a);
  );
  out geom;

Process response: convert to GeoJSON FeatureCollection.
Each way → GeoJSON Feature with:
  geometry: {type:"LineString", coordinates: way.geometry.map(n=>[n.lon,n.lat])}
  properties: {lit: tags.lit, highway: tags.highway}

Write output to data/bangalore-lighting.json.
Log progress: "Fetching...", "Got N ways", "Written to data/bangalore-lighting.json"
Handle timeout/error gracefully.

Uses axios. Run with: node utils/fetchLightingData.js
```

---

## Part 5: Deploy (Day 3, ~1 hour)

### Backend → Render (Free)

**Concept — Render free tier:** Spins down after 15 minutes of inactivity. First request after spin-down takes ~30s. For a demo, this is fine (just open the dashboard before the evaluators arrive). 750 hours/month free = effectively always-on for one service.

**Steps:**
1. Push `safego-backend` to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service → Connect GitHub repo
3. Build Command: `npm install`
4. Start Command: `node index.js`
5. Environment → Add all vars from your `.env` (copy-paste each key-value)
6. Click Deploy. Note the URL: `https://safego-backend-xxxx.onrender.com`

**Update mobile app:**
In `safego-mobile/.env`:
```env
EXPO_PUBLIC_BACKEND_URL=https://safego-backend-xxxx.onrender.com
```

**Update dashboard:**
In `safego-dashboard/.env`:
```env
VITE_BACKEND_URL=https://safego-backend-xxxx.onrender.com
```

Also update backend `.env`:
```env
DASHBOARD_URL=https://safego-dashboard.vercel.app
```

### Dashboard → Vercel

```bash
cd safego-dashboard
npm install -g vercel
vercel --prod
# Follow prompts. Add VITE_BACKEND_URL as env var in Vercel dashboard too.
```

### Mobile App — Build for Demo

For IDP demo on a physical device: Expo Go is sufficient (no need to build APK).
1. Make sure `.env` uses Render URL (not localhost)
2. Run `npx expo start` on your machine
3. Scan QR code with Expo Go on the demo phone

If you need a standalone APK:
```bash
npx eas build --platform android --profile preview
# Requires Expo account + eas-cli. Free tier available.
```

### Final E2E Test Checklist

Run through this sequence before IDP:

```
[ ] Open dashboard at Vercel URL in browser
[ ] Confirm: Bangalore map loads, "Connected" status shows
[ ] Open mobile app (Expo Go / Render URL)
[ ] Register new user with 2 emergency contacts
[ ] Login → HomeScreen
[ ] Start trip with destination → confirm: tracking email arrives in contacts' inbox
[ ] Watch backend → GPS location:update events streaming every 5s
[ ] Watch dashboard → blue marker moves with each GPS update
[ ] Trigger SOS (let 5s countdown complete)
[ ] Confirm: SOS email in contacts' inbox with priority, location, station
[ ] Confirm: red pin drops on dashboard map instantly
[ ] Confirm: SOS card appears in sidebar with correct priority level
[ ] End trip → status updates
```

---

## Appendix A: What to Say at IDP Review

**Live demo sequence:**
1. App opens, register, login
2. Start trip → "Tracking link sent to your emergency contacts" — show email on a second device
3. Start walking GPS (or simulate by changing coordinates) → dashboard updates live
4. Demo stop detection: stand still 3 min (or manually lower the threshold to 30s for demo: `const STOP_DURATION_MS = 30 * 1000` in stopDetection.js)
5. Check-in prompt appears → dismiss ("I'm Safe") → no SOS
6. Manual SOS: 5s countdown → fire → email arrives → dashboard red alert
7. Show danger zone circles on map
8. Nearest station shown in email: "Koramangala PS — 080-25504225"

**On Phase 2 (if asked):**
> "The MVP demonstrates the core safety pipeline — real-time GPS streaming over WebSockets, multi-trigger SOS with priority scoring, and emergency notification. Phase 2 integrates on-device scream detection using a two-stage SVM trained on MFCC feature vectors, and an A\* routing engine over OSM road network graphs with TOPSIS multi-criteria scoring for safe route ranking. The backend is designed to accept these as drop-in util modules with no structural changes."

---

## Appendix B: Architecture Decisions to Know Cold

These will be asked about at IDP review:

| Question | Answer |
|----------|--------|
| Why WebSocket for GPS, not HTTP polling? | Persistent connection: no handshake overhead per update, ~70% less bandwidth, server can push (check-in prompts) — polling can't. |
| Why Socket.io over raw WebSocket? | Built-in rooms, auto-reconnect, event namespacing, fallback to long-polling if WS blocked. |
| Why custom JWT over Supabase Auth? | Full control over token shape and expiry. Simpler for backend-only auth. Supabase Auth adds complexity for this use case. |
| Why OSRM over Google Maps? | Free, no API key, no quota. Public demo server adequate for college demo scale. |
| Why Haversine and not PostGIS spatial queries? | Haversine in JS is sufficient at this scale (< 500m distances, < 100 active trips). PostGIS adds infra complexity for MVP. Phase 2 with bigger dataset → move to PostGIS. |
| Why Resend over Twilio SMS? | India deliverability issues with Twilio trial (DLT registration required). Email is free, reliable, carries more info (maps link, audio clip). |
| Priority score formula basis? | Weighted additive scoring based on empirical factors: trigger type (manual SOS = highest intentionality), time of day (night = elevated risk), spatial context (danger zone proximity), and kinematic state (sudden stop). Similar to TOPSIS but simplified for real-time computation. |

---

*SafeGo Build Guide v2.0 | June 2026 | BMSIT&M CSE IDP | 1BY25CS116*
