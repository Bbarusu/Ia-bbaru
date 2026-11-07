import { ArrowRight, ArrowUpRight, MessageSquare, Workflow } from "lucide-react";
import type { Task } from "../types";
import { taskState } from "../logic.mjs";

interface HistorySectionProps {
  tasks: Task[];
  viewTask: (id: string) => void;
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
    <section className="history-section" aria-labelledby="history-title">
      <h2 id="history-title" className="sr-only">
        Histórico de atividades
      </h2>
      {tasks.length ? (
        tasks.map((t) => (
          <button
            type="button"
            className="task-row card"
            key={t.id}
            onClick={() => viewTask(t.id)}
            aria-label={`Ver tarefa: ${t.instruction}`}
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
          <p>Os planos e resultados deste projeto aparecerão nesta área.</p>
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
