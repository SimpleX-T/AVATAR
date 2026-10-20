const $ = (id) => document.getElementById(id);
const format = (value, digits = 1) => value == null ? "No reading" : Number(value).toFixed(digits);
const time = (value) => new Date(value).toLocaleString();

function render(report) {
  $("farm-name").textContent = report.farm.name;
  $("farmer-name").textContent = report.farm.farmerName;
  $("crop").textContent = report.farm.crop || "Not specified";
  $("period").textContent = `${time(report.period.from)} – ${time(report.period.to)}`;
  $("generated-at").textContent = `Prepared ${time(report.period.to)}`;

  const { temperatureC, humidityPercent } = report.air;
  const { moistureAdc, drySamples } = report.soil;
  $("temperature").textContent = temperatureC.count ? `${format(temperatureC.average)} °C average` : "No reading";
  $("temperature-detail").textContent = temperatureC.count
    ? `Lowest ${format(temperatureC.minimum)} °C · highest ${format(temperatureC.maximum)} °C. ${temperatureC.count} recorded readings.`
    : "No valid air temperature was recorded in this period.";
  $("humidity").textContent = humidityPercent.count ? `${format(humidityPercent.average)}% average` : "No reading";
  $("humidity-detail").textContent = humidityPercent.count
    ? `Lowest ${format(humidityPercent.minimum)}% · highest ${format(humidityPercent.maximum)}%. ${humidityPercent.count} recorded readings.`
    : "No valid humidity was recorded in this period.";
  $("soil").textContent = moistureAdc.count ? `${format(moistureAdc.average, 0)} ADC average` : "No reading";
  $("soil-detail").textContent = moistureAdc.count
    ? `The controller marked soil dry in ${drySamples} of ${report.sampleCount.soil} soil records. ADC is not a moisture percentage.`
    : "No valid soil moisture was recorded in this period.";

  $("fire-samples").textContent = `${report.protection.fireDetectedSamples} of ${report.sampleCount.climate} climate records`;
  $("irrigation-samples").textContent = `${report.protection.irrigationCommandedSamples} of ${report.sampleCount.climate} climate records`;
  $("fire-pump-samples").textContent = `${report.protection.firePumpCommandedSamples} of ${report.sampleCount.climate} climate records`;
  const anyData = report.sampleCount.soil + report.sampleCount.climate > 0;
  $("summary-copy").textContent = anyData
    ? "The cards below describe measurements received during the last 12 hours. Use them to spot conditions worth checking in person; they are not a crop prescription."
    : "No field measurements were recorded in the last 12 hours. Check the ESP32 connection and ThingSpeak publishing before drawing conclusions.";
  $("coverage").textContent = `Coverage: ${report.sampleCount.soil} soil records · ${report.sampleCount.climate} climate records. Missing records are not filled in or estimated.`;
  $("research-note").textContent = report.researchNote;
  $("report-status").textContent = anyData ? "Generated from recorded field data." : "Report generated, but no field data was available.";
  $("report-content").hidden = false;
  $("print-report").disabled = false;
}

async function load() {
  const response = await fetch("/api/report");
  if (response.status === 401) { location.assign("/auth/"); return; }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not prepare the report.");
  render(result);
}

$("print-report").addEventListener("click", () => window.print());
load().catch((error) => { $("report-status").textContent = error.message; });
