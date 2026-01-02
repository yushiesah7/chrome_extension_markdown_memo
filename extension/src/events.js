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
const TAB_INDENT = "  ";
const ORDERED_LIST_MARKER_MODE = "ordered"; // "one" or "ordered"（Markdown All in One互換）
const ORDERED_LIST_AUTO_RENUMBER = true;
// リスト継続とみなす最小インデント長（Markdown All in One互換）
const MIN_LIST_CONTINUATION_INDENT = 3;

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

export function renderApp() {
  const notes = getNotes();
  renderNoteList({
    notes,
    sortOrder: getSortOrder(),
    sortDirection: getSortDirection(),
    activeNoteId: getActiveNoteId(),
  });
  updateEditor(getActiveNote(), notes.length);
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
  // 選択変更も即座に保存しておくことで、タブを開いた際に同じメモを表示できる
  persistState();
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

function handlePreviewOpen() {
  // タブ側は拡張の保存領域から直接ロードするため、最新状態を先に保存してから開く。
  (async () => {
    try {
      await persistNow();
    } catch (error) {
      console.error("タブを開く前の保存に失敗しました", error);
      setStatus("idle", "保存に失敗しました");
    }
    const url = chrome.runtime.getURL("src/preview.html");
    openInNewTab(url, "プレビューを開けませんでした");
  })();
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
    // ignore
  }
  try {
    chrome.tabs?.create?.({ url });
  } catch (error) {
    console.error("タブのオープンに失敗しました", error);
    setStatus("idle", fallbackMessage);
  }
}

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

  const matchTask = currentLine.match(/^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/);
  if (matchTask) {
    event.preventDefault();

    const indent = matchTask[1];
    const bullet = matchTask[2];
    const rest = matchTask[4] || "";
    const isLineOnlyPrefix = rest.trim().length === 0;

    const insert = isLineOnlyPrefix ? "\n" : `\n${indent}${bullet} [ ] `;
    const newPos = before.length + insert.length;
    target.value = before + insert + after;
    target.setSelectionRange(newPos, newPos);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const matchUnordered = currentLine.match(/^(\s*)([-*+])\s+/);
  const matchOrdered = currentLine.match(/^(\s*)(\d+)([.)])(\s+)(\[[ xX]\]\s+)?/);
  if (!matchUnordered && !matchOrdered) return;

  event.preventDefault();

  const indent = matchUnordered ? matchUnordered[1] : matchOrdered[1];
  const prefix = matchUnordered ? `${indent}${matchUnordered[2]} ` : buildNextOrderedPrefix(matchOrdered);

  const isLineOnlyPrefix = isLineOnlyListPrefix(
    currentLine,
    matchUnordered || matchOrdered
  );

  const insert = isLineOnlyPrefix ? "\n" : `\n${prefix}`;
  const newPos = before.length + insert.length;
  target.value = before + insert + after;
  target.setSelectionRange(newPos, newPos);
  if (!matchUnordered) {
    fixMarkersPreservingSelection(target, 1);
  }
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

function isLineOnlyListPrefix(currentLine, match) {
  if (!match) return false;
  const rest = currentLine.slice(match[0].length);
  return rest.trim().length === 0;
}

