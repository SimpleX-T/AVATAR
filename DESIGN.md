# Night Garden Design System

<!-- impeccable:design-schema 1 -->

## Visual World

Night Garden is a printed field-control sheet brought to life: cream paper,
heavy black rules, offset ink shadows, block colors, technical annotations, and
one live canvas illustration. It uses neo-brutalist clarity without becoming
noisy or cryptic.

The physical scene is a brightly lit classroom or projector screen during an
academic defence. This forces a light-first interface with strong contrast.

## Surface Strategy

Mode: Operate.

The reading order is:

1. Is the ESP32 connected?
2. Are field conditions normal?
3. What are the exact readings and units?
4. What can be demonstrated safely?
5. What has happened recently?

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

- Display and interface: a robust system monospace stack for the technical,
  printed-card character.
- Supporting prose: Georgia or another familiar serif for lecturer-friendly
  reading.
- Readings use tabular numerals.
- Body text is never below 16px; labels are never below 13px.

## Composition

- Strong 3px black borders.
- Square or lightly rounded corners only where the reference language needs
  them.
- Offset shadows use hard ink-like displacement.
- The top of the page is an explicit system summary, not a decorative hero.
- Metrics use different color fields but consistent internal anatomy.
- Controls include a title and one-sentence consequence.

## Motion

The single authored moment is the live field canvas. It visualizes the system
connection and telemetry: a signal travels from an ESP32 marker through a sensor
line into a growing field trace. Slow birds, a peeking rabbit, and a distant
field worker make the simulated farm feel inhabited while remaining visually
behind the sensor story. Motion pauses when the tab is hidden, stops when the
canvas is offscreen, and becomes static under reduced-motion settings.

Supporting motion is limited to:

- a short status stamp when telemetry arrives;
- a 120ms button press with offset-shadow movement; and
- number updates highlighted by a brief paper-flash.

## Responsive Rules

- Desktop/projector: summary metrics in one row, field canvas beside the written
  interpretation, controls in a clear grid.
- Tablet: two-column metrics and two-column controls.
- Mobile: single-column reading order with no hidden core information.
- Touch targets remain at least 44px.
- A print stylesheet removes interactive controls and animation while retaining
  readings, statuses, and timestamp.

## Accessibility

- Contrast meets WCAG AA.
- Keyboard focus is a 3px black outline with yellow offset.
- Status has text, icon, and color.
- Canvas includes an accessible written equivalent.
- Reduced-motion mode removes looping animation.
