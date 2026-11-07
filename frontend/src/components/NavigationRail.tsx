import { Folder, Plus, Settings2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Mark } from "./Mark";
import type { Project, Tab } from "../types";

interface NavigationRailProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
  tabs: { id: Tab; label: string; icon: LucideIcon }[];
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  projectNext: number | null;
  openProject: () => void;
  moreProjects: () => void;
  online: boolean;
  busy: boolean;
}

export function NavigationRail({
  tab,
  setTab,
  tabs,
  projects,
  projectId,
  setProjectId,
  projectNext,
  openProject,
  moreProjects,
  online,
  busy,
}: NavigationRailProps) {
  return (
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
        type="button"
        className="new-project"
        onClick={openProject}
        disabled={!online || busy}
      >
        <Plus size={17} /> Novo projeto <span>＋</span>
      </button>

      <nav aria-label="Navegação principal">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
          >
            <Icon size={18} />
            {label}
            {tab === id && <span className="nav-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="rail-label">
        <span>SEUS PROJETOS</span>
        <button
          type="button"
          aria-label="Criar projeto"
          onClick={openProject}
          disabled={!online}
        >
          <Plus size={14} />
        </button>
      </div>

      {projects.length > 0 ? (
        <ul className="project-list" aria-label="Lista de projetos">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setProjectId(p.id)}
                className={p.id === projectId ? "chosen" : ""}
                aria-current={p.id === projectId ? "true" : undefined}
              >
                <Folder size={16} aria-hidden="true" />
                <span>{p.title}</span>
                {p.id === projectId && <span className="tiny-dot" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rail-empty">
          Um espaço para cada ideia.
          <br />
          Crie seu primeiro projeto.
        </p>
      )}

      {projectNext !== null && (
        <button
          type="button"
          className="subtle load-more-rail"
          onClick={moreProjects}
          disabled={busy}
        >
          Mais projetos
        </button>
      )}

      <div className="rail-bottom">
        <div className="private-note">
          <ShieldCheck size={18} />
          <div>
            Seu contexto, com você.
            <small>Materiais guardados no seu computador.</small>
          </div>
        </div>
        <button
          type="button"
          className="profile"
          onClick={() => setTab("connections")}
          aria-label="Abrir conexões e configurações locais"
        >
          <span className="avatar" aria-hidden="true">B</span>
          <span>
            Meu espaço<small>Uso pessoal · local</small>
          </span>
          <Settings2 size={16} />
        </button>
      </div>
    </aside>
  );
}
