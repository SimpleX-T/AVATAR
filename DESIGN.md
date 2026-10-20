# Project AVATAR Design System

<!-- impeccable:design-schema 1 -->

## Visual World

Project AVATAR is a farmer-facing field tool for an off-grid agriculture
prototype. The interface should feel practical, calm, and legible in daylight
on a phone, not like an examiner-only presentation. Keep the existing strong
printed-control-sheet character, but use decoration only when it helps someone
read farm conditions or operate the system.

## Surface Strategy

Mode: Operate.

The reading order is:

1. Is the farm unit working, and when did it last report?
2. Are the displayed readings current and understandable?
3. What is happening at the farm and at each sensor location?
4. Is an automatic action active, and why?
5. What can the farmer safely do next?

## Color Roles

- `paper`: warm off-white `#f4f0e6`
- `ink`: near-black `#11110f`
- `signal`: acid green `#b9f34a`
- `attention`: warm yellow `#ffd84d`
- `info`: clear blue `#7db7ff`
- `danger`: tomato red `#ff6b57`
- `muted-ink`: `#4e4d47`

Color appears as large functional fields, not scattered decoration. Status is
always written in text and never communicated by color alone.

## Typography

- Use highly legible type with familiar letterforms; avoid dense technical
  monospace as the primary reading face.
- Keep labels and instructions short, concrete, and easy to translate.
- Readings use tabular numerals.
- Body text is never below 16px; labels are never below 13px.

## Composition

- Strong 3px black borders.
- Square or lightly rounded corners only where the reference language needs
  them.
- Offset shadows use hard ink-like displacement.
- The first view foregrounds farm status, data freshness, and active actions.
- Every measurement includes a human-readable name and unit; show sensor
  location where known.
- Use status words as well as color, with distinct states for offline, stale,
  missing, simulated, and current readings.
- Controls use familiar labels, clear consequences, and confirmation for
  consequential actions; do not expose raw device commands as farmer controls.

## Motion

Motion is secondary to timely, stable readings. Use brief feedback to show a
new reading or a completed action; do not imply that animated data is live when
the device is offline or stale. Respect reduced-motion settings and do not make
motion the only way to communicate a state.

## Responsive Rules

- Desktop: farm status, key measurements, sensor locations, and action history
  are easy to scan together.
- Tablet: preserve readable measurement groups and reachable controls.
- Mobile: prioritize current status and next action; no essential reading or
  alert is hidden in a wide table or decorative canvas.
- Touch targets remain at least 44px.
- Controls work with keyboard access.

## Accessibility

- Contrast meets WCAG AA.
- Keyboard focus is a 3px black outline with yellow offset.
- Status has text, icon, and color.
- Charts and maps include accessible text equivalents and explicit units.
- Reduced-motion mode removes looping animation.
