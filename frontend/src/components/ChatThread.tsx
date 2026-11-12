import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileText, Loader2, PencilLine } from "lucide-react";
import { request } from "../transport";
import {
  chatActivityLabel,
  chatTurnPhase,
  describeChatError,
  describeTaskError,
  formatFinishReason,
  formatOutputLimit,
  taskState,
} from "../logic.mjs";
import type { Model, Task } from "../types";
import { YukiMark } from "./YukiMark";

interface ChatThreadProps {
  turns: Task[];
  models: Model[];
  executionEnabled: boolean;
  updateTask: (task: Task) => void;
  pollError: string;
  uncertainEnqueue: string[];
  openTask: (task: Task) => void;
  reuseInstruction: (text: string) => void;
  starters: { label: string; hint: string; run: () => void }[];
  canAttachSelection: boolean;
  openGuide: () => void;
}

function modelLabel(task: Task, models: Model[]) {
  const id = task.plan?.[0]?.model_id;
  if (!id) return "Claude";
  return models.find((m) => m.id === id)?.label || id;
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Confirmação por tarefa, igual à do diálogo de detalhes, mas dentro da conversa. */
function TurnConsent({
  task,
  updateTask,
  startUncertain,
}: {
  task: Task;
  updateTask: (task: Task) => void;
  startUncertain: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(startUncertain);
  const [error, setError] = useState(
    startUncertain
      ? "Não recebemos a confirmação do envio. Consulte o estado antes de tentar novamente."
      : "",
  );
  const blocked = task.status === "blocked";

  async function refresh() {
    setSubmitting(true);
    try {
      updateTask(await request<Task>("tasks.get", { task_id: task.id }));
      setNeedsRefresh(false);
      setError("");
    } catch {
      setError("Não foi possível consultar o estado. Reconecte o componente local.");
    } finally {
      setSubmitting(false);
    }
  }

  async function enqueue() {
    if (!confirmed || submitting || needsRefresh) return;
    setSubmitting(true);
    setError("");
    try {
      updateTask(
        await request<Task>(blocked ? "tasks.resume" : "tasks.enqueue", {
          task_id: task.id,
          confirmed: true,
        }),
      );
      setConfirmed(false);
    } catch {
      // Uma confirmação perdida não autoriza enfileirar de novo.
      setNeedsRefresh(true);
      setError("Não recebemos a confirmação. Consulte o estado antes de tentar novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="turn-consent">
      <p>
        {blocked
          ? "Este pedido está parado até a correção acima. Ele ainda não foi enviado de novo."
          : "Pedido salvo e ainda não enviado. O envio usa a cota da sua conta Claude."}
      </p>
      <label className="consent-check">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={submitting}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>Autorizo executar esta tarefa com minha conta</span>
      </label>
      <div className="turn-consent-actions">
        <button
          type="button"
          className="primary"
          disabled={!confirmed || submitting || needsRefresh}
          onClick={enqueue}
        >
          {blocked ? "Retomar após corrigir" : "Executar tarefa"}
        </button>
        {needsRefresh && (
          <button type="button" className="subtle" disabled={submitting} onClick={refresh}>
            Consultar estado
          </button>
        )}
      </div>
      {error && (
        <p className="turn-error-line" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TurnDetails({
  task,
  models,
  openTask,
}: {
  task: Task;
  models: Model[];
  openTask: (task: Task) => void;
}) {
  return (
    <details className="turn-details">
      <summary>Detalhes técnicos</summary>
      <dl>
        <dt>Estado</dt>
        <dd>{taskState(task.status)}</dd>
        {task.error && (
          <>
            <dt>Diagnóstico</dt>
            <dd>
              {describeTaskError(task.error)} <code>{task.error}</code>
            </dd>
          </>
        )}
        {task.plan?.map((step, index) => (
          <div key={index} className="turn-details-step">
            <dt>{step.role === "answer" ? "Resposta" : "Revisão"}</dt>
            <dd>
              {models.find((m) => m.id === step.model_id)?.label || step.model_id}
              {step.capabilities &&
                ` · ${formatOutputLimit(step.capabilities.output_limit, step.max_output_tokens)} · ${formatFinishReason(step.capabilities.finish_reason)}`}
              {task.execution?.steps?.[index] &&
                ` · Tentativas: ${task.execution.steps[index].attempts}`}
            </dd>
          </div>
        ))}
        {task.routing?.reason && (
          <>
            <dt>Escolha do modelo</dt>
            <dd>{task.routing.reason}</dd>
          </>
        )}
        {task.gateway_protocol_version && (
          <>
            <dt>Contrato</dt>
            <dd>v{task.gateway_protocol_version}</dd>
          </>
        )}
        <dt>Identificador</dt>
        <dd>
          <code>{task.execution?.steps?.[0]?.request_id || task.id}</code>
        </dd>
      </dl>
      <button type="button" className="text-button" onClick={() => openTask(task)}>
        Abrir detalhes da tarefa
      </button>
    </details>
  );
}

export function ChatThread({
  turns,
  models,
  executionEnabled,
  updateTask,
  pollError,
  uncertainEnqueue,
  openTask,
  reuseInstruction,
  starters,
  canAttachSelection,
  openGuide,
}: ChatThreadProps) {
  const [copiedId, setCopiedId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastKey = turns.length
    ? `${turns[turns.length - 1].id}:${turns[turns.length - 1].status}`
    : "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastKey]);

  async function copy(task: Task) {
    try {
      await navigator.clipboard.writeText(task.output || "");
      setCopiedId(task.id);
      setTimeout(() => setCopiedId((old) => (old === task.id ? "" : old)), 1800);
    } catch {
      setCopiedId("");
    }
  }

  if (!turns.length) {
    return (
      <div className="chat-thread chat-empty">
        <div className="chat-welcome">
          <YukiMark />
          <h2>Como posso ajudar hoje?</h2>
          <p>
            Converse com o Claude ao lado da página.
            {canAttachSelection
              ? " Para perguntar sobre um trecho, selecione o texto na aba e anexe."
              : ""}
          </p>
          <div className="chat-starters">
            {starters.map((starter) => (
              <button type="button" key={starter.label} onClick={starter.run}>
                <strong>{starter.label}</strong>
                <small>{starter.hint}</small>
              </button>
            ))}
          </div>
          <button type="button" className="text-button" onClick={openGuide}>
            Conhecendo o Yuki
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-thread" role="log" aria-label="Conversa com o Claude">
      {turns.map((task) => {
        const phase = chatTurnPhase(task);
        const info = describeChatError(task.error);
        const label = modelLabel(task, models);
        const partial =
          task.output ||
          (phase !== "answered" ? task.results?.[task.results.length - 1]?.output : "") ||
          "";
        return (
          <article key={task.id} className="chat-turn">
            <div className="turn-user">
              <p>{task.instruction}</p>
              {Boolean(task.context?.length) && (
                <div className="turn-sources" aria-label="Contexto enviado">
                  {task.context!.map((source) => (
                    <span key={source.id} className="source-chip" title={source.title}>
                      <FileText size={11} aria-hidden="true" />
                      {source.title}
                    </span>
                  ))}
                </div>
              )}
              <time dateTime={task.created_at}>{timeLabel(task.created_at)}</time>
            </div>

            <div className="turn-assistant">
              <div className="turn-author">
                <YukiMark size="sm" />
                <strong>Claude</strong>
                <span>{label}</span>
              </div>

              {phase === "working" && (
                <p className="turn-working" role="status">
                  <Loader2 size={15} className="spin" aria-hidden="true" />
                  {chatActivityLabel(task.status)}
                </p>
              )}
              {phase === "working" && pollError && (
                <p className="turn-error-line" role="alert">
                  {pollError}
                </p>
              )}

              {info && (
                <div
                  className={`turn-notice ${info.tone}`}
                  role={info.tone === "info" ? "status" : "alert"}
                >
                  <strong>{info.message}</strong>
                  <p>{info.hint}</p>
                </div>
              )}
              {!info && phase === "uncertain" && (
                <div className="turn-notice warn" role="alert">
                  <strong>Não foi possível confirmar o resultado deste pedido.</strong>
                  <p>A geração pode ter usado sua cota. O pedido não será repetido automaticamente.</p>
                </div>
              )}
              {!info && phase === "failed" && (
                <div className="turn-notice error" role="alert">
                  <strong>Este pedido não foi concluído.</strong>
                  <p>Seu texto continua preservado.</p>
                </div>
              )}

              {partial && <div className="turn-answer">{partial}</div>}

              {(phase === "awaiting_consent" || phase === "blocked") &&
                (executionEnabled ? (
                  <TurnConsent
                    task={task}
                    updateTask={updateTask}
                    startUncertain={uncertainEnqueue.includes(task.id)}
                  />
                ) : (
                  <div className="turn-notice info" role="status">
                    <strong>Pedido salvo. Nenhuma resposta foi gerada.</strong>
                    <p>Esta conexão não executa pedidos pelo painel.</p>
                  </div>
                ))}

              <div className="turn-actions">
                {task.output && (
                  <button type="button" onClick={() => copy(task)}>
                    {copiedId === task.id ? (
                      <Check size={13} aria-hidden="true" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                    {copiedId === task.id ? "Copiado" : "Copiar"}
                  </button>
                )}
                {(phase === "failed" || phase === "incomplete") && (
                  <button
                    type="button"
                    title="Coloca o texto no campo de mensagem; nada é enviado sem a sua confirmação"
                    onClick={() => reuseInstruction(task.instruction)}
                  >
                    <PencilLine size={13} aria-hidden="true" />
                    Editar e enviar de novo
                  </button>
                )}
                <TurnDetails task={task} models={models} openTask={openTask} />
              </div>
            </div>
          </article>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
