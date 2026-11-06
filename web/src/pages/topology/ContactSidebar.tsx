import { useRef, useState } from "react";
import {
  Check,
  Ellipsis,
  Plus,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import type { Category, TopologyAgent } from "../../types";
import { Avatar } from "../../components/Avatar";
import { HarnessIcon } from "../../components/HarnessIcon";

interface ContactSidebarProps {
  agents: TopologyAgent[];
  categories: Category[];
  onAssign: (agentId: string, categoryId: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onRename: (categoryId: string, name: string) => Promise<void>;
  onDelete: (category: Category) => void;
  onMoveMenu: (agent: TopologyAgent, x: number, y: number) => void;
  onClose?: () => void;
}

export function ContactSidebar({
  agents,
  categories,
  onAssign,
  onCreate,
  onRename,
  onDelete,
  onMoveMenu,
  onClose,
}: ContactSidebarProps): React.JSX.Element {
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const orderedCategories = [...categories].sort((left, right) => left.order - right.order);
  const knownCategoryIds = new Set(categories.map((category) => category.id));

  async function submitCreate(): Promise<void> {
    const name = createDraft.trim();
    if (!name) return;
    try {
      await onCreate(name);
      setCreateDraft("");
      setCreating(false);
    } catch {
      // The page surfaces API errors.
    }
  }

  async function submitRename(categoryId: string): Promise<void> {
    const name = editDraft.trim();
    const category = categories.find((item) => item.id === categoryId);
    if (!name || !category) return;
    if (name === category.name) {
      setEditingId(null);
      return;
    }
    try {
      await onRename(categoryId, name);
      setEditingId(null);
    } catch {
      // The page surfaces API errors.
    }
  }

  return (
    <aside className="contact-sidebar">
      <header className="contact-header">
        <div className="section-heading">
          <h2>Contacts</h2>
          <span className="section-count">{agents.length}</span>
        </div>
        <div className="contact-header-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="New category"
            title="New category"
            onClick={() => {
              setCreating(true);
              setCreateDraft("");
              window.setTimeout(() => createInputRef.current?.focus(), 0);
            }}
          >
            <Plus size={16} />
          </button>
          {onClose ? (
            <button type="button" className="icon-button mobile-close" aria-label="Close contacts" onClick={onClose}>
              <X size={16} />
            </button>
          ) : null}
        </div>
      </header>

      {creating ? (
        <div className="category-create">
          <input
            ref={createInputRef}
            value={createDraft}
            onChange={(event) => setCreateDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitCreate();
              }
              if (event.key === "Escape") {
                setCreating(false);
                setCreateDraft("");
              }
            }}
            aria-label="Category name"
          />
          <button
            type="button"
            className="icon-button icon-button-small"
            aria-label="Create category"
            onClick={() => void submitCreate()}
            disabled={!createDraft.trim()}
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            className="icon-button icon-button-small"
            aria-label="Cancel"
            onClick={() => {
              setCreating(false);
              setCreateDraft("");
            }}
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      <div className="category-list">
        {orderedCategories.map((category) => {
          const members = agents
            .filter((agent) =>
              category.id === "uncategorized"
                ? agent.categoryId === category.id || !knownCategoryIds.has(agent.categoryId)
                : agent.categoryId === category.id,
            )
            .sort((left, right) => left.name.localeCompare(right.name));
          const isEditing = editingId === category.id;
          return (
            <section
              key={category.id}
              className={`contact-group${dragOverId === category.id ? " is-drop-target" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverId(category.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverId((current) => (current === category.id ? null : current));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const agentId = event.dataTransfer.getData("text/plain") || draggingId;
                setDragOverId(null);
                setDraggingId(null);
                if (agentId) void onAssign(agentId, category.id);
              }}
            >
              <header className="contact-group-header">
                {isEditing ? (
                  <div className="category-edit">
                    <input
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void submitRename(category.id);
                        }
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      aria-label="Category name"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="icon-button icon-button-small"
                      aria-label="Save category"
                      onClick={() => void submitRename(category.id)}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button-small"
                      aria-label="Cancel"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="category-name">{category.name}</span>
                    <span className="category-count">{members.length}</span>
                    {!category.locked ? (
                      <span className="category-actions">
                        <button
                          type="button"
                          className="icon-button icon-button-small"
                          aria-label={`Rename ${category.name}`}
                          title="Rename category"
                          onClick={() => {
                            setEditingId(category.id);
                            setEditDraft(category.name);
                          }}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button-small"
                          aria-label={`Delete ${category.name}`}
                          title="Delete category"
                          onClick={() => onDelete(category)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    ) : null}
                  </>
                )}
              </header>
              <div className="contact-group-body">
                {members.map((agent) => (
                  <div
                    key={agent.sessionId}
                    className={`contact-row${draggingId === agent.sessionId ? " is-dragging" : ""}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", agent.sessionId);
                      setDraggingId(agent.sessionId);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                  >
                    <Avatar avatar={agent.avatar} size={28} alt={agent.name} />
                    <div className="contact-row-text">
                      <span className="contact-row-name">{agent.name}</span>
                      <span className="contact-row-task">
                        <HarnessIcon harness={agent.harness} size={10} />
                        <span className="contact-row-task-text">{agent.task}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-button icon-button-small contact-row-more"
                      aria-label={`Move ${agent.name}`}
                      title="Move to category"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        onMoveMenu(agent, rect.right, rect.bottom + 4);
                      }}
                    >
                      <Ellipsis size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}