import { ShieldCheck } from "lucide-react";
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
}

export function TaskViewModal({ task, models, close }: TaskViewModalProps) {
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

      {task.status === "planned" && (
        <div className="alert info">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            Plano salvo. Esta versão ainda não inicia execuções pelo painel.
          </span>
        </div>
      )}

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
