import { elements } from "./dom.js";

export function renderNoteList({ notes, sortOrder, activeNoteId }) {
  const { noteListEl, noteCountEl } = elements;
  if (!noteListEl) return;

  noteListEl.innerHTML = "";

  if (noteCountEl) {
    noteCountEl.textContent = String(notes.length);
  }

  if (notes.length === 0) {
    const emptyEl = document.createElement("li");
    emptyEl.className = "note-list__item";
    emptyEl.textContent = "メモがありません。新規作成してください。";
    emptyEl.setAttribute("aria-live", "polite");
    noteListEl.appendChild(emptyEl);
    return;
  }

  const noteMap = new Map(notes.map((note) => [note.id, note]));

  for (const noteId of sortOrder) {
    const note = noteMap.get(noteId);
    if (!note) continue;
    const item = createNoteListItem(note, note.id === activeNoteId);
    noteListEl.appendChild(item);
  }
}

export function updateEditor(note) {
  const { noteTitleEl, noteBodyEl, deleteBtn } = elements;
  const hasActive = Boolean(note);

  if (noteTitleEl) {
    noteTitleEl.disabled = !hasActive;
    if (hasActive) {
      noteTitleEl.value = note.title;
    } else {
      noteTitleEl.value = "";
    }
  }

  if (noteBodyEl) {
    noteBodyEl.disabled = !hasActive;
    if (hasActive) {
      noteBodyEl.value = note.body;
    } else {
      noteBodyEl.value = "";
    }
  }

  if (deleteBtn) {
    deleteBtn.disabled = !hasActive;
  }

  if (!hasActive) {
    setStatus("idle", "メモを選択してください");
    updateActiveNoteMeta(null);
    return;
  }

  updateActiveNoteMeta(note);
  setStatus("idle", "編集中");
}

export function updateActiveNoteMeta(note) {
  const { noteMetaEl } = elements;
  if (!noteMetaEl) return;
  if (!note) {
    noteMetaEl.textContent = "メモを選択してください";
    return;
  }
  noteMetaEl.textContent = formatNoteMeta(note);
}

export function formatNoteMeta(note) {
  if (!note) return "";
  const timestamp = note.updatedAt || note.createdAt;
  if (!timestamp) return "";
  return `最終更新: ${new Date(timestamp).toLocaleString("ja-JP")}`;
}

export function setStatus(state, message) {
  const { statusIndicatorEl, statusTextEl } = elements;
  if (!statusIndicatorEl || !statusTextEl) return;

  statusIndicatorEl.classList.remove(
    "status-indicator--saving",
    "status-indicator--saved"
  );

  if (state === "saving") {
    statusIndicatorEl.classList.add("status-indicator--saving");
  } else if (state === "saved") {
    statusIndicatorEl.classList.add("status-indicator--saved");
  }

  statusTextEl.textContent = message;
}

export function applyTheme(isDark) {
  const { editorEl, sidebarEl } = elements;
  const theme = isDark ? "dark" : "light";
  document.body.dataset.theme = theme;
  if (editorEl) {
    editorEl.dataset.theme = theme;
  }
  if (sidebarEl) {
    sidebarEl.dataset.theme = theme;
  }
}

function createNoteListItem(note, isActive) {
  const item = document.createElement("li");
  item.className = "note-list__item";
  item.dataset.id = note.id;
  item.tabIndex = 0;
  item.draggable = true;

  if (isActive) {
    item.classList.add("note-list__item--active");
  }

  const title = document.createElement("p");
  title.className = "note-list__title";
  title.textContent = note.title || "(タイトル未設定)";
  title.title = note.title || "(タイトル未設定)";

  const footer = document.createElement("div");
  footer.className = "note-list__footer";

  const meta = document.createElement("span");
  meta.className = "note-list__meta";
  meta.textContent = note.updatedAt
    ? `更新: ${new Date(note.updatedAt).toLocaleString("ja-JP")}`
    : "新規メモ";

  const deleteButton = document.createElement("button");
  deleteButton.className = "note-list__delete";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", "このメモを削除");
  deleteButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
      </svg>
    `;

  footer.appendChild(meta);
  footer.appendChild(deleteButton);

  item.appendChild(title);
  item.appendChild(footer);

  return item;
}
