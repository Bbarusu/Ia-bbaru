import { ShieldCheck } from "lucide-react";
import { Dialog } from "./Dialog";
import { taskState } from "../logic.mjs";
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

      <div className="plan-list">
        {task.plan.map((step, index) => (
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
            </p>
          </div>
        ))}
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
          A tarefa não foi concluída: {task.error}
        </div>
      )}

      {task.output && <pre className="result-text">{task.output}</pre>}

      {task.status !== "completed" &&
        task.results?.map((r, i) => (
          <details key={i} className="task-partial-result">
            <summary>Resultado parcial · {r.model_id}</summary>
            <pre className="result-text">{r.output}</pre>
          </details>
        ))}
    </Dialog>
  );
}
