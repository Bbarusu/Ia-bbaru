import { useEffect, useState, type FormEvent, type RefObject } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Camera,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Capture } from "../types";
import type { CaptureMediaKind } from "./SourceModal";
import { Menu } from "./Menu";

export type QuickAction = { label: string; run: () => void };

interface ChatComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  changeText: (value: string) => void;
  draftReady: boolean;
  submit: (event: FormEvent) => void;
  canSubmit: boolean;
  busy: boolean;
  online: boolean;
  kind: string;
  setKind: (kind: string) => void;
  capture: Capture | null;
  removeCapture: () => void;
  selectedSourcesCount: number;
  clearSelectedSources: () => void;
  attachSelection: () => void;
  openSource: (mode?: CaptureMediaKind) => void;
  hasEarlierTurns: boolean;
  quickActions: QuickAction[];
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
  kind,
  setKind,
  capture,
  removeCapture,
  selectedSourcesCount,
  clearSelectedSources,
  attachSelection,
  openSource,
  hasEarlierTurns,
  quickActions,
}: ChatComposerProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!capture) setPreviewOpen(false);
  }, [capture]);

  const captureText = typeof capture?.text === "string" ? capture.text : "";
  const captureTitle = capture?.title?.trim() || "Trecho da página";

  const hint =
    text.length > 0
      ? `${text.length.toLocaleString("pt-BR")}/8.000`
      : hasEarlierTurns
        ? "Sem histórico entre mensagens"
        : "Enter envia · Shift+Enter quebra linha";

  return (
    <form className="chat-composer" onSubmit={submit}>
      <div className="quick-actions" role="group" aria-label="Sugestões rápidas">
        {quickActions.map((action) => (
          <button
            type="button"
            key={action.label}
            disabled={!draftReady}
            onClick={action.run}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="composer-pill">
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

        <div className="composer-row">
          <div className="attach-anchor">
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
          </div>

          <label htmlFor="instruction" className="sr-only">
            Mensagem para o Claude
          </label>
          <textarea
            id="instruction"
            ref={inputRef}
            rows={2}
            placeholder="Pergunte ao Claude ou anexe um trecho da página… (Enter para enviar)"
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
            <SlidersHorizontal size={12} aria-hidden="true" />
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
            <ChevronDown size={11} aria-hidden="true" />
          </label>
          <span
            className="composer-hint"
            id="composer-hint"
            title="Enter envia e Shift+Enter quebra linha. O Claude ainda não recebe as mensagens anteriores da conversa."
          >
            {hint}
          </span>
        </div>
      </div>
    </form>
  );
}
