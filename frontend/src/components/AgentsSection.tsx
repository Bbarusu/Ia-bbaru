import { ArrowUpRight, Check, Circle, Command, Sparkles } from "lucide-react";
import type { Model } from "../types";

interface AgentsSectionProps {
  models: Model[];
  availableModels: Model[];
  selectedModels: string[];
  toggleModel: (id: string) => void;
  review: boolean;
  setReview: (review: boolean) => void;
  goToConnections: () => void;
}

export function AgentsSection({
  models,
  availableModels,
  selectedModels,
  toggleModel,
  review,
  setReview,
  goToConnections,
}: AgentsSectionProps) {
  const availableCount = availableModels.length;

  return (
    <section className="agents-section" aria-labelledby="agents-title">
      <div className="section-title">
        <div>
          <h2 id="agents-title">
            Seus agentes{" "}
            <span>
              {availableCount}{" "}
              {availableCount === 1 ? "disponível" : "disponíveis"}
            </span>
          </h2>
          <p>
            Escolha quem vai ajudar a transformar contexto em resultado.
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={goToConnections}
        >
          Gerenciar <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="agents-grid">
        {models.length ? (
          models.map((m) => {
            const isSelected = selectedModels.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={!m.available}
                className={`agent-card card ${isSelected ? "selected" : ""}`}
                onClick={() => toggleModel(m.id)}
                aria-pressed={isSelected}
                aria-label={`${m.label} - ${
                  m.available ? "Disponível neste computador" : "Indisponível"
                }`}
              >
                <span className="agent-symbol" aria-hidden="true">
                  <Command size={23} />
                </span>
                <span className="agent-description">
                  <strong>{m.label}</strong>
                  <small>
                    {m.available
                      ? "Disponível neste computador"
                      : "Indisponível"}
                  </small>
                </span>
                <span className="agent-check" aria-hidden="true">
                  {isSelected ? <Check size={14} /> : <Circle size={15} />}
                </span>
              </button>
            );
          })
        ) : (
          ["ChatGPT", "Claude", "Gemini"].map((name, index) => (
            <button
              type="button"
              className="agent-card card unconfigured"
              key={name}
              onClick={goToConnections}
              aria-label={`${name} - Conexão a configurar`}
            >
              <span className={`agent-symbol a${index}`} aria-hidden="true">
                {index === 0 ? (
                  <Command size={24} />
                ) : index === 1 ? (
                  <Sparkles size={24} />
                ) : (
                  <span className="gemini-star">✦</span>
                )}
              </span>
              <span className="agent-description">
                <strong>{name}</strong>
                <small>Conexão a configurar</small>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          ))
        )}
      </div>

      <div className="agents-meta">
        <span>
          <Circle size={10} aria-hidden="true" />
          {availableCount > 0
            ? "A seleção segue sua preferência e o tipo de tarefa."
            : "Nenhuma IA conectada. Seus pedidos podem ficar como rascunho."}
        </span>
        <label className="switch-label">
          <input
            type="checkbox"
            checked={review}
            onChange={(e) => setReview(e.target.checked)}
            disabled={availableCount < 2}
          />
          <span className="switch" aria-hidden="true" />
          Revisão por outro agente
        </label>
      </div>
    </section>
  );
}
