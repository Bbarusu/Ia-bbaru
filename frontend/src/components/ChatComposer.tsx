import { useEffect, useState, type FormEvent, type RefObject } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Camera,
  ChevronDown,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { shortModelName } from "../logic.mjs";
import type { Capture, Model, Project } from "../types";
import type { CaptureMediaKind } from "./SourceModal";
import { Menu } from "./Menu";

interface ChatComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  changeText: (value: string) => void;
  draftReady: boolean;
  submit: (event: FormEvent) => void;
  canSubmit: boolean;
  busy: boolean;
  online: boolean;
  checking: boolean;
  eligibleModels: Model[];
  chatModel: string;
  setChatModel: (id: string) => void;
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  capture: Capture | null;
  removeCapture: () => void;
  selectedSourcesCount: number;
  clearSelectedSources: () => void;
  attachSelection: () => void;
  openSource: (mode?: CaptureMediaKind) => void;
  hasEarlierTurns: boolean;
}

export function ChatComposer({
  inputRef,
  text,
  changeText,
  draftReady,
  submit,
  canSubmit,
  busy,
  online,
  checking,
  eligibleModels,
  chatModel,
  setChatModel,
  projects,
  projectId,
  setProjectId,
  capture,
  removeCapture,
  selectedSourcesCount,
  clearSelectedSources,
  attachSelection,
  openSource,
  hasEarlierTurns,
}: ChatComposerProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!capture) setPreviewOpen(false);
  }, [capture]);

  const captureText = typeof capture?.text === "string" ? capture.text : "";
  const captureTitle = capture?.title?.trim() || "Trecho da página";
  const status = checking ? "Verificando…" : online ? "Conectado" : "Desconectado";

  return (
    <form className="chat-composer" onSubmit={submit}>
      <div className="composer-box">
        {(capture || selectedSourcesCount > 0) && (
          <div className="composer-context" aria-label="Contexto que será enviado">
            {capture && (
              <span className="context-chip">
                <button
                  type="button"
                  className="context-chip-title"
                  aria-expanded={previewOpen}
                  title={`Ver o trecho que será enviado (${captureText.length.toLocaleString("pt-BR")} caracteres)`}
                  onClick={() => setPreviewOpen((open) => !open)}
                >
                  <span aria-hidden="true">🌐 </span>
                  {captureTitle}
                </button>
                <button
                  type="button"
                  className="context-chip-remove"
                  aria-label="Remover trecho da página"
                  title="Remover trecho da página"
                  onClick={removeCapture}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )}
            {selectedSourcesCount > 0 && (
              <span className="context-chip">
                <span className="context-chip-title">
                  <span aria-hidden="true">📄 </span>
                  {selectedSourcesCount}{" "}
                  {selectedSourcesCount === 1
                    ? "material da biblioteca"
                    : "materiais da biblioteca"}
                </span>
                <button
                  type="button"
                  className="context-chip-remove"
                  aria-label="Não enviar materiais da biblioteca"
                  title="Não enviar materiais da biblioteca"
                  onClick={clearSelectedSources}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        )}

        {capture && previewOpen && (
          <div className="context-preview">
            {capture.url && <small>{capture.url}</small>}
            <p>{captureText || "Este trecho não tem texto."}</p>
          </div>
        )}

        <label htmlFor="instruction" className="sr-only">
          Mensagem para o Claude
        </label>
        <textarea
          id="instruction"
          ref={inputRef}
          rows={1}
          placeholder={
            hasEarlierTurns
              ? "Nova pergunta (o Claude não vê as mensagens anteriores)"
              : "Pergunte ao Claude"
          }
          value={text}
          maxLength={8000}
          disabled={!draftReady}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (canSubmit) event.currentTarget.form?.requestSubmit();
          }}
        />

        <div className="composer-bar">
          <Menu
            label="Anexar contexto"
            triggerClass="attach-button"
            menuClass="attach-menu"
            disabled={!online || busy}
            trigger={<Plus size={17} aria-hidden="true" />}
          >
            {(close) => {
              const choose = (action: () => void) => () => {
                close();
                action();
              };
              return (
                <>
                  <button type="button" onClick={choose(attachSelection)}>
                    <ArrowDownToLine size={14} aria-hidden="true" />
                    <span>
                      Trecho selecionado da aba
                      <small>Vai junto com a mensagem</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(() => openSource("screenshot"))}>
                    <Camera size={14} aria-hidden="true" />
                    <span>
                      Capturar print da tela
                      <small>Fica salvo; o Claude ainda não analisa imagens</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(() => openSource("image"))}>
                    <ImageIcon size={14} aria-hidden="true" />
                    <span>
                      Importar imagem local
                      <small>Fica salva; o Claude ainda não analisa imagens</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(() => openSource("text"))}>
                    <FileText size={14} aria-hidden="true" />
                    <span>
                      Adicionar anotação de texto
                      <small>Salva na biblioteca do projeto</small>
                    </span>
                  </button>
                </>
              );
            }}
          </Menu>

          <label className="composer-chip" title={`Modelo Claude · ${status}`}>
            <span
              className={`status-dot ${checking ? "wait" : online ? "on" : "off"}`}
              aria-hidden="true"
            />
            <select
              aria-label="Modelo Claude"
              value={eligibleModels.some((m) => m.id === chatModel) ? chatModel : "auto"}
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

          <label className="composer-chip" title="Projeto onde a conversa fica guardada">
            <Folder size={13} aria-hidden="true" />
            <select
              id="project"
              aria-label="Projeto atual"
              value={projectId}
              disabled={!projects.length || busy}
              onChange={(event) => setProjectId(event.target.value)}
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

          <button
            type="submit"
            className="send-button"
            aria-label="Enviar"
            title="Enviar (Enter). Shift+Enter quebra linha."
            disabled={!canSubmit}
          >
            {busy ? (
              <Loader2 size={17} className="spin" aria-hidden="true" />
            ) : (
              <ArrowUp size={17} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
