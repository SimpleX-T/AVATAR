---
name: Privy
description: Use when building wallet infrastructure, authentication systems, or financial applications. Reach for Privy when you need to create embedded wallets, authenticate users, manage wallet controls and policies, execute transactions across blockchains, or integrate wallet funding and financial flows.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill

## Product summary

Privy is a programmable wallet infrastructure platform for building financial applications. It provides secure embedded wallets, multi-chain transaction execution, user authentication, and policy-based controls. Agents use Privy to create wallets, authenticate users, execute transactions, manage wallet permissions, and integrate funding/payment flows across Ethereum, Solana, Bitcoin, and 50+ other blockchains.

**Key files and commands:**
- Dashboard: https://dashboard.privy.io (create apps, configure login methods, manage webhooks)
- App ID & App Secret: Required for all API calls (found in Configuration > App settings > Basics)
- REST API base: `https://api.privy.io/v1`
- Client SDKs: React (`@privy-io/react-auth`), React Native (`@privy-io/expo`), Node.js (`@privy-io/node`), Swift, Android, Java, Go, Rust, Ruby
- Webhooks: Configure at Configuration > Webhooks in dashboard

## When to use

**Reach for Privy when:**
- Building consumer or business wallet applications with embedded wallets
- Needing to authenticate users via email, social, passkeys, or wallet-based login
- Creating wallets for users, organizations, agents, or treasury operations
- Executing transactions on EVM, Solana, Bitcoin, or other blockchains
- Implementing wallet controls, spending policies, or multi-sig approval workflows
- Integrating fiat onramps, card spend, yield protocols, or token swaps
- Managing user access to wallets with role-based permissions
- Setting up webhooks for transaction or user lifecycle events

