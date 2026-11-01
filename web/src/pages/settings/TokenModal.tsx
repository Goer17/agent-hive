import { useEffect, useState } from "react";
import { Check, Copy, StickyNote } from "lucide-react";
import type { GeneratedToken } from "../../types";
import { copyText } from "../../lib/clipboard";
import { Modal } from "../../components/Modal";

interface TokenModalProps {
  token: GeneratedToken;
  onClose: (note: string) => void;
}

export function TokenModal({ token, onClose }: TokenModalProps): React.JSX.Element {
  const [note, setNote] = useState(token.note);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const masked = `${token.prefix}-${"*".repeat(12)}`;

  return (
    <Modal title="Agent token" onClose={() => onClose(note)} className="modal-small">
      <div className="token-reveal">
        <code>{masked}</code>
        <button
          type="button"
          className="icon-button"
          aria-label="Copy token"
          title="Copy token"
          onClick={() => {
            void copyText(token.token).then((success) => {
              if (success) setCopied(true);
            });
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <p className="token-once">Only shown once.</p>

      <label className="field-label" htmlFor="token-note">
        Note
      </label>
      <div className="input-shell">
        <StickyNote size={15} aria-hidden="true" />
        <input
          id="token-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          autoFocus
        />
      </div>

      <div className="modal-actions">
        <button type="button" className="button button-primary" onClick={() => onClose(note)}>
          Done
        </button>
      </div>
    </Modal>
  );
}