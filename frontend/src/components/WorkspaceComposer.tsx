import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Camera,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import type { Capture, Model } from "../types";
import type { CaptureMediaKind } from "./SourceModal";

interface WorkspaceComposerProps {
  text: string;
  changeText: (value: string) => void;
  draftReady: boolean;
  selectedSourcesCount: number;
  openSource: (mode?: CaptureMediaKind) => void;
  captureSelection?: () => void;
  kind: string;
  setKind: (kind: string) => void;
  plan: (e: FormEvent) => Promise<void>;
  busy: boolean;
  online: boolean;
  projectId: string;
  availableModels: Model[];
  selectedModels: string[];
  capture?: Capture | null;
  onClearCapture?: () => void;
}

export function WorkspaceComposer({
  text,
  changeText,
  draftReady,
  selectedSourcesCount,
  openSource,
  captureSelection,
  kind,
  setKind,
  plan,
  busy,
  online,
  projectId,
  availableModels,
  selectedModels,
  capture,
  onClearCapture,
}: WorkspaceComposerProps) {
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Close attachment popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target as Node)
      ) {
        setAttachMenuOpen(false);
      }
    }
    if (attachMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [attachMenuOpen]);

  const quickPromptChips = [
    { label: "✨ Resumir página", prompt: "Resuma os pontos essenciais desta página em tópicos claros." },
    { label: "🔍 Principais pontos", prompt: "Identifique os principais argumentos e conclusões do material." },
    { label: "💡 Explicar termos", prompt: "Explique os termos mais complexos deste conteúdo em linguagem simples." },
  ];

  const canSubmit =
    !busy &&
    online &&
    Boolean(projectId) &&
    availableModels.length > 0 &&
    Boolean(text.trim()) &&
    selectedModels.length > 0;

  return (
    <div className="atlas-composer-area">
      {/* Quick Chips Bar (Atlas / Edge starter suggestions) */}
      <div
        className="quick-chips-row"
        role="group"
        aria-label="Sugestões rápidas de prompt"
      >
        {quickPromptChips.map((chip) => (
          <button
            type="button"
            key={chip.label}
            className="quick-chip"
            onClick={() => changeText(chip.prompt)}
            disabled={!draftReady}
            title={chip.prompt}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <form onSubmit={plan} className="atlas-composer-form">
        {/* The Pill Box Container */}
        <div className="composer-pill-box">
          {/* Active Page / Capture Context Chip inside the pill */}
          {capture && (
            <div
              className="attached-context-chip"
              role="status"
              aria-label="Contexto anexado da página"
            >
              <FileText size={13} aria-hidden="true" />
              <span className="chip-title">
                {capture.title || "Contexto da página"}
              </span>
              <small className="chip-chars">
                ({capture.text.length.toLocaleString("pt-BR")} carac.)
              </small>
              {onClearCapture && (
                <button
                  type="button"
                  className="chip-remove-btn"
                  onClick={onClearCapture}
                  title="Remover contexto da página"
                  aria-label="Remover contexto anexado"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Main Input Row: [+] Attach + Textarea + [↑] Send */}
          <div className="composer-input-row">
            {/* Attachment Button & Popover */}
            <div className="attach-menu-anchor" ref={attachMenuRef}>
              <button
                type="button"
                className={`attach-btn ${attachMenuOpen ? "active" : ""}`}
                onClick={() => setAttachMenuOpen((prev) => !prev)}
                title="Anexar da página ou materiais"
                aria-label="Anexar da página ou materiais"
                aria-expanded={attachMenuOpen}
                disabled={!online || !projectId || busy}
              >
                <Plus size={16} aria-hidden="true" />
              </button>

              {attachMenuOpen && (
                <div
                  className="attach-popover"
                  role="menu"
                  aria-label="Opções de anexo"
                >
                  {captureSelection && (
                    <button
                      type="button"
                      role="menuitem"
                      className="attach-popover-item"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        captureSelection();
                      }}
                      disabled={busy}
                    >
                      <ArrowDownToLine size={14} aria-hidden="true" />
                      <span>Trecho selecionado da aba</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="attach-popover-item"
                    onClick={() => {
                      setAttachMenuOpen(false);
                      openSource("screenshot");
                    }}
                    disabled={!online || !projectId || busy}
                  >
                    <Camera size={14} aria-hidden="true" />
                    <span>Capturar print da tela</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="attach-popover-item"
                    onClick={() => {
                      setAttachMenuOpen(false);
                      openSource("image");
                    }}
                    disabled={!online || !projectId || busy}
                  >
                    <ImageIcon size={14} aria-hidden="true" />
                    <span>Importar imagem local</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="attach-popover-item"
                    onClick={() => {
                      setAttachMenuOpen(false);
                      openSource("text");
                    }}
                    disabled={!online || !projectId || busy}
                  >
                    <FileText size={14} aria-hidden="true" />
                    <span>Adicionar anotação de texto</span>
                  </button>
                </div>
              )}
            </div>

            {/* Input Textarea */}
            <label htmlFor="instruction" className="sr-only">
              Descreva seu pedido ou pergunta
            </label>
            <textarea
              id="instruction"
              className="composer-textarea"
              placeholder="Pergunte sobre esta página ou digite uma mensagem ao Claude… (Enter para enviar)"
              value={text}
              onChange={(e) => changeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSubmit) {
                    (e.target as HTMLTextAreaElement).form?.requestSubmit();
                  }
                }
              }}
              disabled={!draftReady}
              maxLength={8000}
              rows={1}
              aria-describedby="composer-chars"
            />

            {/* Send Button [↑] (Atlas/Edge style) */}
            <button
              className="send-arrow-btn"
              type="submit"
              disabled={!canSubmit}
              aria-label="Criar plano"
              title="Criar plano"
            >
              {busy ? (
                <Loader2 size={16} className="spin" aria-hidden="true" />
              ) : (
                <ArrowUp size={16} aria-hidden="true" />
              )}
              <span className="sr-only">Criar plano</span>
            </button>
          </div>

          {/* Discreet Footer Row inside Pill: Kind selector + Attached count + Chars */}
          <div className="composer-pill-footer">
            <label className="kind-select-discreet" title="Tipo de tarefa">
              <Settings2 size={12} aria-hidden="true" />
              <select
                aria-label="Tipo de tarefa"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="general">Geral</option>
                <option value="study">Estudo</option>
                <option value="writing">Escrita</option>
                <option value="coding">Código</option>
                <option value="analysis">Análise</option>
              </select>
            </label>

            {selectedSourcesCount > 0 && (
              <span className="composer-materials-badge">
                <Link2 size={12} aria-hidden="true" />
                {selectedSourcesCount}{" "}
                {selectedSourcesCount === 1 ? "material" : "materiais"}
              </span>
            )}

            <span className="draft-label" id="composer-chars">
              {text.length > 0 ? `${text.length}/8.000` : ""}
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
