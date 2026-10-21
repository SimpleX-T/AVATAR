import test from "node:test";
import assert from "node:assert/strict";
import { isOperator, parseOperatorIds } from "../src/operator-access.js";

test("production grants dashboard access only to configured Privy users", () => {
  const allowed = parseOperatorIds(" did:privy:first , did:privy:second, ");
  assert.equal(isOperator({ userId: "did:privy:first" }, allowed, true), true);
  assert.equal(isOperator({ userId: "did:privy:third" }, allowed, true), false);
  assert.equal(isOperator(null, allowed, true), false);
});

test("local development still allows a verified user", () => {
  assert.equal(isOperator({ userId: "local-development-user" }, new Set(), false), true);
});
