import { useState } from "react";
import { Check, Pencil, Trash2, X, Loader2 } from "lucide-react";
import type { Agent } from "../../types";
import { api, ApiError } from "../../api/client";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { toast } from "../../lib/toast";

interface AgentInfoPopoverProps {
  agent: Agent;
  onClose: () => void;
  onUpdated: (agent: Agent) => void;
  onDeleted: (agent: Agent) => void;
}

export function AgentInfoPopover({
  agent,
  onClose,
  onUpdated,
  onDeleted,
}: AgentInfoPopoverProps): React.JSX.Element {
  const [editingTask, setEditingTask] = useState(false);
  const [taskDraft, setTaskDraft] = useState(agent.task);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveTask(): Promise<void> {
    const task = taskDraft.trim();
    if (!task) {
      toast("Task cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateAgent(agent.sessionId, { task });
      onUpdated(updated);
      setEditingTask(false);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAgent(): Promise<void> {
    setDeleting(true);
    try {
      await api.deleteAgent(agent.sessionId);
      onDeleted(agent);
      onClose();
      toast("Agent deleted.", "success");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Unable to delete agent.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className="info-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="agent-info" role="dialog" aria-label={`${agent.name} info`}>
        <header className="agent-info-header">
          <Avatar avatar={agent.avatar} size={48} alt={agent.name} />
          <div className="agent-info-title">
            <h2>{agent.name}</h2>
            <p>{agent.task}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <dl className="agent-fields">
          <div className="agent-field">
            <dt>host</dt>
            <dd>{agent.host}</dd>
          </div>
          <div className="agent-field">
            <dt>workspace</dt>
            <dd className="wrap">{agent.workspace}</dd>
          </div>
          <div className="agent-field">
            <dt>name</dt>
            <dd>{agent.name}</dd>
          </div>
          <div className="agent-field">
            <dt>task</dt>
            <dd>
              {editingTask ? (
                <div className="task-editor">
                  <input
                    value={taskDraft}
                    onChange={(event) => setTaskDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveTask();
                      }
                      if (event.key === "Escape") {
                        setTaskDraft(agent.task);
                        setEditingTask(false);
                      }
                    }}
                    aria-label="Task"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="icon-button icon-button-small"
                    aria-label="Save task"
                    onClick={() => void saveTask()}
                    disabled={saving}
                  >
                    {saving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button-small"
                    aria-label="Cancel"
                    onClick={() => {
                      setTaskDraft(agent.task);
                      setEditingTask(false);
                    }}
                    disabled={saving}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <span className="task-value">
                  {agent.task}
                  <button
                    type="button"
                    className="icon-button icon-button-small"
                    aria-label="Edit task"
                    onClick={() => {
                      setTaskDraft(agent.task);
                      setEditingTask(true);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                </span>
              )}
            </dd>
          </div>
          <div className="agent-field">
            <dt>session_id</dt>
            <dd className="mono wrap">{agent.sessionId}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="button button-danger agent-delete"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </section>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete agent?"
          description={`${agent.name} will be signed out. Its messages and connections will be removed.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={() => void removeAgent()}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}