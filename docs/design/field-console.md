# Field console implementation contract

THESIS: A greenhouse you can read. Conditions, freshness and bounded protection
are visible before settings. Replace the old poster and exposed command vocabulary.
OWN-WORLD: Forest navigation, ivory canvas, white instrument surfaces, serif page
headings and an Anatomy-built physical greenhouse model with precise shaded parts.
STORY: Sign in → verify the unit → name the greenhouse → wait for real device save
→ see fresh sensor evidence. Returning users go directly to their greenhouse.
FIRST VIEWPORT: Narrow persistent navigation, greenhouse name and status, four
readings, then a wide interactive greenhouse beside the protection readout.
FORM: Operator field journal, chosen directly under the user's one-shot request.

Activation: the grower is activated when fresh physical readings are visible and
the ESP32 has acknowledged the matching greenhouse profile revision.

Required: authentication, fresh device-attributed report, greenhouse name and
operator name (existing server requirements), profile acknowledgement.
Optional: crop. Contextual: reports after twelve commissioned hours, raw registers,
command testing, wiring and network explanation. Remove: decorative tours,
configuration before connection evidence, fake data and premature success.

States: loading, waiting for device, receiving, profile draft, saving, awaiting
acknowledgement, ready, connection interrupted, stale observations, cloud pending,
cloud unavailable, field fault. Draft survives reload; saved state comes from server.
No new claiming or ownership guarantees are invented for this single-device prototype.

Controls: LED commands require a fresh attributed device and show queued versus
acknowledged. No browser pump controls. Sensor failures stay distinct from connection.
Measurements preserve missing/null/invalid values. Probe numbers are raw registers.

Verification: isolated server integration tests for fresh local data during cloud
failure, device attribution, save/ack, error recovery; desktop/mobile/keyboard review.
