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

let isComposing = false;
let lastEnterWithShift = false;

export function attachEventListeners() {
  const {
    createBtn,
    deleteBtn,
    noteTitleEl,
    noteBodyEl,
    noteListEl,
    sortToggleEl,
    previewButtonEl,
  } = elements;

  createBtn.addEventListener("click", handleCreateNote);
  deleteBtn.addEventListener("click", () => handleDeleteNote());
  noteTitleEl.addEventListener("input", handleEditorChange);
  noteBodyEl.addEventListener("input", handleEditorChange);
  noteBodyEl.addEventListener("compositionstart", handleCompositionStart);
  noteBodyEl.addEventListener("compositionend", handleCompositionEnd);
  noteBodyEl.addEventListener("keydown", handleEditorKeydown);
  noteBodyEl.addEventListener("beforeinput", handleEditorBeforeInput);

  noteListEl.addEventListener("click", handleNoteListClick);
  noteListEl.addEventListener("dragstart", handleDragStart);
  noteListEl.addEventListener("dragend", handleDragEnd);
  noteListEl.addEventListener("dragover", handleDragOver);

  sortToggleEl.addEventListener("click", handleSortToggle);

  if (!document.body.dataset.previewTab && previewButtonEl) {
    previewButtonEl.addEventListener("click", handlePreviewOpen);
  }
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
  if (!note) {
    setStatus("idle", "プレビューできるメモがありません");
    return;
  }
  const text = note?.body || "";
  const title = note?.title || "";

  // プレビュー用データを一時保存して新規タブで開く
  const payload = { text, title };
  const url = chrome.runtime.getURL("src/preview.html");

  (async () => {
    try {
      if (chrome.storage?.session) {
        await chrome.storage.session.set({ previewPayload: payload });
      } else {
        await chrome.storage.local.set({ previewPayload: payload });
      }
      await chrome.tabs.create({ url });

      try {
        if (chrome.storage?.session) {
          await chrome.storage.session.remove(["previewPayload"]);
        } else {
          await chrome.storage.local.remove(["previewPayload"]);
        }
      } catch (e) {
        // ignore
      }
    } catch (error) {
      console.error("プレビュータブのオープンに失敗しました", error);
      setStatus("idle", "プレビューを開けませんでした");
    }
  })();
}

function handleCompositionStart() {
  isComposing = true;
}

function handleCompositionEnd() {
  isComposing = false;
}

function handleEditorKeydown(event) {
  // beforeinput 側で insertLineBreak を扱うため、ここでは Shift+Enter 判定だけ保持
  if (event.key !== "Enter") return;
  lastEnterWithShift = Boolean(event.shiftKey);
}

function handleEditorBeforeInput(event) {
  if (isComposing) return;
  if (event.inputType !== "insertLineBreak") return;

  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;

  // Shift+Enter は通常改行
  if (lastEnterWithShift) {
    lastEnterWithShift = false;
    return;
  }
  lastEnterWithShift = false;

  const value = target.value;
  const start = target.selectionStart;
  const end = target.selectionEnd;
  if (start !== end) return;

  // 行末以外では通常の改行
  const nextNewline = value.indexOf("\n", start);
  if (nextNewline !== -1 && nextNewline !== start) return;

  const before = value.slice(0, start);
  const after = value.slice(end);

  const lineStart = before.lastIndexOf("\n") + 1;
  const currentLine = before.slice(lineStart);

  const matchUnordered = currentLine.match(/^(\s*)([-*+])\s+/);
  const matchOrdered = currentLine.match(/^(\s*)(\d+)\.\s+/);
  if (!matchUnordered && !matchOrdered) return;

  event.preventDefault();

  const indent = matchUnordered ? matchUnordered[1] : matchOrdered[1];
  const prefix = matchUnordered
    ? `${indent}${matchUnordered[2]} `
    : `${indent}${Number(matchOrdered[2]) + 1}. `;

  const isLineOnlyPrefix = matchUnordered
    ? currentLine.trim() === `${matchUnordered[2]}`
    : currentLine.trim() === `${matchOrdered[2]}.`;

  const insert = isLineOnlyPrefix ? "\n" : `\n${prefix}`;
  const newPos = before.length + insert.length;
  target.value = before + insert + after;
  target.setSelectionRange(newPos, newPos);
  target.dispatchEvent(new Event("input", { bubbles: true }));
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