function handleListTab(textarea, event) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const { column } = getLineAndColumn(value, start);
  const lineStart = getLineStartIndex(value, start);
  const lineEnd = getLineEndIndex(value, start);
  const lineText = value.slice(lineStart, lineEnd);

  const listPrefixMatch = /^\s*([-+*]|[0-9]+[.)]) +(\[[ xX]\] +)?/.exec(lineText);
  const shouldIndentAsList =
    Boolean(listPrefixMatch) &&
    (event.shiftKey || start !== end || column <= (listPrefixMatch?.[0]?.length ?? 0));

  event.preventDefault();

  if (event.shiftKey) {
    unindentTextArea(textarea, TAB_INDENT);
  } else if (shouldIndentAsList) {
    indentTextArea(textarea, TAB_INDENT);
  } else {
    insertTextAtSelection(textarea, TAB_INDENT);
  }

  fixMarkersPreservingSelection(textarea, 1);

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function handleListBackspace(textarea, event) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start !== end) return;

  const lineStart = getLineStartIndex(value, start);
  const lineEnd = getLineEndIndex(value, start);
  const lineText = value.slice(lineStart, lineEnd);
  const textBeforeCursor = lineText.slice(0, start - lineStart);

  if (/^\s+([-+*]|[0-9]+[.)]) $/.test(textBeforeCursor)) {
    event.preventDefault();
    unindentTextArea(textarea, TAB_INDENT);
    fixMarkersPreservingSelection(textarea, 1);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (/^([-+*]|[0-9]+[.)]) $/.test(textBeforeCursor)) {
    event.preventDefault();
    const replaced = " ".repeat(textBeforeCursor.length);
    textarea.value =
      value.slice(0, lineStart) + replaced + value.slice(lineStart + textBeforeCursor.length);
    textarea.setSelectionRange(start, start);
    fixMarkersPreservingSelection(textarea, 1);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const checkboxMatch = /^\s*([-+*]|[0-9]+[.)]) +(\[[ xX]\] )$/.exec(textBeforeCursor);
  if (checkboxMatch) {
    event.preventDefault();
    const checkboxLen = checkboxMatch[2].length;
    const removeStart = Math.max(lineStart, start - checkboxLen);
    textarea.value = value.slice(0, removeStart) + value.slice(start);
    const next = removeStart;
    textarea.setSelectionRange(next, next);
    fixMarkersPreservingSelection(textarea, 1);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function indentTextArea(textarea, indent) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (start === end) {
    const lineStart = getLineStartIndex(value, start);
    textarea.value = value.slice(0, lineStart) + indent + value.slice(lineStart);
    const nextPos = start + indent.length;
    textarea.setSelectionRange(nextPos, nextPos);
    return;
  }

  const firstLineStart = value.lastIndexOf("\n", start - 1) + 1;
  const blockEndIndex = value.indexOf("\n", end);
  const blockEnd = blockEndIndex === -1 ? value.length : blockEndIndex;
  const block = value.slice(firstLineStart, blockEnd);
  const lines = block.split("\n");

  const nextBlock = lines.map((line) => indent + line).join("\n");

  const startOffset = start - firstLineStart;
  const endOffset = end - firstLineStart;
  const startLineIndex = countNewlines(block, startOffset);
  const endLineIndex = countNewlines(block, endOffset);
  const addedBeforeStart = indent.length * (startLineIndex + 1);
  const addedBeforeEnd = indent.length * (endLineIndex + 1);

  textarea.value = value.slice(0, firstLineStart) + nextBlock + value.slice(blockEnd);
  textarea.setSelectionRange(start + addedBeforeStart, end + addedBeforeEnd);
}

function unindentTextArea(textarea, indent) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const removePrefix = (line) => {
    if (line.startsWith(indent)) return { line: line.slice(indent.length), removed: indent.length };
    if (line.startsWith("\t")) return { line: line.slice(1), removed: 1 };
    if (line.startsWith(" ")) return { line: line.slice(1), removed: 1 };
    return { line, removed: 0 };
  };

  if (start === end) {
    const lineStart = getLineStartIndex(value, start);
    const lineEnd = getLineEndIndex(value, start);
    const line = value.slice(lineStart, lineEnd);
    const { line: nextLine, removed } = removePrefix(line);
    if (removed === 0) return;

    textarea.value = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
    const next = Math.max(lineStart, start - removed);
    textarea.setSelectionRange(next, next);
    return;
  }

  const firstLineStart = value.lastIndexOf("\n", start - 1) + 1;
  const blockEndIndex = value.indexOf("\n", end);
  const blockEnd = blockEndIndex === -1 ? value.length : blockEndIndex;
  const block = value.slice(firstLineStart, blockEnd);
  const lines = block.split("\n");

  const results = lines.map((line) => removePrefix(line));
  const removeLens = results.map((r) => r.removed);
  const nextBlock = results.map((r) => r.line).join("\n");

  const startOffset = start - firstLineStart;
  const endOffset = end - firstLineStart;
  const startLineIndex = countNewlines(block, startOffset);
  const endLineIndex = countNewlines(block, endOffset);

  const removedBeforeStart = sum(removeLens, 0, startLineIndex);
  const removedBeforeEnd = sum(removeLens, 0, endLineIndex);

  textarea.value = value.slice(0, firstLineStart) + nextBlock + value.slice(blockEnd);
  textarea.setSelectionRange(start - removedBeforeStart, end - removedBeforeEnd);
}

