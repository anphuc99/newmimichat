interface ApiMessage {
  message: string;
  timestamp: string;
}

interface MessageCardProps {
  apiMessage: ApiMessage | null;
  error: string | null;
}

/**
 * Renders the API message card for the Home view.
 *
 * @param props - Dependencies injected from the Home view.
 * @returns The message card component.
 */
const MessageCard = ({ apiMessage, error }: MessageCardProps) => {
  return (
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
  );
};

export default MessageCard;
