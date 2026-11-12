import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  SquarePen,
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
  localBridge,
  pendingCapture,
  readDraft,
  request,
  selectCapture,
  writeDraft,
} from "./transport";
import {
  decideIncomingCapture,
  chatTurns,
  eligibleChatModels,
  requiresLimitAcceptance,
  resolveChatModelIds,
  sourceContent,
  validateChatDraft,
} from "./logic.mjs";

import { TopBar } from "./components/TopBar";
import { NavigationRail } from "./components/NavigationRail";
import { MobileNav } from "./components/MobileNav";
import { ProjectSwitch } from "./components/ProjectSwitch";
import { ChatComposer } from "./components/ChatComposer";
import { ChatThread } from "./components/ChatThread";
import { LibrarySection } from "./components/LibrarySection";
import { HistorySection } from "./components/HistorySection";
import { ConnectionsSection } from "./components/ConnectionsSection";
import { ProjectModal } from "./components/ProjectModal";
import { SourceModal, type CaptureMediaKind } from "./components/SourceModal";
import { SourceViewModal } from "./components/SourceViewModal";
import { TaskViewModal } from "./components/TaskViewModal";
import { GuideModal } from "./components/GuideModal";
import { YukiMark } from "./components/YukiMark";

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "workspace", label: "Chat", icon: MessageSquare },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "history", label: "Atividade", icon: Workflow },
  { id: "connections", label: "Conexões", icon: Settings2 },
];