function countNewlines(text, upToIndex) {
  const chunk = text.slice(0, Math.max(0, upToIndex));
  return (chunk.match(/\n/g) || []).length;
}

function sum(values, fromIndex, toIndex) {
  let total = 0;
  for (let i = fromIndex; i <= toIndex; i++) {
    total += values[i] || 0;
  }
  return total;
}

function buildNextOrderedPrefix(matchOrdered) {
  const leadingSpace = matchOrdered[1];
  const previousMarker = matchOrdered[2];
  const delimiter = matchOrdered[3];
  const trailingSpace = matchOrdered[4];
  const checkbox = matchOrdered[5] ? matchOrdered[5].replace(/\[x\]/i, "[ ]") : "";

  const marker =
    ORDERED_LIST_MARKER_MODE === "one"
      ? "1"
      : String(Number(previousMarker) + 1 || 1);

  const textIndent = (previousMarker + delimiter + trailingSpace).length;
  const adjustedTrailing = " ".repeat(
    Math.max(1, textIndent - (marker + delimiter).length)
  );
  return `${leadingSpace}${marker}${delimiter}${adjustedTrailing}${checkbox}`;
}

function getLineStartIndex(text, pos) {
  return text.lastIndexOf("\n", pos - 1) + 1;
}

function getLineEndIndex(text, pos) {
  const next = text.indexOf("\n", pos);
  return next === -1 ? text.length : next;
}

function getColumnFromPos(text, pos) {
  const lineStart = getLineStartIndex(text, pos);
  return pos - lineStart;
}

function getLineAndColumn(text, pos) {
  const line = countNewlines(text, pos);
  return { line, column: getColumnFromPos(text, pos) };
}

function getPosFromLineAndColumn(text, line, column) {
  const lines = text.split("\n");
  const safeLine = Math.max(0, Math.min(line, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < safeLine; i++) {
    offset += lines[i].length + 1;
  }
  const safeCol = Math.max(0, Math.min(column, lines[safeLine].length));
  return offset + safeCol;
}

function restoreSelectionByLineColumn(textarea, startLC, endLC) {
  const nextStart = getPosFromLineAndColumn(textarea.value, startLC.line, startLC.column);
  const nextEnd = getPosFromLineAndColumn(textarea.value, endLC.line, endLC.column);
  textarea.setSelectionRange(nextStart, nextEnd);
}

function insertTextAtSelection(textarea, text) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  const next = start + text.length;
  textarea.setSelectionRange(next, next);
}

function findNextMarkerLineNumber(lines, line) {
  let idx = Math.max(0, line);
  while (idx < lines.length) {
    const lineText = lines[idx] || "";
    if (lineText.startsWith("#")) {
      return -1;
    }
    if (/^\s*[0-9]+[.)] +/.test(lineText)) {
      return idx;
    }
    idx++;
  }
  return -1;
}

function lookUpwardForMarker(lines, line, currentIndentation) {
  let prevLine = line;
  while (--prevLine >= 0) {
    const prevLineText = (lines[prevLine] || "").replace(/\t/g, "    ");
    let matches = null;

    matches = /^(\s*)(([0-9]+)[.)] +)/.exec(prevLineText);
    if (matches) {
      const prevLeadingSpace = matches[1];
      const prevMarker = matches[3];
      if (currentIndentation < prevLeadingSpace.length) {
        continue;
      } else if (
        currentIndentation >= prevLeadingSpace.length &&
        currentIndentation <= (prevLeadingSpace + prevMarker).length
      ) {
        return Number(prevMarker) + 1;
      } else if (currentIndentation > (prevLeadingSpace + prevMarker).length) {
        return 1;
      }
      continue;
    }

    matches = /^(\s*)([-+*] +)/.exec(prevLineText);
    if (matches) {
      const prevLeadingSpace = matches[1];
      if (currentIndentation >= prevLeadingSpace.length) {
        break;
      }
      continue;
    }

    matches = /^(\s*)\S/.exec(prevLineText);
    if (matches) {
      if (matches[1].length < MIN_LIST_CONTINUATION_INDENT) {
        break;
      }
    }
  }
  return 1;
}

function fixOrderedListMarkers(textarea, fromLine = 0) {
  if (!ORDERED_LIST_AUTO_RENUMBER) return;
  if (ORDERED_LIST_MARKER_MODE === "one") return;

  const lines = textarea.value.split("\n");
  const start = findNextMarkerLineNumber(lines, fromLine);
  if (start < 0) return;
  fixMarkerIterative(lines, start);
  textarea.value = lines.join("\n");
}

function fixMarkersPreservingSelection(textarea, fromLineOffset = 1) {
  if (!ORDERED_LIST_AUTO_RENUMBER) return;
  const selectionStart = { ...getLineAndColumn(textarea.value, textarea.selectionStart) };
  const selectionEnd = { ...getLineAndColumn(textarea.value, textarea.selectionEnd) };
  fixOrderedListMarkers(textarea, Math.max(0, selectionStart.line - fromLineOffset));
  restoreSelectionByLineColumn(textarea, selectionStart, selectionEnd);
}

function fixMarkerIterative(lines, line) {
  if (line < 0 || line >= lines.length) return;

  const currentLineText = lines[line] || "";
  const matches = /^(\s*)([0-9]+)([.)])( +)/.exec(currentLineText);
  if (!matches) return;

  const leadingSpace = matches[1];
  const marker = matches[2];
  const delimiter = matches[3];
  const trailingSpace = matches[4];
  const fixedMarker = lookUpwardForMarker(
    lines,
    line,
    leadingSpace.replace(/\t/g, "    ").length
  );

  const listIndent = marker.length + delimiter.length + trailingSpace.length;
  let fixedMarkerString = String(fixedMarker);

  if (marker !== fixedMarkerString) {
    fixedMarkerString +=
      delimiter +
      " ".repeat(Math.max(1, listIndent - (fixedMarkerString + delimiter).length));
    const start = leadingSpace.length;
    const end = leadingSpace.length + listIndent;
    lines[line] = currentLineText.slice(0, start) + fixedMarkerString + currentLineText.slice(end);
  }

  let nextLine = line + 1;
  while (nextLine < lines.length) {
    const nextLineText = lines[nextLine] || "";
    if (/^\s*[0-9]+[.)] +/.test(nextLineText)) {
      fixMarkerIterative(lines, nextLine);
      return;
    }

    const prevLineText = lines[nextLine - 1] || "";
    if (/^\s*$/.test(prevLineText) && !nextLineText.startsWith(TAB_INDENT) && !nextLineText.startsWith("\t")) {
      return;
    }
    nextLine++;
  }
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

async function persistNow() {
  // タブを開く等の「即時保存」が必要な場面用（遅延保存をキャンセルして保存する）
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  if (statusResetTimeout) {
    clearTimeout(statusResetTimeout);
    statusResetTimeout = null;
  }

  const { noteTitleEl, noteBodyEl } = elements;
  if (noteTitleEl && noteBodyEl) {
    updateActiveNote({ title: noteTitleEl.value, body: noteBodyEl.value });
  }

  setStatus("saving", "保存中…");
  await persistState();
  setStatus("saved", "保存しました");
  statusResetTimeout = setTimeout(() => {
    setStatus("idle", "編集中");
  }, 1500);
}
