const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolve),
  );
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

class LocalService {
  constructor(root, stateDir) {
    this.root = root;
    this.stateDir = stateDir;
    this.pending = new Map();
  }
  async start() {
    fs.mkdirSync(this.stateDir, { recursive: true, mode: 0o700 });
    const python =
      process.env.IA_BBARU_PYTHON ||
      path.join(
        this.root,
        ".venv",
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      );
    if (!fs.existsSync(python))
      throw new Error(
        "Python não encontrado. Configure IA_BBARU_PYTHON ou instale .venv na raiz do projeto.",
      );
    const port = await freePort();
    const token = crypto.randomBytes(32).toString("hex");
    const config = path.join(this.stateDir, "backend-config.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        backend_url: `http://127.0.0.1:${port}`,
        token,
        db_path: path.join(this.stateDir, "launcher.sqlite3"),
      }),
      { mode: 0o600 },
    );
    const options = {
      cwd: this.root,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    };
    this.backend = spawn(
      python,
      ["-m", "native_host.service", "--config", config],
      options,
    );
    this.backend.on("error", () => {
      this.failed = true;
    });
    this.backend.on("exit", () => {
      this.failed = true;
    });
    // Do not forward request logs, prompts or environment variables to renderer.
    this.backend.stdout.resume();
    this.backend.stderr.resume();
    let ready = false;
    for (let i = 0; i < 100 && !this.failed; i++) {
      try {
        const response = await fetch(
          `http://127.0.0.1:${port}/v1/projects?limit=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(500),
            redirect: "error",
          },
        );
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) {
      this.stop();
      throw new Error(
        "O backend não iniciou. Confira Python, requirements.txt e a configuração do gateway.",
      );
    }
    this.host = spawn(
      python,
      ["-m", "native_host", "--config", config],
      options,
    );
    this.buffer = Buffer.alloc(0);
    this.host.stderr.resume();
    this.host.on("error", () => this.rejectAll());
    this.host.on("exit", () => this.rejectAll());
    this.host.stdin.on("error", () => this.rejectAll());
    this.host.stdout.on("data", (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      while (this.buffer.length >= 4) {
        const size = this.buffer.readUInt32LE(0);
        if (size < 1 || size > 900000) {
          this.host.kill();
          this.rejectAll();
          return;
        }
        if (this.buffer.length < size + 4) break;
        const body = this.buffer.subarray(4, size + 4);
        this.buffer = this.buffer.subarray(size + 4);
        try {
          const response = JSON.parse(body.toString("utf8"));
          const pending = this.pending.get(response.request_id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(response.request_id);
            pending.resolve(response);
          }
        } catch {
          this.rejectAll();
        }
      }
    });
  }
  request(raw) {
    if (!this.host || this.host.killed || this.host.exitCode !== null)
      return Promise.reject(new Error("Componente local indisponível."));
    if (this.pending.size >= 32 || this.pending.has(raw.request_id))
      return Promise.reject(new Error("Aguarde as operações em andamento."));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(raw.request_id);
        reject(new Error("A operação demorou. Atualize antes de repetir."));
      }, 20000);
      this.pending.set(raw.request_id, { resolve, reject, timer });
      const body = Buffer.from(JSON.stringify(raw));
      const frame = Buffer.alloc(body.length + 4);
      frame.writeUInt32LE(body.length);
      body.copy(frame, 4);
      this.host.stdin.write(frame);
    });
  }
  rejectAll() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Componente local desconectado."));
    }
    this.pending.clear();
  }
  stop() {
    if (this.stopping) return this.stopping;
    this.failed = true;
    this.rejectAll();
    this.stopping = Promise.all(
      [this.host, this.backend].filter(Boolean).map(
        (child) =>
          new Promise((resolve) => {
            if (child.exitCode !== null) {
              resolve();
              return;
            }
            const timer = setTimeout(resolve, 3000);
            child.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
            child.kill();
          }),
      ),
    );
    return this.stopping;
  }
}
module.exports = { LocalService };
