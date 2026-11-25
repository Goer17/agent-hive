import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { UploadSettings } from "../../types";
import { api, ApiError } from "../../api/client";
import { toast } from "../../lib/toast";

const DEFAULT_MAX_MB = 200;

export function UploadSettingsPanel(): React.JSX.Element {
  const [settings, setSettings] = useState<UploadSettings | null>(null);
  const [value, setValue] = useState(String(DEFAULT_MAX_MB));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .uploadSettings()
      .then((next) => {
        if (cancelled) return;
        setSettings(next);
        setValue(String(next.maxFileSizeMb));
      })
      .catch((error) => {
        if (!cancelled) toast(error instanceof ApiError ? error.message : "Unable to load upload settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(): Promise<void> {
    const mb = Number(value);
    if (!Number.isInteger(mb) || mb < 1 || mb > 1024) {
      toast("File size limit must be a whole number between 1 and 1024 MB.");
      return;
    }
    setSaving(true);
    try {
      const next = await api.updateUploadSettings({ maxFileSizeMb: mb });
      setSettings(next);
      setValue(String(next.maxFileSizeMb));
      toast(`File size limit set to ${next.maxFileSizeMb} MB.`, "success");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to save upload settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-card upload-settings-card" aria-label="File uploads">
      <div className="upload-settings-copy">
        <h2>File uploads</h2>
        <p>Maximum size per file and per message. Default is 200 MB.</p>
      </div>
      {loading ? (
        <div className="settings-loading"><Loader2 size={18} className="spin" /></div>
      ) : (
        <div className="upload-settings-controls">
          <label className="upload-size-field">
            <span>Maximum size</span>
            <div className="upload-size-input">
              <input
                type="number"
                min={1}
                max={1024}
                step={1}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-label="Maximum file size in MB"
              />
              <span>MB</span>
            </div>
          </label>
          <button type="button" className="button button-primary" onClick={() => void save()} disabled={saving || Number(value) === settings?.maxFileSizeMb}>
            {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
            Save
          </button>
        </div>
      )}
    </section>
  );
}
