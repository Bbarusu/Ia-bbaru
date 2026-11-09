import { type FormEvent } from "react";
import {
  ArrowRight,
  Link2,
  Loader2,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Model } from "../types";

interface WorkspaceComposerProps {
  text: string;
  changeText: (value: string) => void;
  draftReady: boolean;
  selectedSourcesCount: number;
  openSource: () => void;
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
    "Explique este conteúdo",
    "Compare duas ideias",
    "Organize meus estudos",
  ];

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
          <h2>O que vamos fazer?</h2>
          <p>Comece com uma pergunta. Ou uma grande ideia.</p>
        </div>
        <span className="micro-badge">NOVO PEDIDO</span>
      </div>

      <form onSubmit={plan}>
        <label htmlFor="instruction" className="sr-only">
          Descreva seu pedido
        </label>
        <textarea
          id="instruction"
          placeholder="Explique um assunto, conecte ideias ou planeje seu próximo projeto…"
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
                    ? "material selecionado"
                    : "materiais selecionados"
                }`
              : "Adicione contexto ao seu pedido"}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Adicionar material"
            title="Adicionar material"
            onClick={openSource}
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
        Você escolhe os materiais que cada agente recebe.
      </div>
    </section>
  );
}
