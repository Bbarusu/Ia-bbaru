import { type FormEvent } from "react";
import { Link2, Loader2, Plus } from "lucide-react";
import { Dialog } from "./Dialog";
import { sourceContent } from "../logic.mjs";
import type { Capture, Project } from "../types";

interface SourceModalProps {
  capture: Capture | null;
  queuedCapture: Capture | null;
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  close: () => void;
  saveSource: (e: FormEvent) => Promise<void>;
  discardCapture: (captureId: string) => Promise<void>;
  replaceWithQueuedCapture?: () => void;
  busy: boolean;
  online: boolean;
  error?: string;
}

export function SourceModal({
  capture,
  queuedCapture,
  projects,
  projectId,
  setProjectId,
  title,
  setTitle,
  content,
  setContent,
  close,
  saveSource,
  discardCapture,
  replaceWithQueuedCapture,
  busy,
  online,
  error,
}: SourceModalProps) {
  const originUrl = capture?.url || "";
  const formattedContent = sourceContent(title, originUrl, content);
  const charCount = formattedContent.length;
  const isOverLimit = charCount > 40000;

  return (
    <Dialog
      title={capture ? "Revisar trecho selecionado" : "Adicionar material"}
      close={close}
    >
      <form onSubmit={saveSource}>
        {capture && (
          <div className="capture-origin">
            <Link2 size={14} aria-hidden="true" />
            <span>{capture.url}</span>
          </div>
        )}

        {queuedCapture && replaceWithQueuedCapture && (
          <div className="queued-capture-inline" role="region" aria-label="Captura em espera">
            <span>
              Outro trecho ({queuedCapture.title}) foi capturado e ficou em
              espera para não apagar sua edição atual.
            </span>
            <button
              type="button"
              className="subtle"
              disabled={busy}
              onClick={replaceWithQueuedCapture}
            >
              Substituir pela captura em espera
            </button>
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

        <p className={`small-note ${isOverLimit ? "error" : ""}`}>
          {charCount.toLocaleString("pt-BR")} / 40.000 caracteres · Revise antes
          de salvar.
        </p>

        <div className="dialog-actions">
          {capture && (
            <button
              type="button"
              className="subtle"
              onClick={() => discardCapture(capture.id)}
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
              !projectId ||
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
