// A cloud archive outage must not hide a fresh authenticated device report.
export function localDashboardState(
  latest,
  history,
  { configured = false, pending = false, now = Date.now() } = {},
) {
  const age = now - Date.parse(latest?.receivedAt || "");
  if (!latest || !Number.isFinite(age) || age < -5000 || age > 150000)
    return null;
  return {
    latest,
    history,
    source: "local",
    cloudConfigured: configured,
    cloudAvailable: null,
    pendingUpload: pending,
    deviceReportedRecently: true,
  };
}
