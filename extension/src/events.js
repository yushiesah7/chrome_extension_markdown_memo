/**
 * events.js
 * イベントハンドラの登録と基本的なイベント処理
 *
 * リファクタリング: 責務を分割
 * - textarea-utils.js: テキストエリア操作ユーティリティ
 * - list-editor.js: Markdownリスト操作
 * - auto-save.js: 自動保存ロジック
 */

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
import { renderPreviewPanel } from "./preview_panel.js";
import { scheduleAutoSave, persistNow } from "./auto-save.js";
import {
  handleListTab,
  handleListBackspace,
  isLineOnlyListPrefix,
  buildNextOrderedPrefix,
  fixMarkersPreservingSelection,
} from "./list-editor.js";
import { dispatchInput } from "./textarea-utils.js";

// IME 入力中フラグ
let isComposing = false;
// Shift+Enter 判定用
let lastEnterWithShift = false;

/**
 * 全イベントリスナーを登録
 */
export function attachEventListeners() {
  const {
    createBtn,
    emptyCreateBtnEl,
    deleteBtn,
    noteTitleEl,
    noteBodyEl,
    noteListEl,
    sortToggleEl,
    previewButtonEl,
    openDocsEl,
    emptyOpenDocsEl,
  } = elements;

  // 新規メモを作成
  createBtn.addEventListener("click", handleCreateNote);
  emptyCreateBtnEl?.addEventListener("click", handleCreateNote);
  // 現在のメモを削除
  deleteBtn.addEventListener("click", () => handleDeleteNote());
  // タイトル/本文の編集
  noteTitleEl.addEventListener("input", handleEditorChange);
  noteBodyEl.addEventListener("input", handleEditorChange);
  noteBodyEl.addEventListener("compositionstart", handleCompositionStart);
  noteBodyEl.addEventListener("compositionend", handleCompositionEnd);
  noteBodyEl.addEventListener("keydown", handleEditorKeydown);
  noteBodyEl.addEventListener("beforeinput", handleEditorBeforeInput);

  // メモ一覧のクリック（選択/削除）
  noteListEl.addEventListener("click", handleNoteListClick);
  noteListEl.addEventListener("keydown", handleNoteListKeydown);
  noteListEl.addEventListener("dragstart", handleDragStart);
  noteListEl.addEventListener("dragend", handleDragEnd);
  noteListEl.addEventListener("dragover", handleDragOver);

  // 並び替え（昇順/降順）
  sortToggleEl.addEventListener("click", handleSortToggle);

  // 仕様書を開く
  openDocsEl?.addEventListener("click", handleOpenDocs);
  emptyOpenDocsEl?.addEventListener("click", handleOpenDocs);

  if (!document.body.dataset.previewTab && previewButtonEl) {
    // タブ（編集/プレビュー）を開く
    previewButtonEl.addEventListener("click", handlePreviewOpen);
  }
}

/**
 * アプリ全体を再描画
 */
export function renderApp() {
  const notes = getNotes();
  renderNoteList({
    notes,
    sortOrder: getSortOrder(),
    sortDirection: getSortDirection(),
    activeNoteId: getActiveNoteId(),
  });
  updateEditor(getActiveNote(), notes.length);
  const { previewPanelEl } = elements;
  if (previewPanelEl && !previewPanelEl.hidden) {
    renderPreviewPanel();
  }
}

// ─────────────────────────────────────────────────────────────────
// メモ操作ハンドラ
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// メモ一覧ハンドラ
// ─────────────────────────────────────────────────────────────────

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
  selectNoteId(item.dataset.id);
}

function handleNoteListKeydown(event) {
  // Enter/Spaceでメモ選択（アクセシビリティ/キーボード操作）
  const key = event.key;
  if (key !== "Enter" && key !== " ") return;

  // 削除ボタンなどネイティブ操作がある要素は、既定動作に任せる
  if (event.target.closest?.(".note-list__delete")) return;

  const item = event.target.closest?.("li[data-id]");
  if (!item) return;

  event.preventDefault();
  selectNoteId(item.dataset.id);
}

