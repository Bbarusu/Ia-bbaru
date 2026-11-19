import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Clock,
  Download,
  SlidersHorizontal,
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
import type {
  Capture,
  DirectImage,
  Connection,
  Consent,
  Conversation,
  Media,
  Model,
  Page,
  PageStatus,
  PendingSend,
  Project,
  Source,
  Tab,
  Task,
  Turn,
} from "./types";
import {
  capturePage,
  clearCapture,
  contextStatus,
  demo,
  expand,
  inDesktop,
  localBridge,
  pendingCapture,
  readDraft,
  readPendingSend,
  request,
  selectCapture,
  writeDraft,
  writePendingSend,
} from "./transport";
import {
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_WORKING_STATES,
  buildConsent,
  buildTurn,
  captureIsStale,
  captureSnapshot,
  consentCovers,
  consentRejected,
  conversationTitle,
  decideIncomingCapture,
  eligibleChatModels,
  requiresLimitAcceptance,
  resolveChatModelIds,
  sendOutcomeUnknown,
  sourceContent,
  validateChatDraft,
  visionAvailable,
} from "./logic.mjs";

import { TopBar } from "./components/TopBar";
import { NavigationRail } from "./components/NavigationRail";
import { MobileNav } from "./components/MobileNav";
import { ProjectSwitch } from "./components/ProjectSwitch";
import { ChatComposer } from "./components/ChatComposer";
import { ChatThread } from "./components/ChatThread";
import { ChatHeader, ConversationItems } from "./components/ChatHeader";
import { Menu } from "./components/Menu";
import { LibrarySection } from "./components/LibrarySection";
import { HistorySection } from "./components/HistorySection";
import { ConnectionsSection } from "./components/ConnectionsSection";
import { ProjectModal } from "./components/ProjectModal";
import { SourceModal, type CaptureMediaKind } from "./components/SourceModal";
import { SourceViewModal } from "./components/SourceViewModal";
import { TaskViewModal } from "./components/TaskViewModal";
import { GuideModal } from "./components/GuideModal";
import { DownloadsPage, SettingsPage, WebHistoryPage } from "./components/BrowserPages";
import { YukiMark } from "./components/YukiMark";

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "workspace", label: "Chat", icon: MessageSquare },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "history", label: "Atividade", icon: Workflow },
  { id: "connections", label: "Conexões", icon: Settings2 },
  { id: "web-history", label: "Histórico", icon: Clock },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "settings", label: "Ajustes", icon: SlidersHorizontal },
];

// Títulos das áreas fora do chat (mesmo cabeçalho da página ampla).
const HEADINGS: Partial<Record<Tab, [string, string]>> = {
  library: ["Sua biblioteca.", "Os materiais que acompanham seu pensamento."],
  history: ["Cada passo, registrado.", "Conversas, respostas e revisões organizadas por projeto."],
  connections: ["Tudo começa com uma conexão.", "Veja o que está disponível no seu computador."],
  "web-history": ["Histórico.", "As páginas que você visitou neste computador."],
  downloads: ["Downloads.", "Arquivos baixados pelo navegador."],
  settings: ["Ajustes.", "Como o Yuki abre, mostra e guarda o que você navega."],
};

const chromiumGuideUrl =
  "https://github.com/Bbarusu/Ia-bbaru/blob/codex/chromium-browser/docs/TESTAR_NAVEGADOR_CHROMIUM.md";

