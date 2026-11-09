import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { request } from "../transport";
import { Dialog } from "./Dialog";
import {
  describeTaskError,
  formatBilling,
  formatCancellation,
  formatFinishReason,
  formatOutputLimit,
  taskState,
} from "../logic.mjs";
import type { Model, Task } from "../types";

interface TaskViewModalProps {
  task: Task;
  models: Model[];
  close: () => void;
  executionEnabled: boolean;
  updateTask: (task: Task) => void;
  pollError: string;
}

export function TaskViewModal({ task, models, close, executionEnabled, updateTask, pollError }: TaskViewModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const canStart = executionEnabled && ["planned", "blocked"].includes(task.status);
  const active = ["queued", "running", "waiting"].includes(task.status);

  async function refresh() {
    setSubmitting(true);
    try {
      updateTask(await request<Task>("tasks.get", { task_id: task.id }));
      setNeedsRefresh(false); setError("");
    } catch { setError("Não foi possível consultar o estado. Reconecte o componente local."); }
    finally { setSubmitting(false); }
  }

  async function enqueue() {
    if (!confirmed || submitting || !canStart || needsRefresh) return;
    setSubmitting(true); setError("");
    try {
      updateTask(await request<Task>(task.status === "blocked" ? "tasks.resume" : "tasks.enqueue",
        { task_id: task.id, confirmed: true }));
      setConfirmed(false);
    } catch {
      // A lost 202 response is not permission to enqueue again.
      setNeedsRefresh(true);
      setError("Não recebemos a confirmação. Consulte o estado antes de tentar novamente.");
    } finally { setSubmitting(false); }
  }
  return (
    <Dialog title={taskState(task.status)} close={close}>
      <p className="task-instruction">{task.instruction}</p>

      {(task.gateway_protocol_version || task.allow_unenforced_output_limit) && (
        <div className="task-meta-pills">
          {task.gateway_protocol_version && (
            <span className="cap-chip">
              Contrato v{task.gateway_protocol_version}
            </span>
          )}
          {task.allow_unenforced_output_limit && (
            <span className="cap-chip">
              Limite indicativo aceito para esta tarefa
            </span>
          )}
        </div>
      )}

      <div className="plan-list">
        {task.plan.map((step, index) => {
          const caps = step.capabilities;
          return (
            <div key={index}>
              <span>{index + 1}</span>
              <p>
                <strong>
                  {step.role === "answer" ? "Resposta principal" : "Revisão"}
                </strong>
                <small>
                  {models.find((m) => m.id === step.model_id)?.label ||
                    step.model_id}
                </small>
                {caps && (
                  <small className="step-caps">
                    {formatBilling(caps.billing)} ·{" "}
                    {formatOutputLimit(
                      caps.output_limit,
                      step.max_output_tokens,
                    )}{" "}
                    · {formatCancellation(caps.cancellation)} ·{" "}
                    {formatFinishReason(caps.finish_reason)}
                  </small>
                )}
                {task.execution?.steps[index] && (
                  <small>Etapa: {taskState(task.execution.steps[index].state)} · Tentativas: {task.execution.steps[index].attempts}</small>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {task.routing && <p className="small-note">{task.routing.reason}</p>}

      {Boolean(task.context?.length) && (
        <details className="task-context-details">
          <summary>
            Materiais usados neste plano ({task.context!.length})
          </summary>
          {task.context!.map((source) => (
            <details key={source.id} className="task-source-subdetails">
              <summary>{source.title}</summary>
              <pre className="result-text">{source.content}</pre>
            </details>
          ))}
        </details>
      )}

      {task.status === "planned" && !executionEnabled && (
        <div className="alert info">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            Plano salvo. A execução durável não está disponível nesta conexão.
          </span>
        </div>
      )}

      {canStart && (
        <div className="execution-controls">
          <p className="small-note">O pedido e os materiais deste plano serão enviados aos agentes selecionados e poderão consumir a cota da sua conta.</p>
          <label className="execution-consent">
            <input type="checkbox" checked={confirmed} disabled={submitting}
              onChange={(event) => setConfirmed(event.target.checked)} />
            <span>Autorizo executar esta tarefa com minha conta</span>
          </label>
          <button type="button" className="primary" disabled={!confirmed || submitting || needsRefresh} onClick={enqueue}>
            {task.status === "blocked" ? "Retomar após corrigir" : "Executar tarefa"}
          </button>
        </div>
      )}
      {active && <p className="small-note" role="status">{taskState(task.status)}. Pode fechar este painel; mantenha o aplicativo aberto para continuar a execução.</p>}
      {task.status === "uncertain" && <p className="small-note">A geração pode ter consumido cota. Confira o resultado no provedor. Esta tarefa não será repetida.</p>}
      {(error || (active && pollError)) && <p className="alert error" role="alert">{error || pollError}</p>}
      {(needsRefresh || (active && pollError)) && <button type="button" className="subtle" disabled={submitting} onClick={refresh}>Consultar estado</button>}

      {task.error && (
        <div className="alert error" role="alert">
          {describeTaskError(task.error)}
        </div>
      )}

      {task.output && (
        <div className="task-output-block">
          {task.error === "completion_unconfirmed" && (
            <p className="small-note">
              Saída preservada para leitura (conclusão não confirmada pelo
              provedor):
            </p>
          )}
          <pre className="result-text">{task.output}</pre>
        </div>
      )}

      {task.status !== "completed" &&
        task.results?.map((r, i) => (
          <details key={i} className="task-partial-result">
            <summary>
              Resultado parcial · {r.model_id}
              {r.finish_reason
                ? ` (${formatFinishReason(r.finish_reason)})`
                : ""}
            </summary>
            <pre className="result-text">{r.output}</pre>
          </details>
        ))}
    </Dialog>
  );
}
