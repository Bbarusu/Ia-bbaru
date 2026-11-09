import {
  ArrowRight,
  ArrowUpRight,
  MessageSquare,
  Workflow,
} from "lucide-react";
import { taskState } from "../logic.mjs";
import type { Task } from "../types";

interface HistorySectionProps {
  tasks: Task[];
  viewTask: (taskId: string) => void;
  taskNext: number | null;
  loadMoreTasks: () => void;
  goToWorkspace: () => void;
  busy: boolean;
}

export function HistorySection({
  tasks,
  viewTask,
  taskNext,
  loadMoreTasks,
  goToWorkspace,
  busy,
}: HistorySectionProps) {
  return (
    <section className="history-section">
      {tasks.length > 0 ? (
        tasks.map((t) => (
          <button
            type="button"
            className="task-row card"
            key={t.id}
            onClick={() => viewTask(t.id)}
          >
            <span className="card-icon" aria-hidden="true">
              <MessageSquare size={20} />
            </span>
            <span>
              <strong>{t.instruction}</strong>
              <small>{new Date(t.created_at).toLocaleString("pt-BR")}</small>
            </span>
            <span className={`task-status ${t.status}`}>
              {taskState(t.status)}
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        ))
      ) : (
        <div className="empty-library card">
          <Workflow size={34} aria-hidden="true" />
          <h3>Seu próximo passo começa aqui.</h3>
          <p>
            Os planos e resultados deste projeto aparecerão nesta área.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={goToWorkspace}
          >
            Voltar ao pedido <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {taskNext !== null && (
        <button
          type="button"
          className="subtle load-more"
          onClick={loadMoreTasks}
          disabled={busy}
        >
          Carregar mais tarefas
        </button>
      )}
    </section>
  );
}
