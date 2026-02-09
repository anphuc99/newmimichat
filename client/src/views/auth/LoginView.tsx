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
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [registerToken, setRegisterToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleModeChange = (nextMode: "login" | "register" | "reset") => {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (mode === "reset") {
      if (!newPassword.trim()) {
        setError("New password is required");
        return;
      }
      if (!registerToken.trim()) {
        setError("Registration token is required");
        return;
      }
    } else {
      if (!password.trim()) {
        setError("Password is required");
        return;
      }
      if (mode === "register" && !registerToken.trim()) {
        setError("Registration token is required");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = mode === "reset" ? "reset-password" : mode;
      const requestPayload =
        mode === "reset"
          ? {
              username: username.trim(),
              newPassword: newPassword.trim(),
              registerToken: registerToken.trim()
            }
          : {
              username: username.trim(),
              password: password.trim(),
              ...(mode === "register" ? { registerToken: registerToken.trim() } : {})
            };

      const response = await fetch(apiUrl(`/api/users/${endpoint}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorPayload?.message ?? "Failed to authenticate");
      }

      if (mode === "reset") {
        await response.json().catch(() => null);
        setSuccess("Mật khẩu đã được cập nhật. Hãy đăng nhập lại.");
        handleModeChange("login");
        setPassword("");
        setNewPassword("");
        return;
      }

      const session = (await response.json()) as AuthSession;
      onAuth(session);
    } catch (caught) {
      console.error("Failed to authenticate.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-kicker">MimiChat</p>
        <h1>
          {mode === "login"
            ? "Welcome back"
            : mode === "register"
              ? "Create your account"
              : "Quên mật khẩu"}
        </h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Sign in to manage your chats and characters."
            : mode === "register"
              ? "Set a username and password to begin."
              : "Nhập token và mật khẩu mới để đổi mật khẩu."}
        </p>

        {error ? <p className="auth-error">{error}</p> : null}
        {success ? <p className="auth-success">{success}</p> : null}

        <label className="auth-field">
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="mimi"
          />
        </label>

        {mode !== "reset" ? (
          <label className="auth-field">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>
        ) : (
          <label className="auth-field">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>
        )}

        {mode === "register" || mode === "reset" ? (
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
          {isSubmitting
            ? "Working..."
            : mode === "login"
              ? "Login"
              : mode === "register"
                ? "Register"
                : "Reset password"}
        </button>

        <div className="auth-actions">
          {mode !== "reset" ? (
            <button
              type="button"
              className="auth-toggle"
              onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
            </button>
          ) : null}

          {mode === "login" ? (
            <button type="button" className="auth-toggle" onClick={() => handleModeChange("reset")}>
              Quên mật khẩu
            </button>
          ) : mode === "reset" ? (
            <button type="button" className="auth-toggle" onClick={() => handleModeChange("login")}>
              Quay lại đăng nhập
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
};

export default LoginView;
