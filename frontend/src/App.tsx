import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  Layers3,
  Power,
  Settings2,
  Unplug,
  Workflow,
} from "lucide-react";
import type { Capture, Connection, Media, Model, Page, Project, Source, Tab, Task } from "./types";
import {
  clearCapture,
  demo,
  expand,
  inDesktop,
  inFirefox,
  localBridge,
  pendingCapture,
  readDraft,
  request,
  selectCapture,
  writeDraft,
} from "./transport";
import {
  decideIncomingCapture,
  requiresLimitAcceptance,
  sourceContent,
  validateDraft,
} from "./logic.mjs";

import { TopBar } from "./components/TopBar";
import { NavigationRail } from "./components/NavigationRail";
import { MobileNav } from "./components/MobileNav";
import { ProjectSwitch } from "./components/ProjectSwitch";
import { WorkspaceComposer } from "./components/WorkspaceComposer";
import { ChatThread } from "./components/ChatThread";
import { ContextGuideCard } from "./components/ContextGuideCard";
import { AgentsSection } from "./components/AgentsSection";
import { LibrarySection } from "./components/LibrarySection";
import { HistorySection } from "./components/HistorySection";
import { ConnectionsSection } from "./components/ConnectionsSection";
import { ProjectModal } from "./components/ProjectModal";
import { SourceModal, type CaptureMediaKind } from "./components/SourceModal";
import { SourceViewModal } from "./components/SourceViewModal";
import { TaskViewModal } from "./components/TaskViewModal";
import { GuideModal } from "./components/GuideModal";
import { YukiMark } from "./components/YukiMark";

const tabs: { id: Tab; label: string; icon: typeof Layers3 }[] = [
  { id: "workspace", label: "Área de trabalho", icon: Layers3 },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "history", label: "Atividade", icon: Workflow },
  { id: "connections", label: "Conexões", icon: Settings2 },
];

const chromiumGuideUrl =
  "https://github.com/Bbarusu/Ia-bbaru/blob/codex/chromium-browser/docs/TESTAR_NAVEGADOR_CHROMIUM.md";
