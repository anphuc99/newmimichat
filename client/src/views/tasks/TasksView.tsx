import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

interface TaskItem {
  id: string;
  label: string;
  type: "count" | "clear_due";
  progress: number;
  target: number;
  remaining: number;
  completed: boolean;
}

interface TasksResponse {
  date: string;
  tasks: TaskItem[];
  completedCount: number;
  totalCount: number;
}

/**
 * Renders the daily task checklist.
 *
 * @returns The Tasks view React component.
 */
const TasksView = () => {
  const [payload, setPayload] = useState<TasksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadTasks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authFetch(apiUrl("/api/tasks/today"));

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(errorPayload?.message ?? "Failed to load tasks");
        }

        const data = (await response.json()) as TasksResponse;

        if (isActive) {
          setPayload(data);
        }
      } catch (caught) {
        console.error("Failed to load tasks.", caught);
        if (isActive) {
          setError(caught instanceof Error ? caught.message : "Unknown error");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadTasks();

    return () => {
      isActive = false;
    };
  }, []);

  const tasks = payload?.tasks ?? [];

  const completionLabel = useMemo(() => {
    if (!payload) {
      return "";
    }

    return `${payload.completedCount}/${payload.totalCount} nhiem vu hoan thanh`;
  }, [payload]);

  return (
    <main className="tasks-shell">
      <header className="tasks-header">
        <div>
          <h1>Nhiem vu hom nay</h1>
          {payload ? <p className="tasks-date">{payload.date}</p> : null}
        </div>
        {payload ? <span className="tasks-summary">{completionLabel}</span> : null}
      </header>

      {error ? <p className="tasks-error">{error}</p> : null}

      {isLoading ? (
        <p className="tasks-loading">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="tasks-empty">Chua co nhiem vu cho hom nay.</p>
      ) : (
        <section className="tasks-grid">
          {tasks.map((task) => {
            const percent =
              task.type === "count" && task.target > 0
                ? Math.min((task.progress / task.target) * 100, 100)
                : 0;

            return (
              <article key={task.id} className={`tasks-card ${task.completed ? "is-complete" : ""}`}>
                <div className="tasks-card__header">
                  <h2 className="tasks-card__label">{task.label}</h2>
                  <span className={`tasks-tag ${task.completed ? "is-complete" : ""}`}>
                    {task.completed ? "Hoan thanh" : "Dang lam"}
                  </span>
                </div>

                {task.type === "count" ? (
                  <div className="tasks-card__meta">
                    <span>
                      {task.progress}/{task.target}
                    </span>
                    <span>Con lai: {task.remaining}</span>
                  </div>
                ) : (
                  <div className="tasks-card__meta">
                    <span>Con lai: {task.remaining}</span>
                    <span>{task.remaining === 0 ? "Da on het" : "Can on"}</span>
                  </div>
                )}

                <div className="tasks-bar">
                  <div className="tasks-bar__fill" style={{ width: `${percent}%` }} />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
};

export default TasksView;