const chromiumGuideUrl =
  "https://github.com/Bbarusu/Ia-bbaru/blob/codex/chromium-browser/docs/TESTAR_NAVEGADOR_CHROMIUM.md";

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
  const [chatModel, setChatModel] = useState("auto");
  const [chatSince, setChatSince] = useState("");
  const [chatCapture, setChatCapture] = useState<Capture | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendError, setSendError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [uncertainEnqueue, setUncertainEnqueue] = useState<string[]>([]);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wantsChatCapture = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [kind, setKind] = useState("study");
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
  const guideUrl = chromiumGuideUrl;

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
      } catch (e) {
        setModels([]);
        setModelError((e as Error).message);
      }
    } catch (e) {
      setExecutionEnabled(false);
      setHost(hostReady);
      setOnline(false);
      setModels([]);
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

  // Abrir ou voltar ao painel leva direto ao campo de mensagem; nada é enviado.
  useEffect(() => {
    function focusComposer() {
      if (tab === "workspace" && !document.querySelector("dialog[open]"))
        inputRef.current?.focus();
    }
    focusComposer();
    window.addEventListener("focus", focusComposer);
    return () => window.removeEventListener("focus", focusComposer);
  }, [tab]);

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
    setSendOpen(false);
    setSendError("");
    setChatSince("");

    readDraft(`chat-start:${projectId || "new"}`)
      .then((value) => {
        if (active) setChatSince(value);
      })
      .catch(() => {});

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
    // Um trecho pedido pelo compositor vira contexto visível da conversa, sem diálogo.
    if (value && wantsChatCapture.current && !value.media) {
      wantsChatCapture.current = false;
      setChatCapture(value);
      return;
    }
    const decision = decideIncomingCapture(editRef.current, value);
    if (decision.action === "queue" && decision.queuedCapture) {
      setQueuedCapture(decision.queuedCapture);
      return;
    }
    if (decision.action === "open" && decision.capture) {
      setCapture(decision.capture);
      setSourceMode(decision.capture.media?.kind || "text");
      setTitle(decision.title);
      setContent(decision.content);
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

  const eligibleModels = eligibleChatModels(models, catalogVersion);
  const chatModelIds = resolveChatModelIds(chatModel, models, catalogVersion);
  const needsLimitAcceptance = requiresLimitAcceptance(chatModelIds, models);
  const turns = chatTurns(tasks, chatSince);

  function attachSelection() {
    setError("");
    wantsChatCapture.current = true;
    selectCapture()
      .then((value) => {
        // O runtime também publica a captura; quem chegar primeiro preenche o chip.
        if (wantsChatCapture.current && value && !value.media) {
          wantsChatCapture.current = false;
          setChatCapture(value);
        }
      })
      .catch((e) => {
        wantsChatCapture.current = false;
        setError(e.message);
      });
  }

  function removeChatCapture() {
    const current = chatCapture;
    setChatCapture(null);
    if (current) clearCapture(current.id).catch(() => {});
  }

  function newChat() {
    const now = new Date().toISOString();
    setChatSince(now);
    setSendOpen(false);
    setSendError("");
    writeDraft(`chat-start:${projectId || "new"}`, now).catch(() => {});
    inputRef.current?.focus();
  }

  function requestSend(event: FormEvent) {
    event.preventDefault();
    const warning = validateChatDraft({ text, modelIds: chatModelIds, online });
    if (warning) {
      setError(warning);
      return;
    }
    setError("");
    setSendError("");
    setSendOpen(true);
  }

  function cancelSend() {
    setSendOpen(false);
    setSendError("");
    setAcceptedLimit(false);
    setAuthorized(false);
    inputRef.current?.focus();
  }

  // Envio do chat: persiste o contexto, cria a tarefa e só então enfileira,
  // sempre com os aceites desta mensagem. Nada é marcado sem a ação da pessoa.
  async function confirmSend() {
    const instruction = text;
    const warning = validateChatDraft({ text: instruction, modelIds: chatModelIds, online });
    if (warning) {
      setSendError(warning);
      return;
    }
    if (needsLimitAcceptance && !acceptedLimit) {
      setSendError("Aceite o limite indicativo antes de enviar.");
      return;
    }
    if (executionEnabled && !authorized) {
      setSendError("Autorize o envio com a sua conta antes de enviar.");
      return;
    }
    setBusy(true);
    setSendError("");
    setError("");
    setNotice("");
    try {
      let target = projectId;
      let createdProject = false;
      if (!target) {
        createdProject = true;
        // Projeto não é pré-requisito do chat: o primeiro envio cria um para guardar a conversa.
        const created = await request<Project>("projects.create", { title: "Conversas" });
        await writeDraft(`draft:${created.id}`, instruction).catch(() => {});
        setProjects((old) => [created, ...old]);
        projectRef.current = created.id;
        setProjectId(created.id);
        target = created.id;
      }
      const sourceIds = [...selectedSources];
      const attached = chatCapture;
      if (attached) {
        const sourceTitle = attached.title?.trim() || "Trecho da página";
        const body = sourceContent(sourceTitle, attached.url || "", attached.text || "");
        if (body.length > 40000)
          throw new Error("O trecho anexado, incluindo a origem, deve ter até 40.000 caracteres.");
        const source = await request<Source>("sources.create", {
          project_id: target,
          title: sourceTitle.slice(0, 120),
          content: body,
        });
        sourceIds.push(source.id);
        if (projectRef.current === target)
          setSources((old) => [
            ...old.filter((item) => item.id !== source.id),
            { ...source, preview: body.slice(0, 160), char_count: body.length },
          ]);
        await clearCapture(attached.id).catch(() => {});
        setChatCapture(null);
      }
      let task = await request<Task>("tasks.plan", {
        project_id: target,
        task: {
          instruction,
          kind,
          source_ids: sourceIds,
          allowed_model_ids: chatModelIds,
          mode: "single",
          allow_unenforced_output_limit: needsLimitAcceptance && acceptedLimit,
        },
      });
      const planned = task;
      // A partir daqui o pedido está salvo: o rascunho pode ser limpo.
      setText("");
      writeDraft(`draft:${target}`, "").catch(() => {});
      writeDraft("draft:new", "").catch(() => {});
      setSelectedSources([]);
      setSendOpen(false);
      setAcceptedLimit(false);
      setAuthorized(false);
      if (executionEnabled) {
        try {
          task = await request<Task>("tasks.enqueue", { task_id: planned.id, confirmed: true });
        } catch {
          // Confirmação perdida não autoriza enfileirar de novo: o turno pede consulta de estado.
          setUncertainEnqueue((old) => [...old, planned.id]);
        }
      }
      if (projectRef.current === target)
        setTasks((old) => [task, ...old.filter((item) => item.id !== task.id)]);
      if (createdProject) {
        // A troca de projeto recarrega a lista em paralelo; garante que o novo turno apareça.
        const page = await request<Page<Task>>("tasks.list", { project_id: target });
        if (projectRef.current === target) {
          setTasks(page.items);
          setTaskNext(page.next_offset);
        }
      }
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setBusy(false);
    }
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

  const isChat = tab === "workspace";
  const canSubmit =
    !busy &&
    draftReady &&
    online &&
    eligibleModels.length > 0 &&
    Boolean(text.trim()) &&
    !sendOpen;
  const canAttachSelection = Boolean(localBridge);
  const startWith = (prompt: string, attach: boolean) => () => {
    if (attach) attachSelection();
    changeText(prompt);
    inputRef.current?.focus();
  };
  const starters = canAttachSelection
    ? [
        { label: "Explicar a seleção", hint: "Anexa o trecho selecionado na aba", run: startWith("Explique este trecho em linguagem simples.", true) },
        { label: "Resumir a seleção", hint: "Anexa o trecho e pede os pontos principais", run: startWith("Resuma este trecho em tópicos claros.", true) },
        { label: "Questões de estudo", hint: "Perguntas sobre o trecho selecionado", run: startWith("Crie perguntas de estudo sobre este trecho.", true) },
        { label: "Pergunta livre", hint: "Sem anexar nada da página", run: startWith("", false) },
      ]
    : [
        { label: "Explicar um conceito", hint: "Em linguagem simples", run: startWith("Explique em linguagem simples: ", false) },
        { label: "Resumir um texto", hint: "Cole o texto depois dos dois-pontos", run: startWith("Resuma em tópicos claros o texto a seguir:\n", false) },
        { label: "Questões de estudo", hint: "Sobre um tema que você indicar", run: startWith("Crie perguntas de estudo sobre: ", false) },
        { label: "Pergunta livre", hint: "Escreva o que quiser", run: startWith("", false) },
      ];

  return (
    <div className={`shell ${isChat ? "chat-mode" : ""}`}>
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
          canExpand={inDesktop}
          demo={demo}
          connect={connect}
          expand={expand}
          openGuide={() => setGuideOpen(true)}
          projectSwitch={
            <ProjectSwitch
              projects={projects}
              projectId={projectId}
              setProjectId={setProjectId}
              openProject={openProject}
              online={online}
              busy={busy}
            />
          }
        />

        <MobileNav tab={tab} setTab={setTab} tabs={tabs} />

        <main>
          {!isChat && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span aria-hidden="true" /> SEU ESPAÇO DE TRABALHO
                </div>
                <h1>
                  {tab === "library"
                    ? "Sua biblioteca."
                    : tab === "history"
                      ? "Cada passo, registrado."
                      : "Tudo começa com uma conexão."}
                </h1>
                <p>
                  {tab === "library"
                    ? "Os materiais que acompanham seu pensamento."
                    : tab === "history"
                      ? "Conversas, respostas e revisões organizadas por projeto."
                      : "Veja o que está disponível no seu computador."}
                </p>
              </div>
            </div>
          )}

          {isChat && (
            <div className="chat-bar">
              <h1>
                Chat com <span>Claude</span>
              </h1>
              <button
                type="button"
                className="subtle"
                onClick={newChat}
                disabled={!turns.length}
                title="Começa uma conversa vazia; a anterior continua em Atividade"
              >
                <SquarePen size={14} aria-hidden="true" /> Nova conversa
              </button>
            </div>
          )}

          <div className="notices">
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
                    setTitle(capture.title || "");
                    setContent(capture.text || "");
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
                      "Inicie o componente local para conversar com o Claude."}
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

            {isChat && online && !checking && !eligibleModels.length && (
              <div className="alert" role="status">
                <span>
                  Nenhuma IA conectada. Sua mensagem fica como rascunho até um
                  modelo Claude estar disponível.
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setTab("connections")}
                >
                  Ver conexões
                </button>
              </div>
            )}
          </div>

          {isChat && (
            <section className="chat" aria-label="Chat com Claude">
              <ChatThread
                turns={turns}
                models={models}
                executionEnabled={executionEnabled}
                updateTask={updateTask}
                pollError={pollError}
                uncertainEnqueue={uncertainEnqueue}
                openTask={setTaskView}
                reuseInstruction={(value) => {
                  changeText(value);
                  inputRef.current?.focus();
                }}
                starters={starters}
                canAttachSelection={canAttachSelection}
                openGuide={() => setGuideOpen(true)}
              />

              <div className="chat-dock">
                {sendOpen && (
                  <div className="send-confirm" role="group" aria-label="Confirmar envio">
                    <p>
                      {executionEnabled
                        ? "A mensagem e o contexto anexado serão enviados ao Claude e usam a cota da sua conta."
                        : "Esta conexão não executa pedidos: a mensagem fica salva, sem gerar resposta."}
                    </p>
                    {needsLimitAcceptance && (
                      <label className="consent-check">
                        <input
                          type="checkbox"
                          checked={acceptedLimit}
                          disabled={busy}
                          onChange={(e) => setAcceptedLimit(e.target.checked)}
                        />
                        <span>Aceito o limite indicativo para esta tarefa</span>
                      </label>
                    )}
                    {needsLimitAcceptance && (
                      <p className="small-note">
                        O Claude pode ultrapassar a saída solicitada. Encerrar o
                        processo local não garante interrupção no provedor nem
                        devolução de cota.
                      </p>
                    )}
                    {executionEnabled && (
                      <label className="consent-check">
                        <input
                          type="checkbox"
                          checked={authorized}
                          disabled={busy}
                          onChange={(e) => setAuthorized(e.target.checked)}
                        />
                        <span>Autorizo executar esta tarefa com minha conta</span>
                      </label>
                    )}
                    {sendError && (
                      <p className="turn-error-line" role="alert">
                        {sendError}
                      </p>
                    )}
                    <div className="send-confirm-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={
                          busy ||
                          (needsLimitAcceptance && !acceptedLimit) ||
                          (executionEnabled && !authorized)
                        }
                        onClick={confirmSend}
                      >
                        {executionEnabled ? "Enviar ao Claude" : "Salvar pedido"}
                      </button>
                      <button
                        type="button"
                        className="subtle"
                        disabled={busy}
                        onClick={cancelSend}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <ChatComposer
                  inputRef={inputRef}
                  text={text}
                  changeText={changeText}
                  draftReady={draftReady}
                  submit={requestSend}
                  canSubmit={canSubmit}
                  busy={busy}
                  online={online}
                  eligibleModels={eligibleModels}
                  chatModel={chatModel}
                  setChatModel={setChatModel}
                  kind={kind}
                  setKind={setKind}
                  capture={chatCapture}
                  removeCapture={removeChatCapture}
                  selectedSourcesCount={selectedSources.length}
                  clearSelectedSources={() => setSelectedSources([])}
                  attachSelection={attachSelection}
                  openSource={openSource}
                  hasEarlierTurns={turns.length > 0}
                />
              </div>
            </section>
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

          {!isChat && (
            <footer className="footer">
              <span>
                <YukiMark size="sm" />
                Yuki · Um espaço. Mais possibilidades.
              </span>
            </footer>
          )}
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
