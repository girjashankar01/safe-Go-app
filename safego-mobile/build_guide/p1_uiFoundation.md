# SafeGo UI v2 – Part 1: UI Foundation

Version: 2.0
Scope: UI Layer Only

---

# Objective

Redesign the entire application UI without changing any existing business logic.

Only modify:

- Screens
- Navigation
- Components
- Styling
- Theme
- Icons
- Animations

Do NOT modify services, APIs, backend logic, sockets, location tracking, authentication, SOS logic, trip logic, fake call logic, or any existing functionality.

---

# Design Principles

- Material Design 3 inspired
- Minimal
- Clean
- Rounded corners
- Large touch targets
- Consistent spacing
- Functional over decorative
- Dark mode first
- Light mode fully supported
- Accessibility friendly

---

# Information Architecture

Bottom Navigation

Home

Activity

Settings

---

## Home

Purpose:

Primary dashboard for frequently used safety actions.

Contains:

- Welcome
- Emergency Profile Summary
- System Status
- SOS
- Quick Actions
- Trip Control
- Emergency Contacts
- Emergency Resources

---

## Activity

Purpose:

Live monitoring dashboard.

Contains:

- Embedded Live Map
- Live Tracking Summary
- Emergency History Preview
- Trip History Preview

Each preview navigates to its already existing screen.

---

## Settings

Keep current implementation.

Only add Appearance section later.

---

# Theme System

Create:

theme/

```
colors.ts
spacing.ts
typography.ts
radius.ts
elevation.ts
motion.ts

ThemeProvider.tsx

useTheme.ts
```

No hardcoded colors inside screens.

Always reference theme tokens.

---

# Color Tokens

## Light

Background: #F7F8FA

Surface: #FFFFFF

Card: #FFFFFF

Border: #E5E7EB

Primary: #16A34A

Danger: #EF4444

Text: #111827

Secondary Text: #6B7280

Divider: #E5E7EB

---

## Dark

Background: #121212

Surface: #1E1E1E

Card: #242424

Border: #303030

Primary: #22C55E

Danger: #FF4D4F

Text: #FFFFFF

Secondary Text: #B3B3B3

Divider: #2E2E2E

---

# Typography

Display
34

Headline
28

Title
22

Section
18

Body
16

Caption
13

Small
12

Font Weight

Regular

Medium

SemiBold

Bold

---

# Spacing

Use only

4

8

12

16

24

32

40

No arbitrary spacing values.

---

# Border Radius

Card
20

Button
18

Input
16

Chip
999

SOS
Circle

---

# Elevation

Light Theme

Material shadows

Dark Theme

Contrast only

No large shadows.

---

# Icons

Replace current icons with Lucide.

Rules

- Stroke width: 2
- Consistent size
- No emoji
- No filled icon sets

---

# Motion

Allowed

- Fade
- Scale
- Ripple
- Press feedback
- Pulse
- Navigation transition

Avoid

- Bounce
- 3D
- Neon glow
- Heavy blur
- Elastic animations

---

# Component Library

Create reusable UI components.

Card

Section

SectionHeader

ActionCard

StatusCard

PrimaryButton

DangerButton

ListItem

InfoRow

MapPreview

AvatarStack

ScreenContainer

SafeScrollView

Components must support Light and Dark themes.

---

# Screen Rules

No screen should directly contain:

- hardcoded colors
- duplicate card styling
- duplicate button styling
- duplicate typography

Everything should reuse UI components.

---

# Layout Rules

Use consistent padding.

Outer padding

24

Card spacing

16

Section spacing

24

Grid spacing

16

---

# Accessibility

Minimum touch target

48x48

Support Dynamic Type where possible.

Maintain sufficient contrast in both themes.

---

# Non Goals

Do not change

- API contracts
- Business logic
- Existing services
- Existing storage
- Existing navigation destinations
- Existing backend communication

Only presentation changes.