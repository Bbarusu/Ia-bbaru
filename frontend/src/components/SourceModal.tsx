import { useState, type FormEvent } from "react";
import { Link2, Loader2, Plus } from "lucide-react";
import { Dialog } from "./Dialog";
import { sourceContent } from "../logic.mjs";
import type { Capture, Project } from "../types";

interface SourceModalProps {
  capture: Capture | null;
  projects: Project[];
  currentProjectId: string;
  initialTitle?: string;
  initialContent?: string;
  close: () => void;
  saveSource: (projectId: string, title: string, content: string) => Promise<void>;
  discardCapture?: () => Promise<void>;
  busy: boolean;
  online: boolean;
  error?: string;
}

export function SourceModal({
  capture,
  projects,
  currentProjectId,
  initialTitle = "",
  initialContent = "",
  close,
  saveSource,
  discardCapture,
  busy,
  online,
  error,
}: SourceModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(
    currentProjectId || (projects[0]?.id ?? "")
  );
  const [title, setTitle] = useState(capture?.title || initialTitle);
  const [content, setContent] = useState(capture?.text || initialContent);

  const formattedContent = sourceContent(title, capture?.url || "", content);
  const charCount = formattedContent.length;
  const isOverLimit = charCount > 40000;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !title.trim() || !content.trim() || isOverLimit || busy || !online) {
      return;
    }
    await saveSource(selectedProjectId, title.trim(), content);
  }

  return (
    <Dialog
      title={capture ? "Revisar trecho selecionado" : "Adicionar material"}
      close={close}
    >
      <form onSubmit={handleSubmit}>
        {capture && (
          <div className="capture-origin">
            <Link2 size={14} aria-hidden="true" />
            <span>{capture.url}</span>
          </div>
        )}

        <label>
          Projeto
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
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
            Crie um projeto antes de salvar. O trecho continua aguardando revisão.
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

        <p className={`small-note ${isOverLimit ? "error" : ""}`}>
          {charCount.toLocaleString("pt-BR")} / 40.000 caracteres · Revise antes de salvar.
        </p>

        <div className="dialog-actions">
          {capture && discardCapture && (
            <button
              type="button"
              className="subtle"
              onClick={discardCapture}
              disabled={busy}
            >
              Descartar trecho
            </button>
          )}
          <button
            type="submit"
            className="primary"
            disabled={
              busy ||
              !online ||
              !selectedProjectId ||
              !title.trim() ||
              !content.trim() ||
              isOverLimit
            }
          >
            {busy ? (
              <Loader2 size={16} className="spin" aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}{" "}
            Salvar no projeto
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="dialog-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}
