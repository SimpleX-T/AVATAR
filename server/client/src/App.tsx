import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  getAccessToken,
  useLoginWithEmail,
  usePrivy,
} from "@privy-io/react-auth";

type AppProps = {
  configurationRequired?: boolean;
};

function AuthenticatedGate() {
  const { ready, authenticated, logout } = usePrivy();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  async function within<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
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
      if (!accessToken) throw new Error("Privy did not return an access token.");
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
        throw new Error(result.error || "The server could not verify this session.");
      }
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in could not be completed.");
      setSyncing(false);
    }
  }

  useEffect(() => {
    const requestedLogout = new URLSearchParams(window.location.search).has("logout");
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
      setMessage("We could not send the code. Check the address and try again.");
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

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace") return;
    const digit = code[index] || "";
    if (!digit && index > 0) otpInputs.current[index - 1]?.focus();
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setCode(pasted);
    otpInputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  if (!ready || syncing) {
    return <p className="status-copy" role="status">Preparing your secure field session…</p>;
  }

  if (authenticated) {
    return (
      <div className="session-recovery" role="alert">
        <strong>We confirmed your email, but could not open the dashboard.</strong>
        <p>{message || "The secure server session was not completed."}</p>
        <button type="button" onClick={establishServerSession}>Try opening the dashboard again</button>
        <button className="text-button" type="button" onClick={() => void logout()}>
          Sign out and start again
        </button>
      </div>
    );
  }

  const awaitingCode =
    state.status === "awaiting-code-input" ||
    state.status === "submitting-code";

  return awaitingCode ? (
    <form onSubmit={verifyCode}>
      <label htmlFor="code">Six-digit code</label>
      <p className="field-help">We sent a one-time code to <strong>{email}</strong>.</p>
      <div className="otp-inputs" onPaste={handleOtpPaste}>
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(element) => { otpInputs.current[index] = element; }}
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
      <button disabled={state.status === "submitting-code"} type="submit">
        {state.status === "submitting-code" ? "Checking code…" : "Open my dashboard"}
      </button>
      <button className="text-button" type="button" onClick={() => window.location.reload()}>
        Use a different email
      </button>
      {message && <p className="form-error" role="alert">{message}</p>}
    </form>
  ) : (
    <form onSubmit={requestCode}>
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
      <button disabled={state.status === "sending-code"} type="submit">
        {state.status === "sending-code" ? "Sending code…" : "Send sign-in code"}
      </button>
      {message && <p className="form-error" role="alert">{message}</p>}
    </form>
  );
}

export function App({ configurationRequired = false }: AppProps) {
  return (
    <main className="auth-page">
      <header className="topbar">
        <a href="/" className="brand" aria-label="Project AVATAR home">
          <span className="brand-mark">AV</span>
          <span><strong>Project AVATAR</strong><small>Agricultural Vision &amp; Automated Response</small></span>
        </a>
        <span className="secure-note">SECURE OPERATOR ACCESS</span>
      </header>

      <section className="auth-stage">
        <img
          className="field-art"
          src="/assets/generated/auth-field-hero.png"
          alt="Illustration of a farmer receiving readings from an internet-connected field station"
        />
        <article className="auth-card">
          <p className="eyebrow">WELCOME TO YOUR FIELD</p>
          <h1>See what is happening, wherever you are.</h1>
          <p className="lede">
            Sign in to check your ESP32, understand the latest readings, and send safe commands.
          </p>
          <div className="value-strip" aria-label="What happens after sign in">
            <span><b>01</b> Verify identity</span>
            <span><b>02</b> Open your field</span>
            <span><b>03</b> Check live status</span>
          </div>
          {configurationRequired ? (
            <div className="configuration-note" role="status">
              <strong>Privy setup is waiting for credentials.</strong>
              <span>Add the App ID and App Secret to the server environment, then restart it.</span>
            </div>
          ) : (
            <AuthenticatedGate />
          )}
          <p className="privacy-note">
            Your sign-in proves who you are. Device commands remain separately protected.
          </p>
        </article>
      </section>
    </main>
  );
}
