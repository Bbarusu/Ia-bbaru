const { pathToFileURL } = require("node:url");

function webURL(value) {
  if (typeof value !== "string" || value.length > 8192)
    throw new Error("Endereço inválido.");
  const input = value.trim();
  if (!input) return null;
  // Only web navigation; never turn explicit dangerous schemes into searches.
  const hostPort = /^(localhost|[a-z\d.-]+\.[a-z\d-]+):\d+([/?#]|$)/i.test(
    input,
  );
  if (
    /^[a-z][a-z\d+.-]*:/i.test(input) &&
    !/^https?:/i.test(input) &&
    !hostPort
  ) {
    throw new Error("Use um endereço HTTP ou HTTPS.");
  }
  const candidate = /^https?:\/\//i.test(input)
    ? input
    : /^(localhost|127\.0\.0\.1)(:\d+)?([/?#]|$)/.test(input)
      ? `http://${input}`
      : !/\s/.test(input) && input.includes(".")
        ? `https://${input}`
        : `https://www.google.com/search?q=${encodeURIComponent(input)}`;
  const url = new URL(candidate);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Endereço não permitido.");
  return url.href;
}

function trustedFrame(event, contents, file) {
  return (
    event.sender === contents &&
    event.senderFrame === contents.mainFrame &&
    event.senderFrame.url === pathToFileURL(file).href
  );
}

const operations = new Set([
  "bridge.info",
  "health.get",
  "projects.list",
  "projects.create",
  "sources.list",
  "sources.create",
  "sources.get",
  "models.list",
  "connections.list",
  "tasks.list",
  "tasks.plan",
  "tasks.get",
  "tasks.enqueue",
  "tasks.resume",
]);
function validateEnvelope(raw) {
  if (
    !raw ||
    raw.protocol_version !== "0" ||
    !operations.has(raw.operation) ||
    typeof raw.request_id !== "string" ||
    !/^[\da-f-]{36}$/i.test(raw.request_id) ||
    !raw.params ||
    typeof raw.params !== "object" ||
    Array.isArray(raw.params) ||
    Buffer.byteLength(JSON.stringify(raw)) > 850000
  )
    throw new Error("Operação local inválida.");
  return raw;
}

module.exports = { webURL, trustedFrame, validateEnvelope };
