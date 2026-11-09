const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { webURL, trustedFrame, validateEnvelope } = require("../policy.cjs");
test("address bar accepts web addresses and searches, rejects privileged schemes", () => {
  assert.equal(webURL("example.org"), "https://example.org/");
  assert.equal(webURL("localhost:1234"), "http://localhost:1234/");
  assert.equal(webURL("example.org:8443"), "https://example.org:8443/");
  assert.equal(
    new URL(webURL("minha faculdade")).searchParams.get("q"),
    "minha faculdade",
  );
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,hi",
    "chrome://settings",
    "https://user:pass@example.org",
  ])
    assert.throws(() => webURL(url));
});
test("only the registered internal top frame has bridge access", () => {
  const file = "/workspace/internal.html";
  const frame = { url: pathToFileURL(file).href };
  const contents = { mainFrame: frame };
  assert.equal(
    trustedFrame({ sender: contents, senderFrame: frame }, contents, file),
    true,
  );
  assert.equal(
    trustedFrame(
      { sender: contents, senderFrame: { url: frame.url } },
      contents,
      file,
    ),
    false,
  );
  assert.equal(
    trustedFrame({ sender: {}, senderFrame: frame }, contents, file),
    false,
  );
  frame.url = "https://example.org/";
  assert.equal(
    trustedFrame({ sender: contents, senderFrame: frame }, contents, file),
    false,
  );
});
test("desktop bridge refuses execution, unknown operations and oversized frames", () => {
  const body = {
    protocol_version: "0",
    request_id: "9f5d0861-a12a-4c5e-a010-c648cb9c611c",
    operation: "projects.list",
    params: {},
  };
  assert.equal(validateEnvelope(body), body);
  for (const operation of ["tasks.execute", "shell.exec", "cookies.get"])
    assert.throws(() => validateEnvelope({ ...body, operation }));
  assert.throws(() =>
    validateEnvelope({ ...body, params: { text: "x".repeat(900000) } }),
  );
});
