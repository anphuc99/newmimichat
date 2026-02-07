import { useState } from "react";
import ChatView from "./views/chat";
import CharactersView from "./views/characters";
import LoginView from "./views/auth";
import { clearStoredAuth, getStoredAuth, setStoredAuth, type AuthSession } from "./lib/auth";

type AppView = "chat" | "characters";

/**
 * Renders the main application view shell.
 *
 * @returns The React component for the client app.
 */
const App = () => {
  const [view, setView] = useState<AppView>("chat");
  const [auth, setAuth] = useState<AuthSession | null>(() => getStoredAuth());

  const handleAuth = (session: AuthSession) => {
    setStoredAuth(session);
    setAuth(session);
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth(null);
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
        <div className="app-nav__spacer" />
        <span className="app-nav__user">{auth.user.username}</span>
        <button type="button" className="app-nav__button" onClick={handleLogout}>
          Logout
        </button>
      </nav>

      {view === "chat" ? <ChatView /> : <CharactersView />}
    </div>
  );
};

export default App;
