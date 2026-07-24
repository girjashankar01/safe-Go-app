# SafeGo UI v2 – Part 3: Activity Dashboard

Version: 2.0

Scope: Activity screen only.

---

# Objective

Create a unified monitoring dashboard using existing features.

This screen should not introduce any new functionality.

Reuse:

- Existing Map screen
- Existing Live Tracking screen
- Existing Emergency History
- Existing Trip History

Only redesign presentation.

---

# Purpose

Provide a real-time overview of:

- Current location
- Movement
- Tracking
- Emergency history
- Trip history

without requiring users to open multiple screens.

---

# Layout

Top → Bottom

Live Map

↓

Live Tracking

↓

Emergency History

↓

Trip History

---

# Live Map

Reuse the existing Map implementation.

Do not recreate maps.

Embed the existing map component.

The map should:

- follow current location
- keep user visible
- avoid aggressive recentering
- animate smoothly

Apply a bottom fade into the next section.

Tapping anywhere on the map opens the existing full-screen Map screen.

No changes to map logic.

---

# Live Tracking

Single information card.

Display

Location

↓

Coordinates

↓

Motion Status

↓

Speed

↓

Last Updated

Reuse existing tracking data.

No new calculations.

No polling changes.

No location logic changes.

---

# Suggested Layout

Location

Bengaluru, Karnataka

Latitude

12.9716

Longitude

77.5946

Status

Walking

Speed

5.2 km/h

Updated

Just now

Only show values already available.

---

# Motion States

Reuse existing values.

Examples

Stopped

Walking

Running

Driving

Unknown

Do not create new logic.

---

# Emergency History

Preview card.

Display latest emergency only.

Information

Title

↓

Date

↓

Status (if available)

Button

View All

↓

Existing Emergency History screen.

---

# Trip History

Preview card.

Display latest trip only.

Information

Destination

↓

Date

↓

Duration (if available)

Button

View All

↓

Existing Trip History screen.

---

# Card Design

Material Design 3.

Rounded corners.

Consistent spacing.

Minimal elevation.

Dark theme uses contrast instead of shadows.

---

# Embedded Map

Height

260–320 px

Rounded

20

Touch enabled.

Tap opens full map.

Bottom fade.

---

# Icons

Lucide only.

Navigation

ChevronRight

History

History

Location

MapPin

Speed

Gauge

Time

Clock

Movement

Navigation

---

# Accessibility

Touch targets

48x48

Readable typography.

Good contrast.

---

# Do Not Modify

Map logic

Location tracking

GPS

Socket streaming

Trip tracking

Emergency history logic

Trip history logic

Services

Backend

Storage

Authentication

Navigation

---

# Success Criteria

Users should understand their current status at a glance.

Every section should either:

display existing live information

or

navigate to an already existing screen.

No new business logic.