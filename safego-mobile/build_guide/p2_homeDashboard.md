# SafeGo UI v2 – Part 2: Home Dashboard

Version: 2.0

Scope: HomeScreen UI only.

---

# Objective

Redesign HomeScreen into a dashboard while preserving all existing functionality.

This phase is UI-only.

Reuse all existing services, navigation, APIs, business logic and settings.

No functionality should change.

---

# Screen Purpose

The Home screen should become the primary safety dashboard.

Users should be able to perform the most common actions without navigating elsewhere.

Everything shown here should either:

- communicate current safety status
- trigger a frequently used feature
- navigate to an existing screen

---

# Layout

Top → Bottom

Welcome Header

↓

Emergency Profile Summary

↓

System Status

↓

SOS

↓

Quick Actions

↓

Trip Control

↓

Emergency Contacts

↓

Emergency Resources

---

# Header

Keep existing logo.

Keep profile avatar.

Display

Welcome back

User Name

Reuse existing profile data.

No backend changes.

---

# Emergency Profile Summary

Reuse existing implementation.

Display

- Blood Group
- Medical Notes Status
- Last Updated

Tapping the card should open the existing Emergency Details/Profile screen.

No editing on Home.

---

# System Status

Reuse existing SystemStatusCard.

Display

- Socket Connection
- Location Services
- Battery

Keep existing status logic.

Only redesign appearance.

---

# SOS Section

Most visually prominent component.

Center aligned.

Large circular button.

Danger color.

Minimum size

180px

Maximum size

220px

White text.

Bold typography.

Subtext

"Press and hold"

Hold duration

2 seconds.

Reuse existing SOS logic.

Do not modify backend requests.

Do not modify countdown implementation except duration if configurable.

---

# Quick Actions

Layout

2 columns

2 rows

Equal size cards.

Actions

Start Fake Call

Loud Siren

Current Location

Live Tracking

Each card

Icon

↓

Title

Only.

No descriptions.

Use Lucide icons.

Rounded corners.

Primary navigation only.

No duplicated business logic.

Reuse existing screens and services.

---

# Trip Control

Separate full-width button.

States

Inactive

Button

Start Trip

↓

Existing Trip flow.

Active

Button

End Trip

↓

Existing End Trip flow.

Only text changes.

Do not modify trip logic.

Button should automatically update based on existing trip state.

---

# Emergency Contacts

Single card.

Display

Title

↓

Up to three contact initials.

↓

Chevron.

Tap

↓

Existing Emergency Contacts screen.

If future contacts exceed three

Display

AB +2

Implementation optional.

---

# Emergency Resources

Reuse current implementation.

Display

Title

Current Location

↓

Find Nearby

↓

Chevron

No backend changes.

No service changes.

Current location should appear on the right.

If "Updated Now" already exists, retain it as subtle caption below the location. Otherwise, omit it rather than introducing fake freshness indicators.

---

# Card Style

Material Design 3.

Rounded

20

Consistent padding

24

Internal spacing

16

No large shadows.

Dark theme should rely on contrast.

---

# Buttons

Corner radius

18

Minimum height

56

Large touch targets.

No outlines unless required by theme.

---

# Icons

Lucide only.

Consistent stroke width.

No emoji.

No mixed icon sets.

---

# Spacing

Outer

24

Between sections

24

Within cards

16

Within grids

16

---

# Accessibility

Minimum touch area

48x48

Readable contrast.

Dynamic text friendly.

---

# Do Not Modify

Authentication

Trips

SOS logic

Fake Call logic

Location services

Maps

Emergency services

Settings

Supabase

Sockets

Storage

Audio

Backend APIs

Any service implementation

---

# Success Criteria

The Home screen should feel like a safety dashboard.

All existing functionality must continue working exactly as before.

Only presentation should change.