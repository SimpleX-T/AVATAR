import { useEffect, useState } from "react";
import { LiveState } from "../lib/useLive";
import { api, FarmResponse } from "../lib/api";

const DRAFT_KEY = "avatar-greenhouse-draft-v2";

export default function Setup({ live }: { live: LiveState }) {
  const { fs, latest, farm, activation, refresh } = live;
  const [step, setStep] = useState(farm ? 3 : 1);
  const [name, setName] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [crop, setCrop] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        deviceId?: string;
        revision?: string;
        name?: string;
        farmerName?: string;
        crop?: string;
      };
      if (draft.deviceId && draft.deviceId !== latest?.deviceId) return;
      if (draft.revision && draft.revision !== farm?.revision) return;
      setName(draft.name || "");
      setFarmerName(draft.farmerName || "");
      setCrop(draft.crop || "");
    } catch {
      /* drafts are disposable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (farm && farm.deviceSyncedAt) setStep(3);
  }, [farm]);

  const persistDraft = (next: {
    name: string;
    farmerName: string;
    crop: string;
  }) => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          ...next,
          deviceId: latest?.deviceId,
          revision: farm?.revision,
        }),
      );
    } catch {
      /* private mode etc. */
    }
  };

  const save = async () => {
    if (!fs.canCommand) return;
    setSaving(true);
    setError("");
    try {
      await api<FarmResponse>("/api/farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          farmerName: farmerName.trim(),
          crop: crop.trim(),
          deviceId: latest!.deviceId,
        }),
      });
      localStorage.removeItem(DRAFT_KEY);
      await refresh();
      setStep(3);
      live.setFeed("Greenhouse profile saved — waiting for device acknowledgement");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const node = (n: number, label: string) => (
    <span className={`node ${step === n ? "active" : step > n ? "done" : ""}`}>
      <span className="ring">{step > n ? "✓" : n}</span>
      {label}
    </span>
  );

  return (
    <>
      <p className="kicker">Setup</p>
      <h1 className="headline">
        Meet your <em>greenhouse.</em>
      </h1>
      <p className="sub">
        Three short steps. Progress is saved as you go, and activation requires
        fresh physical telemetry — never a simulated reading.
      </p>

      <section className="section" style={{ maxWidth: 680 }}>
        <div className="wizard">
          {node(1, "Check device")}
          <span className="tie" />
          {node(2, "Make it yours")}
          <span className="tie" />
          {node(3, "Verify & grow")}
        </div>

        <div className="panel">
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 24, marginBottom: 6 }}>
                Find your field unit
              </h2>
              <p className="quiet" style={{ marginBottom: 18 }}>
                The ESP32 reports as <span className="num">{latest?.deviceId || "——"}</span>.
                Activation needs a fresh hardware report — simulation does not
                count.
              </p>
              <p style={{ marginBottom: 22 }}>
                {activation.receiving ? (
                  <span className="badge good">Receiving</span>
                ) : (
                  <span className="badge warning">
                    {latest ? "Not reporting fresh data" : "No report yet"}
                  </span>
                )}
              </p>
              <button
                className="cta cta-solid"
                disabled={!activation.receiving}
                onClick={() => setStep(2)}
              >
                Continue to greenhouse details →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 24, marginBottom: 6 }}>
                Make it yours
              </h2>
              <p className="quiet" style={{ marginBottom: 20 }}>
                Saved against the reporting device {latest?.deviceId || "——"}.
              </p>
              <div className="field">
                <label htmlFor="gh-name">Greenhouse name</label>
                <input
                  id="gh-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    persistDraft({ name: e.target.value, farmerName, crop });
                  }}
                  placeholder="e.g. North tunnel"
                />
              </div>
              <div className="field">
                <label htmlFor="gh-farmer">Operator name</label>
                <input
                  id="gh-farmer"
                  value={farmerName}
                  onChange={(e) => {
                    setFarmerName(e.target.value);
                    persistDraft({ name, farmerName: e.target.value, crop });
                  }}
                  placeholder="Who runs this greenhouse?"
                />
              </div>
              <div className="field">
                <label htmlFor="gh-crop">
                  Crop <span className="quiet">(optional)</span>
                </label>
                <input
                  id="gh-crop"
                  value={crop}
                  onChange={(e) => {
                    setCrop(e.target.value);
                    persistDraft({ name, farmerName, crop: e.target.value });
                  }}
                  placeholder="e.g. Tomatoes"
                />
              </div>
              {error && (
                <div className="notice danger" role="alert" style={{ margin: "0 0 18px" }}>
                  <div>
                    <strong>Could not save</strong>
                    {error}
                  </div>
                </div>
              )}
              <div className="cta-row">
                <button
                  className="cta cta-solid"
                  disabled={!fs.canCommand || saving || !name.trim()}
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save and verify"}
                </button>
                <button className="cta cta-line" onClick={() => setStep(1)}>
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 24, marginBottom: 6 }}>
                Confirm and grow
              </h2>
              <p className="quiet" style={{ marginBottom: 18 }}>
                Activation completes when the field unit acknowledges your
                profile on the record.
              </p>
              <ul className="ritual">
                <li className={farm ? "done" : "pending"}>
                  {farm ? "✓" : "○"} Profile saved on the server
                </li>
                <li className={activation.profileSaved ? "done" : "pending"}>
                  {activation.profileSaved ? "✓" : "○"} Matching profile saved
                  on the ESP32
                </li>
                <li
                  className={
                    activation.receiving && activation.matching
                      ? "done"
                      : "pending"
                  }
                >
                  {activation.receiving && activation.matching ? "✓" : "○"}{" "}
                  Fresh report from the registered device
                </li>
              </ul>
              {activation.ready && (
                <p className="quiet" style={{ marginBottom: 18 }}>
                  The 12-hour report clock started at{" "}
                  <span className="num">
                    {new Date(
                      farm!.commissionedAt || farm!.deviceSyncedAt!,
                    ).toLocaleString()}
                  </span>
                  .
                </p>
              )}
              <div className="cta-row">
                <a className="cta cta-solid" href="#overview">
                  Open my greenhouse →
                </a>
                <button className="cta cta-line" onClick={() => setStep(2)}>
                  Edit details
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
