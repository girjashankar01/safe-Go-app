# SafeGo UI v2 – Part 6: Motion & Interaction

Version: 2.0

Scope: Interaction polish only.

---

# Objective

Add subtle Material Design inspired motion throughout the application.

Motion should improve feedback and usability without changing functionality.

Do not introduce decorative animations.

---

# Motion Principles

Motion must:

- Communicate state changes
- Improve responsiveness
- Guide attention
- Feel smooth
- Never delay user actions

Avoid excessive animation.

---

# Duration

Fast

100ms

Normal

200ms

Slow

300ms

SOS Hold

2000ms

---

# Easing

Use standard Material easing.

Avoid bounce.

Avoid elastic effects.

Avoid overshoot.

---

# Screen Transitions

Navigation transitions should remain simple.

Allowed

- Fade
- Slide

Avoid custom page animations.

---

# Buttons

All buttons

Press In

Scale

0.97

Press Out

Return to

1.0

Duration

100ms

Applies to

- Primary buttons
- Danger buttons
- Action cards
- List items

---

# Cards

Cards should animate only when entering.

Animation

Fade

↓

TranslateY

8px

↓

Normal position

Duration

200ms

Only on initial render.

---

# Bottom Navigation

Tab change

Fade

Icon color transition

Label color transition

No bounce.

No scaling.

---

# SOS Button

Reuse existing SOS implementation.

Improve interaction only.

Press

↓

Ripple

↓

Progress Ring

↓

Circular progress

↓

Trigger SOS

Progress duration

2000ms

After activation

Gentle pulse

Until SOS completes

No glow.

No flashing.

---

# Loud Siren

Inactive

Static

Active

Gentle pulse

Scale

1.00

↓

1.03

↓

1.00

Duration

1000ms

Repeat

Only while siren is active.

---

# Quick Actions

Press feedback only.

Scale

0.98

Ripple

Fade

No elevation jump.

---

# List Items

Emergency History

Trip History

Emergency Contacts

Press

↓

Ripple

↓

Chevron transition

Only standard Material behavior.

---

# Map

Do not animate map manually.

Reuse existing map animations.

Only add

Bottom fade

Tap ripple

Do not interfere with tracking.

---

# Loading

Buttons

Spinner inside button.

Cards

Skeleton if already implemented.

Otherwise

ActivityIndicator.

Do not introduce new loading architecture.

---

# Theme Transition

When changing theme

Crossfade colors.

Duration

200ms

Do not remount screens.

---

# Error States

No shaking.

No flashing.

Only color transition.

---

# Accessibility

Respect Reduce Motion where supported.

If Reduce Motion is enabled:

Disable

- Pulses
- Card entrance
- Theme fade

Keep

Ripple

Button feedback

Navigation

---

# Constraints

Do not modify:

- Business logic
- Services
- APIs
- Navigation hierarchy
- Tracking
- SOS flow
- Fake Call
- Trips

Only interaction polish.

---

# Success Criteria

The application should feel responsive and polished.

Animations should reinforce interaction without distracting the user.

Functionality remains unchanged.