const firefoxGuideUrl =
  "https://github.com/Bbarusu/Ia-bbaru/blob/codex/frontend-firefox/docs/INSTALAR_FIREFOX.md";

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
  const [preferredModelId, setPreferredModelId] = useState("");
  const [reviewerModelId, setReviewerModelId] = useState("");
  const [text, setText] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [kind, setKind] = useState("study");
  const [review, setReview] = useState(false);
  const [acceptedLimit, setAcceptedLimit] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState("1");

  const [host, setHost] = useState(false);
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [modelError, setModelError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [modal, setModal] = useState<"project" | "source" | null>(null);
  const [sourceMode, setSourceMode] = useState<CaptureMediaKind>("text");
  const [guideOpen, setGuideOpen] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [queuedCapture, setQueuedCapture] = useState<Capture | null>(null);
  const [sourceView, setSourceView] = useState<Source | null>(null);
  const [taskView, setTaskView] = useState<Task | null>(null);
  const [executionEnabled, setExecutionEnabled] = useState(false);
  const [pollError, setPollError] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [diagnosticError, setDiagnosticError] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");

  const editRef = useRef({ modal, title, content, capture, busy });
  editRef.current = { modal, title, content, capture, busy };

  const project = projects.find((p) => p.id === projectId);
  const available = models.filter((m) => m.available);
  const guideUrl = inDesktop ? chromiumGuideUrl : firefoxGuideUrl;

  async function connect() {
    let hostReady = false;
    setChecking(true);
    setError("");
    setConnectionError("");
    try {
      const info = await request<{ task_execution?: boolean }>("bridge.info");
      setExecutionEnabled(inDesktop && !demo && info.task_execution === true);
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
        const data = await request<{
          protocol_version?: string;
          models: Model[];
        }>("models.list");
        setModels(data.models);
        setCatalogVersion(data.protocol_version || "1");
        setModelError("");
        setSelectedModels((old) =>
          old.filter((id) =>
            data.models.some((m) => m.id === id && m.available),
          ),
        );
        setPreferredModelId((old) =>
          data.models.some((m) => m.id === old && m.available) ? old : "",
        );
        setReviewerModelId((old) =>
          data.models.some((m) => m.id === old && m.available) ? old : "",
        );
      } catch (e) {
        setModels([]);
        setSelectedModels([]);
        setPreferredModelId("");
        setReviewerModelId("");
        setModelError((e as Error).message);
      }
    } catch (e) {
      setExecutionEnabled(false);
      setHost(hostReady);
      setOnline(false);
      setModels([]);
      setSelectedModels([]);
      setPreferredModelId("");
      setReviewerModelId("");
      setConnectionError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function updateTask(task: Task) {
    setTasks((old) => old.map((item) => item.id === task.id ? task : item));
    setTaskView((old) => old?.id === task.id ? task : old);
  }

  const activeTaskIds = [...new Set([...tasks, ...(taskView ? [taskView] : [])]
    .filter((task) => ["queued", "running", "waiting"].includes(task.status))
    .map((task) => task.id))].sort().join(",");
  useEffect(() => {
    if (!online || !activeTaskIds) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const updates = await Promise.all(activeTaskIds.split(",").map((id) =>
          request<Task>("tasks.get", { task_id: id })));
        if (!stopped) {
          updates.forEach(updateTask);
          setPollError("");
        }
      } catch {
        if (!stopped) setPollError("Não foi possível atualizar o andamento. A tarefa não foi reenviada; reconecte o componente local para consultar.");
      } finally {
        if (!stopped) timer = setTimeout(poll, 1500);
      }
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [online, activeTaskIds]);

  useEffect(() => {
    connect();
  }, []);

  useEffect(() => {
    if (tab !== "connections" || !online || !inDesktop || checking) return;
    let active = true;
    request<{ connections: Connection[] }>("connections.list").then((data) => {
      if (active) { setConnections(data.connections); setDiagnosticError(""); }
    }).catch(() => { if (active) setDiagnosticError("Diagnóstico das CLIs indisponível. O catálogo acima continua independente."); });
    return () => { active = false; };
  }, [tab, online, checking]);

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
    const decision = decideIncomingCapture(editRef.current, value);
    if (decision.action === "queue" && decision.queuedCapture) {
      setQueuedCapture(decision.queuedCapture);
      return;
    }
    if (decision.action === "open" && decision.capture) {
      setCapture(decision.capture);
      setSourceMode(decision.capture.media?.kind || "text");
      setTitle(decision.title || "");
      setContent(decision.content || "");
      setModal("source");
    }
  }

  useEffect(() => {
    pendingCapture()
      .then(receiveCapture)
      .catch(() => {});

    if (!localBridge) return;

    const listener = (changes: any) => {
      if (changes.pendingCapture?.newValue) {
        receiveCapture(changes.pendingCapture.newValue);
      }
      if (changes.captureError?.newValue) {
        setError(changes.captureError.newValue);
        localBridge.storage.local.remove("captureError");
      }
    };

    localBridge.storage.onChanged.addListener(listener);
    return () => localBridge.storage.onChanged.removeListener(listener);
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

  function openSource(mode: CaptureMediaKind = "text") {
    if (mode === "screenshot" && inDesktop) {
      void (async () => {
        setError("");
        const result = await localBridge.runtime.sendMessage({ type: "capture.screenshot" });
        if (!result?.ok) throw new Error(result?.error?.message || "Não foi possível capturar a página.");
        // The runtime publishes the capture through the existing draft-safe path.
      })().catch((error) => setError(error.message));
      return;
    }
    setCapture(null);
    setSourceMode(mode);
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

  async function saveSource(event: FormEvent, media?: Media) {
    event.preventDefault();
    const target = projectId;
    if (!target) {
      setError("Crie ou escolha um projeto antes de salvar.");
      return;
    }
    const reviewedCapture = capture;
    const body = sourceContent(title, reviewedCapture?.url || "", content);
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
        ...(media ? { media } : {}),
      });
      if (projectRef.current === target) {
        setSources((old) => [
          ...old,
          { ...source, preview: body.slice(0, 160), char_count: body.length },
        ]);
        setSelectedSources((old) =>
          old.length < 20 && !source.media ? [...old, source.id] : old,
        );
      }
      if (reviewedCapture) {
        await clearCapture(reviewedCapture.id);
      }
      setCapture((old) =>
        old?.id === reviewedCapture?.id ? null : old,
      );
      setModal(null);
      setTitle("");
      setContent("");
      setNotice("Material salvo no projeto.");
    });
  }

  async function discardCapture(captureId: string) {
    await act(async () => {
      await clearCapture(captureId);
      setCapture((old) => (old?.id === captureId ? null : old));
      setTitle("");
      setContent("");
      setModal(null);
    });
  }

  function replaceWithQueuedCapture() {
    if (!queuedCapture) return;
    const previous = capture;
    const next = queuedCapture;
    if (previous && previous.id !== next.id) {
      clearCapture(previous.id).catch(() => {});
    }
    setCapture(next);
    setTitle(next.title);
    setContent(next.text);
    setQueuedCapture(null);
    setModal("source");
  }

  function changeText(value: string) {
    setText(value);
    writeDraft(`draft:${projectId || "new"}`, value).catch(() =>
      setError("Não foi possível guardar o rascunho neste navegador."),
    );
  }

  function toggleSource(id: string) {
    if (selectedSources.includes(id)) {
      setSelectedSources((old) => old.filter((x) => x !== id));
    } else if (selectedSources.length >= 20) {
      setError("Selecione no máximo 20 materiais por pedido.");
    } else {
      setSelectedSources((old) => [...old, id]);
    }
  }

  function toggleModel(id: string) {
    setSelectedModels((old) => {
      const next = old.includes(id)
        ? old.filter((x) => x !== id)
        : [...old, id];
      if (!next.includes(preferredModelId)) setPreferredModelId("");
      if (!next.includes(reviewerModelId)) setReviewerModelId("");
      return next;
    });
  }

  async function plan(event: FormEvent) {
    event.preventDefault();
    const warning = validateDraft({ projectId, text, selectedModels, review });
    if (warning) {
      setError(warning);
      return;
    }
    const selected = models.filter((m) => selectedModels.includes(m.id));
    if (
      catalogVersion === "1.1" &&
      selected.some(
        (m) => !m.capabilities || m.capabilities.tools !== "disabled",
      )
    ) {
      setError(
        "Este agente não oferece as capacidades necessárias para esta tarefa.",
      );
      return;
    }
    if (requiresLimitAcceptance(selectedModels, models) && !acceptedLimit) {
      setError("Aceite o limite indicativo antes de criar este plano.");
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
          allow_unenforced_output_limit: acceptedLimit,
          ...(preferredModelId && selectedModels.includes(preferredModelId)
            ? { preferred_model_id: preferredModelId }
            : {}),
          ...(review && reviewerModelId && selectedModels.includes(reviewerModelId)
            ? { reviewer_model_id: reviewerModelId }
            : {}),
        },
      });
      if (projectRef.current === target) setTasks((old) => [task, ...old]);
      setTaskView(task);
      setAcceptedLimit(false);
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

  const filteredSources = sources.filter((s) =>
    `${s.title} ${s.preview || ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );

  return (
    <div className="shell">
      <NavigationRail
        tab={tab}
        setTab={setTab}
        tabs={tabs}
        projects={projects}
        projectId={projectId}
        setProjectId={setProjectId}
        projectNext={projectNext}
        openProject={openProject}
        moreProjects={() => more("projects")}
        online={online}
        busy={busy}
      />

      <div className="body">
        <TopBar
          tab={tab}
          tabs={tabs}
          online={online}
          checking={checking}
          canExpand={inFirefox || inDesktop}
          demo={demo}
          connect={connect}
          expand={expand}
          openGuide={() => setGuideOpen(true)}
        />

        <MobileNav tab={tab} setTab={setTab} tabs={tabs} />

        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span aria-hidden="true" /> IA-BBARU BROWSER · CLAUDE
              </div>
              <h1>
                {tab === "workspace" ? (
                  <>
                    Chat com <span>Claude</span>
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
                  ? "Converse sobre a página ativa ou explore seus materiais."
                  : tab === "library"
                    ? "Os materiais que acompanham seu pensamento."
                    : tab === "history"
                      ? "Planos, respostas e revisões organizados por projeto."
                      : "Veja o que está disponível no seu computador."}
              </p>
            </div>

            <ProjectSwitch
              projects={projects}
              projectId={projectId}
              setProjectId={setProjectId}
              openProject={openProject}
              online={online}
              busy={busy}
            />
          </div>

          {error && (
            <div className="alert error" role="alert">
              <Circle size={15} aria-hidden="true" />
              <span>{error}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Dispensar erro"
                onClick={() => setError("")}
              >
                <Power size={14} />
              </button>
            </div>
          )}

          {notice && (
            <div className="alert success" role="status">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{notice}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                <Power size={14} />
              </button>
            </div>
          )}

          {queuedCapture && (
            <div className="alert" role="status">
              <span>
                Uma nova captura está aguardando. Conclua o material atual.
              </span>
              <button
                type="button"
                className="text-button"
                disabled={modal === "source" || busy}
                onClick={() => {
                  receiveCapture(queuedCapture);
                  setQueuedCapture(null);
                }}
              >
                Revisar nova captura
              </button>
            </div>
          )}

          {capture && modal !== "source" && (
            <div className="alert" role="status">
              <FileText size={16} aria-hidden="true" />
              <span>Um trecho aguarda sua revisão.</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setTitle(capture.title);
                  setContent(capture.text);
                  setModal("source");
                }}
              >
                Revisar trecho
              </button>
            </div>
          )}

          {!online && !checking && tab !== "connections" && (
            <div className="connection-banner">
              <span className="connection-icon" aria-hidden="true">
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
                type="button"
                className="text-button"
                onClick={() => setTab("connections")}
              >
                Como conectar <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {tab === "workspace" && (
            <div className="atlas-workspace-view">
              <div className="atlas-chat-container">
                <ChatThread
                  tasks={tasks}
                  models={models}
                  onOpenTask={setTaskView}
                  onSuggestionClick={(s) => changeText(s)}
                />

                <WorkspaceComposer
                  text={text}
                  changeText={changeText}
                  draftReady={draftReady}
                  selectedSourcesCount={selectedSources.length}
                  openSource={openSource}
                  captureSelection={() =>
                    selectCapture().catch((error) => setError(error.message))
                  }
                  kind={kind}
                  setKind={setKind}
                  plan={plan}
                  busy={busy}
                  online={online}
                  projectId={projectId}
                  availableModels={available}
                  selectedModels={selectedModels}
                  capture={capture}
                  onClearCapture={() => setCapture(null)}
                />
              </div>

              <div className="atlas-secondary-panels">
                <details className="atlas-accordion" open>
                  <summary>
                    <div className="accordion-summary-title">
                      <Settings2 size={15} aria-hidden="true" />
                      <span>Modelos Claude</span>
                    </div>
                    <span className="accordion-badge">
                      {available.length > 0
                        ? `${available.length} ativo(s)`
                        : "Sem conexão"}
                    </span>
                  </summary>
                  <div className="accordion-body">
                    <AgentsSection
                      models={models}
                      availableModels={available}
                      selectedModels={selectedModels}
                      toggleModel={toggleModel}
                      preferredModelId={preferredModelId}
                      setPreferredModelId={setPreferredModelId}
                      reviewerModelId={reviewerModelId}
                      setReviewerModelId={setReviewerModelId}
                      review={review}
                      setReview={setReview}
                      acceptedLimit={acceptedLimit}
                      setAcceptedLimit={setAcceptedLimit}
                      goToConnections={() => setTab("connections")}
                      kind={kind}
                    />
                  </div>
                </details>

                <details className="atlas-accordion" open>
                  <summary>
                    <div className="accordion-summary-title">
                      <BookOpen size={15} aria-hidden="true" />
                      <span>Materiais do Projeto</span>
                    </div>
                    <span className="accordion-badge">
                      {sources.length} {sources.length === 1 ? "item" : "itens"}
                    </span>
                  </summary>
                  <div className="accordion-body">
                    <LibrarySection
                      project={project}
                      sources={sources}
                      filteredSources={filteredSources}
                      selectedSources={selectedSources}
                      toggleSource={toggleSource}
                      openSource={openSource}
                      openProject={openProject}
                      captureSelection={() =>
                        selectCapture().catch((error) => setError(error.message))
                      }
                      viewSource={(source) =>
                        act(async () =>
                          setSourceView(
                            await request<Source>("sources.get", {
                              project_id: projectId,
                              source_id: source.id,
                            }),
                          ),
                        )
                      }
                      search={search}
                      setSearch={setSearch}
                      sourceNext={sourceNext}
                      loadMoreSources={() => more("sources")}
                      online={online}
                      busy={busy}
                    />
                  </div>
                </details>
              </div>
            </div>
          )}

          {tab === "library" && (
            <LibrarySection
              project={project}
              sources={sources}
              filteredSources={filteredSources}
              selectedSources={selectedSources}
              toggleSource={toggleSource}
              openSource={openSource}
              openProject={openProject}
              captureSelection={() =>
                selectCapture().catch((error) => setError(error.message))
              }
              viewSource={(source) =>
                act(async () =>
                  setSourceView(
                    await request<Source>("sources.get", {
                      project_id: projectId,
                      source_id: source.id,
                    }),
                  ),
                )
              }
              search={search}
              setSearch={setSearch}
              sourceNext={sourceNext}
              loadMoreSources={() => more("sources")}
              online={online}
              busy={busy}
            />
          )}

          {tab === "history" && (
            <HistorySection
              tasks={tasks}
              viewTask={(id) =>
                act(async () =>
                  setTaskView(await request<Task>("tasks.get", { task_id: id })),
                )
              }
              taskNext={taskNext}
              loadMoreTasks={() => more("tasks")}
              goToWorkspace={() => setTab("workspace")}
              busy={busy}
            />
          )}

          {tab === "connections" && (
            <ConnectionsSection
              connections={connections}
              diagnosticError={diagnosticError}
              inFirefox={inFirefox}
              inDesktop={inDesktop}
              demo={demo}
              host={host}
              online={online}
              checking={checking}
              catalogVersion={catalogVersion}
              availableModels={available}
              models={models}
              connectionError={connectionError}
              modelError={modelError}
              connect={connect}
              guideUrl={guideUrl}
            />
          )}

          <footer className="footer">
            <span>
              <YukiMark size="sm" />
              Yuki · Um espaço. Mais possibilidades.
            </span>
          </footer>
        </main>
      </div>

      {modal === "project" && (
        <ProjectModal
          title={title}
          setTitle={setTitle}
          close={() => setModal(null)}
          createProject={createProject}
          busy={busy}
          online={online}
          error={error}
        />
      )}

      {modal === "source" && (
        <SourceModal
          key={`${capture?.id ?? "source-manual"}-${sourceMode}`}
          capture={capture}
          queuedCapture={queuedCapture}
          projects={projects}
          projectId={projectId}
          setProjectId={setProjectId}
          title={title}
          setTitle={setTitle}
          content={content}
          setContent={setContent}
          close={() => setModal(null)}
          saveSource={saveSource}
          discardCapture={discardCapture}
          replaceWithQueuedCapture={replaceWithQueuedCapture}
          busy={busy}
          online={online}
          error={error}
          initialMode={sourceMode}
        />
      )}

      {sourceView && (
        <SourceViewModal
          source={sourceView}
          close={() => setSourceView(null)}
        />
      )}

      {taskView && (
        <TaskViewModal
          key={taskView.id}
          task={taskView}
          models={models}
          executionEnabled={executionEnabled}
          updateTask={updateTask}
          pollError={pollError}
          close={() => setTaskView(null)}
        />
      )}

      {guideOpen && <GuideModal close={() => setGuideOpen(false)} />}
    </div>
  );
}
