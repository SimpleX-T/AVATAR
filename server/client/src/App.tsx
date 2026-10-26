import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getAccessToken,
  useLoginWithEmail,
  usePrivy,
} from "@privy-io/react-auth";
import { GreenhouseScene } from "./illustrations";

type AppProps = {
  configurationRequired?: boolean;
};

function BrandMark() {
  return (
    <a className="mini-brand" href="/" aria-label="Project AVATAR home">
      <span className="mini-glyph">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 17C6 9.5 10 6 18 4.5 18.8 13.5 14.5 18 8.5 18c-.9 0-1.7-.3-2.5-1z" />
          <path d="M6 17c3-5 7-8 12-10" />
        </svg>
      </span>
      <span className="mini-word">
        avatar<i>.</i>
      </span>
    </a>
  );
}

const TAGLINES = [
  "Your greenhouse, one clear view.",
  "Local protection that never sleeps.",
  "A research record you can trust.",
];

function StoryPanel() {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setSlide((s) => (s + 1) % TAGLINES.length),
      4200,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className="story" aria-label="About AVATAR">
      <div className="story-art-wrap">
        <GreenhouseScene width={460} />
        <div className="float-card">
          <div className="float-title">Field unit</div>
          <div className="float-sub">Local protection active</div>
          <span className="float-chip">ESP32</span>
        </div>
      </div>
      <div className="story-caption">
        <p key={slide} className="story-tagline">
          {TAGLINES[slide]}
        </p>
        <div className="story-dots" role="tablist" aria-label="Highlights">
          {TAGLINES.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === slide}
              aria-label={`Highlight ${i + 1}`}
              className={`story-dot ${i === slide ? "on" : ""}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function AuthenticatedGate() {
  const { ready, authenticated, logout } = usePrivy();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  async function within<T>(
    promise: Promise<T>,
    milliseconds: number,
  ): Promise<T> {
    let timeoutId = 0;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error("The secure session took too long to verify.")),
        milliseconds,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function establishServerSession() {
    setSyncing(true);
    setMessage("");
    try {
      const accessToken = await within(getAccessToken(), 10_000);
      if (!accessToken)
        throw new Error("Privy did not return an access token.");
      const response = await within(
        fetch("/api/auth/session", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        12_000,
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.error || "The server could not verify this session.",
        );
      }
      window.location.assign("/");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sign-in could not be completed.",
      );
      setSyncing(false);
    }
  }

  useEffect(() => {
    const requestedLogout = new URLSearchParams(window.location.search).has(
      "logout",
    );
    if (ready && authenticated && requestedLogout) {
      void logout().then(() => window.history.replaceState({}, "", "/auth/"));
      return;
    }
    if (ready && authenticated) void establishServerSession();
  }, [ready, authenticated]);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await sendCode({ email: email.trim() });
    } catch {
      setMessage(
        "We could not send the code. Check the address and try again.",
      );
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await loginWithCode({ code: code.trim() });
    } catch {
      setMessage("That code was not accepted. Check it or request a new one.");
    }
  }

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const digits = code.padEnd(6, " ").split("");
    digits[index] = digit || " ";
    setCode(digits.join("").trimEnd());
    if (digit && index < 5) otpInputs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Backspace") return;
    const digit = code[index] || "";
    if (!digit && index > 0) otpInputs.current[index - 1]?.focus();
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setCode(pasted);
    otpInputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  if (!ready || syncing) {
    return (
      <div className="gate-status" role="status">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <p>Preparing your secure field session…</p>
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="recovery" role="alert">
        <strong>We confirmed your email, but could not open the dashboard.</strong>
        <p>{message || "The secure server session was not completed."}</p>
        <button type="button" onClick={establishServerSession}>
          Try opening the dashboard again
        </button>
        <button className="text-btn" type="button" onClick={() => void logout()}>
          Sign out and start again
        </button>
      </div>
    );
  }

  const awaitingCode =
    state.status === "awaiting-code-input" ||
    state.status === "submitting-code";

  return awaitingCode ? (
    <form className="auth-form" onSubmit={verifyCode}>
      <label htmlFor="code">Six-digit code</label>
      <p className="field-help">
        We sent a one-time code to <strong>{email}</strong>.
      </p>
      <div className="otp-row" onPaste={handleOtpPaste}>
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              otpInputs.current[index] = element;
            }}
            id={index === 0 ? "code" : undefined}
            aria-label={`Code digit ${index + 1} of 6`}
            value={code[index] || ""}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleOtpKeyDown(index, event)}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]"
            maxLength={1}
            required
            autoFocus={index === 0}
          />
        ))}
      </div>
      <button
        className="cta"
        disabled={state.status === "submitting-code"}
        type="submit"
      >
        {state.status === "submitting-code" ? "Checking code…" : "Open my dashboard"}
      </button>
      <button className="text-btn" type="button" onClick={() => window.location.reload()}>
        Use a different email
      </button>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </form>
  ) : (
    <form className="auth-form" onSubmit={requestCode}>
      <label htmlFor="email">Email address</label>
      <p className="field-help">No password. We will email you a one-time code.</p>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="farmer@example.com"
        required
        autoFocus
      />
      <button className="cta" disabled={state.status === "sending-code"} type="submit">
        {state.status === "sending-code" ? "Sending code…" : "Send sign-in code"}
      </button>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

export function App({ configurationRequired = false }: AppProps) {
  return (
    <main className="auth-page">
      <section className="auth-left">
        <BrandMark />
        <div className="auth-center">
          <h1>Welcome back!</h1>
          <p className="auth-sub">
            Your greenhouse, your observations. Sign in with a one-time email
            code — no password to remember.
          </p>

          {configurationRequired ? (
            <div className="config-note" role="status">
              <strong>Sign-in is not configured yet.</strong>
              <span>
                The server needs its authentication credentials. Ask the
                project operator to complete setup.
              </span>
            </div>
          ) : (
            <AuthenticatedGate />
          )}

          <p className="assure">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
              <path d="m8.5 12 2.5 2.5L16 9" />
            </svg>
            Your email verifies access. Wi-Fi passwords stay on the field
            unit. Local protection keeps running independently.
          </p>
        </div>
        <footer className="auth-foot">Project AVATAR · Greenhouse farming research</footer>
      </section>

      <StoryPanel />
    </main>
  );
}
