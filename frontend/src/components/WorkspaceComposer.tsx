import { type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Model } from "../types";
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
}: WorkspaceComposerProps) {
  const promptSuggestions = [
    "Resumir pontos essenciais da página",
    "Analisar print ou diagrama capturado",
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
          <h2>Perguntar ao Yuki</h2>
          <p>Acione seus agentes com textos, prints e imagens da página.</p>
        </div>
        <span className="micro-badge">MODO ATLAS</span>
      </div>

      <div
        className="atlas-composer-bar"
        role="group"
        aria-label="Captura rápida multimodal para o agente"
      >
        <span className="atlas-bar-title">❄ Anexar da aba:</span>
        <div className="atlas-bar-btns">
          {captureSelection && (
            <button
              type="button"
              className="atlas-mini-btn"
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
            className="atlas-mini-btn"
            onClick={() => openSource("screenshot")}
            disabled={!online || !projectId || busy}
            title="Capturar ou colar print da tela (Ctrl+V)"
          >
            <Camera size={12} aria-hidden="true" />
            Print
          </button>
          <button
            type="button"
            className="atlas-mini-btn"
            onClick={() => openSource("image")}
            disabled={!online || !projectId || busy}
            title="Capturar ou importar imagem da página"
          >
            <ImageIcon size={12} aria-hidden="true" />
            Imagem
          </button>
        </div>
      </div>

      <form onSubmit={plan}>
        <label htmlFor="instruction" className="sr-only">
          Descreva seu pedido
        </label>
        <textarea
          id="instruction"
          placeholder="Pergunte sobre a página aberta, peça para analisar um print/imagem ou sintetizar seus materiais…"
          value={text}
          onChange={(e) => changeText(e.target.value)}
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
          <span className="atlas-agent-pill">
            {activeAgentLabels.length > 0
              ? `❄ ${activeAgentLabels.join(" + ")}`
              : availableModels.length > 0
                ? "Escolha 1 agente abaixo"
                : "Sem agente conectado"}
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
          >
            {busy ? (
              <Loader2 size={16} className="spin" aria-hidden="true" />
            ) : (
              <ArrowRight size={16} aria-hidden="true" />
            )}{" "}
            Criar plano
          </button>
        </div>
      </form>

      <div className="composer-foot">
        <ShieldCheck size={13} aria-hidden="true" />
        Você escolhe exatamente quais textos, prints e imagens cada agente recebe.
      </div>
    </section>
  );
}
