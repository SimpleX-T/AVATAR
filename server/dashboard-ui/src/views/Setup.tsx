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

  // Restore the resumable draft (keyed by deviceId + farm revision).
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
      live.setFeed("Greenhouse profile saved; waiting for device acknowledgement");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const stepNode = (n: number, label: string) => (
    <span className={`step-node ${step === n ? "active" : step > n ? "done" : ""}`}>
      <span className="dot">{step > n ? "✓" : n}</span>
      {label}
    </span>
  );

  return (
    <>
      <header className="page-head rise">
        <p className="eyebrow">Setup</p>
        <h1>
          Meet your <em>greenhouse.</em>
        </h1>
        <p className="lede">
          Three short steps. Your progress is saved, and activation requires
          fresh physical telemetry — never a simulated reading.
        </p>
      </header>

      <section className="panel rise" style={{ maxWidth: 640 }}>
        <div className="wizard-steps">
          {stepNode(1, "Check device")}
          <span className="step-line" />
          {stepNode(2, "Make it yours")}
          <span className="step-line" />
          {stepNode(3, "Verify & grow")}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Find your field unit</h2>
            <p className="quiet" style={{ marginBottom: 16 }}>
              The ESP32 on the bench reports as <span className="num">{latest?.deviceId || "—"}</span>.
              Activation needs a fresh hardware report — simulation does not
              count.
            </p>
            <p style={{ marginBottom: 18 }}>
              {activation.receiving ? (
                <span className="pill good">Receiving</span>
              ) : (
                <span className="pill warning">
                  {latest ? "Not reporting fresh data" : "No report yet"}
                </span>
              )}
            </p>
            <button
              className="btn btn-primary"
              disabled={!activation.receiving}
              onClick={() => setStep(2)}
            >
              Continue to greenhouse details
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Make it yours</h2>
            <p className="quiet" style={{ marginBottom: 16 }}>
              Saved against the reporting device {latest?.deviceId || "—"}.
            </p>
            <div className="form-row">
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
            <div className="form-row">
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
            <div className="form-row">
              <label htmlFor="gh-crop">
                Crop <span className="form-hint">(optional)</span>
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
              <div className="alert-banner warning" role="alert" style={{ margin: "0 0 14px" }}>
                <div>
                  <strong>Could not save</strong>
                  {error}
                </div>
              </div>
            )}
            <div className="row-actions">
              <button
                className="btn btn-primary"
                disabled={!fs.canCommand || saving || !name.trim()}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save and verify"}
              </button>
              <button className="btn btn-outline" onClick={() => setStep(1)}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Confirm and grow</h2>
            <p className="quiet" style={{ marginBottom: 14 }}>
              Activation completes when the field unit acknowledges your
              profile on the record.
            </p>
            <ul className="checklist">
              <li className={farm ? "done" : "pending"}>
                {farm ? "✓" : "○"} Profile saved on the server
              </li>
              <li className={activation.profileSaved ? "done" : "pending"}>
                {activation.profileSaved ? "✓" : "○"} Matching profile saved on
                the ESP32
              </li>
              <li
                className={
                  activation.receiving && activation.matching ? "done" : "pending"
                }
              >
                {activation.receiving && activation.matching ? "✓" : "○"} Fresh
                report from the registered device
              </li>
            </ul>
            {activation.ready && (
              <p className="quiet" style={{ marginBottom: 14 }}>
                The 12-hour report clock started at{" "}
                <span className="num">
                  {new Date(farm!.commissionedAt || farm!.deviceSyncedAt!).toLocaleString()}
                </span>
                .
              </p>
            )}
            <div className="row-actions">
              <a className="btn btn-primary" href="#overview">
                Open my greenhouse
              </a>
              <button className="btn btn-outline" onClick={() => setStep(2)}>
                Edit details
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
