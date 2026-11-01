import { MessageSquare, Settings, Share2 } from "lucide-react";
import { HiveMark } from "./HiveMark";

export type View = "chat" | "topology" | "settings";

interface NavigationProps {
  view: View;
  onChange: (view: View) => void;
}

const items: Array<{ id: View; label: string; icon: typeof MessageSquare }> = [
  { id: "chat", label: "Chats", icon: MessageSquare },
  { id: "topology", label: "Topology", icon: Share2 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function NavRail({ view, onChange }: NavigationProps): React.JSX.Element {
  return (
    <aside className="nav-rail" aria-label="Primary">
      <div className="nav-logo" title="agent hive">
        <HiveMark size={25} />
      </div>
      <nav className="nav-items">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-button${view === item.id ? " is-active" : ""}`}
              onClick={() => onChange(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={view === item.id ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.8} />
            </button>
          );
        })}
      </nav>
      <div className="nav-spacer" />
      <div className="nav-signature" aria-hidden="true">
        <span />
      </div>
    </aside>
  );
}

export function BottomNav({ view, onChange }: NavigationProps): React.JSX.Element {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav-button${view === item.id ? " is-active" : ""}`}
            onClick={() => onChange(item.id)}
            aria-label={item.label}
            aria-current={view === item.id ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}