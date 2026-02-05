import { useEffect, useState } from "react";

interface ApiMessage {
  message: string;
  timestamp: string;
}

/**
 * Renders the main application view and fetches a sample API message.
 *
 * @returns The React component for the client app.
 */
const App = () => {
  const [apiMessage, setApiMessage] = useState<ApiMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadMessage = async () => {
      try {
        const response = await fetch("/api/message");

        if (!response.ok) {
          throw new Error("Failed to fetch message");
        }

        const data = (await response.json()) as ApiMessage;

        if (isMounted) {
          setApiMessage(data);
        }
      } catch (caught) {
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

      <section className="card">
        <h2>API Message</h2>
        {error ? (
          <p className="text-error">{error}</p>
        ) : apiMessage ? (
          <div>
            <p>{apiMessage.message}</p>
            <small>Received at {new Date(apiMessage.timestamp).toLocaleString()}</small>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </section>
    </main>
  );
};

export default App;
