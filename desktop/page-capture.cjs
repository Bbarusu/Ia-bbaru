// Bounded full-document capture. The CDP session never reaches a web renderer.
async function captureFullPage(contents, isCurrent) {
  const debuggerSession = contents.debugger;
  if (debuggerSession.isAttached()) throw new Error("A página está em depuração. Feche a depuração antes de capturar.");
  const check = () => {
    if (contents.isDestroyed() || !isCurrent()) throw new Error("A página mudou. Capture novamente.");
  };
  check();
  debuggerSession.attach("1.3");
  try {
    const metrics = await debuggerSession.sendCommand("Page.getLayoutMetrics");
    check();
    const size = metrics.cssContentSize;
    const width = Math.ceil(size?.width), height = Math.ceil(size?.height);
    if (![width, height].every(Number.isFinite) || width < 1 || height < 1 ||
        width > 8000 || height > 8000 || width * height > 16000000)
      throw new Error("A página inteira excede os limites da captura (8.000 px por lado e 16 MP). Capture uma área menor.");
    const result = await debuggerSession.sendCommand("Page.captureScreenshot", {
      format: "jpeg", quality: 80, captureBeyondViewport: true, fromSurface: true,
      clip: { x: 0, y: 0, width, height, scale: Math.min(1, 2000 / Math.max(width, height)) },
    });
    check();
    if (typeof result.data !== "string" || result.data.length > 640000)
      throw new Error("O print da página inteira excede 480 KB. Capture uma área menor.");
    const bytes = Buffer.from(result.data, "base64");
    if (!bytes.length || bytes.length > 480000) throw new Error("Print inválido ou grande demais.");
    return { data_url: "data:image/jpeg;base64," + bytes.toString("base64"), width, height };
  } finally {
    if (!contents.isDestroyed() && debuggerSession.isAttached()) debuggerSession.detach();
  }
}

module.exports = { captureFullPage };
