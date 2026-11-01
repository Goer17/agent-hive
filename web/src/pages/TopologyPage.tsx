import { useCallback, useEffect, useState } from "react";
import { Folder, Loader2, Trash2, UsersRound } from "lucide-react";
import type { Category, Topology, TopologyAgent, TopologyEdge } from "../types";
import { api, ApiError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ContextMenu } from "../components/ContextMenu";
import { useMediaQuery, useSseEvent } from "../lib/hooks";
import { toast } from "../lib/toast";
import { ContactSidebar } from "./topology/ContactSidebar";
import { EdgeConversationPanel } from "./topology/EdgeConversationPanel";
import { GraphView } from "./topology/GraphView";

export function TopologyPage(): React.JSX.Element {
  const isMobile = useMediaQuery("(max-width: 820px)");
  const [topology, setTopology] = useState<Topology | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ edge: TopologyEdge; x: number; y: number } | null>(null);
  const [moveMenu, setMoveMenu] = useState<{ agent: TopologyAgent; x: number; y: number } | null>(null);
  const [confirmEdge, setConfirmEdge] = useState<TopologyEdge | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  const refresh = useCallback(async (reportError = false): Promise<void> => {
    try {
      setTopology(await api.topology());
    } catch (error) {
      if (reportError) {
        toast(error instanceof ApiError ? error.message : "Unable to load topology.");
      }
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!topology || !selectedEdgeId) return;
    if (!topology.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [selectedEdgeId, topology]);

  useSseEvent((event) => {
    if (event.type === "topology" || event.type === "agents") {
      void refresh();
    }
  });

  async function connect(first: string, second: string): Promise<boolean> {
    try {
      await api.createEdge(first, second);
      await refresh();
      return true;
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to connect agents.");
      return false;
    }
  }

  async function persistPositions(positions: Record<string, { x: number; y: number }>): Promise<void> {
    try {
      await api.updatePositions(positions);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to save graph position.");
      void refresh();
    }
  }

  async function createCategory(name: string): Promise<void> {
    try {
      await api.createCategory(name);
      await refresh();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to create category.");
      throw error;
    }
  }

  async function renameCategory(categoryId: string, name: string): Promise<void> {
    try {
      await api.renameCategory(categoryId, name);
      await refresh();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to rename category.");
      throw error;
    }
  }

  async function assignAgent(agentId: string, categoryId: string): Promise<void> {
    try {
      await api.updateAgent(agentId, { categoryId });
      await refresh();
      if (isMobile) setContactsOpen(false);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to move agent.");
    }
  }

  async function removeCategory(): Promise<void> {
    if (!deleteCategory) return;
    setDeleting(true);
    try {
      await api.deleteCategory(deleteCategory.id);
      setDeleteCategory(null);
      await refresh();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to delete category.");
    } finally {
      setDeleting(false);
    }
  }

  async function removeEdge(): Promise<void> {
    if (!confirmEdge) return;
    setDeleting(true);
    try {
      await api.deleteEdge(confirmEdge.id);
      setConfirmEdge(null);
      setSelectedEdgeId(null);
      await refresh();
      toast("Connection deleted.", "success");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to delete connection.");
    } finally {
      setDeleting(false);
    }
  }

  const selectedEdge = topology?.edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  return (
    <div className="topology-page">
      {topology ? (
        <div className={`topology-sidebar-wrap${contactsOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="drawer-scrim"
            aria-label="Close contacts"
            onClick={() => setContactsOpen(false)}
          />
          <ContactSidebar
            agents={topology.agents}
            categories={topology.categories}
            onAssign={assignAgent}
            onCreate={createCategory}
            onRename={renameCategory}
            onDelete={setDeleteCategory}
            onMoveMenu={(agent, x, y) => setMoveMenu({ agent, x, y })}
            onClose={() => setContactsOpen(false)}
          />
        </div>
      ) : null}

      <section className="topology-canvas-panel">
        <div className="topology-mobile-bar">
          <button
            type="button"
            className="mobile-panel-button"
            onClick={() => setContactsOpen(true)}
          >
            <UsersRound size={16} />
            Contacts
          </button>
          <span className="topology-mobile-title">Topology</span>
        </div>
        {topology ? (
          <GraphView
            agents={topology.agents}
            edges={topology.edges}
            selectedEdgeId={selectedEdgeId}
            onConnect={connect}
            onEdgeClick={(edge) => setSelectedEdgeId(edge.id)}
            onEdgeMenu={(edge, x, y) => setEdgeMenu({ edge, x, y })}
            onPositionsChange={(positions) => void persistPositions(positions)}
          />
        ) : (
          <div className="topology-loading">
            <Loader2 size={20} className="spin" />
          </div>
        )}

        {selectedEdge ? (
          <EdgeConversationPanel
            edge={selectedEdge}
            agents={topology?.agents ?? []}
            onClose={() => setSelectedEdgeId(null)}
            onDeleteRequest={(edge) => setConfirmEdge(edge)}
          />
        ) : null}
      </section>

      {edgeMenu ? (
        <ContextMenu
          x={edgeMenu.x}
          y={edgeMenu.y}
          onClose={() => setEdgeMenu(null)}
          items={[
            {
              label: "Delete",
              icon: <Trash2 size={14} />,
              danger: true,
              onSelect: () => setConfirmEdge(edgeMenu.edge),
            },
          ]}
        />
      ) : null}

      {moveMenu && topology ? (
        <ContextMenu
          x={moveMenu.x}
          y={moveMenu.y}
          onClose={() => setMoveMenu(null)}
          items={topology.categories.map((category) => ({
            label: category.name,
            icon: <Folder size={14} />,
            checked: moveMenu.agent.categoryId === category.id,
            onSelect: () => void assignAgent(moveMenu.agent.sessionId, category.id),
          }))}
        />
      ) : null}

      {confirmEdge ? (
        <ConfirmDialog
          title="Delete connection?"
          description="The connection will be removed and its conversation cleared."
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={() => void removeEdge()}
          onCancel={() => setConfirmEdge(null)}
        />
      ) : null}

      {deleteCategory ? (
        <ConfirmDialog
          title="Delete category?"
          description={`${deleteCategory.name} will be removed. Its agents move to Uncategorized.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={() => void removeCategory()}
          onCancel={() => setDeleteCategory(null)}
        />
      ) : null}
    </div>
  );
}