function selectNoteId(noteId) {
  if (!noteId) return;
  if (noteId === getActiveNoteId()) return;
  setActiveNoteId(noteId);
  // 選択変更も即座に保存しておくことで、タブを開いた際に同じメモを表示できる
  persistState().catch((error) => {
    console.error("Failed to persist state on note selection:", error);
  });
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
  const sortedIds = [...getNotes()]
    .sort((a, b) => {
      const aTime = a?.updatedAt || a?.createdAt || 0;
      const bTime = b?.updatedAt || b?.createdAt || 0;
      return next === "asc" ? aTime - bTime : bTime - aTime;
    })
    .map((note) => note.id);
  setSortOrder(sortedIds);
  renderNoteList({
    notes: getNotes(),
    sortOrder: getSortOrder(),
    sortDirection: next,
    activeNoteId: getActiveNoteId(),
  });
  scheduleAutoSave();
}

// ─────────────────────────────────────────────────────────────────
// ナビゲーションハンドラ
// ─────────────────────────────────────────────────────────────────

async function handlePreviewOpen() {
  // タブ側は拡張の保存領域から直接ロードするため、最新状態を先に保存してから開く
  await persistNow();
  const url = chrome.runtime.getURL("src/preview.html");
  openInNewTab(url, "プレビューを開けませんでした");
}

function handleOpenDocs() {
  const url = chrome.runtime.getURL("src/docs.html");
  openInNewTab(url, "仕様書を開けませんでした");
}

function openInNewTab(url, fallbackMessage) {
  try {
    const opened = window.open(url, "_blank");
    if (opened) return;
  } catch (e) {
    // window.open はポップアップブロッカーで失敗することがあるため無視
  }
  try {
    chrome.tabs?.create?.({ url });
  } catch (error) {
    console.error("タブのオープンに失敗しました", error);
    setStatus("idle", fallbackMessage);
  }
}

// ─────────────────────────────────────────────────────────────────
// エディタ入力ハンドラ
// ─────────────────────────────────────────────────────────────────

function handleCompositionStart() {
  isComposing = true;
}

function handleCompositionEnd() {
  isComposing = false;
}

function handleEditorKeydown(event) {
  // beforeinput 側で insertLineBreak を扱うため、ここでは Shift+Enter 判定だけ保持
  if (event.key === "Enter") {
    lastEnterWithShift = Boolean(event.shiftKey);
    return;
  }

  if (isComposing) return;

  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;

  if (event.key === "Backspace") {
    handleListBackspace(target, event);
    return;
  }

  // Tab / Shift+Tab でインデント（Markdownのネスト入力用）
  if (event.key !== "Tab") return;

  handleListTab(target, event);
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

  // タスクリストの継続
  const matchTask = currentLine.match(/^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/);
  if (matchTask) {
    event.preventDefault();

    const indent = matchTask[1];
    const bullet = matchTask[2];
    const rest = matchTask[4] || "";
    const isLineEmpty = rest.trim().length === 0;

    const insert = isLineEmpty ? "\n" : `\n${indent}${bullet} [ ] `;
    const newPos = before.length + insert.length;
    target.value = before + insert + after;
    target.setSelectionRange(newPos, newPos);
    dispatchInput(target);
    return;
  }

  // 通常リスト / 番号付きリストの継続
  const matchUnordered = currentLine.match(/^(\s*)([-*+])\s+/);
  const matchOrdered = currentLine.match(/^(\s*)(\d+)([.)])(\s+)(\[[ xX]\]\s+)?/);
  if (!matchUnordered && !matchOrdered) return;

  event.preventDefault();

  const indent = matchUnordered ? matchUnordered[1] : matchOrdered[1];
  const prefix = matchUnordered ? `${indent}${matchUnordered[2]} ` : buildNextOrderedPrefix(matchOrdered);

  const isLineEmpty = isLineOnlyListPrefix(
    currentLine,
    matchUnordered || matchOrdered
  );

  const insert = isLineEmpty ? "\n" : `\n${prefix}`;
  const newPos = before.length + insert.length;
  target.value = before + insert + after;
  target.setSelectionRange(newPos, newPos);
  if (!matchUnordered) {
    fixMarkersPreservingSelection(target, 1);
  }
dispatchInput(target);
}
