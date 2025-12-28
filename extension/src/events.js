import {
  getActiveNote,
  getActiveNoteId,
  getDraggedNoteId,
  getNotes,
  getSortOrder,
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
  const { createBtn, deleteBtn, noteTitleEl, noteBodyEl, noteListEl } = elements;

  createBtn.addEventListener("click", handleCreateNote);
  deleteBtn.addEventListener("click", () => handleDeleteNote());
  noteTitleEl.addEventListener("input", handleEditorChange);
  noteBodyEl.addEventListener("input", handleEditorChange);

  noteListEl.addEventListener("click", handleNoteListClick);
  noteListEl.addEventListener("dragstart", handleDragStart);
  noteListEl.addEventListener("dragend", handleDragEnd);
  noteListEl.addEventListener("dragover", handleDragOver);
}

export function renderApp() {
  renderNoteList({
    notes: getNotes(),
    sortOrder: getSortOrder(),
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
    activeNoteId: getActiveNoteId(),
  });
  scheduleAutoSave();
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
