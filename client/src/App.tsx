import { useEffect, useState, type ChangeEvent } from "react";
import ChatView from "./views/chat";
import CharactersView from "./views/characters";
import JournalView from "./views/journal";
import StoryView from "./views/story";
import TasksView from "./views/tasks";
import TranslationView from "./views/translation";
import ListeningView from "./views/listening";
import ShadowingView from "./views/shadowing";
import VocabularyView from "./views/vocabulary";
import LoginView from "./views/auth";
import { apiUrl } from "./lib/api";
import {
  authFetch,
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  type AuthSession
} from "./lib/auth";

type AppView =
  | "chat"
  | "characters"
  | "journal"
  | "tasks"
  | "story"
  | "translation"
  | "listening"
  | "shadowing"
  | "vocabulary";
const MODEL_STORAGE_KEY = "mimi_chat_model";
const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-5-mini", "gpt-5", "gpt-5.1"];

/**
 * Describes a selectable proficiency level option.
 */
interface LevelOption {
  id: number;
  level: string;
  descript: string;
}

/**
 * Renders the main application view shell.
 *
 * @returns The React component for the client app.
 */
const App = () => {
  const [view, setView] = useState<AppView>("chat");
  const [auth, setAuth] = useState<AuthSession | null>(() => getStoredAuth());
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [levelError, setLevelError] = useState<string | null>(null);
  const [isLevelLoading, setIsLevelLoading] = useState(false);
  const [isLevelSaving, setIsLevelSaving] = useState(false);
  const [chatModel, setChatModel] = useState(() => {
    return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? "gpt-4o-mini";
  });

  const handleAuth = (session: AuthSession) => {
    setStoredAuth(session);
    setAuth(session);
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth(null);
  };
  const handleModelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value.trim();
    setChatModel(nextValue);
    window.localStorage.setItem(MODEL_STORAGE_KEY, nextValue);
  };

  useEffect(() => {
    if (!auth) {
      return;
    }

    let isActive = true;

    const loadLevels = async () => {
      setIsLevelLoading(true);
      setLevelError(null);

      try {
        const response = await authFetch(apiUrl("/api/levels"));

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "Failed to load levels");
        }

        const payload = (await response.json()) as { levels: LevelOption[] };

        if (isActive) {
          setLevels(payload.levels ?? []);
        }
      } catch (caught) {
        console.error("Failed to load levels.", caught);
        if (isActive) {
          setLevelError(caught instanceof Error ? caught.message : "Unknown error");
        }
      } finally {
        if (isActive) {
          setIsLevelLoading(false);
        }
      }
    };

    const loadProfile = async () => {
      try {
        const response = await authFetch(apiUrl("/api/users/me"));

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { user: AuthSession["user"] };

        if (payload?.user && isActive) {
          const hasChanges =
            payload.user.username !== auth.user.username ||
            payload.user.levelId !== auth.user.levelId ||
            payload.user.level !== auth.user.level ||
            payload.user.levelDescription !== auth.user.levelDescription;

          if (hasChanges) {
            const nextSession = { ...auth, user: payload.user };
            setStoredAuth(nextSession);
            setAuth(nextSession);
          }
        }
      } catch (caught) {
        console.warn("Failed to refresh profile; keeping existing session.", caught);
      }
    };

    void loadLevels();
    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [auth]);

  /**
   * Persists the selected proficiency level for the authenticated user.
   *
   * @param event - Select change event for the level dropdown.
   */
  const handleLevelChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    if (!auth) {
      return;
    }

    const nextValue = event.target.value;

    if (!nextValue) {
      return;
    }

    const levelId = Number(nextValue);

    if (!Number.isInteger(levelId)) {
      setLevelError("Invalid level");
      return;
    }

    setIsLevelSaving(true);
    setLevelError(null);

    try {
      const response = await authFetch(apiUrl("/api/users/level"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ levelId })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to update level");
      }

      const payload = (await response.json()) as AuthSession;
      setStoredAuth(payload);
      setAuth(payload);
    } catch (caught) {
      console.error("Failed to update level.", caught);
      setLevelError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsLevelSaving(false);
    }
  };

  if (!auth) {
    return <LoginView onAuth={handleAuth} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__profile">
          <div className="app-header__avatar" aria-hidden="true" />
          <div className="app-header__text">
            <div className="app-header__title">Waifu Chat</div>
            <div className="app-header__subtitle">{auth.user.username} - Online</div>
          </div>
        </div>
        <button type="button" className="app-header__logout" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="app-controls">
        <div className="app-control">
          <label htmlFor="level-selector">Level</label>
          <select
            id="level-selector"
            value={auth.user.levelId ?? ""}
            onChange={handleLevelChange}
            disabled={isLevelLoading || isLevelSaving || levels.length === 0}
          >
            <option value="">Select level</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.level}
              </option>
            ))}
          </select>
          {levelError ? <span className="app-control__error">{levelError}</span> : null}
        </div>
        <div className="app-control">
          <label htmlFor="model-selector">Model</label>
          <select id="model-selector" value={chatModel} onChange={handleModelChange}>
            {MODEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </section>

      <main className="app-main">
        {view === "chat" ? (
          <ChatView userId={auth.user.id} model={chatModel} />
        ) : view === "characters" ? (
          <CharactersView />
        ) : view === "journal" ? (
          <JournalView userId={auth.user.id} />
        ) : view === "tasks" ? (
          <TasksView />
        ) : view === "translation" ? (
          <TranslationView />
        ) : view === "listening" ? (
          <ListeningView />
        ) : view === "shadowing" ? (
          <ShadowingView />
        ) : view === "vocabulary" ? (
          <VocabularyView userId={auth.user.id} />
        ) : (
          <StoryView />
        )}
      </main>

      <nav className="app-tabs" aria-label="Primary">
        <button
          type="button"
          className={`app-tab ${view === "chat" ? "active" : ""}`}
          onClick={() => setView("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={`app-tab ${view === "characters" ? "active" : ""}`}
          onClick={() => setView("characters")}
        >
          Characters
        </button>
        <button
          type="button"
          className={`app-tab ${view === "journal" ? "active" : ""}`}
          onClick={() => setView("journal")}
        >
          Journal
        </button>
        <button
          type="button"
          className={`app-tab ${view === "tasks" ? "active" : ""}`}
          onClick={() => setView("tasks")}
        >
          Tasks
        </button>
        <button
          type="button"
          className={`app-tab ${view === "translation" ? "active" : ""}`}
          onClick={() => setView("translation")}
        >
          Translate
        </button>
        <button
          type="button"
          className={`app-tab ${view === "listening" ? "active" : ""}`}
          onClick={() => setView("listening")}
        >
          Listening
        </button>
        <button
          type="button"
          className={`app-tab ${view === "shadowing" ? "active" : ""}`}
          onClick={() => setView("shadowing")}
        >
          Shadowing
        </button>
        <button
          type="button"
          className={`app-tab ${view === "story" ? "active" : ""}`}
          onClick={() => setView("story")}
        >
          Story
        </button>
        <button
          type="button"
          className={`app-tab ${view === "vocabulary" ? "active" : ""}`}
          onClick={() => setView("vocabulary")}
        >
          Vocab
        </button>
      </nav>
    </div>
  );
};

export default App;
