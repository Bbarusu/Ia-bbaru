import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";
import { describeTaskError, formatFinishReason, taskState } from "../logic.mjs";
import type { Model, Task } from "../types";

interface ChatThreadProps {
  tasks: Task[];
  models: Model[];
  onOpenTask: (task: Task) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export function ChatThread({
  tasks,
  models,
  onOpenTask,
  onSuggestionClick,
}: ChatThreadProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyText(id: string, text: string) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  if (tasks.length === 0) {
    return null;
  }

  // Render tasks in chronological order (oldest to newest for natural chat flow)
  const chronologicalTasks = [...tasks].reverse();

  return (
    <div className="chat-thread" role="feed" aria-label="Histórico de mensagens">
      {chronologicalTasks.map((t) => {
        const isRunning = ["queued", "running", "waiting", "in_flight"].includes(
          t.status,
        );
        const writerModel =
          models.find((m) => m.id === t.plan?.[0]?.model_id)?.label ||
          t.plan?.[0]?.model_id ||
          "Claude";

        return (
          <div key={t.id} className="chat-turn">
            {/* User message */}
            <div className="chat-msg user">
              <div className="chat-msg-header">
                <span className="chat-avatar user" aria-hidden="true">
                  <User size={13} />
                </span>
                <strong className="chat-author">Você</strong>
                <time className="chat-time">
                  {new Date(t.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <div className="chat-bubble user">
                <p>{t.instruction}</p>
                {Boolean(t.context?.length) && (
                  <div className="chat-context-pills">
                    {t.context!.map((s) => (
                      <span key={s.id} className="chat-ctx-chip" title={s.title}>
                        <FileText size={11} aria-hidden="true" />
                        {s.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assistant reply */}
            <div className="chat-msg assistant">
              <div className="chat-msg-header">
                <span className="chat-avatar assistant" aria-hidden="true">
                  ❄
                </span>
                <strong className="chat-author">{writerModel}</strong>
                <span className={`task-badge ${t.status}`}>
                  {taskState(t.status)}
                </span>
              </div>

              <div className="chat-bubble assistant">
                {isRunning && (
                  <div className="chat-loading" role="status">
                    <Loader2 size={16} className="spin" aria-hidden="true" />
                    <span>Aguardando resposta do Claude…</span>
                  </div>
                )}

                {t.error && (
                  <div
                    className={
                      t.error === "completion_unconfirmed"
                        ? "chat-notice info"
                        : "chat-notice error"
                    }
                    role="alert"
                  >
                    <strong>{describeTaskError(t.error)}</strong>
                    {t.error === "provider_error" && (
                      <p className="small-note">
                        O Claude não conseguiu responder a este pedido. O seu
                        texto e os materiais foram preservados para consulta.
                      </p>
                    )}
                  </div>
                )}

                {t.output && (
                  <div className="chat-output">
                    <pre className="chat-text">{t.output}</pre>
                    <div className="chat-actions">
                      <button
                        type="button"
                        className="chat-mini-action"
                        onClick={() => copyText(t.id, t.output!)}
                        title="Copiar resposta"
                      >
                        {copiedId === t.id ? (
                          <>
                            <Check size={12} aria-hidden="true" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy size={12} aria-hidden="true" /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {t.status === "planned" && !t.output && !t.error && (
                  <div className="chat-planned-banner">
                    <p>
                      Plano preparado com <strong>{writerModel}</strong>.
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onOpenTask(t)}
                    >
                      Revisar e executar plano →
                    </button>
                  </div>
                )}

                {/* Collapsible Technical Details */}
                <details className="chat-tech-details">
                  <summary>
                    <span>Detalhes técnicos</span>
                    <ChevronDown size={12} aria-hidden="true" />
                  </summary>
                  <div className="tech-details-content">
                    {t.routing && (
                      <p className="small-note">
                        <strong>Roteamento:</strong> {t.routing.reason}
                      </p>
                    )}
                    {t.gateway_protocol_version && (
                      <p className="small-note">
                        <strong>Contrato:</strong> v
                        {t.gateway_protocol_version}
                      </p>
                    )}
                    {t.plan?.map((step, idx) => (
                      <p key={idx} className="small-note">
                        <strong>Passo {idx + 1}:</strong>{" "}
                        {step.role === "answer"
                          ? "Resposta principal"
                          : "Revisão"}{" "}
                        ({step.model_id})
                        {step.capabilities &&
                          ` · ${formatFinishReason(step.capabilities.finish_reason)}`}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onOpenTask(t)}
                      style={{ marginTop: "6px" }}
                    >
                      Abrir diálogo detalhado{" "}
                      <ExternalLink size={12} aria-hidden="true" />
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
