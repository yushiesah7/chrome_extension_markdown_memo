import {
  getActiveNote,
  getActiveNoteId,
  getDraggedNoteId,
  getNotes,
  getSortOrder,
  getSortDirection,
  setSortDirection,
  setSortOrder,
  createNote,
  deleteNote,
  updateActiveNote,
  setActiveNoteId,
  setDraggedNoteId,
  reorderNotes,
  persistState,
} from "./state.js";
import { elements } from "./dom.js";
import { renderNoteList, updateEditor, setStatus, updateActiveNoteMeta } from "./render.js";

const AUTO_SAVE_DELAY = 400;
let autoSaveTimeout = null;
let statusResetTimeout = null;

export function attachEventListeners() {
  const {
    createBtn,
    deleteBtn,
    noteTitleEl,
    noteBodyEl,
    noteListEl,
    sortToggleEl,
    previewButtonEl,
    previewCloseEl,
    previewBackdropEl,
    previewCopyAllEl,
  } = elements;

  createBtn.addEventListener("click", handleCreateNote);
  deleteBtn.addEventListener("click", () => handleDeleteNote());
  noteTitleEl.addEventListener("input", handleEditorChange);
  noteBodyEl.addEventListener("input", handleEditorChange);

  noteListEl.addEventListener("click", handleNoteListClick);
  noteListEl.addEventListener("dragstart", handleDragStart);
  noteListEl.addEventListener("dragend", handleDragEnd);
  noteListEl.addEventListener("dragover", handleDragOver);

  sortToggleEl.addEventListener("click", handleSortToggle);

  previewButtonEl.addEventListener("click", handlePreviewOpen);
  previewCloseEl.addEventListener("click", handlePreviewClose);
  previewBackdropEl.addEventListener("click", handlePreviewClose);
  previewCopyAllEl.addEventListener("click", handlePreviewCopyAll);
  window.addEventListener("keydown", handlePreviewKeydown);
}

export function renderApp() {
  renderNoteList({
    notes: getNotes(),
    sortOrder: getSortOrder(),
    sortDirection: getSortDirection(),
    activeNoteId: getActiveNoteId(),
  });
  updateEditor(getActiveNote());
}

function handleCreateNote() {
  createNote();
  renderApp();
  elements.noteTitleEl.focus();
  scheduleAutoSave();
}

function handleDeleteNote(targetId = getActiveNoteId()) {
  if (!targetId) return;
  deleteNote(targetId);
  renderApp();
  scheduleAutoSave();
}

function handleEditorChange() {
  const { noteTitleEl, noteBodyEl } = elements;
  const note = updateActiveNote({
    title: noteTitleEl.value,
    body: noteBodyEl.value,
  });
  if (!note) return;

  renderNoteList({
    notes: getNotes(),
    sortOrder: getSortOrder(),
    sortDirection: getSortDirection(),
    activeNoteId: getActiveNoteId(),
  });
  updateActiveNoteMeta(note);
  scheduleAutoSave();
}

function handleNoteListClick(event) {
  const deleteButton = event.target.closest(".note-list__delete");
  if (deleteButton) {
    const parentItem = deleteButton.closest("li[data-id]");
    if (!parentItem) return;
    handleDeleteNote(parentItem.dataset.id);
    return;
  }

  const item = event.target.closest("li[data-id]");
  if (!item) return;
  const noteId = item.dataset.id;
  if (noteId === getActiveNoteId()) return;
  setActiveNoteId(noteId);
  renderApp();
}

function handleDragStart(event) {
  const item = event.target.closest("li[data-id]");
  if (!item) return;
  setDraggedNoteId(item.dataset.id);
  item.classList.add("note-list__item--dragging");
}

function handleDragEnd(event) {
  const item = event.target.closest("li[data-id]");
  if (item) {
    item.classList.remove("note-list__item--dragging");
  }
  setDraggedNoteId(null);
}

function handleDragOver(event) {
  const draggedNoteId = getDraggedNoteId();
  if (!draggedNoteId) return;
  event.preventDefault();
  const item = event.target.closest("li[data-id]");
  if (!item) return;
  const targetId = item.dataset.id;
  if (targetId === draggedNoteId) return;
  reorderNotes(draggedNoteId, targetId);
  renderNoteList({
    notes: getNotes(),
    sortOrder: getSortOrder(),
    sortDirection: getSortDirection(),
    activeNoteId: getActiveNoteId(),
  });
  scheduleAutoSave();
}

