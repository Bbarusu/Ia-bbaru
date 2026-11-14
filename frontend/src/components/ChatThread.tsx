import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { request } from "../transport";
import {
  chatActivityLabel,
  chatTurnPhase,
  describeChatError,
  describeTaskError,
  formatFinishReason,
  formatOutputLimit,
  readableAnswer,
  shortModelName,
  taskState,
} from "../logic.mjs";
import type { Model, Task } from "../types";
import { YukiMark } from "./YukiMark";

export type Starter = { label: string; hint: string; run: () => void };
export type PendingMessage = { text: string; contextTitles: string[] };

interface ChatThreadProps {
  turns: Task[];
  models: Model[];
  executionEnabled: boolean;
  updateTask: (task: Task) => void;
  pollError: string;
  uncertainEnqueue: string[];
  openTask: (task: Task) => void;
  retry: (text: string) => void;
  starters: Starter[];
  welcomeText: string;
  pending: PendingMessage | null;
  confirm: ReactNode;
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Avatar() {
  return (
    <span className="turn-avatar" aria-hidden="true">
      ❄
    </span>
  );
}

function UserMessage({ text, contextTitles }: { text: string; contextTitles: string[] }) {
  return (
    <div className="turn-user">
      <p>{text}</p>
      {contextTitles.length > 0 && (
        <div className="turn-sources" aria-label="Contexto enviado">
          {contextTitles.map((title, index) => (
            <span key={`${title}-${index}`} className="source-chip" title={title}>
              <span aria-hidden="true">🌐 </span>
              {title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
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
    <div className="chat-card">
      <strong>{blocked ? "Pedido parado até a correção" : "Pedido salvo, ainda não enviado"}</strong>
      <p>
        {blocked
          ? "Corrija o problema indicado e retome. Ele ainda não foi enviado de novo."
          : "O envio usa a cota da sua conta Claude."}
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
      <div className="chat-card-actions">
        <button
          type="button"
          className="dark-button"
          disabled={!confirmed || submitting || needsRefresh}
          onClick={enqueue}
        >
          {blocked ? "Retomar após corrigir" : "Executar tarefa"}
        </button>
        {needsRefresh && (
          <button type="button" className="outline-button" disabled={submitting} onClick={refresh}>
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
        <dt>Enviado</dt>
        <dd>{timeLabel(task.created_at)}</dd>
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
  retry,
  starters,
  welcomeText,
  pending,
  confirm,
}: ChatThreadProps) {
  const [copiedId, setCopiedId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastKey = `${turns.length ? `${turns[turns.length - 1].id}:${turns[turns.length - 1].status}` : ""}:${pending ? "p" : ""}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastKey]);

  async function copy(task: Task, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(task.id);
      setTimeout(() => setCopiedId((old) => (old === task.id ? "" : old)), 1800);
    } catch {
      setCopiedId("");
    }
  }

  if (!turns.length && !pending) {
    return (
      <div className="chat-thread chat-empty">
        <div className="chat-welcome">
          <span className="welcome-mark">
            <YukiMark />
          </span>
          <h2>Como posso ajudar hoje?</h2>
          <p>{welcomeText}</p>
          <div className="chat-starters">
            {starters.map((starter) => (
              <button type="button" key={starter.label} onClick={starter.run}>
                <strong>{starter.label}</strong>
                <small>{starter.hint}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-thread" role="log" aria-label="Conversa com o Claude">
      {turns.map((task) => {
        const phase = chatTurnPhase(task);
        const info =
          describeChatError(task.error) ||
          (phase === "uncertain"
            ? describeChatError("request_outcome_uncertain")
            : phase === "failed"
              ? describeChatError("pedido_nao_concluido")
              : null);
        const model = models.find((m) => m.id === task.plan?.[0]?.model_id);
        const modelName = model ? shortModelName(model) : task.plan?.[0]?.model_id || "";
        const rawAnswer =
          task.output ||
          (phase !== "answered" ? task.results?.[task.results.length - 1]?.output : "") ||
          "";
        const answer = readableAnswer(rawAnswer, task.context);
        const finished = phase !== "working" && phase !== "awaiting_consent" && phase !== "blocked";
        const isError = Boolean(info && info.tone !== "info" && !answer);
        return (
          <article key={task.id} className="chat-turn">
            <UserMessage
              text={task.instruction}
              contextTitles={(task.context || []).map((source) => source.title)}
            />

            {phase === "working" && (
              <div className="turn-working" role="status">
                <Avatar />
                <span className="thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>{chatActivityLabel(task.status)}</span>
                {pollError && (
                  <p className="turn-error-line" role="alert">
                    {pollError}
                  </p>
                )}
              </div>
            )}

            {isError && info && (
              <div className="turn-error">
                <Avatar />
                <div className={`chat-card ${info.tone}`} role="alert">
                  <strong>{info.message}</strong>
                  <p>{info.hint}</p>
                  <div className="chat-card-actions">
                    <button
                      type="button"
                      className="outline-button"
                      title="Coloca o texto no campo de mensagem; nada é enviado sem a sua confirmação"
                      onClick={() => retry(task.instruction)}
                    >
                      Tentar novamente
                    </button>
                    <TurnDetails task={task} models={models} openTask={openTask} />
                  </div>
                </div>
              </div>
            )}

            {!isError && phase !== "working" && (
              <div className="turn-assistant">
                <div className="turn-author">
                  <Avatar />
                  <strong>Claude</strong>
                  <span>{modelName}</span>
                </div>

                {info && (
                  <div className={`chat-card ${info.tone}`} role={info.tone === "info" ? "status" : "alert"}>
                    <strong>{info.message}</strong>
                    <p>{info.hint}</p>
                  </div>
                )}

                {answer && <div className="turn-answer">{answer}</div>}

                {(phase === "awaiting_consent" || phase === "blocked") &&
                  (executionEnabled ? (
                    <TurnConsent
                      task={task}
                      updateTask={updateTask}
                      startUncertain={uncertainEnqueue.includes(task.id)}
                    />
                  ) : (
                    <div className="chat-card info" role="status">
                      <strong>Pedido salvo. Nenhuma resposta foi gerada.</strong>
                      <p>Esta conexão não executa pedidos pelo painel.</p>
                    </div>
                  ))}

                <div className="turn-actions">
                  {answer && (
                    <button type="button" onClick={() => copy(task, answer)}>
                      {copiedId === task.id ? (
                        <Check size={13} aria-hidden="true" />
                      ) : (
                        <Copy size={13} aria-hidden="true" />
                      )}
                      {copiedId === task.id ? "Copiado" : "Copiar"}
                    </button>
                  )}
                  {finished && (
                    <button
                      type="button"
                      title="Coloca o texto no campo de mensagem; nada é enviado sem a sua confirmação"
                      onClick={() => retry(task.instruction)}
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      Tentar novamente
                    </button>
                  )}
                  <TurnDetails task={task} models={models} openTask={openTask} />
                </div>
              </div>
            )}
          </article>
        );
      })}

      {pending && (
        <article className="chat-turn pending-turn">
          <UserMessage text={pending.text} contextTitles={pending.contextTitles} />
          {confirm}
        </article>
      )}
      <div ref={endRef} />
    </div>
  );
}
