import { useEffect, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import type { EmailNotificationSettings, EmailSettingsInput } from "../../types";
import { api, ApiError } from "../../api/client";
import { toast } from "../../lib/toast";

interface EmailFormState {
  enabled: boolean;
  email: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
}

const EMPTY_FORM: EmailFormState = {
  enabled: false,
  email: "",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUser: "",
  smtpFrom: "",
};

function formFromSettings(settings: EmailNotificationSettings): EmailFormState {
  return {
    enabled: settings.enabled,
    email: settings.email ?? "",
    smtpHost: settings.smtpHost ?? "",
    smtpPort: String(settings.smtpPort),
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser ?? "",
    smtpFrom: settings.smtpFrom ?? "",
  };
}

function inputFromForm(
  form: EmailFormState,
  password: string,
  clearPassword: boolean,
): EmailSettingsInput {
  const port = Number.parseInt(form.smtpPort, 10);
  return {
    enabled: form.enabled,
    email: form.email.trim(),
    smtpHost: form.smtpHost.trim(),
    smtpPort: Number.isFinite(port) ? port : 587,
    smtpSecure: form.smtpSecure,
    smtpUser: form.smtpUser.trim(),
    smtpFrom: form.smtpFrom.trim(),
    // The server overrides this with the request origin; keep a value for the
    // API type and for older servers.
    serverUrl: window.location.origin,
    ...(password.trim() ? { smtpPassword: password } : {}),
    ...(clearPassword ? { clearPassword: true } : {}),
  };
}

export function EmailSettingsPanel(): React.JSX.Element {
  const [settings, setSettings] = useState<EmailNotificationSettings | null>(null);
  const [form, setForm] = useState<EmailFormState>(EMPTY_FORM);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .emailSettings()
      .then((next) => {
        if (cancelled) return;
        setSettings(next);
        setForm(formFromSettings(next));
      })
      .catch((error) => {
        if (!cancelled) {
          toast(error instanceof ApiError ? error.message : "Unable to load email settings.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof EmailFormState>(key: K, value: EmailFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const next = await api.updateEmailSettings(inputFromForm(form, password, clearPassword));
      setSettings(next);
      setForm(formFromSettings(next));
      setPassword("");
      setClearPassword(false);
      toast("Email notifications saved.", "success");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to save email settings.");
    } finally {
      setSaving(false);
    }
  }

  async function test(): Promise<void> {
    setTesting(true);
    try {
      await api.testEmailSettings(inputFromForm(form, password, clearPassword));
      toast("Test email sent.", "success");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to send the test email.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <div className="settings-section-heading">
        <h2>Email notifications</h2>
        {settings ? (
          <span className={`settings-pill${settings.enabled ? " is-on" : ""}`}>
            {settings.enabled ? "On" : "Off"}
          </span>
        ) : null}
      </div>

      <section className="settings-card email-card" aria-label="Email notifications">
        {loading ? (
          <div className="settings-loading">
            <Loader2 size={18} className="spin" />
          </div>
        ) : (
          <>
            <div className="email-intro">
              <span className="email-intro-icon" aria-hidden="true">
                <Mail size={18} />
              </span>
              <div className="email-intro-copy">
                <h3>Push agent replies to your inbox</h3>
                <p>
                  Every agent reply is emailed by default. Right-click a chat to unsubscribe or
                  resubscribe.
                </p>
              </div>
              <label className="email-enabled">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => update("enabled", event.target.checked)}
                />
                <span>Enabled</span>
              </label>
            </div>

            {form.enabled ? (
              <>
                <div className="email-form">
                  <label className="email-field">
                    <span>Recipient email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </label>

                  <label className="email-field">
                    <span>Sender address</span>
                    <input
                      type="email"
                      value={form.smtpFrom}
                      onChange={(event) => update("smtpFrom", event.target.value)}
                      placeholder="agent-hive@example.com"
                      autoComplete="off"
                    />
                  </label>

                  <label className="email-field">
                    <span>SMTP host</span>
                    <input
                      value={form.smtpHost}
                      onChange={(event) => update("smtpHost", event.target.value)}
                      placeholder="smtp.example.com"
                      autoComplete="off"
                    />
                  </label>

                  <div className="email-field email-field-row">
                    <label className="email-field email-field-port">
                      <span>Port</span>
                      <input
                        inputMode="numeric"
                        value={form.smtpPort}
                        onChange={(event) => update("smtpPort", event.target.value)}
                        placeholder="587"
                      />
                    </label>
                    <label className="email-inline-check email-secure">
                      <input
                        type="checkbox"
                        checked={form.smtpSecure}
                        onChange={(event) => update("smtpSecure", event.target.checked)}
                      />
                      <span>Implicit TLS (usually port 465)</span>
                    </label>
                  </div>

                  <label className="email-field">
                    <span>SMTP username</span>
                    <input
                      value={form.smtpUser}
                      onChange={(event) => update("smtpUser", event.target.value)}
                      placeholder="Optional"
                      autoComplete="username"
                    />
                  </label>

                  <div className="email-field">
                    <label className="email-field-label" htmlFor="email-smtp-password">
                      SMTP password
                    </label>
                    <input
                      id="email-smtp-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        settings?.smtpPasswordSet ? "Saved — leave blank to keep" : "Optional"
                      }
                      autoComplete="new-password"
                      disabled={clearPassword}
                    />
                    {settings?.smtpPasswordSet ? (
                      <label className="email-inline-check email-clear-password">
                        <input
                          type="checkbox"
                          checked={clearPassword}
                          onChange={(event) => setClearPassword(event.target.checked)}
                        />
                        <span>Remove saved password</span>
                      </label>
                    ) : null}
                  </div>

                  <div className="email-field">
                    <span>Server URL</span>
                    <p className="email-auto-value">{settings?.serverUrl || window.location.origin}</p>
                    <small>Detected automatically from this address; used for links in emails.</small>
                  </div>
                </div>

                <div className="email-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => void test()}
                    disabled={testing || saving}
                  >
                    {testing ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                    Send test email
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => void save()}
                    disabled={saving || testing}
                  >
                    {saving ? <Loader2 size={15} className="spin" /> : null}
                    Save
                  </button>
                </div>

                <p className={`email-hint${settings?.configured ? " is-ready" : ""}`}>
                  {settings?.configured
                    ? `Ready to send to ${settings.email}.`
                    : "Set the recipient, SMTP host, and sender address to enable delivery."}
                </p>
              </>
            ) : (
              <div className="email-collapsed">
                <p>Enable email notifications to configure SMTP delivery.</p>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  {saving ? <Loader2 size={15} className="spin" /> : null}
                  Save
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