function handleSortToggle() {
  const current = getSortDirection();
  const next = current === "asc" ? "desc" : "asc";
  setSortDirection(next);

  // sortOrder を updatedAt 基準で再生成
  const notes = getNotes();
  const sortedIds = [...notes]
    .sort((a, b) => {
      const aTime = a.updatedAt || 0;
      const bTime = b.updatedAt || 0;
      return next === "asc" ? aTime - bTime : bTime - aTime;
    })
    .map((n) => n.id);
  setSortOrder(sortedIds);

  renderNoteList({
    notes: getNotes(),
    sortOrder: getSortOrder(),
    sortDirection: next,
    activeNoteId: getActiveNoteId(),
  });
  scheduleAutoSave();
}

function handlePreviewOpen() {
  const note = getActiveNote();
  const { previewModalEl, previewBackdropEl, previewBodyEl } = elements;
  if (!previewModalEl || !previewBackdropEl || !previewBodyEl) return;

  const text = note?.body || "";
  previewBodyEl.innerHTML = "";

  const container = document.createElement("div");
  container.className = "preview-markdown";

  const parts = text.split(/```/);
  let hasMermaid = false;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const block = parts[i];
      const firstLine = block.split("\n")[0].trim();
      if (firstLine === "mermaid") {
        const code = block.split("\n").slice(1).join("\n");
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-block";

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "copy-button";
        copyBtn.textContent = "コピー";
        copyBtn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText("```mermaid\n" + code + "\n```");
            copyBtn.textContent = "コピー済";
            setTimeout(() => (copyBtn.textContent = "コピー"), 1200);
          } catch {
            copyBtn.textContent = "失敗";
            setTimeout(() => (copyBtn.textContent = "コピー"), 1200);
          }
        });

        const el = document.createElement("div");
        el.className = "mermaid";
        el.textContent = code;

        wrapper.appendChild(copyBtn);
        wrapper.appendChild(el);
        container.appendChild(wrapper);
        hasMermaid = true;
        continue;
      }
    }

    const trimmed = parts[i].trim();
    if (trimmed) {
      const wrapper = document.createElement("div");
      wrapper.className = "code-block";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-button";
      copyBtn.textContent = "コピー";
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(parts[i]);
          copyBtn.textContent = "コピー済";
          setTimeout(() => (copyBtn.textContent = "コピー"), 1200);
        } catch {
          copyBtn.textContent = "失敗";
          setTimeout(() => (copyBtn.textContent = "コピー"), 1200);
        }
      });

      const pre = document.createElement("pre");
      pre.textContent = parts[i];
      wrapper.appendChild(copyBtn);
      wrapper.appendChild(pre);
      container.appendChild(wrapper);
    }
  }

  if (!container.childElementCount) {
    const pre = document.createElement("pre");
    pre.textContent = text || "(プレビュー対象がありません)";
    container.appendChild(pre);
  }

  previewBodyEl.appendChild(container);
  previewModalEl.hidden = false;
  previewBackdropEl.hidden = false;

  if (hasMermaid && typeof mermaid !== "undefined") {
    try {
      mermaid.initialize({ startOnLoad: false, theme: "dark" });
      mermaid.run({ querySelector: ".preview-modal .mermaid" });
    } catch (error) {
      console.error("Mermaid render error", error);
    }
  }
}

function handlePreviewClose() {
  const { previewModalEl, previewBackdropEl } = elements;
  if (!previewModalEl || !previewBackdropEl) return;
  previewModalEl.hidden = true;
  previewBackdropEl.hidden = true;
}

function handlePreviewCopyAll() {
  const note = getActiveNote();
  const { previewCopyAllEl } = elements;
  if (!previewCopyAllEl) return;
  const text = note?.body || "";
  (async () => {
    try {
      await navigator.clipboard.writeText(text);
      previewCopyAllEl.textContent = "コピー済";
      setTimeout(() => (previewCopyAllEl.textContent = "全文コピー"), 1200);
    } catch (error) {
      console.error("copy all failed", error);
      previewCopyAllEl.textContent = "失敗";
      setTimeout(() => (previewCopyAllEl.textContent = "全文コピー"), 1200);
    }
  })();
}

function handlePreviewKeydown(e) {
  if (e.key !== "Escape") return;
  const { previewModalEl } = elements;
  if (previewModalEl?.hidden) return;
  handlePreviewClose();
}

function scheduleAutoSave() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  setStatus("saving", "自動保存中…");
  autoSaveTimeout = setTimeout(async () => {
    autoSaveTimeout = null;
    await persistState();
    setStatus("saved", "保存しました");
    if (statusResetTimeout) {
      clearTimeout(statusResetTimeout);
    }
    statusResetTimeout = setTimeout(() => {
      setStatus("idle", "編集中");
    }, 1500);
  }, AUTO_SAVE_DELAY);
}
