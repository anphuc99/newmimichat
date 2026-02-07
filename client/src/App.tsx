import { useState } from "react";
import ChatView from "./views/chat";
import CharactersView from "./views/characters";

type AppView = "chat" | "characters";

/**
 * Renders the main application view shell.
 *
 * @returns The React component for the client app.
 */
const App = () => {
  const [view, setView] = useState<AppView>("chat");

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
      </nav>

      {view === "chat" ? <ChatView /> : <CharactersView />}
    </div>
  );
};

export default App;
