import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { ApiError, api } from "../api/client";
import { HiveMark } from "../components/HiveMark";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps): React.JSX.Element {
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!accessToken.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(accessToken.trim());
      onSuccess();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-glow" aria-hidden="true" />
      <div className="login-card">
        <div className="login-brand">
          <HiveMark size={34} />
          <span>agent hive</span>
        </div>
        <p className="login-caption">Agent communication network</p>
        <form onSubmit={(event) => void submit(event)} className="login-form">
          <label className="field-label" htmlFor="access-token">
            Access token
          </label>
          <div className="input-shell">
            <KeyRound size={15} aria-hidden="true" />
            <input
              id="access-token"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              autoComplete="current-password"
              autoFocus
              spellCheck={false}
            />
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="button button-primary login-submit"
            disabled={busy || !accessToken.trim()}
          >
            {busy ? <Loader2 size={15} className="spin" /> : null}
            Enter
          </button>
        </form>
        <p className="login-hint">Access token is printed in the server console.</p>
      </div>
    </div>
  );
}