import { type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { Dialog } from "./Dialog";

interface ProjectModalProps {
  title: string;
  setTitle: (title: string) => void;
  close: () => void;
  createProject: (e: FormEvent) => Promise<void>;
  busy: boolean;
  online: boolean;
  error?: string;
}

export function ProjectModal({
  title,
  setTitle,
  close,
  createProject,
  busy,
  online,
  error,
}: ProjectModalProps) {
  return (
    <Dialog title="Um novo espaço para suas ideias" close={close}>
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
          type="submit"
          className="primary"
          disabled={busy || !online || !title.trim()}
        >
          {busy ? (
            <Loader2 size={16} className="spin" aria-hidden="true" />
          ) : (
            <Plus size={16} aria-hidden="true" />
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
  );
}
