import { type FormEvent } from "react";
import {
  ArrowDownToLine,
  Camera,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
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
  const promptSuggestions = [
    "Resumir pontos essenciais da página",
    "Explicar a descrição de um diagrama",
    "Comparar argumentos dos materiais",
  ];

  const activeAgentLabels = availableModels
    .filter((m) => selectedModels.includes(m.id))
    .map((m) => m.label);

  const canSubmit =
    !busy &&
    online &&
    Boolean(projectId) &&
    availableModels.length > 0 &&
    Boolean(text.trim()) &&
    selectedModels.length > 0;

  return (
    <section className="composer card">
      <div className="card-heading">
        <span className="card-icon blue" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <h2>Conversar com Claude</h2>
          <p>Converse com os modelos Claude. Capture trechos da página ou envie mensagens.</p>
        </div>
        <span className="micro-badge">CLAUDE CODE</span>
      </div>

      <div
        className="context-composer-bar"
        role="group"
        aria-label="Captura rápida multimodal para o agente"
      >
        <span className="context-bar-title">❄ Anexar da aba:</span>
        <div className="context-bar-btns">
          {captureSelection && (
            <button
              type="button"
              className="context-mini-btn"
              onClick={captureSelection}
              disabled={busy}
              title="Capturar trecho de texto selecionado na aba ativa"
            >
              <ArrowDownToLine size={12} aria-hidden="true" />
              Trecho
            </button>
          )}
          <button
            type="button"
            className="context-mini-btn"
            onClick={() => openSource("screenshot")}
            disabled={!online || !projectId || busy}
            title="Capturar print visível da aba web"
          >
            <Camera size={12} aria-hidden="true" />
            Print
          </button>
          <button
            type="button"
            className="context-mini-btn"
            onClick={() => openSource("image")}
            disabled={!online || !projectId || busy}
            title="Importar imagem local para o projeto"
          >
            <ImageIcon size={12} aria-hidden="true" />
            Imagem
          </button>
        </div>
      </div>

      {capture && (
        <div className="attached-context-chip" role="status" aria-label="Contexto anexado da página">
          <FileText size={13} aria-hidden="true" />
          <span className="chip-title">{capture.title || "Contexto da página"}</span>
          <small className="chip-chars">({capture.text.length.toLocaleString("pt-BR")} carac.)</small>
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

      <form onSubmit={plan}>
        <label htmlFor="instruction" className="sr-only">
          Descreva seu pedido
        </label>
        <textarea
          id="instruction"
          placeholder="Pergunte sobre a página ou envie uma mensagem ao Claude… (Enter para enviar)"
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
          aria-describedby="composer-chars"
        />

        <div
          className="prompt-ideas"
          role="group"
          aria-label="Ideias rápidas de pedido"
        >
          {promptSuggestions.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => changeText(s)}
              disabled={!draftReady}
            >
              <Plus size={12} aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>

        <div className="composer-context">
          <span>
            <Link2 size={14} aria-hidden="true" />
            {selectedSourcesCount > 0
              ? `${selectedSourcesCount} ${
                  selectedSourcesCount === 1
                    ? "material anexado"
                    : "materiais anexados"
                }`
              : "Adicione textos, prints ou imagens ao pedido"}
          </span>
          <span className="context-agent-pill">
            {activeAgentLabels.length > 0
              ? `❄ ${activeAgentLabels.join(" + ")}`
              : availableModels.length > 0
                ? "Escolha 1 modelo abaixo"
                : "Sem modelo conectado"}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Adicionar material"
            title="Adicionar material (Texto, Print ou Imagem)"
            onClick={() => openSource("text")}
            disabled={!online || !projectId}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="composer-controls">
          <label className="kind-select">
            <Settings2 size={14} aria-hidden="true" />
            <select
              aria-label="Tipo de tarefa"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="study">Estudo</option>
              <option value="writing">Escrita</option>
              <option value="coding">Código</option>
              <option value="analysis">Análise</option>
              <option value="general">Geral</option>
            </select>
          </label>

          <span className="draft-label" id="composer-chars">
            {text.length > 0 ? `${text.length}/8.000 · ` : ""}Rascunho local
          </span>

          <button
            className="primary"
            type="submit"
            disabled={!canSubmit}
            aria-label="Criar plano"
            title="Enviar mensagem ou criar plano"
          >
            {busy ? (
              <Loader2 size={16} className="spin" aria-hidden="true" />
            ) : (
              <Send size={15} aria-hidden="true" />
            )}{" "}
            Criar plano
          </button>
        </div>
      </form>

      <div className="composer-foot">
        <ShieldCheck size={13} aria-hidden="true" />
        Você escolhe exatamente quais textos, prints e imagens cada modelo recebe.
      </div>
    </section>
  );
}
