import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { GeneratedToken, PublicToken } from "../types";
import { api, ApiError } from "../api/client";
import { useSseEvent } from "../lib/hooks";
import { formatTimestamp, maskToken } from "../lib/format";
import { toast } from "../lib/toast";
import { TokenModal } from "./settings/TokenModal";

export function SettingsPage(): React.JSX.Element {
  const [tokens, setTokens] = useState<PublicToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedToken | null>(null);

  const loadTokens = useCallback(async (reportError = false): Promise<void> => {
    try {
      setTokens(await api.tokens());
    } catch (error) {
      if (reportError) {
        toast(error instanceof ApiError ? error.message : "Unable to load tokens.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTokens(true);
  }, [loadTokens]);

  useSseEvent((event) => {
    if (event.type === "tokens" && !generated) void loadTokens();
  });

  async function generate(): Promise<void> {
    setGenerating(true);
    try {
      const created = await api.createToken("");
      setGenerated(created);
      setTokens((current) => [
        {
          id: created.id,
          prefix: created.prefix,
          note: created.note,
          createdAt: created.createdAt,
        },
        ...current.filter((token) => token.id !== created.id),
      ]);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to generate token.");
    } finally {
      setGenerating(false);
    }
  }

  async function closeGenerated(note: string): Promise<void> {
    const current = generated;
    setGenerated(null);
    if (!current) return;
    try {
      await api.updateTokenNote(current.id, note);
      await loadTokens();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to save token note.");
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <header className="settings-header">
          <div>
            <h1>Settings</h1>
            <p>Access tokens</p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void generate()}
            disabled={generating}
          >
            {generating ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            Generate token
          </button>
        </header>

        <section className="settings-card" aria-label="Access tokens">
          {loading ? (
            <div className="settings-loading">
              <Loader2 size={18} className="spin" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="empty-note">No tokens yet.</p>
          ) : (
            <div className="token-list">
              {tokens.map((token) => (
                <article key={token.id} className="token-row">
                  <div className="token-row-main">
                    <span className="token-note">{token.note || "No note"}</span>
                    <code className="token-mask">{maskToken(token.prefix)}</code>
                  </div>
                  <time className="token-date" dateTime={token.createdAt}>
                    {formatTimestamp(token.createdAt)}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {generated ? (
        <TokenModal token={generated} onClose={(note) => void closeGenerated(note)} />
      ) : null}
    </div>
  );
}