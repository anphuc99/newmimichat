import { useEffect, useState, type ChangeEvent } from "react";
import ChatView from "./views/chat";
import CharactersView from "./views/characters";
import LoginView from "./views/auth";
import { apiUrl } from "./lib/api";
import {
  authFetch,
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  type AuthSession
} from "./lib/auth";

type AppView = "chat" | "characters";

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

  const handleAuth = (session: AuthSession) => {
    setStoredAuth(session);
    setAuth(session);
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth(null);
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
      } catch {
        // Ignore refresh errors and keep the existing session.
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
      <nav className="app-nav">
        <button
          type="button"
          className={`app-nav__button ${view === "chat" ? "active" : ""}`}
          onClick={() => setView("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={`app-nav__button ${view === "characters" ? "active" : ""}`}
          onClick={() => setView("characters")}
        >
          Characters
        </button>
        <div className="app-nav__level">
          <label>
            Level
            <select
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
          </label>
          {levelError ? <span className="app-nav__level-error">{levelError}</span> : null}
        </div>
        <div className="app-nav__spacer" />
        <span className="app-nav__user">{auth.user.username}</span>
        <button type="button" className="app-nav__button" onClick={handleLogout}>
          Logout
        </button>
      </nav>

      {view === "chat" ? <ChatView userId={auth.user.id} /> : <CharactersView userId={auth.user.id} />}
    </div>
  );
};

export default App;
