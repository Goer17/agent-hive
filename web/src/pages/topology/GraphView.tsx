import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { TopologyAgent, TopologyEdge } from "../../types";
import { Avatar } from "../../components/Avatar";
import { HiveMark } from "../../components/HiveMark";
import { avatarUrl } from "../../lib/format";

interface GraphViewProps {
  agents: TopologyAgent[];
  edges: TopologyEdge[];
  selectedEdgeId: string | null;
  onConnect: (a: string, b: string) => Promise<boolean>;
  onEdgeClick: (edge: TopologyEdge) => void;
  onEdgeMenu: (edge: TopologyEdge, x: number, y: number) => void;
  onPositionsChange: (positions: Record<string, { x: number; y: number }>) => void;
}

interface Point {
  x: number;
  y: number;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.2;
const DOUBLE_CLICK_MS = 500;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function GraphView({
  agents,
  edges,
  selectedEdgeId,
  onConnect,
  onEdgeClick,
  onEdgeMenu,
  onPositionsChange,
}: GraphViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState<Record<string, Point>>(() =>
    Object.fromEntries(agents.map((agent) => [agent.sessionId, agent.graph])),
  );
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const hasFittedRef = useRef(false);
  const draggingNodeRef = useRef(false);
  const lastNodeClickRef = useRef<{ agentId: string; at: number } | null>(null);

  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pendingSourceRef = useRef(pendingSourceId);
  pendingSourceRef.current = pendingSourceId;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPositions((current) => {
      if (draggingNodeRef.current) return current;
      const next: Record<string, Point> = {};
      for (const agent of agents) {
        next[agent.sessionId] = current[agent.sessionId] ?? agent.graph;
      }
      return next;
    });
    setPendingSourceId((current) =>
      current && agents.some((agent) => agent.sessionId === current) ? current : null,
    );
  }, [agents]);

  const fitView = useCallback(() => {
    const current = positionsRef.current;
    const points = Object.values(current);
    if (points.length === 0 || size.width === 0 || size.height === 0) {
      setPan({ x: size.width / 2, y: size.height / 2 });
      setZoom(1);
      return;
    }

    const minX = Math.min(...points.map((point) => point.x)) - 90;
    const maxX = Math.max(...points.map((point) => point.x)) + 90;
    const minY = Math.min(...points.map((point) => point.y)) - 90;
    const maxY = Math.max(...points.map((point) => point.y)) + 120;
    const scale = clamp(
      Math.min(size.width / (maxX - minX), size.height / (maxY - minY)),
      MIN_ZOOM,
      1.25,
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setZoom(scale);
    setPan({ x: size.width / 2 - centerX * scale, y: size.height / 2 - centerY * scale });
  }, [size.height, size.width]);

  useLayoutEffect(() => {
    if (!hasFittedRef.current && size.width > 0 && size.height > 0 && agents.length > 0) {
      hasFittedRef.current = true;
      fitView();
    }
  }, [agents.length, fitView, size.height, size.width]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const previousZoom = zoomRef.current;
      const nextZoom = clamp(
        previousZoom * Math.exp(-event.deltaY * 0.0014),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const previousPan = panRef.current;
      setZoom(nextZoom);
      setPan({
        x: pointerX - ((pointerX - previousPan.x) * nextZoom) / previousZoom,
        y: pointerY - ((pointerY - previousPan.y) * nextZoom) / previousZoom,
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setPendingSourceId(null);
        lastNodeClickRef.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const clientToWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  function beginPan(event: React.PointerEvent<SVGRectElement>): void {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    const origin = { ...panRef.current };
    let moved = false;

    const onMove = (moveEvent: PointerEvent): void => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      setPan({ x: origin.x + dx, y: origin.y + dy });
    };
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!moved) {
        setPendingSourceId(null);
        lastNodeClickRef.current = null;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startLink(agent: TopologyAgent): void {
    setPendingSourceId(agent.sessionId);
    const position = positionsRef.current[agent.sessionId];
    if (position) setCursor(position);
  }

  function beginNodeDrag(event: React.PointerEvent<SVGGElement>, agent: TopologyAgent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const startClient = { x: event.clientX, y: event.clientY };
    const startPosition = positionsRef.current[agent.sessionId] ?? agent.graph;
    let moved = false;
    let latest = startPosition;
    draggingNodeRef.current = true;

    const onMove = (moveEvent: PointerEvent): void => {
      const dx = (moveEvent.clientX - startClient.x) / zoomRef.current;
      const dy = (moveEvent.clientY - startClient.y) / zoomRef.current;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        setHoveredAgentId(null);
      }
      if (!moved) return;
      latest = { x: startPosition.x + dx, y: startPosition.y + dy };
      setPositions((current) => ({ ...current, [agent.sessionId]: latest }));
    };

    const cleanup = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      draggingNodeRef.current = false;
    };

    const onUp = (): void => {
      cleanup();
      if (moved) {
        lastNodeClickRef.current = null;
        onPositionsChange({ [agent.sessionId]: latest });
        return;
      }

      if (pendingSourceRef.current) {
        if (pendingSourceRef.current !== agent.sessionId) {
          const source = pendingSourceRef.current;
          setPendingSourceId(null);
          lastNodeClickRef.current = null;
          void onConnect(source, agent.sessionId);
        } else {
          lastNodeClickRef.current = null;
        }
        return;
      }

      const now = Date.now();
      const last = lastNodeClickRef.current;
      if (last && last.agentId === agent.sessionId && now - last.at <= DOUBLE_CLICK_MS) {
        lastNodeClickRef.current = null;
        startLink(agent);
      } else {
        lastNodeClickRef.current = { agentId: agent.sessionId, at: now };
      }
    };

    const onCancel = (): void => {
      cleanup();
      lastNodeClickRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function changeZoom(factor: number): void {
    const previousZoom = zoomRef.current;
    const nextZoom = clamp(previousZoom * factor, MIN_ZOOM, MAX_ZOOM);
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const previousPan = panRef.current;
    setZoom(nextZoom);
    setPan({
      x: centerX - ((centerX - previousPan.x) * nextZoom) / previousZoom,
      y: centerY - ((centerY - previousPan.y) * nextZoom) / previousZoom,
    });
  }

  const hoveredAgent = agents.find((agent) => agent.sessionId === hoveredAgentId) ?? null;
  const hoveredPosition = hoveredAgent ? positions[hoveredAgent.sessionId] : null;
  const pendingAgent = pendingSourceId
    ? agents.find((agent) => agent.sessionId === pendingSourceId) ?? null
    : null;
  const pendingPosition = pendingSourceId ? positions[pendingSourceId] : null;

  const tooltipStyle = (() => {
    if (!hoveredPosition || size.width === 0) return { display: "none" };
    const screenX = pan.x + hoveredPosition.x * zoom;
    const screenY = pan.y + hoveredPosition.y * zoom;
    return {
      left: clamp(screenX + 54, 12, Math.max(12, size.width - 274)),
      top: clamp(screenY - 48, 12, Math.max(12, size.height - 220)),
    };
  })();

  return (
    <div
      ref={containerRef}
      className={`graph-canvas${pendingSourceId ? " is-linking" : ""}`}
      onPointerMove={(event) => {
        if (pendingSourceId) setCursor(clientToWorld(event.clientX, event.clientY));
      }}
      onPointerLeave={() => {
        setHoveredAgentId(null);
        setHoveredEdgeId(null);
      }}
      onContextMenuCapture={(event) => {
        if (pendingSourceRef.current) {
          event.preventDefault();
          event.stopPropagation();
          setPendingSourceId(null);
          lastNodeClickRef.current = null;
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg width={size.width} height={size.height} className="graph-svg" role="img" aria-label="Agent topology">
        <defs>
          {agents.map((agent) => (
            <clipPath id={`clip-${agent.sessionId}`} key={agent.sessionId}>
              <circle cx="0" cy="0" r="29" />
            </clipPath>
          ))}
        </defs>
        <rect
          className="graph-background"
          width="100%"
          height="100%"
          onPointerDown={beginPan}
        />
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <g className="graph-edges">
            {edges.map((edge) => {
              const first = positions[edge.a];
              const second = positions[edge.b];
              if (!first || !second) return null;
              const active = selectedEdgeId === edge.id || hoveredEdgeId === edge.id;
              const midX = (first.x + second.x) / 2;
              const midY = (first.y + second.y) / 2;
              return (
                <g key={edge.id} className="graph-edge">
                  <line
                    x1={first.x}
                    y1={first.y}
                    x2={second.x}
                    y2={second.y}
                    className={`edge-line${active ? " is-active" : ""}`}
                  />
                  <circle cx={midX} cy={midY} r="3.2" className={`edge-dot${active ? " is-active" : ""}`} />
                  <line
                    x1={first.x}
                    y1={first.y}
                    x2={second.x}
                    y2={second.y}
                    className="edge-hit"
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerEnter={() => setHoveredEdgeId(edge.id)}
                    onPointerLeave={() => setHoveredEdgeId((current) => (current === edge.id ? null : current))}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (pendingSourceRef.current) {
                        setPendingSourceId(null);
                        lastNodeClickRef.current = null;
                        return;
                      }
                      onEdgeClick(edge);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onEdgeMenu(edge, event.clientX, event.clientY);
                    }}
                  />
                </g>
              );
            })}
          </g>

          {pendingSourceId && pendingPosition ? (
            <line
              x1={pendingPosition.x}
              y1={pendingPosition.y}
              x2={cursor?.x ?? pendingPosition.x}
              y2={cursor?.y ?? pendingPosition.y}
              className="pending-edge"
            />
          ) : null}

          {agents.map((agent) => {
            const position = positions[agent.sessionId] ?? agent.graph;
            const isSource = pendingSourceId === agent.sessionId;
            const isTarget =
              Boolean(pendingSourceId) && hoveredAgentId === agent.sessionId && !isSource;
            return (
              <g
                key={agent.sessionId}
                className={[
                  "graph-node",
                  isSource ? "is-source" : "",
                  isTarget ? "is-target" : "",
                  hoveredAgentId === agent.sessionId ? "is-hovered" : "",
                ].join(" ")}
                transform={`translate(${position.x} ${position.y})`}
                onPointerDown={(event) => beginNodeDrag(event, agent)}
                onPointerEnter={() => setHoveredAgentId(agent.sessionId)}
                onPointerLeave={() =>
                  setHoveredAgentId((current) => (current === agent.sessionId ? null : current))
                }
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPendingSourceId(null);
                  lastNodeClickRef.current = null;
                }}
              >
                <circle r="48" fill="transparent" />
                <circle r="36" className="node-halo" />
                <circle r="31" className="node-ring" />
                <image
                  href={avatarUrl(agent.avatar)}
                  x="-29"
                  y="-29"
                  width="58"
                  height="58"
                  clipPath={`url(#clip-${agent.sessionId})`}
                  preserveAspectRatio="xMidYMid slice"
                />
                <text className="node-name" textAnchor="middle" y="54">
                  {agent.name}
                </text>
                <text className="node-task" textAnchor="middle" y="70">
                  {agent.task.length > 22 ? `${agent.task.slice(0, 22)}…` : agent.task}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {agents.length === 0 ? (
        <div className="graph-empty">
          <HiveMark size={30} />
          <p>No agents yet.</p>
        </div>
      ) : null}

      {hoveredAgent && hoveredPosition ? (
        <div className="graph-tooltip" style={tooltipStyle}>
          <div className="graph-tooltip-heading">
            <Avatar avatar={hoveredAgent.avatar} size={30} alt="" />
            <div>
              <strong>{hoveredAgent.name}</strong>
              <span>{hoveredAgent.task}</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>host</dt>
              <dd>{hoveredAgent.host}</dd>
            </div>
            <div>
              <dt>workspace</dt>
              <dd>{hoveredAgent.workspace}</dd>
            </div>
            <div>
              <dt>session_id</dt>
              <dd>{hoveredAgent.sessionId}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="graph-controls">
        <button type="button" className="graph-control" onClick={fitView} title="Fit graph" aria-label="Fit graph">
          <Maximize2 size={15} />
        </button>
        <button type="button" className="graph-control" onClick={() => changeZoom(1.2)} title="Zoom in" aria-label="Zoom in">
          <Plus size={15} />
        </button>
        <button type="button" className="graph-control" onClick={() => changeZoom(1 / 1.2)} title="Zoom out" aria-label="Zoom out">
          <Minus size={15} />
        </button>
      </div>

      <div className={`graph-hint${pendingSourceId ? " is-active" : ""}`} aria-live="polite">
        {pendingSourceId
          ? `Click another agent to connect to ${pendingAgent?.name ?? "this agent"}. Esc cancels.`
          : "Double-click an agent to start a connection."}
      </div>
    </div>
  );
}
