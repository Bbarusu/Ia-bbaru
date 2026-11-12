import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  Folder,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings2,
  SquarePen,
  Workflow,
} from "lucide-react";
import { shortModelName } from "../logic.mjs";
import type { Model, Project, Tab } from "../types";

interface ModelPillProps {
  eligibleModels: Model[];
  chatModel: string;
  setChatModel: (id: string) => void;
  online: boolean;
  checking: boolean;
  /** No painel o estado da conexão aparece no ponto da pílula; na página ampla, na barra superior. */
  showStatus: boolean;
}

export function ModelPill({
  eligibleModels,
  chatModel,
  setChatModel,
  online,
  checking,
  showStatus,
}: ModelPillProps) {
  const status = checking ? "Verificando…" : online ? "Backend local ativo" : "Modo desconectado";
  const value = eligibleModels.some((m) => m.id === chatModel) ? chatModel : "auto";
  return (
    <>
      {showStatus && (
        <span className="sr-only" role="status" aria-live="polite">
          {status}
        </span>
      )}
      <label className="model-pill" title={`Modelo Claude · ${status}`}>
        <span
          className={`status-dot ${checking ? "wait" : online ? "on" : "off"}`}
          aria-hidden="true"
        />
        <span aria-hidden="true">❄</span>
        <select
          aria-label="Modelo Claude"
          value={value}
          disabled={!eligibleModels.length}
          onChange={(event) => setChatModel(event.target.value)}
        >
          <option value="auto">{eligibleModels.length ? "Automático" : "Sem modelo"}</option>
          {eligibleModels.map((m) => (
            <option key={m.id} value={m.id}>
              {shortModelName(m)}
            </option>
          ))}
        </select>
        <ChevronDown size={12} aria-hidden="true" />
      </label>
    </>
  );
}

interface ChatHeaderProps extends Omit<ModelPillProps, "showStatus"> {
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  busy: boolean;
  tab: Tab;
  setTab: (tab: Tab) => void;
  openProject: () => void;
  newChat: () => void;
  canNewChat: boolean;
  openGuide: () => void;
  canExpand: boolean;
  expand: () => void;
  sourceCount: number;
}

const AREAS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "workspace", label: "Chat", icon: MessageSquare },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "history", label: "Atividade", icon: Workflow },
  { id: "connections", label: "Conexões", icon: Settings2 },
];

/** Topo único do painel lateral (até 700 px): uma linha de 44 px. */
export function ChatHeader({
  projects,
  projectId,
  setProjectId,
  busy,
  tab,
  setTab,
  openProject,
  newChat,
  canNewChat,
  openGuide,
  canExpand,
  expand,
  sourceCount,
  ...pill
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function choose(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <header className="chat-header">
      <ModelPill {...pill} showStatus />

      <label className="project-pill" title="Projeto atual">
        <Folder size={13} aria-hidden="true" />
        <span className="sr-only">Projeto atual</span>
        <select
          id="project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={!projects.length || busy}
        >
          <option value="" disabled>
            {projects.length ? "Escolha um projeto" : "Sem projeto"}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <ChevronDown size={12} aria-hidden="true" />
      </label>

      <div className="chat-header-actions">
        <button
          type="button"
          className="header-icon"
          aria-label="Nova conversa"
          title="Nova conversa (a anterior continua em Atividade)"
          disabled={!canNewChat}
          onClick={() => {
            setTab("workspace");
            newChat();
          }}
        >
          <SquarePen size={16} aria-hidden="true" />
        </button>

        <div className="header-menu-anchor" ref={menuRef}>
          <button
            type="button"
            className={`header-icon ${menuOpen ? "active" : ""}`}
            aria-label="Mais opções"
            title="Biblioteca, atividade e conexões"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="header-menu" role="menu" aria-label="Mais opções">
              {AREAS.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  role="menuitem"
                  key={id}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => choose(() => setTab(id))}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}</span>
                  {id === "library" && sourceCount > 0 && (
                    <small>
                      {sourceCount} {sourceCount === 1 ? "material" : "materiais"}
                    </small>
                  )}
                </button>
              ))}
              <span className="header-menu-divider" role="separator" />
              <button type="button" role="menuitem" onClick={() => choose(openProject)}>
                <Plus size={14} aria-hidden="true" />
                <span>Novo projeto</span>
              </button>
              <button type="button" role="menuitem" onClick={() => choose(openGuide)}>
                <CircleHelp size={14} aria-hidden="true" />
                <span>Conhecendo o Yuki</span>
              </button>
            </div>
          )}
        </div>

        {canExpand && (
          <button
            type="button"
            className="header-icon"
            aria-label="Abrir página ampla"
            title="Abrir página ampla"
            onClick={expand}
          >
            <Maximize2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