export default function App() {
  const [tab, setTab] = useState<Tab>("workspace");
  const tabRef = useRef<Tab>("workspace");
  tabRef.current = tab;
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
  // Perfil de resposta (quick/normal/deep) ou um modelo escolhido pelo nome.
  const [chatChoice, setChatChoice] = useState("normal");
  const [directImages, setDirectImages] = useState<DirectImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [chatCapture, setChatCapture] = useState<Capture | null>(null);
  // Texto colado pela pessoa: contexto do turno (snapshot "text"), nunca parte do pedido.
  const [pasted, setPasted] = useState<{ id: string; text: string } | null>(null);
  const openPaste = () => setPasted((old) => old ?? { id: crypto.randomUUID(), text: "" });
  const pastedCapture = pasted?.text.trim()
    ? { id: pasted.id, kind: "text", title: "Texto colado", url: "", text: pasted.text }
    : null;
  // Trecho vindo do navegador (botão, menu de contexto): só confirma se vai para o chat.
  const [incomingCapture, setIncomingCapture] = useState<Capture | null>(null);
  const chatCaptureRef = useRef<string | undefined>(undefined);
  chatCaptureRef.current = chatCapture?.id;
  const [pageStatus, setPageStatus] = useState<PageStatus | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendError, setSendError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [rememberConsent, setRememberConsent] = useState(false);
  const [review, setReview] = useState(false);
  const [sendImage, setSendImage] = useState(false);
  // Conversa real do backend: histórico, aceite e envio idempotente por turn_id.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const conversationRef = useRef("");
  conversationRef.current = conversationId;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const [sendLost, setSendLost] = useState(false);
  const [lostMissing, setLostMissing] = useState(false);
  const [text, setText] = useState("");
  const textRef = useRef("");
  textRef.current = text;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wantsChatCapture = useRef(false);
  // Print da página inteira pedido pelo compositor: depois de salvo, volta ao chat selecionado.
  const wantsChatVisual = useRef(false);
  // Painel lateral (até 700 px): um topo só, no formato da proposta aprovada.
  const [narrow, setNarrow] = useState(
    () => window.matchMedia?.("(max-width: 700px)").matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 700px)");
    if (!query) return;
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const [draftReady, setDraftReady] = useState(false);
  // General is neutral until the user chooses a response profile; do not label every request as study.
  const kind = "general";
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

      // Envio sem confirmação de uma sessão anterior volta para consulta, sem reenvio automático.
      try {
        const list = await request<Page<Conversation>>("conversations.list");
        setConversations(list.items);
      } catch (e) {
        // Lista indisponível não derruba a conexão; o envio continua idempotente.
        setError((e as Error).message);
      }
      const unsent = await readPendingSend();
      const lastConversation = unsent?.conversation.conversation_id || (await readDraft("draft:conversation"));
      setConversationId((old) => old || lastConversation || crypto.randomUUID());
      if (unsent) {
        setPendingSend(unsent);
        setSendLost(true);
      }
      contextStatus().then(setPageStatus).catch(() => {});
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
    setTurns((old) => old.map((turn) => turn.task.id === task.id ? { ...turn, task } : turn));
    setTaskView((old) => old?.id === task.id ? task : old);
  }

  function updateTurn(turn: Turn) {
    setTurns((old) => old.map((item) => (item.id === turn.id ? turn : item)));
    setTaskView((old) => (old?.id === turn.task.id ? turn.task : old));
  }

  // Abre a conversa ativa: histórico pelo backend, inclusive após reiniciar.
  useEffect(() => {
    if (!online || !conversationId) return;
    let active = true;
    setTurns([]);
    setConsent(null);
    writeDraft("draft:conversation", conversationId).catch(() => {});
    (async () => {
      let conversation: Conversation;
      try {
        conversation = await request<Conversation>("conversations.get", { conversation_id: conversationId });
      } catch (e) {
        // Ainda não criada: nasce no primeiro envio.
        if ((e as { code?: string }).code === "http_404") return;
        throw e;
      }
      const loaded: Turn[] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const page: Page<{ id: string }> = await request("conversations.turns.list", {
          conversation_id: conversationId,
          offset,
        });
        loaded.push(
          ...(await Promise.all(
            page.items.map((item) =>
              request<Turn>("conversations.turns.get", { conversation_id: conversationId, turn_id: item.id }),
            ),
          )),
        );
        offset = page.next_offset;
      }
      const granted = await request<{ consent: Consent | null }>("conversations.consent.get", {
        conversation_id: conversationId,
      });
      if (!active) return;
      setTurns(loaded);
      setConsent(granted.consent);
      if (conversation.project_id !== projectRef.current) setProjectId(conversation.project_id);
    })().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [conversationId, online]);

  const workingTurns = turns
    .filter((turn) => CHAT_WORKING_STATES.includes(turn.task.status))
    .map((turn) => turn.id)
    .join(",");
  useEffect(() => {
    if (!online || !workingTurns) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const target = conversationId;
    async function poll() {
      try {
        const updates = await Promise.all(
          workingTurns.split(",").map((id) =>
            request<Turn>("conversations.turns.get", { conversation_id: target, turn_id: id }),
          ),
        );
        if (!stopped) {
          updates.forEach(updateTurn);
          setPollError("");
        }
      } catch {
        if (!stopped)
          setPollError("Não foi possível atualizar o andamento. A mensagem não foi reenviada; reconecte o componente local para consultar.");
      } finally {
        if (!stopped) timer = setTimeout(poll, 1500);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [online, workingTurns, conversationId]);

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
    const onError = (event: Event) => setError((event as CustomEvent<string>).detail);
    window.addEventListener("yuki:browser-error", onError);
    return () => window.removeEventListener("yuki:browser-error", onError);
  }, []);

  // A barra do navegador pede uma área (Histórico, Downloads, Ajustes) pelo
  // armazenamento compartilhado; o painel só troca de área, sem enviar nada.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "yuki:open-area" || !event.newValue) return;
      try {
        const area = JSON.parse(event.newValue).area;
        if (tabs.some((t) => t.id === area)) setTab(area);
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
    // Fora da Biblioteca, texto capturado vai para o chat: sem título nem salvamento,
    // só a confirmação do que será enviado. Na Biblioteca, segue o fluxo de material.
    if (value && !value.media && tabRef.current !== "library") {
      if (chatCaptureRef.current !== value.id) {
        setIncomingCapture(value);
        setTab("workspace");
      }
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
      // O runtime pede foco ao abrir o painel pelo botão ou Ctrl+Shift+L; nada é enviado.
      if (changes.focusComposer?.newValue) {
        setTab("workspace");
        requestAnimationFrame(() => {
          if (!document.querySelector("dialog[open]")) inputRef.current?.focus();
        });
      }
      if (changes.activePage?.newValue) setPageStatus(changes.activePage.newValue);
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
          old.length < 20 && (!source.media || (wantsChatVisual.current && canSeeImages))
            ? [...old, source.id]
            : old,
        );
        if (wantsChatVisual.current) {
          wantsChatVisual.current = false;
          setTab("workspace");
        }
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
  const chatModelIds = resolveChatModelIds(chatChoice, models, catalogVersion);
  const needsLimitAcceptance = requiresLimitAcceptance(chatModelIds, models);
  const canSeeImages = visionAvailable(models, chatModelIds, catalogVersion);
  const imageSources = sources.filter((s) => selectedSources.includes(s.id) && s.media);
  const previousImageIds = new Set(turns.flatMap(turn => (turn.task.attachment_refs || []).map(ref => ref.id)));
  const imageCount = new Set([...previousImageIds, ...imageSources.map(s => s.id), ...directImages.map(s => s.attachment_id)]).size;
  const imageLimit = catalogVersion === "1.3" ? 4 : 1;
  async function attachImageFiles(files: FileList | null) {
    if (!files) return;
    try {
      if (directImages.length + files.length > imageLimit) throw new Error(`Este contrato permite até ${imageLimit} imagem(ns), incluindo o histórico.`);
      const added: DirectImage[] = [];
      for (const file of Array.from(files)) {
        if (!["image/png", "image/jpeg"].includes(file.type) || !file.size || file.size > 480000)
          throw new Error("Selecione PNG ou JPEG de até 480 KB por imagem.");
        const data_url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Não foi possível ler a imagem.")); reader.readAsDataURL(file);
        });
        added.push({ attachment_id: crypto.randomUUID(), title: file.name.slice(0, 120), media: { kind: "image", data_url } });
      }
      setDirectImages(old => [...old, ...added]); setSendImage(false);
    } catch (error) { setError((error as Error).message); }
    finally { if (imageInputRef.current) imageInputRef.current.value = ""; }
  }
  const conversationCreated =
    turns.length > 0 || conversations.some((c) => c.id === conversationId);

  function captureForChat(read: () => Promise<Capture>) {
    setError("");
    wantsChatCapture.current = true;
    read()
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
  const attachSelection = () => captureForChat(selectCapture);
  const attachPage = () => captureForChat(capturePage);
  // capture.page.visual chega como captura de mídia: revisa e salva no projeto (V6).
  function attachPageVisual() {
    setError("");
    wantsChatVisual.current = true;
    localBridge?.runtime
      .sendMessage({ type: "capture.page.visual" })
      .then((result: { ok: boolean; error?: { message?: string } }) => {
        if (!result?.ok) {
          wantsChatVisual.current = false;
          setError(result?.error?.message || "Não foi possível capturar a página inteira.");
        }
      })
      .catch((e: Error) => {
        wantsChatVisual.current = false;
        setError(e.message);
      });
  }

  function acceptIncomingCapture() {
    const next = incomingCapture;
    if (!next) return;
    if (chatCapture && chatCapture.id !== next.id) clearCapture(chatCapture.id).catch(() => {});
    setChatCapture(next);
    setIncomingCapture(null);
    inputRef.current?.focus();
  }

  function discardIncomingCapture() {
    const current = incomingCapture;
    setIncomingCapture(null);
    if (current) clearCapture(current.id).catch(() => {});
  }

  function removeChatCapture() {
    const current = chatCapture;
    setChatCapture(null);
    if (current) clearCapture(current.id).catch(() => {});
  }

  function switchConversation(id: string) {
    if (pendingSend) {
      setError("Consulte o envio sem confirmação antes de trocar de conversa.");
      return;
    }
    setSendOpen(false);
    setSendError("");
    setConversationId(id);
    inputRef.current?.focus();
  }
  const newChat = () => switchConversation(crypto.randomUUID());

  async function revokeConsent() {
    await act(async () => {
      await request("conversations.consent.revoke", { conversation_id: conversationId });
      setConsent(null);
      setNotice("Autorização revogada. Os próximos envios pedem confirmação.");
    });
  }

  function requestSend(event: FormEvent) {
    event.preventDefault();
    const warning = executionEnabled
      ? validateChatDraft({ text, modelIds: chatModelIds, online })
      : "Esta conexão não executa pedidos. O rascunho continua salvo.";
    if (warning) {
      setError(warning);
      return;
    }
    if (pendingSend) {
      setError("Há um envio sem confirmação. Consulte o estado antes de enviar outro.");
      return;
    }
    setError("");
    setSendError("");
    // Aceite válido da conversa dispensa a confirmação; imagem e revisão sempre perguntam.
    if (!review && !imageCount && consentCovers(consent, { modelIds: chatModelIds })) {
      void send(consent);
      return;
    }
    setSendOpen(true);
  }

  function cancelSend() {
    setSendOpen(false);
    setSendError("");
    setAcceptedLimit(false);
    setAuthorized(false);
    setRememberConsent(false);
    setSendImage(false);
    inputRef.current?.focus();
  }

  /** Cria a conversa (idempotente pelo mesmo corpo) e, se preciso, o projeto que a guarda. */
  async function ensureConversation() {
    let target = projectRef.current;
    if (!target) {
      const created = await request<Project>("projects.create", { title: "Conversas" });
      await writeDraft(`draft:${created.id}`, textRef.current).catch(() => {});
      setProjects((old) => [created, ...old]);
      projectRef.current = created.id;
      setProjectId(created.id);
      target = created.id;
    }
    const body = { conversation_id: conversationId, project_id: target, title: conversationTitle(text) };
    if (!conversationCreated) {
      const created = await request<Conversation>("conversations.create", body);
      setConversations((old) => [created, ...old.filter((c) => c.id !== created.id)]);
      return { ...body, project_id: created.project_id };
    }
    const known = conversations.find((c) => c.id === conversationId);
    return { ...body, project_id: known?.project_id || target };
  }

  async function confirmSend() {
    if (needsLimitAcceptance && !acceptedLimit) {
      setSendError("Aceite o limite indicativo antes de enviar.");
      return;
    }
    if (!authorized) {
      setSendError("Autorize o envio com a sua conta antes de enviar.");
      return;
    }
    let granted: Consent | null = null;
    if (rememberConsent) {
      setBusy(true);
      try {
        const conversation = await ensureConversation();
        const result = await request<{ consent: Consent }>("conversations.consent.set", {
          conversation_id: conversation.conversation_id,
          consent: buildConsent({
            modelIds: chatModelIds,
            acceptedLimit: needsLimitAcceptance && acceptedLimit,
            visual: sendImage,
          }),
        });
        granted = result.consent;
        setConsent(granted);
      } catch (e) {
        setSendError((e as Error).message);
        setBusy(false);
        return;
      }
    }
    await send(granted);
  }

  // Envio: o corpo inteiro e o turn_id são guardados ANTES de sair; perda de
  // resposta só permite consultar ou reenviar o mesmo corpo.
  async function send(useConsent: Consent | null) {
    setBusy(true);
    setSendError("");
    setError("");
    setNotice("");
    try {
      const conversation = await ensureConversation();
      const pending: PendingSend = {
        conversation,
        turn: buildTurn({
          turnId: crypto.randomUUID(),
          instruction: text,
          choice: chatChoice,
          modelIds: chatModelIds,
          consent: useConsent,
          acceptedLimit: needsLimitAcceptance && acceptedLimit,
          review,
          sourceIds: selectedSources,
          snapshots: [captureSnapshot(chatCapture), captureSnapshot(pastedCapture)],
          visual: sendImage && imageCount > 0,
          attachments: directImages,
        }),
        captureId: chatCapture?.id,
        titles: pendingTitles,
      };
      await writePendingSend(pending);
      setPendingSend(pending);
      setSendOpen(false);
      await dispatch(pending);
    } catch (e) {
      if (sendOpen) setSendError((e as Error).message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function dispatch(pending: PendingSend) {
    setSendLost(false);
    setLostMissing(false);
    try {
      const turn = await request<Turn>("conversations.turns.send", {
        conversation_id: pending.conversation.conversation_id,
        turn: pending.turn,
      });
      await finishSend(pending, turn);
    } catch (e) {
      if (sendOutcomeUnknown(e)) {
        setSendLost(true);
        return;
      }
      // Recusa definitiva: preserve também o texto recuperado após reiniciar.
      if (!textRef.current) setText(pending.turn.instruction);
      await writePendingSend(null);
      setPendingSend(null);
      if (consentRejected(e)) {
        setConsent(null);
        setSendOpen(true);
        setSendError(`${(e as Error).message} Confirme de novo para enviar.`);
      } else setError((e as Error).message);
    }
  }

  async function checkLostSend() {
    if (!pendingSend) return;
    setBusy(true);
    try {
      const turn = await request<Turn>("conversations.turns.get", {
        conversation_id: pendingSend.conversation.conversation_id,
        turn_id: pendingSend.turn.turn_id,
      });
      await finishSend(pendingSend, turn);
    } catch (e) {
      if ((e as { code?: string }).code === "http_404") setLostMissing(true);
      else setError("Não foi possível consultar o envio. Reconecte o componente local e consulte de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function finishSend(pending: PendingSend, turn: Turn) {
    await writePendingSend(null);
    setPendingSend(null);
    setSendLost(false);
    setLostMissing(false);
    if (pending.conversation.conversation_id === conversationRef.current)
      setTurns((old) => [...old.filter((item) => item.id !== turn.id), turn]);
    if (pending.captureId) {
      clearCapture(pending.captureId).catch(() => {});
      setChatCapture((old) => (old?.id === pending.captureId ? null : old));
    }
    // Só limpa o campo se ele ainda tem o texto enviado.
    if (textRef.current === pending.turn.instruction) {
      setText("");
      writeDraft(`draft:${projectRef.current || "new"}`, "").catch(() => {});
      writeDraft("draft:new", "").catch(() => {});
    }
    setSelectedSources([]);
    setPasted(null);
    setDirectImages([]);
    setAcceptedLimit(false);
    setAuthorized(false);
    setRememberConsent(false);
    setReview(false);
    setSendImage(false);
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
    executionEnabled &&
    eligibleModels.length > 0 &&
    Boolean(text.trim()) &&
    !sendOpen &&
    !pendingSend;
  const canAttachSelection = Boolean(localBridge);
  // Sugestões: no navegador, anexam a página ou a seleção da aba (ação explícita,
  // nada é enviado); fora dele, só preenchem o campo.
  const startWith = (prompt: string, attach?: () => void) => () => {
    if (!canAttachSelection) attach?.();
    else if (!chatCapture) attach?.();
    changeText(prompt);
    inputRef.current?.focus();
  };
  const starters = canAttachSelection
    ? [
        { label: "Resumir página", hint: "Anexa o texto visível da aba atual", run: startWith("Resuma esta página em tópicos claros.", attachPage) },
        { label: "Explicar seleção", hint: "Anexa o trecho selecionado na aba", run: startWith("Explique este trecho em linguagem simples.", attachSelection) },
        { label: "Principais pontos", hint: "Anexa a página: argumentos e conclusões", run: startWith("Identifique os principais argumentos e conclusões desta página.", attachPage) },
        { label: "Questões de estudo", hint: "Anexa a página: perguntas para fixar", run: startWith("Crie perguntas de estudo sobre esta página.", attachPage) },
      ]
    : [
        // F-4: sem a ponte, o texto vai num campo próprio e segue como snapshot, não no pedido.
        { label: "Resumir texto", hint: "Abre um campo para colar o texto", run: startWith("Resuma em tópicos claros o texto colado.", openPaste) },
        { label: "Explicar termos", hint: "Conceitos difíceis em linguagem simples", run: startWith("Explique em linguagem simples os termos do texto colado.", openPaste) },
        { label: "Questões de estudo", hint: "Perguntas para fixar o conteúdo", run: startWith("Crie perguntas de estudo sobre o texto colado.", openPaste) },
      ];
  const welcomeText = canAttachSelection
    ? "Pergunte sobre a página aberta ou um trecho dela, explore conceitos ou converse com Claude."
    : "Explore conceitos ou converse com Claude.";
  const fableChosen = chatModelIds.some((id) => /fable/i.test(id));
  const pendingTitles = [
    ...(chatCapture ? [chatCapture.title?.trim() || "Trecho da página"] : []),
    ...(pastedCapture ? ["Texto colado"] : []),
    ...sources.filter((source) => selectedSources.includes(source.id)).map((source) => source.title),
  ];
  const pending = pendingSend
    ? { text: pendingSend.turn.instruction, contextTitles: pendingSend.titles }
    : sendOpen
      ? { text, contextTitles: pendingTitles }
      : null;
  const imageBlocked = imageCount > 0 && !(canSeeImages && imageCount <= imageLimit && sendImage);
  const sendConfirm = (
    <div className="chat-card" role="group" aria-label="Confirmar envio">
      <strong>Enviar ao Claude?</strong>
      <p>
        Sua pergunta, o histórico desta conversa e o contexto anexado vão para o Claude e usam a
        cota da sua assinatura.
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
        <p className="consent-note">
          O Claude pode ultrapassar a saída solicitada. Encerrar o processo local
          não garante interrupção no provedor nem devolução de cota.
        </p>
      )}
      {fableChosen && (
        <p className="consent-note">
          Fable pode exigir créditos de uso adicionais na sua conta. Não há troca automática de
          modelo se ele for recusado.
        </p>
      )}
      <label className="consent-check">
        <input
          type="checkbox"
          checked={authorized}
          disabled={busy}
          onChange={(e) => setAuthorized(e.target.checked)}
        />
        <span>Autorizo executar esta tarefa com minha conta</span>
      </label>
      <label
        className="consent-check"
        title={
          review
            ? "Com revisão, cada mensagem pede confirmação."
            : `Vale só para esta conversa, estes modelos e o teto de ${CHAT_MAX_OUTPUT_TOKENS.toLocaleString("pt-BR")} tokens. Dá para revogar a qualquer momento; revogar não interrompe uma resposta já enviada.`
        }
      >
        <input
          type="checkbox"
          checked={rememberConsent && !review}
          disabled={busy || review}
          onChange={(e) => setRememberConsent(e.target.checked)}
        />
        <span>Não perguntar de novo nesta conversa</span>
      </label>

      {imageCount > 0 &&
        (canSeeImages && imageCount <= imageLimit ? (
          <div className="image-consent">
            {[...imageSources, ...directImages].map((image) => image.media?.data_url && <img key={image.title} src={image.media.data_url} alt={`Prévia: ${image.title}`} />)}
            <label className="consent-check">
              <input
                type="checkbox"
                checked={sendImage}
                disabled={busy}
                onChange={(e) => setSendImage(e.target.checked)}
              />
              <span>Enviar as imagens ao Claude (experimental)</span>
            </label>
            <p className="consent-note">
              {imageCount} imagem(ns), incluindo {previousImageIds.size} do histórico. Até {imageLimit} por contexto,
              PNG/JPEG de 480 KB cada. Imagens também usam cota e serão reenviadas com o histórico.
              A leitura visual ainda não foi validada com uma conta real.
            </p>
          </div>
        ) : (
          <p className="turn-error-line" role="alert">
            {imageCount > imageLimit
              ? `Este contexto excede ${imageLimit} imagem(ns). Remova anexos novos ou comece outra conversa.`
              : "O modelo escolhido não declara leitura de imagens. Escolha um modelo com visão ou tire a imagem da seleção."}
          </p>
        ))}

      <details className="send-advanced">
        <summary>Avançado</summary>
        <label className="consent-check">
          <input
            type="checkbox"
            checked={review}
            disabled={busy}
            onChange={(e) => setReview(e.target.checked)}
          />
          <span>Revisar a resposta com um segundo modelo</span>
        </label>
        <p className="consent-note">
          Faz uma segunda chamada ao Claude e usa mais cota. O revisor é de nível igual ou superior
          (Haiku, Sonnet, Opus); Fable só entra se escolhido. Sem revisor elegível, o pedido é recusado.
        </p>
      </details>

      {sendError && (
        <p className="turn-error-line" role="alert">
          {sendError}
        </p>
      )}
      <div className="chat-card-actions">
        <button
          type="button"
          className="dark-button"
          disabled={busy || (needsLimitAcceptance && !acceptedLimit) || !authorized || imageBlocked}
          onClick={confirmSend}
        >
          Enviar ao Claude
        </button>
        <button type="button" className="plain-button" disabled={busy} onClick={cancelSend}>
          Cancelar
        </button>
      </div>
    </div>
  );
  const sendStatus = pendingSend && (
    <div className={`chat-card ${sendLost ? "warn" : "info"}`} role={sendLost ? "alert" : "status"}>
      {!sendLost ? (
        <strong>Enviando…</strong>
      ) : lostMissing ? (
        <>
          <strong>O envio ainda não foi encontrado.</strong>
          <p>A consulta não confirma se o pedido anterior ainda está chegando. Consulte novamente ou reenvie o mesmo pedido, preservando seu identificador.</p>
        </>
      ) : (
        <>
          <strong>Não recebemos a confirmação do envio.</strong>
          <p>
            O pedido pode ter chegado ao Claude. Consulte antes de qualquer outra ação: reenviar usa o
            mesmo identificador e não duplica a geração.
          </p>
        </>
      )}
      {sendLost && (
        <div className="chat-card-actions">
          <button type="button" className="outline-button" disabled={busy} onClick={checkLostSend}>
            Consultar estado
          </button>
          <button
            type="button"
            className="outline-button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              dispatch(pendingSend).finally(() => setBusy(false));
            }}
          >
            Reenviar o mesmo pedido
          </button>
        </div>
      )}
    </div>
  );
  const consentChip = consent && (
    <span
      className="consent-chip"
      title={`Vale para ${consent.allowed_model_ids.length} modelo(s) e teto de ${consent.max_output_tokens} tokens. Revogar bloqueia novos envios; não interrompe uma resposta já enviada.`}
    >
      Envio autorizado nesta conversa
      <button type="button" className="text-button" disabled={busy} onClick={revokeConsent}>
        Revogar
      </button>
    </span>
  );

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
        {narrow ? (
          <>
            <ChatHeader
              online={online}
              checking={checking}
              tab={tab}
              setTab={setTab}
              openProject={openProject}
              newChat={newChat}
              canNewChat={conversationCreated && !pendingSend}
              openGuide={() => setGuideOpen(true)}
              canExpand={inDesktop}
              expand={expand}
              sourceCount={sources.length}
              conversations={conversations}
              conversationId={conversationId}
              switchConversation={switchConversation}
              canSwitch={online && !busy && !pendingSend}
            />
            {demo && (
              <div className="demo-banner" role="note">
                Demonstração visual · dados de exemplo · nenhuma conta ou IA conectada
              </div>
            )}
          </>
        ) : (
          <>
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
                // No chat, o projeto fica no compositor.
                !isChat && <ProjectSwitch
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
          </>
        )}

        <main>
          {!isChat && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span aria-hidden="true" /> SEU ESPAÇO DE TRABALHO
                </div>
                <h1>{HEADINGS[tab]?.[0]}</h1>
                <p>{HEADINGS[tab]?.[1]}</p>
              </div>
            </div>
          )}

          {isChat && !narrow && (
            <div className="chat-bar">
              {conversations.length > 0 && (
                <Menu
                  label="Conversas"
                  triggerClass="subtle"
                  menuClass="header-menu"
                  trigger={<>Conversas</>}
                >
                  {(close) => (
                    <ConversationItems
                      conversations={conversations}
                      conversationId={conversationId}
                      disabled={!online || busy || Boolean(pendingSend)}
                      pick={(id) => {
                        close();
                        switchConversation(id);
                      }}
                    />
                  )}
                </Menu>
              )}
              {(
                <button
                  type="button"
                  className="subtle"
                  onClick={newChat}
                  disabled={!conversationCreated || Boolean(pendingSend)}
                  title="Começa outra conversa; esta continua guardada na lista"
                >
                  <SquarePen size={14} aria-hidden="true" /> Novo chat
                </button>
              )}
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

            {isChat && online && !checking && !executionEnabled && eligibleModels.length > 0 && (
              <div className="alert" role="status">
                <span>Esta conexão não executa pedidos pelo painel. O rascunho fica salvo.</span>
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
                turns={turns.map((turn) => turn.task)}
                models={models}
                executionEnabled={executionEnabled}
                updateTask={updateTask}
                pollError={pollError}
                uncertainEnqueue={[]}
                openTask={setTaskView}
                retry={(value) => {
                  changeText(value);
                  inputRef.current?.focus();
                }}
                starters={starters}
                welcomeText={welcomeText}
                pending={pending}
                confirm={pendingSend ? sendStatus : sendConfirm}
              />

              <div className="chat-dock">
                {incomingCapture && (
                  <div className="chat-card capture-confirm" role="group" aria-label="Confirmar trecho">
                    <strong>Enviar este trecho no chat?</strong>
                    <small>
                      {incomingCapture.title?.trim() || "Trecho da página"}
                      {incomingCapture.url && ` · ${(() => { try { return new URL(incomingCapture.url).hostname; } catch { return ""; } })()}`}
                    </small>
                    <p className="capture-preview">{incomingCapture.text}</p>
                    <div className="chat-card-actions">
                      <button type="button" className="dark-button" onClick={acceptIncomingCapture}>
                        Usar no chat
                      </button>
                      <button type="button" className="plain-button" onClick={discardIncomingCapture}>
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
                {consentChip}
                <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" multiple className="sr-only" aria-label="Imagens para a conversa"
                  disabled={busy || Boolean(pendingSend)} onChange={event => void attachImageFiles(event.target.files)} />
                {directImages.length > 0 && <div className="composer-context" aria-label="Imagens anexadas à conversa">
                  {directImages.map(image => <span className="context-chip" key={image.attachment_id}>
                    <img src={image.media.data_url} alt={image.title} width="48" height="48" />
                    <span>{image.title}</span>
                    <button type="button" className="icon-button" disabled={busy || Boolean(pendingSend)} aria-label={`Remover imagem: ${image.title}`}
                      onClick={() => setDirectImages(old => old.filter(item => item.attachment_id !== image.attachment_id))}>×</button>
                  </span>)}
                </div>}
                <ChatComposer
                  inputRef={inputRef}
                  text={sendOpen || pendingSend ? "" : text}
                  changeText={changeText}
                  draftReady={draftReady && !sendOpen && !pendingSend}
                  submit={requestSend}
                  canSubmit={canSubmit}
                  busy={busy}
                  online={online}
                  checking={checking}
                  eligibleModels={eligibleModels}
                  chatChoice={chatChoice}
                  setChatChoice={setChatChoice}
                  projects={projects}
                  projectId={projectId}
                  setProjectId={(id) => {
                    // Materiais pertencem ao projeto da conversa: outro projeto começa outra conversa.
                    setProjectId(id);
                    if (conversationCreated) newChat();
                  }}
                  capture={chatCapture}
                  captureStale={captureIsStale(chatCapture, pageStatus)}
                  attachPage={attachPage}
                  attachPageVisual={attachPageVisual}
                  attachImages={() => imageInputRef.current?.click()}
                  imagesSupported={canSeeImages}
                  removeCapture={removeChatCapture}
                  selectedSourcesCount={selectedSources.length}
                  clearSelectedSources={() => setSelectedSources([])}
                  attachSelection={attachSelection}
                  pasted={pasted}
                  setPastedText={(value) => setPasted((old) => (old ? { ...old, text: value } : old))}
                  removePasted={() => setPasted(null)}
                  openPaste={openPaste}
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
              imagesSelectable={canSeeImages}
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

          {tab === "web-history" && <WebHistoryPage />}
          {tab === "downloads" && <DownloadsPage />}
          {tab === "settings" && <SettingsPage />}

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
          imagesSupported={canSeeImages}
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
