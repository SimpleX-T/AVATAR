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
      <p className="status-copy" role="status">
        Preparing your secure field session…
      </p>
    );
  }

  if (authenticated) {
    return (
      <div className="session-recovery" role="alert">
        <strong>
          We confirmed your email, but could not open the dashboard.
        </strong>
        <p>{message || "The secure server session was not completed."}</p>
        <button type="button" onClick={establishServerSession}>
          Try opening the dashboard again
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => void logout()}
        >
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
      <p className="field-help">
        We sent a one-time code to <strong>{email}</strong>.
      </p>
      <div className="otp-inputs" onPaste={handleOtpPaste}>
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
      <button disabled={state.status === "submitting-code"} type="submit">
        {state.status === "submitting-code"
          ? "Checking code…"
          : "Open my dashboard"}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => window.location.reload()}
      >
        Use a different email
      </button>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </form>
  ) : (
    <form onSubmit={requestCode}>
      <label htmlFor="email">Email address</label>
      <p className="field-help">
        No password. We will email you a one-time code.
      </p>
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
        {state.status === "sending-code"
          ? "Sending code…"
          : "Send sign-in code"}
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
      <section className="auth-story" aria-label="Welcome to AVATAR">
        <a href="/" className="brand" aria-label="Project AVATAR home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M5 25 16 5l11 20M10 17h12M16 5v22" />
          </svg>
          <span>
            avatar<span className="brand-dot">.</span>
            <small>YOUR FIELD, CONNECTED</small>
          </span>
        </a>
        <div className="story-copy">
          <p className="eyebrow">A LITTLE CLOSER TO YOUR GREENHOUSE</p>
          <h1>
            Good growing starts
            <br />
            with a clearer view.
          </h1>
          <p className="lede">
            See what your field is telling you. Follow real observations,
            understand local protection, and keep a useful research record.
          </p>
        </div>
        <div className="field-art-wrap">
          <img
            className="field-art"
            src="/assets/field/greenhouse.svg"
            alt="Isometric cutaway of the AVATAR greenhouse, showing the planted bed, sensors and local field controller"
          />
        </div>
        <div className="story-foot">
          <span>PROJECT AVATAR</span>
          <span>Greenhouse farming research</span>
        </div>
      </section>
      <section className="auth-content">
        <div className="auth-top-note">Your greenhouse, your observations.</div>
        <article className="auth-card">
          <div className="flow-progress" aria-label="Your setup journey">
            <span className="current">1 · Sign in</span>
            <i aria-hidden="true" />
            <span>2 · Connect your field</span>
            <i aria-hidden="true" />
            <span>3 · Start observing</span>
          </div>
          <p className="eyebrow">WELCOME TO AVATAR</p>
          <h2>
            Step into your
            <br />
            <em>greenhouse.</em>
          </h2>
          <p className="auth-intro">
            Sign in or create your account with a one-time email code. We will
            guide you through your field setup next.
          </p>
          {configurationRequired ? (
            <div className="configuration-note" role="status">
              <strong>Sign-in is not configured yet.</strong>
              <span>
                The server needs its authentication credentials. Ask the project
                operator to complete setup.
              </span>
            </div>
          ) : (
            <AuthenticatedGate />
          )}
          <div className="privacy-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6" />
            </svg>
            <p>
              Your email verifies access. Wi-Fi passwords stay on the field
              unit. Local protection keeps running independently.
            </p>
          </div>
        </article>
        <footer>Built for the field. Grounded in real observations.</footer>
      </section>
    </main>
  );
}
