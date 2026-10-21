import test from "node:test";
import assert from "node:assert/strict";
import { readApiResponse } from "../public/http-response.js";

test("sign-out accepts the server's empty 204 response", async () => {
  assert.equal(await readApiResponse(new Response(null, { status: 204 })), null);
});

test("API errors still use the server's JSON message", async () => {
  await assert.rejects(
    readApiResponse(
      Response.json({ error: "Session expired" }, { status: 401 }),
    ),
    /Session expired/,
  );
});
