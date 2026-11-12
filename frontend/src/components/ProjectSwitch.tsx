import { ChevronDown, Folder, Plus } from "lucide-react";
import type { Project } from "../types";

interface ProjectSwitchProps {
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  openProject: () => void;
  online: boolean;
  busy: boolean;
}

export function ProjectSwitch({
  projects,
  projectId,
  setProjectId,
  openProject,
  online,
  busy,
}: ProjectSwitchProps) {
  return (
    <div className="project-switch">
      <label htmlFor="project" className="sr-only">
        Projeto atual
      </label>
      <div className="project-select-wrap">
        <Folder size={15} className="folder-icon" aria-hidden="true" />
        <select
          id="project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!projects.length || busy}
        >
          <option value="" disabled>
            {projects.length ? "Escolha um projeto" : "Nenhum projeto criado"}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="chevron-icon" aria-hidden="true" />
        <button
          type="button"
          className="icon-button"
          aria-label="Novo projeto"
          title="Novo projeto"
          onClick={openProject}
          disabled={!online}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
