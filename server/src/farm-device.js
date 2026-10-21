// This prototype has one authenticated field unit. Bind setup to its observed
// identity rather than a UI constant or an arbitrary client-supplied ID.
export function farmDeviceId(requested, latest, previous, now = Date.now()) {
  const age = now - Date.parse(latest?.receivedAt || "");
  const fresh =
    latest?.mode === "hardware" &&
    Number.isFinite(age) &&
    age >= -5000 &&
    age <= 150000;
  const deviceId = requested || previous?.deviceId || latest?.deviceId;
  if (typeof deviceId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(deviceId))
    throw new Error("Wait for a valid field-unit identity before saving.");
  if (!fresh || latest.deviceId !== deviceId)
    throw new Error(
      "The selected field unit has not sent a matching recent hardware report. Reconnect it and retry.",
    );
  return deviceId;
}
