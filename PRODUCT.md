# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are university lecturers and project examiners assessing a
final-year embedded-systems project. They may not be familiar with modern
dashboard conventions and need to understand the system from a quick glance,
often on a laptop or projected screen.

The student project team also uses the dashboard while developing and
demonstrating the ESP32 system.

## Product Purpose

Night Garden demonstrates an off-grid, ESP32-based agricultural monitoring and
protection system. The dashboard makes live environmental readings, device
connectivity, simulated events, and system responses visible and understandable.

Success means an examiner can identify what is being measured, whether the
device is connected, whether conditions are normal, and what each demonstration
control does without explanation from the interface designer.

## Positioning

Night Garden connects a real ESP32 control architecture to a transparent
teaching and demonstration interface. It presents the sensor-to-decision-to-
actuator relationship rather than treating telemetry as detached analytics.

## Operating Context

- Used during project development, live demonstrations, and academic defence.
- Viewed on laptops, projectors, tablets, and phones.
- Runs on a trusted local network with an ESP32, Node server, and browser.
- Currently supports simulated telemetry because physical sensors and actuators
  are not yet available.

## Capabilities and Constraints

- Shows temperature, humidity, soil ADC, light, motion, fire, device mode, Wi-Fi
  signal, and last contact time.
- Queues simulation commands for the ESP32.
- Receives realtime updates through Server-Sent Events.
- Must remain understandable without familiarity with specialist UI patterns.
- Must remain usable when JavaScript motion is disabled.
- Must not imply that simulated readings are real field measurements.

## Brand Commitments

- Product name: Night Garden.
- Clear, direct, student-project language.
- Neo-brutalist visual style inspired by PostHog, GitReverse, printed technical
  cards, and the user's supplied monochrome reference images.
- Paper-like surfaces, strong black outlines, offset shadows, restrained color,
  and purposeful HTML canvas motion.

## Evidence on Hand

- Working ESP32 simulation telemetry.
- Working local server, command queue, and dashboard.
- Real sensor and output state schema in the repository.
- No real farm trial data, crop-yield evidence, or physical sensor measurements
  are currently available and none should be fabricated.

## Product Principles

1. Explain the system before decorating it.
2. Show status in words as well as color.
3. Keep the sensor-to-response relationship visible.
4. Label simulation honestly.
5. Preserve safe operation and explicit controls.

## Accessibility & Inclusion

Use high contrast, large readable labels, visible keyboard focus, 44-pixel
minimum touch targets, redundant status indicators, reduced-motion support, and
layouts that remain clear on projectors and small screens.
