import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Camera,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import type { Capture, Model } from "../types";
import type { CaptureMediaKind } from "./SourceModal";

interface ChatComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  changeText: (value: string) => void;
  draftReady: boolean;
  submit: (event: FormEvent) => void;
  canSubmit: boolean;
  busy: boolean;
  online: boolean;
  eligibleModels: Model[];
  chatModel: string;
  setChatModel: (id: string) => void;
  kind: string;
  setKind: (kind: string) => void;
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
  eligibleModels,
  chatModel,
  setChatModel,
  kind,
  setKind,
  capture,
  removeCapture,
  selectedSourcesCount,
  clearSelectedSources,
  attachSelection,
  openSource,
  hasEarlierTurns,
}: ChatComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setMenuOpen(false);
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

  useEffect(() => {
    if (!capture) setPreviewOpen(false);
  }, [capture]);

  // Cresce com o conteúdo até o limite definido no CSS.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, inputRef]);

  const captureText = typeof capture?.text === "string" ? capture.text : "";
  const captureTitle = capture?.title?.trim() || "Trecho da página";

  function choose(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <form className="chat-composer" onSubmit={submit}>
      <div className="composer-pill">
        {(capture || selectedSourcesCount > 0) && (
          <div className="composer-context" aria-label="Contexto que será enviado">
            {capture && (
              <span className="context-chip">
                <Link2 size={12} aria-hidden="true" />
                <button
                  type="button"
                  className="context-chip-title"
                  aria-expanded={previewOpen}
                  title="Ver o trecho que será enviado"
                  onClick={() => setPreviewOpen((open) => !open)}
                >
                  {captureTitle}
                </button>
                <small>{captureText.length.toLocaleString("pt-BR")} caracteres</small>
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
                <FileText size={12} aria-hidden="true" />
                <span>
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

        <div className="composer-row">
          <div className="attach-anchor" ref={menuRef}>
            <button
              type="button"
              className={`attach-button ${menuOpen ? "active" : ""}`}
              aria-label="Anexar contexto"
              title="Anexar contexto"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={!online || busy}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Plus size={17} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="attach-menu" role="menu" aria-label="Anexar contexto">
                <button type="button" role="menuitem" onClick={() => choose(attachSelection)}>
                  <ArrowDownToLine size={14} aria-hidden="true" />
                  <span>
                    Trecho selecionado da aba
                    <small>Vai junto com a mensagem</small>
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={() => choose(() => openSource("text"))}>
                  <FileText size={14} aria-hidden="true" />
                  <span>
                    Anotação de texto
                    <small>Salva na biblioteca do projeto</small>
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={() => choose(() => openSource("screenshot"))}>
                  <Camera size={14} aria-hidden="true" />
                  <span>
                    Print da tela
                    <small>Fica salvo; o Claude ainda não analisa imagens</small>
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={() => choose(() => openSource("image"))}>
                  <ImageIcon size={14} aria-hidden="true" />
                  <span>
                    Imagem do computador
                    <small>Fica salva; o Claude ainda não analisa imagens</small>
                  </span>
                </button>
              </div>
            )}
          </div>

          <label htmlFor="instruction" className="sr-only">
            Mensagem para o Claude
          </label>
          <textarea
            id="instruction"
            ref={inputRef}
            rows={1}
            placeholder="Pergunte ao Claude…"
            value={text}
            maxLength={8000}
            disabled={!draftReady}
            aria-describedby="composer-hint"
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (canSubmit) event.currentTarget.form?.requestSubmit();
            }}
          />

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

        <div className="composer-footer">
          <label className="composer-select">
            <span className="sr-only">Modelo Claude</span>
            <select
              aria-label="Modelo Claude"
              value={eligibleModels.some((m) => m.id === chatModel) ? chatModel : "auto"}
              disabled={!eligibleModels.length}
              onChange={(event) => setChatModel(event.target.value)}
            >
              <option value="auto">
                {eligibleModels.length ? "Modelo automático" : "Sem modelo"}
              </option>
              {eligibleModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <label className="composer-select">
            <span className="sr-only">Tipo de tarefa</span>
            <select
              aria-label="Tipo de tarefa"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="general">Geral</option>
              <option value="study">Estudo</option>
              <option value="writing">Escrita</option>
              <option value="coding">Código</option>
              <option value="analysis">Análise</option>
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <span
            className="composer-hint"
            id="composer-hint"
            title="Enter envia e Shift+Enter quebra linha. O Claude ainda não recebe as mensagens anteriores da conversa."
          >
            {text.length > 0
              ? `${text.length.toLocaleString("pt-BR")}/8.000`
              : hasEarlierTurns
                ? "Sem histórico entre mensagens"
                : "Enter envia"}
          </span>
        </div>
      </div>
    </form>
  );
}
