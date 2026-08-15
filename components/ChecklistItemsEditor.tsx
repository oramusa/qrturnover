"use client";

import { useState } from "react";

export default function ChecklistItemsEditor({
  items,
  onAdd,
  onEdit,
  onDelete,
  disabled,
}: {
  items: { id: string; label: string }[];
  onAdd: (label: string) => Promise<void>;
  onEdit: (id: string, label: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    await onAdd(newLabel.trim());
    setNewLabel("");
    setBusy(false);
  }

  async function handleEditSave(id: string) {
    if (!editingLabel.trim()) return;
    setBusy(true);
    await onEdit(id, editingLabel.trim());
    setEditingId(null);
    setBusy(false);
  }

  async function handleDelete(id: string) {
    setBusy(true);
    await onDelete(id);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-gray-400">No items yet — add one below.</p>
      )}
      {items.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="flex items-center gap-2">
            <input
              value={editingLabel}
              onChange={(e) => setEditingLabel(e.target.value)}
              autoFocus
              className="flex-1 border rounded px-2 py-1 text-sm bg-white text-gray-900"
            />
            <button
              type="button"
              onClick={() => handleEditSave(item.id)}
              disabled={busy || disabled}
              className="text-xs text-gray-700 hover:text-black disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setEditingId(item.id);
                setEditingLabel(item.label);
              }}
              className="text-left flex-1 text-gray-900 hover:underline"
            >
              {item.label}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={busy || disabled}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )
      )}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add an item (e.g. Refrigerator)"
          className="flex-1 border rounded px-2 py-1 text-sm bg-white text-gray-900"
        />
        <button
          type="submit"
          disabled={busy || disabled || !newLabel.trim()}
          className="text-xs border rounded px-2 py-1 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}
