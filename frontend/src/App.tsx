import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  FileText,
  Layers3,
  BookOpen,
  Workflow,
  Settings2,
  Unplug,
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
import { sourceContent, validateDraft } from "./logic.mjs";

import { Mark } from "./components/Mark";
import { TopBar } from "./components/TopBar";
import { NavigationRail } from "./components/NavigationRail";
import { MobileNav } from "./components/MobileNav";
import { ProjectSwitch } from "./components/ProjectSwitch";
import { WorkspaceComposer } from "./components/WorkspaceComposer";
import { ContextGuideCard } from "./components/ContextGuideCard";
import { AgentsSection } from "./components/AgentsSection";
import { LibrarySection } from "./components/LibrarySection";
import { HistorySection } from "./components/HistorySection";
import { ConnectionsSection } from "./components/ConnectionsSection";
import { ProjectModal } from "./components/ProjectModal";
import { SourceModal } from "./components/SourceModal";
import { SourceViewModal } from "./components/SourceViewModal";
import { TaskViewModal } from "./components/TaskViewModal";

const tabs: { id: Tab; label: string; icon: typeof Layers3 }[] = [
  { id: "workspace", label: "Área de trabalho", icon: Layers3 },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "history", label: "Atividade", icon: Workflow },
  { id: "connections", label: "Conexões", icon: Settings2 },
];

const guideUrl =
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
            ""
      );

      try {
        const data = await request<{ models: Model[] }>("models.list");
        setModels(data.models);
        setModelError("");
        setSelectedModels((old) =>
          old.filter((id) =>
            data.models.some((m) => m.id === id && m.available)
          )
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

    if (projectId) {
      writeDraft("last-project", projectId).catch(() => {});
    }

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
      setModal("source");
    }
  }

  useEffect(() => {
    pendingCapture()
      .then(receiveCapture)
      .catch(() => {});

    if (!inFirefox) return;

    const listener = (changes: any) => {
      if (changes.pendingCapture?.newValue) {
        receiveCapture(changes.pendingCapture.newValue);
      }
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
    setModal("project");
  }

  function openSource() {
    setCapture(null);
    setModal("source");
  }

  async function handleCreateProject(title: string) {
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

  async function handleSaveSource(
    targetProjectId: string,
    title: string,
    content: string,
    sourceUrl: string = capture?.url || "",
    sourceCaptureId?: string
  ) {
    if (!targetProjectId) {
      setError("Crie ou escolha um projeto antes de salvar.");
      return;
    }

    const body = sourceContent(title, sourceUrl, content);
    if (body.length > 40000) {
      setError(
        "O material completo, incluindo a origem, deve ter até 40.000 caracteres."
      );
      return;
    }

    await act(async () => {
      const source = await request<Source>("sources.create", {
        project_id: targetProjectId,
        title: title.trim(),
        content: body,
      });

      if (projectRef.current === targetProjectId) {
        setSources((old) => [
          ...old,
          { ...source, preview: body.slice(0, 160), char_count: body.length },
        ]);
        setSelectedSources((old) =>
          old.length < 20 ? [...old, source.id] : old
        );
      }

      setModal(null);
      setNotice("Material salvo no projeto.");

      const idToClear = sourceCaptureId || capture?.id;
      if (idToClear) {
        await clearCapture(idToClear);
      }
      setCapture(null);
    });
  }

  async function handleDiscardCapture(captureId?: string) {
    const idToClear = captureId || capture?.id;
    if (!idToClear) return;
    await act(async () => {
      await clearCapture(idToClear);
      setCapture(null);
      setModal(null);
    });
  }

  function changeText(value: string) {
    setText(value);
    writeDraft(`draft:${projectId || "new"}`, value).catch(() =>
      setError("Não foi possível guardar o rascunho neste navegador.")
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
    setSelectedModels((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id]
    );
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

      if (projectRef.current === target) {
        setTasks((old) => [task, ...old]);
      }
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
            [...old, ...page.items].map((item) => [item.id, item])
          ).values(),
        ]);
        setProjectNext(page.next_offset);
      } else if (projectRef.current === target && type === "sources") {
        setSources((old) => [
          ...new Map(
            [...old, ...page.items].map((item) => [item.id, item])
          ).values(),
        ]);
        setSourceNext(page.next_offset);
      } else if (projectRef.current === target) {
        setTasks((old) => [
          ...new Map(
            [...old, ...page.items].map((item) => [item.id, item])
          ).values(),
        ]);
        setTaskNext(page.next_offset);
      }
    });
  }

  const filteredSources = sources.filter((s) =>
    `${s.title} ${s.preview || ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase())
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
          inFirefox={inFirefox}
          demo={demo}
          connect={connect}
          expand={expand}
        />

        <MobileNav tab={tab} setTab={setTab} tabs={tabs} />

        <main>
          <div className="page-heading">
            <div className="heading-copy">
              <div className="eyebrow">
                <span aria-hidden="true" /> SEU ESPAÇO DE TRABALHO
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
                <X size={15} />
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
                <X size={15} />
              </button>
            </div>
          )}

          {capture && modal !== "source" && (
            <div className="alert capture-alert" role="status">
              <FileText size={16} aria-hidden="true" />
              <span>Um trecho aguarda sua revisão.</span>
              <button
                type="button"
                className="text-button"
                onClick={() => setModal("source")}
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
            <>
              <div className="workspace-grid">
                <WorkspaceComposer
                  text={text}
                  changeText={changeText}
                  draftReady={draftReady}
                  selectedSourcesCount={selectedSources.length}
                  openSource={openSource}
                  kind={kind}
                  setKind={setKind}
                  plan={plan}
                  busy={busy}
                  online={online}
                  projectId={projectId}
                  availableModels={available}
                  selectedModels={selectedModels}
                />
                <ContextGuideCard />
              </div>

              <AgentsSection
                models={models}
                availableModels={available}
                selectedModels={selectedModels}
                toggleModel={toggleModel}
                review={review}
                setReview={setReview}
                goToConnections={() => setTab("connections")}
              />
            </>
          )}

          {(tab === "workspace" || tab === "library") && (
            <LibrarySection
              project={project}
              sources={sources}
              filteredSources={filteredSources}
              selectedSources={selectedSources}
              toggleSource={toggleSource}
              openSource={openSource}
              openProject={openProject}
              captureSelection={() =>
                act(async () => receiveCapture(await selectCapture()))
              }
              viewSource={(source) =>
                act(async () =>
                  setSourceView(
                    await request<Source>("sources.get", {
                      project_id: projectId,
                      source_id: source.id,
                    })
                  )
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
                  setTaskView(await request<Task>("tasks.get", { task_id: id }))
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
              inFirefox={inFirefox}
              demo={demo}
              host={host}
              online={online}
              checking={checking}
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
              <Mark small /> Um espaço. Mais possibilidades.
            </span>
            <span>
              Ia-bbaru <span className="version">0.1</span>
            </span>
          </footer>
        </main>
      </div>

      {modal === "project" && (
        <ProjectModal
          close={() => setModal(null)}
          createProject={handleCreateProject}
          busy={busy}
          online={online}
          error={error}
        />
      )}

      {modal === "source" && (
        <SourceModal
          key={capture?.id ?? "source-manual"}
          capture={capture}
          projects={projects}
          currentProjectId={projectId}
          close={() => setModal(null)}
          saveSource={handleSaveSource}
          discardCapture={handleDiscardCapture}
          busy={busy}
          online={online}
          error={error}
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
          task={taskView}
          models={models}
          close={() => setTaskView(null)}
        />
      )}
    </div>
  );
}
