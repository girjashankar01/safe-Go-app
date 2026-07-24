# SafeGo UI v2 – Part 5: Theming

Version: 2.0

Scope: Theme architecture only.

---

# Objective

Implement a centralized theme system supporting:

- Dark Theme (default)
- Light Theme
- System Theme (optional)

All UI colors, typography, spacing and elevations must be derived from theme tokens.

No screen should contain hardcoded color values.

---

# Theme Architecture

src/theme/

```
colors.ts
spacing.ts
typography.ts
radius.ts
elevation.ts
motion.ts

ThemeProvider.tsx
useTheme.ts
index.ts
```

ThemeProvider should wrap the application once.

Every component should consume theme values through useTheme().

---

# Theme Modes

Supported Modes

- Dark
- Light
- System (optional)

Default

Dark

Persist user preference locally.

---

# Semantic Colors

Never reference colors directly inside screens.

Use semantic tokens only.

Example

background

surface

card

primary

danger

success

warning

textPrimary

textSecondary

border

divider

iconPrimary

iconSecondary

disabled

overlay

---

# Light Palette

Background

#F7F8FA

Surface

#FFFFFF

Card

#FFFFFF

Primary

#16A34A

Danger

#EF4444

Success

#22C55E

Warning

#F59E0B

Text Primary

#111827

Text Secondary

#6B7280

Border

#E5E7EB

Divider

#E5E7EB

Overlay

rgba(0,0,0,0.45)

---

# Dark Palette

Background

#121212

Surface

#1E1E1E

Card

#242424

Primary

#22C55E

Danger

#FF4D4F

Success

#22C55E

Warning

#FBBF24

Text Primary

#FFFFFF

Text Secondary

#B3B3B3

Border

#303030

Divider

#2E2E2E

Overlay

rgba(0,0,0,0.60)

---

# Special Colors

SOS

Always red.

Never changes with theme.

Trip Button

Primary Green.

Status

Reuse existing status colors where possible.

Do not introduce new meanings.

---

# Typography

Typography must remain identical across themes.

Only colors change.

---

# Elevation

Light Theme

Material elevation shadows.

Dark Theme

Prefer contrast instead of heavy shadows.

Minimal shadow only where necessary.

---

# Images & Maps

Do not recolor:

- Maps
- User avatars
- Profile images
- Existing media

Only surrounding UI changes.

---

# Theme Toggle

Add a new section in Settings.

Appearance

↓

Theme

Options

- Dark
- Light
- System

Changing the theme should update the UI immediately.

Persist the user's choice.

---

# Existing Settings

Do not modify any existing settings.

Only append the new Appearance section.

---

# Accessibility

Maintain WCAG-compliant contrast.

Ensure all text remains readable.

Touch targets remain unchanged.

---

# Constraints

Do not modify:

- Business logic
- Services
- APIs
- Navigation
- Authentication
- SOS
- Trips
- Fake Call
- Location
- Tracking
- Backend

Only styling.

---

# Success Criteria

Every screen uses theme tokens.

No hardcoded colors remain in newly updated UI.

Dark mode is the default.

Light mode behaves consistently.

Theme changes without restarting the application.