# SafeGo UI v2 – Part 4: Navigation

Version: 2.0

Scope: Navigation hierarchy only.

---

# Objective

Replace the current navigation structure with a minimal bottom navigation while preserving every existing screen and route.

This phase must not modify business logic or screen functionality.

---

# Navigation Structure

Bottom Navigation

Home

↓

Activity

↓

Settings

Only these three tabs should exist.

---

# Home Tab

Contains

Home Dashboard

The Home dashboard provides entry points to:

- Fake Call
- Loud Siren
- Current Location
- Live Map
- Emergency Contacts
- Emergency Resources
- Emergency Profile
- Trip Control

These destinations must continue using their existing screens.

---

# Activity Tab

Contains

Activity Dashboard

The Activity dashboard provides entry points to:

- Full Map
- Live Tracking
- Emergency History
- Trip History

These destinations must continue using their existing screens.

---

# Settings Tab

Reuse the existing Settings screen.

No redesign in this phase.

Only move it under the new Bottom Navigation.

---

# Navigation Architecture

Root

↓

Bottom Tabs

├── Home

├── Activity

└── Settings

Each tab may contain its own Stack Navigator.

Example

Bottom Tabs

↓

Home Stack

Home Dashboard

↓

Emergency Contacts

↓

Emergency Profile

↓

Emergency Resources

↓

Current Location

↓

Map

↓

Trip

---

Activity Stack

Activity Dashboard

↓

Map

↓

Trip History

↓

Emergency History

↓

Live Tracking

---

Settings Stack

Settings

---

# Existing Routes

Do not rename existing route names unless absolutely required.

Reuse current navigation destinations.

Only reorganize hierarchy.

---

# Deep Linking

If already implemented

preserve existing deep links.

Do not break navigation state.

---

# Header

Hide default navigation headers where the dashboard provides its own layout.

Maintain back navigation for pushed screens.

---

# Bottom Navigation Design

Material Design 3.

Rounded top corners.

Safe Area aware.

Equal spacing.

No floating navigation.

No custom animations beyond standard Material transitions.

---

# Icons

Lucide.

Home

House

Activity

Activity

Settings

Settings

Consistent stroke width.

---

# Active State

Active

Primary Green

Inactive

Secondary Text

No badges.

No labels above icons.

Keep labels below icons.

---

# Screen State

Changing tabs must preserve:

- Scroll position
- Existing screen state where possible
- Active trip state
- Existing navigation history inside each stack

Do not reset screens unnecessarily.

---

# Constraints

Do not modify:

- Business logic
- Services
- APIs
- SOS
- Trip implementation
- Fake Call
- Audio
- Maps
- Tracking
- Emergency Resources
- Authentication

Only navigation hierarchy.

---

# Success Criteria

Users can access every existing feature using only:

Home

Activity

Settings

No existing screen becomes unreachable.

Navigation remains stable on Android and iOS.