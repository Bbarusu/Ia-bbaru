import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Command,
  FileText,
  Folder,
  Layers3,
  Link2,
  Loader2,
  Maximize2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
  Workflow,
  X,
} from "lucide-react";
import type { Capture, Model, Page, Project, Source, Tab, Task } from "./types";
import {
  clearCapture,
  demo,
  expand,
  inFirefox,
  pendingCapture,
  readDraft,
  request,
  selectCapture,
  writeDraft,
} from "./transport";
import { sourceContent, taskState, validateDraft } from "./logic.mjs";

const tabs: { id: Tab; label: string; icon: typeof Layers3 }[] = [
  { id: "workspace", label: "Área de trabalho", icon: Layers3 },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "history", label: "Atividade", icon: Workflow },
  { id: "connections", label: "Conexões", icon: Settings2 },
];
const guide =
  "https://github.com/Bbarusu/Ia-bbaru/blob/codex/frontend-firefox/docs/INSTALAR_FIREFOX.md";
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`mark ${small ? "small" : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} onClose={close}>
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={close}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("workspace");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const projectRef = useRef("");
  projectRef.current = projectId;
  const [projectNext, setProjectNext] = useState<number | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceNext, setSourceNext] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskNext, setTaskNext] = useState<number | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [kind, setKind] = useState("study");
  const [review, setReview] = useState(false);
  const [host, setHost] = useState(false);
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [modelError, setModelError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"project" | "source" | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [sourceView, setSourceView] = useState<Source | null>(null);
  const [taskView, setTaskView] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const project = projects.find((p) => p.id === projectId);
  const available = models.filter((m) => m.available);

  async function connect() {
    let hostReady = false;
    setChecking(true);
    setError("");
    setConnectionError("");
    try {
      await request("bridge.info");
      hostReady = true;
      setHost(true);
      await request("health.get");
      setOnline(true);
      const page = await request<Page<Project>>("projects.list");
      setProjects(page.items);
      setProjectNext(page.next_offset);
      const saved = await readDraft("last-project");
      setProjectId((old) =>
        page.items.some((p) => p.id === old)
          ? old
          : page.items.find((p) => p.id === saved)?.id ||
            page.items[0]?.id ||
            "",
      );
      try {
        const data = await request<{ models: Model[] }>("models.list");
        setModels(data.models);
        setModelError("");
        setSelectedModels((old) =>
          old.filter((id) =>
            data.models.some((m) => m.id === id && m.available),
          ),
        );
      } catch (e) {
        setModels([]);
        setSelectedModels([]);
        setModelError((e as Error).message);
      }
    } catch (e) {
      setHost(hostReady);
      setOnline(false);
      setModels([]);
      setSelectedModels([]);
      setConnectionError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    connect();
  }, []);
  useEffect(() => {
    let active = true;
    setSources([]);
    setTasks([]);
    setSelectedSources([]);
    setSourceNext(null);
    setTaskNext(null);
    setText("");
    setDraftReady(false);
    readDraft(`draft:${projectId || "new"}`)
      .then((value) => {
        if (active) {
          setText(value);
          setDraftReady(true);
        }
      })
      .catch(() => {
        if (active) setDraftReady(true);
      });
    if (projectId) writeDraft("last-project", projectId).catch(() => {});
    if (projectId && online) {
      Promise.all([
        request<Page<Source>>("sources.list", { project_id: projectId }),
        request<Page<Task>>("tasks.list", { project_id: projectId }),
      ])
        .then(([s, t]) => {
          if (active) {
            setSources(s.items);
            setSourceNext(s.next_offset);
            setTasks(t.items);
            setTaskNext(t.next_offset);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    return () => {
      active = false;
    };
  }, [projectId, online]);

  function receiveCapture(value: Capture | null) {
    if (value) {
      setCapture(value);
      setTitle(value.title);
      setContent(value.text);
      setModal("source");
    }
  }
  useEffect(() => {
    pendingCapture()
      .then(receiveCapture)
      .catch(() => {});
    if (!inFirefox) return;
    const listener = (changes: any) => {
      if (changes.pendingCapture?.newValue)
        receiveCapture(changes.pendingCapture.newValue);
      if (changes.captureError?.newValue) {
        setError(changes.captureError.newValue);
        window.browser.storage.local.remove("captureError");
      }
    };
    window.browser.storage.onChanged.addListener(listener);
    return () => window.browser.storage.onChanged.removeListener(listener);
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function openProject() {
    setTitle("");
    setModal("project");
  }
  function openSource() {
    setCapture(null);
    setTitle("");
    setContent("");
    setModal("source");
  }
  async function createProject(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      const p = await request<Project>("projects.create", {
        title: title.trim(),
      });
      setProjects((old) => [p, ...old]);
      setProjectId(p.id);
      setModal(null);
      setNotice("Projeto criado. Adicione seus primeiros materiais.");
    });
  }
  async function saveSource(event: FormEvent) {
    event.preventDefault();
    const target = projectId;
    if (!target) {
      setError("Crie ou escolha um projeto antes de salvar.");
      return;
    }
    const body = sourceContent(title, capture?.url || "", content);
    if (body.length > 40000) {
      setError(
        "O material completo, incluindo a origem, deve ter até 40.000 caracteres.",
      );
      return;
    }
    await act(async () => {
      const source = await request<Source>("sources.create", {
        project_id: target,
        title: title.trim(),
        content: body,
      });
      if (projectRef.current === target) {
        setSources((old) => [
          ...old,
          { ...source, preview: body.slice(0, 160), char_count: body.length },
        ]);
        setSelectedSources((old) =>
          old.length < 20 ? [...old, source.id] : old,
        );
      }
      setModal(null);
      setNotice("Material salvo no projeto.");
      if (capture) await clearCapture(capture.id);
      setCapture(null);
    });
  }
  function changeText(value: string) {
    setText(value);
    writeDraft(`draft:${projectId || "new"}`, value).catch(() =>
      setError("Não foi possível guardar o rascunho neste navegador."),
    );
  }
  function toggleSource(id: string) {
    if (selectedSources.includes(id))
      setSelectedSources((old) => old.filter((x) => x !== id));
    else if (selectedSources.length >= 20)
      setError("Selecione no máximo 20 materiais por pedido.");
    else setSelectedSources((old) => [...old, id]);
  }
  async function plan(event: FormEvent) {
    event.preventDefault();
    const warning = validateDraft({ projectId, text, selectedModels, review });
    if (warning) {
      setError(warning);
      return;
    }
    const target = projectId;
    await act(async () => {
      const task = await request<Task>("tasks.plan", {
        project_id: target,
        task: {
          instruction: text,
          kind,
          source_ids: selectedSources,
          allowed_model_ids: selectedModels,
          mode: review ? "review" : "single",
        },
      });
      if (projectRef.current === target) setTasks((old) => [task, ...old]);
      setTaskView(task);
      setNotice("Plano salvo. Nenhuma geração foi iniciada.");
    });
  }
  async function more(type: "sources" | "tasks" | "projects") {
    const target = projectId;
    const offset =
      type === "sources"
        ? sourceNext
        : type === "tasks"
          ? taskNext
          : projectNext;
    if (offset === null) return;
    await act(async () => {
      const page = await request<Page<any>>(`${type}.list`, {
        ...(type === "projects" ? {} : { project_id: target }),
        offset,
      });
      if (type === "projects") {
        setProjects((old) => [
          ...new Map(
            [...old, ...page.items].map((item) => [item.id, item]),
          ).values(),
        ]);
        setProjectNext(page.next_offset);
      } else if (projectRef.current === target && type === "sources") {
        setSources((old) => [
          ...new Map(
            [...old, ...page.items].map((item) => [item.id, item]),
          ).values(),
        ]);
        setSourceNext(page.next_offset);
      } else if (projectRef.current === target) {
        setTasks((old) => [
          ...new Map(
            [...old, ...page.items].map((item) => [item.id, item]),
          ).values(),
        ]);
        setTaskNext(page.next_offset);
      }
    });
  }
  const filtered = sources.filter((s) =>
    `${s.title} ${s.preview || ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );

  return (
    <div className="shell">
      <aside className="rail">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("workspace");
          }}
        >
          <Mark />
          <span>
            Ia-bbaru<span className="brand-sub">PENSE. CONECTE. CRIE.</span>
          </span>
        </a>
        <button
          className="new-project"
          onClick={openProject}
          disabled={!online || busy}
        >
          <Plus size={17} /> Novo projeto <span>＋</span>
        </button>
        <nav aria-label="Navegação principal">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "active" : ""}
            >
              <Icon size={18} />
              {label}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="rail-label">
          SEUS PROJETOS{" "}
          <button
            aria-label="Criar projeto"
            onClick={openProject}
            disabled={!online}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="project-list">
          {projects.length ? (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectId(p.id)}
                className={p.id === projectId ? "chosen" : ""}
              >
                <Folder size={16} />
                <span>{p.title}</span>
                {p.id === projectId && <span className="tiny-dot" />}
              </button>
            ))
          ) : (
            <p className="rail-empty">
              Um espaço para cada ideia.
              <br />
              Crie seu primeiro projeto.
            </p>
          )}
          {projectNext !== null && (
            <button onClick={() => more("projects")} disabled={busy}>
              Mais projetos
            </button>
          )}
        </div>
        <div className="rail-bottom">
          <div className="private-note">
            <ShieldCheck size={18} />
            <div>
              Seu contexto, com você.
              <small>Materiais guardados no seu computador.</small>
            </div>
          </div>
          <button className="profile" onClick={() => setTab("connections")}>
            <span className="avatar">B</span>
            <span>
              Meu espaço<small>Uso pessoal · local</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <div className="body">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">
              <Mark small />
            </span>
            <span>Meu espaço</span>
            <span className="slash">/</span>
            <strong>{tabs.find((t) => t.id === tab)?.label}</strong>
          </div>
          <div className="top-actions">
            <span className={`status-pill ${online ? "connected" : ""}`}>
              <span />
              {checking
                ? "Verificando…"
                : online
                  ? "Backend local ativo"
                  : "Modo desconectado"}
            </span>
            <button
              className="icon-button"
              title="Verificar conexão"
              aria-label="Verificar conexão"
              disabled={checking}
              onClick={connect}
            >
              <RefreshCw size={16} className={checking ? "spin" : ""} />
            </button>
            {inFirefox && (
              <button
                className="icon-button"
                title="Abrir página ampla"
                aria-label="Abrir página ampla"
                onClick={expand}
              >
                <Maximize2 size={16} />
              </button>
            )}
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            Demonstração visual · dados de exemplo · nenhuma conta ou IA
            conectada
          </div>
        )}
        <nav className="mobile-nav" aria-label="Navegação compacta">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              title={label}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
              className={tab === id ? "active" : ""}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> SEU ESPAÇO DE TRABALHO
              </div>
              <h1>
                {tab === "workspace" ? (
                  <>
                    Boas ideias merecem
                    <br />
                    <span>o contexto certo.</span>
                  </>
                ) : tab === "library" ? (
                  "Sua biblioteca."
                ) : tab === "history" ? (
                  "Cada passo, registrado."
                ) : (
                  "Tudo começa com uma conexão."
                )}
              </h1>
              <p>
                {tab === "workspace"
                  ? "Reúna seus materiais. Escolha seus agentes. Dê o próximo passo."
                  : tab === "library"
                    ? "Os materiais que acompanham seu pensamento."
                    : tab === "history"
                      ? "Planos, respostas e revisões organizados por projeto."
                      : "Veja o que está disponível no seu computador."}
              </p>
            </div>
            <div className="project-switch">
              <label htmlFor="project">PROJETO ATUAL</label>
              <div>
                <Folder size={15} />
                <select
                  id="project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={!projects.length || busy}
                >
                  <option value="" disabled>
                    Escolha um projeto
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
                <button
                  className="icon-button"
                  aria-label="Novo projeto"
                  onClick={openProject}
                  disabled={!online}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="alert error" role="alert">
              <Circle size={15} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dispensar erro"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <CheckCircle2 size={16} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {capture && modal !== "source" && (
            <div className="alert" role="status">
              <FileText size={16} />
              <span>Um trecho aguarda sua revisão.</span>
              <button
                className="text-button"
                onClick={() => receiveCapture(capture)}
              >
                Revisar trecho
              </button>
            </div>
          )}
          {!online && !checking && tab !== "connections" && (
            <div className="connection-banner">
              <span className="connection-icon">
                <Unplug size={20} />
              </span>
              <div>
                <strong>Seu espaço está pronto para conectar.</strong>
                <p>
                  {connectionError ||
                    "Inicie o componente local para acessar seus projetos."}
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => setTab("connections")}
              >
                Como conectar <ArrowUpRight size={16} />
              </button>
            </div>
          )}

          {tab === "workspace" && (
            <>
              <div className="workspace-grid">
                <section className="composer card">
                  <div className="card-heading">
                    <span className="card-icon blue">
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <h2>O que vamos fazer?</h2>
                      <p>Comece com uma pergunta. Ou uma grande ideia.</p>
                    </div>
                    <span className="micro-badge">NOVO PEDIDO</span>
                  </div>
                  <form onSubmit={plan}>
                    <label htmlFor="instruction" className="sr-only">
                      Descreva seu pedido
                    </label>
                    <textarea
                      id="instruction"
                      placeholder="Explique um assunto, conecte ideias ou planeje seu próximo projeto…"
                      value={text}
                      onChange={(e) => changeText(e.target.value)}
                      disabled={!draftReady}
                      maxLength={8000}
                    />
                    <div className="prompt-ideas">
                      {[
                        "Explique este conteúdo",
                        "Compare duas ideias",
                        "Organize meus estudos",
                      ].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => changeText(s)}
                          disabled={!draftReady}
                        >
                          <Plus size={12} />
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="composer-context">
                      <span>
                        <Link2 size={14} />
                        {selectedSources.length
                          ? `${selectedSources.length} ${selectedSources.length === 1 ? "material selecionado" : "materiais selecionados"}`
                          : "Adicione contexto ao seu pedido"}
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Adicionar material"
                        onClick={openSource}
                        disabled={!online || !projectId}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="composer-controls">
                      <label className="kind-select">
                        <Settings2 size={14} />
                        <select
                          aria-label="Tipo de tarefa"
                          value={kind}
                          onChange={(e) => setKind(e.target.value)}
                        >
                          <option value="study">Estudo</option>
                          <option value="writing">Escrita</option>
                          <option value="coding">Código</option>
                          <option value="analysis">Análise</option>
                          <option value="general">Geral</option>
                        </select>
                      </label>
                      <span className="draft-label">Rascunho local</span>
                      <button
                        className="primary"
                        type="submit"
                        disabled={
                          busy ||
                          !online ||
                          !projectId ||
                          !available.length ||
                          !text.trim() ||
                          !selectedModels.length
                        }
                      >
                        {busy ? (
                          <Loader2 size={16} className="spin" />
                        ) : (
                          <ArrowRight size={16} />
                        )}{" "}
                        Criar plano
                      </button>
                    </div>
                  </form>
                  <div className="composer-foot">
                    <ShieldCheck size={13} />
                    Você escolhe os materiais que cada agente recebe.
                  </div>
                </section>
                <section className="context-card card">
                  <div className="section-top">
                    <div>
                      <span className="eyebrow muted">POR ONDE COMEÇAR</span>
                      <h2>Um lugar para suas ideias.</h2>
                    </div>
                    <span className="orbit-icon">
                      <Layers3 size={22} />
                    </span>
                  </div>
                  <p>
                    O contexto acompanha o projeto, mesmo quando o agente muda.
                  </p>
                  <div className="steps">
                    <div>
                      <span>01</span>
                      <p>
                        <strong>Reúna o que importa</strong>
                        <small>Trechos, anotações e referências.</small>
                      </p>
                    </div>
                    <div>
                      <span>02</span>
                      <p>
                        <strong>Escolha quem participa</strong>
                        <small>Um agente ou uma segunda opinião.</small>
                      </p>
                    </div>
                    <div>
                      <span>03</span>
                      <p>
                        <strong>Continue de onde parou</strong>
                        <small>Planos e resultados no mesmo lugar.</small>
                      </p>
                    </div>
                  </div>
                </section>
              </div>
              <section className="agents-section">
                <div className="section-title">
                  <div>
                    <h2>
                      Seus agentes <span>{available.length} disponíveis</span>
                    </h2>
                    <p>
                      Escolha quem vai ajudar a transformar contexto em
                      resultado.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("connections")}
                  >
                    Gerenciar <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="agents-grid">
                  {models.length
                    ? models.map((m) => (
                        <button
                          key={m.id}
                          disabled={!m.available}
                          className={`agent-card card ${selectedModels.includes(m.id) ? "selected" : ""}`}
                          onClick={() =>
                            setSelectedModels((old) =>
                              old.includes(m.id)
                                ? old.filter((x) => x !== m.id)
                                : [...old, m.id],
                            )
                          }
                          aria-pressed={selectedModels.includes(m.id)}
                        >
                          <span className="agent-symbol">
                            <Command size={23} />
                          </span>
                          <span className="agent-description">
                            <strong>{m.label}</strong>
                            <small>
                              {m.available
                                ? "Disponível neste computador"
                                : "Indisponível"}
                            </small>
                          </span>
                          <span className="agent-check">
                            {selectedModels.includes(m.id) ? (
                              <Check size={14} />
                            ) : (
                              <Circle size={15} />
                            )}
                          </span>
                        </button>
                      ))
                    : ["ChatGPT", "Claude", "Gemini"].map((name, index) => (
                        <button
                          className="agent-card card"
                          key={name}
                          onClick={() => setTab("connections")}
                        >
                          <span className={`agent-symbol a${index}`}>
                            {index === 0 ? (
                              <Command size={24} />
                            ) : index === 1 ? (
                              <Sparkles size={24} />
                            ) : (
                              <span className="gemini-star">✦</span>
                            )}
                          </span>
                          <span className="agent-description">
                            <strong>{name}</strong>
                            <small>Conexão a configurar</small>
                          </span>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                </div>
                <div className="agents-meta">
                  <span>
                    <Circle size={10} />
                    {available.length
                      ? "A seleção segue sua preferência e o tipo de tarefa."
                      : "Nenhuma IA conectada. Seus pedidos podem ficar como rascunho."}
                  </span>
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={review}
                      onChange={(e) => setReview(e.target.checked)}
                      disabled={available.length < 2}
                    />
                    <span className="switch" />
                    Revisão por outro agente
                  </label>
                </div>
              </section>
            </>
          )}

          {(tab === "workspace" || tab === "library") && (
            <section className="library-section">
              <div className="section-title">
                <div>
                  <h2>
                    Contexto do projeto <span>{sources.length} materiais</span>
                  </h2>
                  <p>
                    {project
                      ? `Tudo o que você reuniu em ${project.title}.`
                      : "Crie um projeto para começar sua biblioteca."}
                  </p>
                </div>
                <div className="section-actions">
                  <button
                    className="subtle"
                    onClick={() =>
                      act(async () => receiveCapture(await selectCapture()))
                    }
                    disabled={busy}
                  >
                    <ArrowDownToLine size={15} /> Capturar seleção
                  </button>
                  <button
                    className="subtle"
                    onClick={openSource}
                    disabled={!online || !projectId || busy}
                  >
                    <Plus size={15} /> Adicionar texto
                  </button>
                </div>
              </div>
              {sources.length > 0 && (
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Buscar materiais"
                    value={search}
                    placeholder="Buscar neste projeto…"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span>{selectedSources.length} selecionados</span>
                </div>
              )}
              {filtered.length ? (
                <div className="sources-grid">
                  {filtered.map((s) => (
                    <article
                      key={s.id}
                      className={`source-card card ${selectedSources.includes(s.id) ? "selected" : ""}`}
                    >
                      <label className="source-check">
                        <input
                          type="checkbox"
                          checked={selectedSources.includes(s.id)}
                          onChange={() => toggleSource(s.id)}
                          aria-label={`Usar ${s.title} no pedido`}
                        />
                        <span>
                          {selectedSources.includes(s.id) && (
                            <Check size={12} />
                          )}
                        </span>
                      </label>
                      <span className="file-icon">
                        <FileText size={19} />
                      </span>
                      <button
                        className="source-open"
                        onClick={() =>
                          act(async () =>
                            setSourceView(
                              await request<Source>("sources.get", {
                                project_id: projectId,
                                source_id: s.id,
                              }),
                            ),
                          )
                        }
                      >
                        <h3>{s.title}</h3>
                        <p>{s.preview || s.content?.slice(0, 160)}</p>
                      </button>
                      <div className="source-bottom">
                        <span>
                          Texto · {s.char_count || s.content?.length || 0}{" "}
                          caracteres
                        </span>
                        <ArrowUpRight size={14} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-library card">
                  <div className="empty-files">
                    <FileText size={23} />
                    <Link2 size={20} />
                    <BookOpen size={22} />
                  </div>
                  <h3>
                    {search
                      ? "Nenhum material encontrado."
                      : "Toda boa resposta começa com contexto."}
                  </h3>
                  <p>
                    {search
                      ? "Experimente outro termo."
                      : "Adicione uma anotação ou selecione um trecho de uma página no Firefox."}
                  </p>
                  <button
                    className="text-button"
                    onClick={projectId ? openSource : openProject}
                    disabled={!online}
                  >
                    {projectId
                      ? "Adicionar primeiro material"
                      : "Criar meu primeiro projeto"}{" "}
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {sourceNext !== null && (
                <button
                  className="load-more subtle"
                  disabled={busy}
                  onClick={() => more("sources")}
                >
                  Carregar mais materiais
                </button>
              )}
            </section>
          )}

          {tab === "history" && (
            <section className="history-section">
              {tasks.length ? (
                tasks.map((t) => (
                  <button
                    className="task-row card"
                    key={t.id}
                    onClick={() =>
                      act(async () =>
                        setTaskView(
                          await request<Task>("tasks.get", { task_id: t.id }),
                        ),
                      )
                    }
                  >
                    <span className="card-icon">
                      <MessageSquare size={20} />
                    </span>
                    <span>
                      <strong>{t.instruction}</strong>
                      <small>
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                      </small>
                    </span>
                    <span className={`task-status ${t.status}`}>
                      {taskState(t.status)}
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))
              ) : (
                <div className="empty-library card">
                  <Workflow size={34} />
                  <h3>Seu próximo passo começa aqui.</h3>
                  <p>
                    Os planos e resultados deste projeto aparecerão nesta área.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setTab("workspace")}
                  >
                    Voltar ao pedido <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {taskNext !== null && (
                <button
                  className="subtle load-more"
                  onClick={() => more("tasks")}
                  disabled={busy}
                >
                  Carregar mais tarefas
                </button>
              )}
            </section>
          )}

          {tab === "connections" && (
            <div className="connections-grid">
              <section className="card connection-details">
                <h2>Conexão com seu computador</h2>
                <p>
                  A extensão usa um componente local para acessar seus projetos.
                </p>
                <div className="connection-line">
                  <span>Extensão Firefox</span>
                  <span className={inFirefox ? "good" : ""}>
                    {inFirefox
                      ? "Disponível"
                      : demo
                        ? "Demonstração"
                        : "Abra no Firefox"}
                  </span>
                </div>
                <div className="connection-line">
                  <span>Componente local</span>
                  <span className={host ? "good" : ""}>
                    {host ? "Respondendo" : "Não conectado"}
                  </span>
                </div>
                <div className="connection-line">
                  <span>Backend</span>
                  <span className={online ? "good" : ""}>
                    {online ? "Disponível" : "Não conectado"}
                  </span>
                </div>
                <div className="connection-line">
                  <span>Agentes disponíveis</span>
                  <span>{available.length}</span>
                </div>
                {(connectionError || modelError) && (
                  <p className="connection-message">
                    {connectionError || modelError}
                  </p>
                )}
                <button
                  className="primary"
                  onClick={connect}
                  disabled={checking}
                >
                  {checking ? (
                    <Loader2 className="spin" size={15} />
                  ) : (
                    <RefreshCw size={15} />
                  )}{" "}
                  Verificar novamente
                </button>
              </section>
              <section className="card connection-details">
                <span className="card-icon blue">
                  <Link2 size={21} />
                </span>
                <h2>Conecte seu espaço local.</h2>
                <p>
                  Instale o componente local e inicie o backend. Seus materiais
                  ficam no computador; os agentes recebem apenas o contexto
                  escolhido para uma tarefa.
                </p>
                <a
                  className="subtle"
                  href={guide}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir guia de instalação <ArrowUpRight size={15} />
                </a>
                <p className="small-note">
                  Nesta versão, você pode organizar materiais e criar planos.
                  Executar uma IA pelo painel será habilitado quando a execução
                  independente do painel estiver pronta.
                </p>
              </section>
            </div>
          )}
          <footer className="footer">
            <span>
              <Mark small /> Um espaço. Mais possibilidades.
            </span>
            <span>
              Ia-bbaru <span className="version">0.1</span>
            </span>
          </footer>
        </main>
      </div>

      {modal === "project" && (
        <Dialog
          title="Um novo espaço para suas ideias"
          close={() => setModal(null)}
        >
          <form onSubmit={createProject}>
            <label>
              Nome do projeto
              <input
                autoFocus
                required
                maxLength={120}
                placeholder="Ex.: Faculdade, Pesquisa, Meu app…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <p className="small-note">
              Materiais e tarefas ficam organizados dentro deste projeto.
            </p>
            <button
              className="primary"
              disabled={busy || !online || !title.trim()}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Plus size={16} />
              )}{" "}
              Criar projeto
            </button>
          </form>
          {error && (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {modal === "source" && (
        <Dialog
          title={capture ? "Revisar trecho selecionado" : "Adicionar material"}
          close={() => setModal(null)}
        >
          <form onSubmit={saveSource}>
            {capture && (
              <div className="capture-origin">
                <Link2 size={14} />
                <span>{capture.url}</span>
              </div>
            )}
            <label>
              Projeto
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                <option value="">Escolha um projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {!projects.length && (
              <p className="small-note">
                Crie um projeto antes de salvar. O trecho continua aguardando
                revisão.
              </p>
            )}
            <label>
              Título
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Conteúdo
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                maxLength={40000}
              />
            </label>
            <p className="small-note">
              {sourceContent(
                title,
                capture?.url || "",
                content,
              ).length.toLocaleString("pt-BR")}{" "}
              / 40.000 caracteres · Revise antes de salvar.
            </p>
            <div className="dialog-actions">
              {capture && (
                <button
                  type="button"
                  className="subtle"
                  onClick={() =>
                    act(async () => {
                      await clearCapture(capture.id);
                      setCapture(null);
                      setModal(null);
                    })
                  }
                >
                  Descartar trecho
                </button>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  !online ||
                  !projectId ||
                  !title.trim() ||
                  !content.trim()
                }
              >
                <Plus size={16} /> Salvar no projeto
              </button>
            </div>
          </form>
          {error && (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {sourceView && (
        <Dialog title={sourceView.title} close={() => setSourceView(null)}>
          <pre className="result-text">{sourceView.content}</pre>
        </Dialog>
      )}
      {taskView && (
        <Dialog
          title={taskState(taskView.status)}
          close={() => setTaskView(null)}
        >
          <p className="task-instruction">{taskView.instruction}</p>
          <div className="plan-list">
            {taskView.plan.map((step, index) => (
              <div key={index}>
                <span>{index + 1}</span>
                <p>
                  <strong>
                    {step.role === "answer" ? "Resposta principal" : "Revisão"}
                  </strong>
                  <small>
                    {models.find((m) => m.id === step.model_id)?.label ||
                      step.model_id}
                  </small>
                </p>
              </div>
            ))}
          </div>
          {taskView.routing && (
            <p className="small-note">{taskView.routing.reason}</p>
          )}
          {!!taskView.context?.length && (
            <details>
              <summary>
                Materiais usados neste plano ({taskView.context.length})
              </summary>
              {taskView.context.map((source) => (
                <details key={source.id}>
                  <summary>{source.title}</summary>
                  <pre className="result-text">{source.content}</pre>
                </details>
              ))}
            </details>
          )}
          {taskView.status === "planned" && (
            <div className="alert">
              <ShieldCheck size={18} />
              <span>
                Plano salvo. Esta versão ainda não inicia execuções pelo painel.
              </span>
            </div>
          )}
          {taskView.error && (
            <div className="alert error" role="alert">
              A tarefa não foi concluída: {taskView.error}
            </div>
          )}
          {taskView.output && (
            <pre className="result-text">{taskView.output}</pre>
          )}
          {taskView.status !== "completed" &&
            taskView.results?.map((r, i) => (
              <details key={i}>
                <summary>Resultado parcial · {r.model_id}</summary>
                <pre className="result-text">{r.output}</pre>
              </details>
            ))}
        </Dialog>
      )}
    </div>
  );
}
