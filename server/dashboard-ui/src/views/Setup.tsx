import { useEffect, useState } from "react";
import { LiveState } from "../lib/useLive";
import { api, FarmResponse } from "../lib/api";
import { GreenhouseScene } from "../components/illustrations";

const DRAFT_KEY = "avatar-greenhouse-draft-v2";

export default function Setup({ live }: { live: LiveState }) {
  const { fs, latest, farm, activation, refresh, loading } = live;
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
      /* private mode */
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
      live.setFeed("Profile saved — now waiting on the unit to confirm");
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

  if (loading)
    return (
      <div className="empty" style={{ padding: "120px 20px" }}>
        <span className="dots" style={{ justifyContent: "center" }}>
          <i />
          <i />
          <i />
        </span>
        <p style={{ marginTop: 18 }}>Seeing who's already here…</p>
      </div>
    );

  return (
    <div className="stagger">
      <div className="topbar" style={{ padding: 0 }}>
        <div className="greeting">
          <h1>Let's get acquainted</h1>
          <p>
            Three short steps, and your progress keeps itself. The final
            unlock needs real telemetry from the unit — practice data doesn't
            count.
          </p>
        </div>
      </div>

      <section className="card" style={{ maxWidth: 640 }}>
        <div className="wizard">
          {node(1, "Spot the unit")}
          <span className="tie" />
          {node(2, "Name the tunnel")}
          <span className="tie" />
          {node(3, "Seal the match")}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
              Is the little box out there?
            </h2>
            <p className="quiet" style={{ marginBottom: 18 }}>
              It introduces itself as <span className="num">{latest?.deviceId || "——"}</span>.
              We just need to see a fresh hardware report before we shake
              hands.
            </p>
            <p style={{ marginBottom: 22 }}>
              {activation.receiving ? (
                <span className="badge good">Found it — it's talking</span>
              ) : (
                <span className="badge warning">
                  {latest ? "It's gone quiet" : "Haven't met it yet"}
                </span>
              )}
            </p>
            <button
              className="pill-btn solid"
              disabled={!activation.receiving}
              onClick={() => setStep(2)}
            >
              On to the details →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
              Put your name on it
            </h2>
            <p className="quiet" style={{ marginBottom: 20 }}>
              These details stick to the unit currently reporting in.
            </p>
            <div className="field">
              <label htmlFor="gh-name">What do you call your greenhouse?</label>
              <input
                id="gh-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  persistDraft({ name: e.target.value, farmerName, crop });
                }}
                placeholder="The north tunnel, Papa's garden…"
              />
            </div>
            <div className="field">
              <label htmlFor="gh-farmer">And who tends it?</label>
              <input
                id="gh-farmer"
                value={farmerName}
                onChange={(e) => {
                  setFarmerName(e.target.value);
                  persistDraft({ name, farmerName: e.target.value, crop });
                }}
                placeholder="Your name"
              />
            </div>
            <div className="field">
              <label htmlFor="gh-crop">
                What's growing in there? <span className="quiet">(say it later if you like)</span>
              </label>
              <input
                id="gh-crop"
                value={crop}
                onChange={(e) => {
                  setCrop(e.target.value);
                  persistDraft({ name, farmerName, crop: e.target.value });
                }}
                placeholder="Tomatoes, peppers…"
              />
            </div>
            {error && (
              <div className="notice danger" role="alert" style={{ margin: "0 0 16px" }}>
                <div>
                  <strong>That didn't take</strong>
                  {error}
                </div>
              </div>
            )}
            <div className="cta-row">
              <button
                className="pill-btn solid"
                disabled={!fs.canCommand || saving || !name.trim()}
                onClick={() => void save()}
              >
                {saving ? "Putting it on record…" : "Save it"}
              </button>
              <button className="pill-btn ghost" onClick={() => setStep(1)}>
                Go back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
              The handshake
            </h2>
            <p className="quiet" style={{ marginBottom: 18 }}>
              You're done when the unit itself confirms your details — watch
              the three lamps below.
            </p>
            <div className="row-list" style={{ marginBottom: 18 }}>
              {[
                { ok: Boolean(farm), label: "The server has your details" },
                {
                  ok: activation.profileSaved,
                  label: "The unit carries the same profile",
                },
                {
                  ok: activation.receiving && activation.matching,
                  label: "It's reporting fresh, and it's the right unit",
                },
              ].map((item) => (
                <div className="row-item" key={item.label}>
                  <span className={`ri-icon ${item.ok ? "good" : "neutral"}`}>
                    {item.ok ? "✓" : "○"}
                  </span>
                  <div className="ri-body">
                    <h3 style={{ fontWeight: item.ok ? 700 : 500 }}>{item.label}</h3>
                  </div>
                  <span className={`badge ${item.ok ? "good" : "neutral"}`}>
                    {item.ok ? "Lit" : "Waiting"}
                  </span>
                </div>
              ))}
            </div>
            {activation.ready && (
              <p className="quiet" style={{ marginBottom: 18 }}>
                Your twelve-hour clock started at{" "}
                <span className="num">
                  {new Date(
                    farm!.commissionedAt || farm!.deviceSyncedAt!,
                  ).toLocaleString()}
                </span>
                .
              </p>
            )}
            <div className="cta-row">
              <a
                className="pill-btn solid"
                href="#overview"
                style={{ textDecoration: "none" }}
              >
                Take me to my greenhouse →
              </a>
              <button className="pill-btn ghost" onClick={() => setStep(2)}>
                Change the details
              </button>
            </div>
          </div>
        )}
      </section>

      <div style={{ textAlign: "center" }}>
        <GreenhouseScene width={360} />
      </div>
    </div>
  );
}
