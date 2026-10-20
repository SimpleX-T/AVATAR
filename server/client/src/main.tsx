import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { App } from "./App";
import "./styles.css";

type RuntimeConfig = {
  authEnabled: boolean;
  privyAppId: string | null;
};

const response = await fetch("/api/auth/config");
const config = (await response.json()) as RuntimeConfig;
const root = ReactDOM.createRoot(document.getElementById("root")!);

class AuthErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="provider-error">
        <strong>Secure sign-in could not start.</strong>
        <p>
          Open <a href="http://localhost:8788/auth/">localhost:8788</a> on this
          computer. For access from another device, Project AVATAR must use HTTPS.
        </p>
      </main>
    );
  }
}

root.render(
  <React.StrictMode>
    <AuthErrorBoundary>
      {config.authEnabled && config.privyAppId ? (
        <PrivyProvider
          appId={config.privyAppId}
          config={{
            loginMethods: ["email"],
            externalWallets: {
              disableAllExternalWallets: true,
            },
            embeddedWallets: {
              ethereum: { createOnLogin: "off" },
              solana: { createOnLogin: "off" },
              showWalletUIs: false,
            },
            appearance: {
              theme: "light",
              accentColor: "#00684a",
              walletList: [],
            },
          }}
        >
          <App />
        </PrivyProvider>
      ) : (
        <App configurationRequired />
      )}
    </AuthErrorBoundary>
  </React.StrictMode>,
);
