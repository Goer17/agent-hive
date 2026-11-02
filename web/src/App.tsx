import { useEffect, useState } from "react";
import { applyTheme, readThemeMode, type ThemeMode } from "./lib/theme";
import { api, UNAUTHORIZED_EVENT } from "./api/client";
import type { SseEventDetail } from "./types";
import { BottomNav, NavRail, type View } from "./components/Navigation";
import { ToastHost } from "./components/ToastHost";
import { HiveMark } from "./components/HiveMark";
import { LoginPage } from "./pages/LoginPage";
import { ChatPage } from "./pages/ChatPage";
import { TopologyPage } from "./pages/TopologyPage";
import { SettingsPage } from "./pages/SettingsPage";

type AuthState = "loading" | "authenticated" | "unauthenticated";

const VALID_VIEWS: View[] = ["chat", "topology", "settings"];

function viewFromHash(): View {
  const value = window.location.hash.replace(/^#\/?/, "");
  return VALID_VIEWS.includes(value as View) ? (value as View) : "chat";
}

export function App(): React.JSX.Element {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [view, setView] = useState<View>(viewFromHash);
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemeMode);

  useEffect(() => {
    applyTheme(themeMode);
    if (themeMode !== "auto") return;
    const interval = window.setInterval(() => applyTheme("auto", false), 60_000);
    return () => window.clearInterval(interval);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;
    api
      .status()
      .then((result) => {
        if (!cancelled) setAuth(result.authenticated ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!cancelled) setAuth("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = (): void => setAuth("unauthenticated");
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    const onHashChange = (): void => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (auth !== "authenticated") return;
    const source = new EventSource("/api/events");
    const types: Array<SseEventDetail["type"]> = ["agents", "topology", "message", "tokens"];
    const listeners = types.map((type) => {
      const listener = (event: MessageEvent): void => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          data = {};
        }
        window.dispatchEvent(
          new CustomEvent<SseEventDetail>("hive:sse", { detail: { type, data } }),
        );
      };
      source.addEventListener(type, listener);
      return { type, listener };
    });
    return () => {
      for (const { type, listener } of listeners) {
        source.removeEventListener(type, listener);
      }
      source.close();
    };
  }, [auth]);

  function changeView(next: View): void {
    setView(next);
    const hash = `#/${next}`;
    if (window.location.hash !== hash) window.location.hash = hash;
  }

  if (auth === "loading") {
    return (
      <div className="splash">
        <HiveMark size={36} />
      </div>
    );
  }

  if (auth === "unauthenticated") {
    return (
      <>
        <LoginPage
          onSuccess={() => {
            setAuth("authenticated");
            changeView("chat");
          }}
        />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <div className="app">
        <main className="app-main">
          <div className={`view${view === "chat" ? " is-active" : ""}`}>
            <ChatPage />
          </div>
          <div className={`view${view === "topology" ? " is-active" : ""}`}>
            <TopologyPage />
          </div>
          <div className={`view${view === "settings" ? " is-active" : ""}`}>
            <SettingsPage themeMode={themeMode} onThemeModeChange={setThemeMode} />
          </div>
        </main>
        <NavRail view={view} onChange={changeView} />
        <BottomNav view={view} onChange={changeView} />
      </div>
      <ToastHost />
    </>
  );
}