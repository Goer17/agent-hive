import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { TOAST_EVENT, type ToastDetail } from "../lib/toast";

interface ToastItem extends ToastDetail {
  id: number;
}

let nextId = 1;

export function ToastHost(): React.JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (event: Event): void => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      const item: ToastItem = { ...detail, id: nextId++ };
      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      }, 3600);
    };
    window.addEventListener(TOAST_EVENT, listener);
    return () => window.removeEventListener(TOAST_EVENT, listener);
  }, []);

  function dismiss(id: number): void {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <div className="toast-host" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.tone}`} role="status">
          {item.tone === "success" ? (
            <CheckCircle2 size={15} aria-hidden="true" />
          ) : (
            <AlertCircle size={15} aria-hidden="true" />
          )}
          <span>{item.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => dismiss(item.id)}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}