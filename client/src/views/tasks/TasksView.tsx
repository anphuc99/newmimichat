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
          throw new Error(errorPayload?.message ?? "Không thể tải nhiệm vụ");
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

    return `${payload.completedCount}/${payload.totalCount} nhiệm vụ hoàn thành`;
  }, [payload]);

  return (
    <main className="tasks-shell">
      <header className="tasks-header">
        <div>
          <h1>Nhiệm vụ hôm nay</h1>
          {payload ? <p className="tasks-date">{payload.date}</p> : null}
        </div>
        {payload ? <span className="tasks-summary">{completionLabel}</span> : null}
      </header>

      {error ? <p className="tasks-error">{error}</p> : null}

      {isLoading ? (
        <p className="tasks-loading">Đang tải...</p>
      ) : tasks.length === 0 ? (
        <p className="tasks-empty">Chưa có nhiệm vụ cho hôm nay.</p>
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
                    {task.completed ? "Hoàn thành" : "Đang làm"}
                  </span>
                </div>

                {task.type === "count" ? (
                  <div className="tasks-card__meta">
                    <span>
                      {task.progress}/{task.target}
                    </span>
                    <span>Còn lại: {task.remaining}</span>
                  </div>
                ) : (
                  <div className="tasks-card__meta">
                    <span>Còn lại: {task.remaining}</span>
                    <span>{task.remaining === 0 ? "Đã ôn hết" : "Cần ôn"}</span>
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
