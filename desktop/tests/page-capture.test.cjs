const test = require("node:test");
const assert = require("node:assert/strict");
const { captureFullPage } = require("../page-capture.cjs");

function fixture(width = 800, height = 2400) {
  let attached = false;
  const calls = [];
  const debuggerSession = {
    isAttached: () => attached,
    attach: () => { attached = true; },
    detach: () => { attached = false; },
    sendCommand: async (name, params) => {
      calls.push({ name, params });
      if (name === "Page.getLayoutMetrics") return { cssContentSize: { width, height } };
      return { data: Buffer.from("synthetic-image").toString("base64") };
    },
  };
  return { contents: { debugger: debuggerSession, isDestroyed: () => false }, calls };
}

test("full page uses bounded CSS document dimensions, not viewport, and detaches", async () => {
  const { contents, calls } = fixture();
  const result = await captureFullPage(contents, () => true);
  assert.equal(result.height, 2400);
  assert.equal(calls[1].params.captureBeyondViewport, true);
  assert.deepEqual(calls[1].params.clip, { x: 0, y: 0, width: 800, height: 2400, scale: 1 });
  assert.equal(contents.debugger.isAttached(), false);
});

test("oversized or stale document never returns a capture and releases CDP", async () => {
  for (const [width, height] of [[800, 20000], [5000, 5000], [NaN, 100], [100, 0]]) {
    const { contents, calls } = fixture(width, height);
    await assert.rejects(captureFullPage(contents, () => true), /excede/);
    assert.equal(calls.length, 1);
    assert.equal(contents.debugger.isAttached(), false);
  }
  for (const changeAt of [2, 3]) {
    const { contents } = fixture();
    let check = 0;
    await assert.rejects(captureFullPage(contents, () => ++check < changeAt), /mudou/);
    assert.equal(contents.debugger.isAttached(), false);
  }
});

test("does not steal an existing debugger or silently reduce an oversized image", async () => {
  const { contents } = fixture();
  contents.debugger.attach();
  await assert.rejects(captureFullPage(contents, () => true), /depuração/);
  assert.equal(contents.debugger.isAttached(), true);
  contents.debugger.detach();
  const original = contents.debugger.sendCommand;
  contents.debugger.sendCommand = (name, params) => name === "Page.captureScreenshot"
    ? Promise.resolve({ data: "a".repeat(640004) }) : original(name, params);
  await assert.rejects(captureFullPage(contents, () => true), /480 KB/);
  assert.equal(contents.debugger.isAttached(), false);
});
