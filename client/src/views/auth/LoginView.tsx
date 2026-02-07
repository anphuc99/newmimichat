import { useState } from "react";
import { apiUrl } from "../../lib/api";
import type { AuthSession } from "../../lib/auth";

interface LoginViewProps {
  onAuth: (session: AuthSession) => void;
}

/**
 * Renders the login/register form for MimiChat.
 *
 * @param props - Dependencies for auth callbacks.
 * @returns The login view component.
 */
const LoginView = ({ onAuth }: LoginViewProps) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerToken, setRegisterToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    if (mode === "register" && !registerToken.trim()) {
      setError("Registration token is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        username: username.trim(),
        password: password.trim(),
        ...(mode === "register" ? { registerToken: registerToken.trim() } : {})
      };

      const response = await fetch(apiUrl(`/api/users/${mode}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to authenticate");
      }

      const payload = (await response.json()) as AuthSession;
      onAuth(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-kicker">MimiChat</p>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Sign in to manage your chats and characters."
            : "Set a username and password to begin."}
        </p>

        {error ? <p className="auth-error">{error}</p> : null}

        <label className="auth-field">
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="mimi"
          />
        </label>

        <label className="auth-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
          />
        </label>

        {mode === "register" ? (
          <label className="auth-field">
            Registration token
            <input
              type="password"
              value={registerToken}
              onChange={(event) => setRegisterToken(event.target.value)}
              placeholder="Ask the admin"
            />
          </label>
        ) : null}

        <button type="button" className="auth-submit" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Working..." : mode === "login" ? "Login" : "Register"}
        </button>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </section>
    </main>
  );
};

export default LoginView;
