import { useEffect, useState } from "react";
import MessageCard from "./components/MessageCard";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

interface ApiMessage {
  message: string;
  timestamp: string;
}

/**
 * Renders the main Home view for the chat app.
 *
 * @returns The Home view React component.
 */
const HomeView = () => {
  const [apiMessage, setApiMessage] = useState<ApiMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadMessage = async () => {
      try {
        const response = await authFetch(apiUrl("/api/home/message"));

        if (!response.ok) {
          throw new Error("Failed to fetch message");
        }

        const data = (await response.json()) as ApiMessage;

        if (isMounted) {
          setApiMessage(data);
        }
      } catch (caught) {
        console.error("Failed to load home message.", caught);
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Unknown error");
        }
      }
    };

    // Load the sample message once on mount.
    loadMessage();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="app">
      <header className="app__header">
        <h1>New Mimi Chat</h1>
        <p>React + Node.js (TypeScript) full-stack starter</p>
      </header>

      <MessageCard apiMessage={apiMessage} error={error} />
    </main>
  );
};

export default HomeView;
