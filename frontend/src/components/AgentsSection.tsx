import { ArrowUpRight, Check, Circle, Command, Sparkles } from "lucide-react";
import {
  formatBilling,
  formatCancellation,
  formatOutputLimit,
  formatUnavailableReason,
  requiresLimitAcceptance,
} from "../logic.mjs";
import type { Model } from "../types";

interface AgentsSectionProps {
  models: Model[];
  availableModels: Model[];
  selectedModels: string[];
  toggleModel: (id: string) => void;
  review: boolean;
  setReview: (review: boolean) => void;
  acceptedLimit: boolean;
  setAcceptedLimit: (accepted: boolean) => void;
  goToConnections: () => void;
}

export function AgentsSection({
  models,
  availableModels,
  selectedModels,
  toggleModel,
  review,
  setReview,
  acceptedLimit,
  setAcceptedLimit,
  goToConnections,
}: AgentsSectionProps) {
  const placeholderAgents = ["ChatGPT", "Claude", "Gemini"];
  const needsLimitConsent = requiresLimitAcceptance(selectedModels, models);

  return (
    <section className="agents-section">
      <div className="section-title">
        <div>
          <h2>
            Seus agentes <span>{availableModels.length} disponíveis</span>
          </h2>
          <p>Escolha quem vai ajudar a transformar contexto em resultado.</p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={goToConnections}
        >
          Gerenciar <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>

      <div
        className="agents-grid"
        role="group"
        aria-label="Seleção de agentes de IA"
      >
        {models.length > 0
          ? models.map((m) => {
              const isSelected = selectedModels.includes(m.id);
              const caps = m.capabilities;
              return (
                <button
                  type="button"
                  key={m.id}
                  disabled={!m.available}
                  className={`agent-card card ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleModel(m.id)}
                  aria-pressed={isSelected}
                >
                  <span className="agent-symbol" aria-hidden="true">
                    <Command size={21} />
                  </span>
                  <span className="agent-description">
                    <strong>{m.label}</strong>
                    <small>
                      {m.available
                        ? caps
                          ? `${formatBilling(caps.billing)} · ${formatOutputLimit(caps.output_limit, m.max_output_tokens)}`
                          : "Disponível neste computador"
                        : formatUnavailableReason(m.unavailable_reason)}
                    </small>
                    {caps && (
                      <span className="agent-caps-row">
                        <span className="cap-chip">
                          {formatCancellation(caps.cancellation)}
                        </span>
                        {caps.tools !== "disabled" && (
                          <span className="cap-chip warn">
                            Requer ferramentas (não elegível)
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="agent-check" aria-hidden="true">
                    {isSelected ? <Check size={14} /> : <Circle size={15} />}
                  </span>
                </button>
              );
            })
          : placeholderAgents.map((name, index) => (
              <button
                type="button"
                className="agent-card card"
                key={name}
                onClick={goToConnections}
              >
                <span className={`agent-symbol a${index}`} aria-hidden="true">
                  {index === 0 ? (
                    <Command size={22} />
                  ) : index === 1 ? (
                    <Sparkles size={22} />
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
            ))}
      </div>

      {needsLimitConsent && (
        <div className="limit-consent-card card">
          <label className="limit-consent-label">
            <input
              type="checkbox"
              checked={acceptedLimit}
              onChange={(e) => setAcceptedLimit(e.target.checked)}
            />
            <span>Aceito o limite indicativo para esta tarefa</span>
          </label>
          <p className="small-note">
            O agente pode ultrapassar a saída solicitada. Encerrar o processo
            local não garante interrupção no provedor nem devolução de cota.
            Esta confirmação aplica-se apenas ao plano atual e não inicia
            geração.
          </p>
        </div>
      )}

      <div className="agents-meta">
        <span>
          <Circle size={10} aria-hidden="true" />
          {availableModels.length > 0
            ? "A seleção segue sua preferência e o tipo de tarefa."
            : "Nenhuma IA conectada. Seus pedidos podem ficar como rascunho."}
        </span>
        <label className="switch-label">
          <input
            type="checkbox"
            checked={review}
            onChange={(e) => setReview(e.target.checked)}
            disabled={availableModels.length < 2}
          />
          <span className="switch" aria-hidden="true" />
          Revisão por outro agente
        </label>
      </div>
    </section>
  );
}