**Do not use Privy for:**
- Custodial wallet services (use Privy's custodial wallet feature instead)
- Non-blockchain applications without wallet needs
- Applications that don't require user authentication

## Quick reference

### SDK Installation

| Platform | Command | Package |
|----------|---------|---------|
| React/Next.js | `npm install @privy-io/react-auth@latest` | `@privy-io/react-auth` |
| React Native/Expo | `npm install @privy-io/expo` | `@privy-io/expo` |
| Node.js | `npm install @privy-io/node` | `@privy-io/node` |
| Swift | CocoaPods/SPM | `@privy-io/swift` |
| Android | Gradle | `io.privy:android` |

### Core Concepts

| Concept | Purpose |
|---------|---------|
| **User** | Entity that authenticates and owns wallets (individual or organization) |
| **Wallet** | Non-custodial account on a blockchain owned by a user or authorization key |
| **Owner** | Entity with full control over a wallet (user, authorization key, or key quorum) |
| **Signer** | Additional party with scoped permissions to sign transactions |
| **Policy** | Rules that constrain what actions a wallet can perform |
| **Authorization Key** | Server-side key for programmatic wallet control |
| **Key Quorum** | Multi-sig threshold for wallet approval |

### Common API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/users` | Create a user |
| `GET /v1/users/{user_id}` | Get user by ID |
| `POST /v1/wallets` | Create a wallet |
| `GET /v1/wallets/{wallet_id}` | Get wallet details |
| `POST /v1/wallets/{wallet_id}/rpc` | Execute RPC method (send transaction, sign, etc.) |
| `POST /v1/policies` | Create a policy |
| `GET /v1/policies/{policy_id}` | Get policy details |
| `POST /v1/key-quorums` | Create a key quorum |

### Authentication Methods

| Method | Type | Best For |
|--------|------|----------|
| Email OTP | Delegated | General users |
| SMS/WhatsApp | Delegated | Mobile users |
| Passkey | Direct | High security |
| Social (Google, Discord, Twitter, etc.) | Delegated | Familiar login |
| Wallet (MetaMask, Phantom) | Direct | Crypto-native users |
| Farcaster | Direct | Farcaster ecosystem |
| JWT-based | Custom | Existing auth systems |

### Wallet Control Models

| Model | Owner | Signer | Use Case |
|-------|-------|--------|----------|
| User-owned | User | None | Self-custodial consumer wallets |
| User + Server | User | Server (scoped) | Automated trading, limit orders |
| App-owned | Authorization key | None | Treasury, agents, bots |
| Custodial | Custodian | None | FBO banking model |

## Decision guidance

### When to use embedded wallets vs external wallets

| Embedded Wallets | External Wallets |
|------------------|------------------|
| New users without wallets | Users with existing MetaMask/Phantom |
| Seamless onboarding UX | Crypto-native power users |
| Non-custodial, Privy-managed keys | User-controlled keys |
| Automatic wallet creation | User brings their own wallet |
| Best for consumer apps | Best for DeFi/trading apps |

### When to use Privy authentication vs JWT-based auth

| Privy Auth | JWT-based Auth |
|-----------|-----------------|
| No existing auth system | Already have Auth0/Firebase/Cognito |
| Want built-in login UI | Need custom authentication |
| Support multiple login methods | Single auth provider |
| Easier integration | More control over auth flow |

### When to use policies vs manual approval

| Policies | Manual Approval |
|----------|-----------------|
| Automated, rule-based constraints | Human decision required |
| Spending limits, allowlists | Sensitive operations |
| High-frequency operations | Rare, high-value transactions |
| Faster execution | Better for governance |

### When to use user signers vs authorization keys

| User Signers | Authorization Keys |
|--------------|-------------------|
| User approves transactions | Server approves transactions |
| Delegated permissions | Full programmatic control |
| User retains ownership | Application owns wallet |
| Scoped to specific actions | Can perform any action |

## Workflow

### 1. Set up a Privy app

1. Go to https://dashboard.privy.io and create a new app
2. Copy your **App ID** and **App Secret** from Configuration > App settings > Basics
3. Store App Secret securely in environment variables (never expose in client code)
4. Configure login methods at Configuration > Login methods
5. Set up webhooks at Configuration > Webhooks (optional)

### 2. Integrate client-side authentication (React example)

1. Install SDK: `npm install @privy-io/react-auth`
2. Wrap app with `PrivyProvider` at root level with your App ID
3. Configure embedded wallet creation in `config.embeddedWallets`
4. Use `usePrivy()` hook to access authentication state
5. Use `useLoginWithEmail()` or other login hooks for user authentication
6. Wait for `ready` flag before consuming Privy state

### 3. Create a wallet

**Client-side (React):**
1. Use `useCreateWallet()` hook after user authenticates
2. Call `createWallet()` to create embedded wallet
3. Wallet is automatically owned by authenticated user

**Server-side (Node.js):**
1. Create user first via API or SDK
2. Use `privy.wallets().create()` with user ID as owner
3. Optionally attach policies and signers at creation time

### 4. Execute a transaction

**Client-side (React):**
1. Get wallet via `useWallets()` hook
2. Use `useSendTransaction()` for EVM or Solana-specific hooks
3. Call `sendTransaction()` with transaction parameters
4. User signs in wallet UI (no additional approval needed if no policy)

**Server-side (Node.js):**
1. Create `AuthorizationContext` with authorization key
2. Call `privy.wallets().ethereum().sendTransaction()` with wallet ID
3. Provide transaction parameters and authorization context
4. Returns transaction hash

### 5. Set up policies (optional)

1. Create policy via Dashboard or API with rules for specific RPC methods
2. Define conditions (spending limits, allowlists, contract interactions)
3. Attach policy to wallet at creation or via update
4. Policy engine evaluates all requests against rules
5. Requests must satisfy all conditions to be allowed

### 6. Listen for events via webhooks

1. Create backend endpoint that accepts POST requests
2. Register endpoint URL at Configuration > Webhooks
3. Select event types to subscribe to (user, wallet, transaction, etc.)
4. Verify webhook signature using SDK's `webhooks().verify()` method
5. Process webhook payload and return 2xx status

### 7. Verify your integration

- Test authentication flow end-to-end
- Verify wallet creation and transaction execution
- Check webhook delivery in dashboard
- Test policy enforcement with invalid transactions
- Confirm error handling for edge cases

## Common gotchas

**Wallet creation timing:** Wallets are not created until explicitly requested (unless `createOnLogin` is configured). Don't assume a user has a wallet immediately after authentication.

**Policy denials are silent:** When a policy blocks a transaction, the error is `policy_violation`. Always check error codes and provide user feedback.

**Authorization signatures required:** Server-side wallet operations require authorization signatures from the owner. Use `AuthorizationContext` to automatically handle this.

**Webhook verification is mandatory:** Always verify webhook signatures using the SDK's `verify()` method. Never trust unsigned payloads.

**Rate limits apply:** REST API has rate limits. Implement exponential backoff for retries. Use batching and caching to reduce requests.

**App Secret exposure:** Never expose App Secret in client code. Use environment variables and keep it server-side only.

**Transaction broadcast vs confirmed:** `sendTransaction` returns when broadcasted, not confirmed. Listen to webhooks for confirmation status.

**Policy evaluation is in-enclave:** Policies are evaluated in secure execution environments. Conditions are evaluated at request time, not pre-flight.

**Solana instruction parsing:** Solana policies must allow every instruction in a transaction. A single disallowed instruction blocks the entire transaction.

**External wallet limitations:** External wallets (MetaMask, Phantom) cannot use Privy's policy engine. Policies only apply to embedded wallets.

**User session keys expire:** User signing keys are time-bound. Request fresh keys before they expire or use `AuthorizationContext` for automatic refresh.

**Idempotency keys prevent duplicates:** Use idempotency keys for critical operations to prevent duplicate wallet creation or transactions.

## Verification checklist

Before submitting work with Privy:

- [ ] App ID and App Secret are correctly configured
- [ ] PrivyProvider wraps the entire app (React)
- [ ] Waited for `ready` flag before consuming Privy state
- [ ] Wallet owner is correctly set (user ID or authorization key)
- [ ] Policies are attached if needed and rules cover all RPC methods
- [ ] Transaction parameters are valid (correct chain, recipient, amount)
- [ ] Authorization signatures are provided for server-side operations
- [ ] Webhook endpoint returns 2xx status and verifies signatures
- [ ] Error handling covers `policy_violation`, `insufficient_funds`, `request_expired`
- [ ] Tested with both valid and invalid transactions
- [ ] Confirmed transaction status via webhooks, not just broadcast response
- [ ] Rate limiting and retry logic implemented for API calls
- [ ] App Secret is never exposed in client code or logs

## Resources

**Comprehensive navigation:** https://docs.privy.io/llms.txt

**Critical documentation pages:**
- [Privy Overview](https://docs.privy.io/basics/get-started/about) — What Privy is and what you can build
- [Key Concepts](https://docs.privy.io/basics/key-concepts) — Authentication, wallets, controls, and how they work together
- [React SDK Setup](https://docs.privy.io/basics/react/setup) — Configure PrivyProvider and initialize Privy in React apps
- [API Reference](https://docs.privy.io/api-reference/introduction) — Complete REST API documentation
- [Wallets Overview](https://docs.privy.io/wallets/overview) — Embedded and external wallet infrastructure
- [Controls & Policies](https://docs.privy.io/controls/overview) — Authorization models and policy engine
- [Webhooks](https://docs.privy.io/api-reference/webhooks/overview) — Event subscriptions and webhook verification
- [Error Handling](https://docs.privy.io/basics/troubleshooting/error-handling/api-errors) — Common error codes and troubleshooting

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt