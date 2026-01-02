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
  // タブ側は拡張の保存領域から直接ロードするため、payload受け渡しは不要。
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

  // Tab / Shift+Tab でインデント（Markdownのネスト入力用）
  if (event.key !== "Tab") return;
  if (isComposing) return;

  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;

  event.preventDefault();

  if (event.shiftKey) {
    unindentTextArea(target, TAB_INDENT);
  } else {
    indentTextArea(target, TAB_INDENT);
  }
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

function findPreviousOrderedNumberAtIndent(text, indent) {
  if (!text) return null;
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)(\d+)\.\s+/);
    if (!m) continue;
    if (m[1] !== indent) continue;
    const n = Number(m[2]);
    if (!Number.isFinite(n)) continue;
    return n;
  }
  return null;
}

function getLineIndent(line) {
  const match = String(line || "").match(/^(\s*)/);
  return match ? match[1] : "";
}

function isOrderedListItemAtIndent(line, indent) {
  const m = String(line || "").match(/^(\s*)(\d+)\.\s+/);
  if (!m) return false;
  return m[1] === indent;
}

function renumberOrderedListAtIndent(lines, pivotIndex, indent) {
  if (!indent && indent !== "") return;
  if (!Array.isArray(lines) || lines.length === 0) return;

  const pivotLine = lines[pivotIndex] ?? "";
  if (!isOrderedListItemAtIndent(pivotLine, indent)) {
    // pivotがネスト内にいても、近傍の同階層リストを対象にしたいので探索する
    let found = -1;
    for (let i = pivotIndex; i >= 0; i--) {
      const line = lines[i] ?? "";
      if (line.trim().length === 0) break;
      const lineIndent = getLineIndent(line);
      if (lineIndent.length < indent.length) break;
      if (lineIndent === indent && isOrderedListItemAtIndent(line, indent)) {
        found = i;
        break;
      }
    }
    for (let i = pivotIndex + 1; found === -1 && i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trim().length === 0) break;
      const lineIndent = getLineIndent(line);
      if (lineIndent.length < indent.length) break;
      if (lineIndent === indent && isOrderedListItemAtIndent(line, indent)) {
        found = i;
        break;
      }
    }
    if (found === -1) return;
    pivotIndex = found;
  }

  // 上に向かってブロック開始点を探す
  let start = pivotIndex;
  while (start > 0) {
    const prev = lines[start - 1] ?? "";
    if (prev.trim().length === 0) break;
    const prevIndent = getLineIndent(prev);
    if (prevIndent.length < indent.length) break;
    if (prevIndent === indent && !isOrderedListItemAtIndent(prev, indent)) break;
    start -= 1;
  }

  // 下に向かってブロック終端を探す
  let end = pivotIndex;
  while (end < lines.length - 1) {
    const next = lines[end + 1] ?? "";
    if (next.trim().length === 0) break;
    const nextIndent = getLineIndent(next);
    if (nextIndent.length < indent.length) break;
    if (nextIndent === indent && !isOrderedListItemAtIndent(next, indent)) break;
    end += 1;
  }

  let current = 0;
  for (let i = start; i <= end; i++) {
    const line = lines[i] ?? "";
    if (line.trim().length === 0) break;
    const lineIndent = getLineIndent(line);

    // ネストは飛ばす（同階層の兄弟だけ採番対象）
    if (lineIndent.length > indent.length) continue;

    // 同じインデントで別種の行が来たら、このリストブロック終了
    if (lineIndent !== indent) break;

    if (!isOrderedListItemAtIndent(line, indent)) break;

    current += 1;
    lines[i] = line.replace(/^(\s*)(\d+)(\.\s+)/, `$1${current}$3`);
  }
}

function indentTextArea(textarea, indent) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (start === end) {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", start);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const currentLine = value.slice(lineStart, lineEnd);
    const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
    const oldIndent = orderedMatch?.[1] ?? null;

    textarea.value = value.slice(0, lineStart) + indent + value.slice(lineStart);

    let nextPos = start + indent.length;
    if (orderedMatch) {
      const existingIndentLen = orderedMatch[1].length;
      const numberText = orderedMatch[2];
      const newIndent = indent + orderedMatch[1];
      const desiredNumber = computeNextOrderedNumberAtIndent(value.slice(0, lineStart), newIndent);
      const desiredNumberText = String(desiredNumber);

      const numberStart = lineStart + indent.length + existingIndentLen;
      const numberEnd = numberStart + numberText.length;

      if (desiredNumberText !== numberText) {
        const updated = textarea.value;
        textarea.value =
          updated.slice(0, numberStart) + desiredNumberText + updated.slice(numberEnd);

        const delta = desiredNumberText.length - numberText.length;
        if (nextPos >= numberEnd) {
          nextPos += delta;
        } else if (nextPos > numberStart) {
          nextPos = numberStart + desiredNumberText.length;
        }
      }
    }

    if (orderedMatch) {
      const after = textarea.value;
      const lines = after.split("\n");
      const lineIndex = countNewlines(after, lineStart);
      const newIndent = indent + orderedMatch[1];

      renumberOrderedListAtIndent(lines, lineIndex, newIndent);
      if (oldIndent != null && oldIndent !== newIndent) {
        renumberOrderedListAtIndent(lines, lineIndex, oldIndent);
      }

      textarea.value = lines.join("\n");
    }

    textarea.setSelectionRange(nextPos, nextPos);
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
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
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
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
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", start);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const line = value.slice(lineStart, lineEnd);
    const originalOrderedMatch = line.match(/^(\s*)(\d+)\.\s+/);
    const originalIndent = originalOrderedMatch?.[1] ?? null;
    const { line: nextLine, removed } = removePrefix(line);
    if (removed === 0) return;

    const beforeLine = value.slice(0, lineStart);
    const orderedMatch = nextLine.match(/^(\s*)(\d+)\.\s+/);
    let patchedLine = nextLine;
    let delta = 0;
    let patchedIndent = null;

    if (orderedMatch) {
      const desiredNumber = computeNextOrderedNumberAtIndent(beforeLine, orderedMatch[1]);
      const desiredNumberText = String(desiredNumber);
      if (desiredNumberText !== orderedMatch[2]) {
        const numberStartInLine = orderedMatch[1].length;
        const numberEndInLine = numberStartInLine + orderedMatch[2].length;
        patchedLine =
          nextLine.slice(0, numberStartInLine) +
          desiredNumberText +
          nextLine.slice(numberEndInLine);
        delta = desiredNumberText.length - orderedMatch[2].length;
      }
      patchedIndent = orderedMatch[1];
    }

    textarea.value = beforeLine + patchedLine + value.slice(lineEnd);

    // Shift+Tab で階層が変わった場合、同じ階層の兄弟を連番補正
    if (orderedMatch) {
      const after = textarea.value;
      const lines = after.split("\n");
      const lineIndex = countNewlines(after, lineStart);
      const newIndent = patchedIndent ?? orderedMatch[1];

      renumberOrderedListAtIndent(lines, lineIndex, newIndent);
      if (originalIndent != null && originalIndent !== newIndent) {
        renumberOrderedListAtIndent(lines, lineIndex, originalIndent);
      }

      textarea.value = lines.join("\n");
    }

    const next = Math.max(lineStart, start - removed + delta);
    textarea.setSelectionRange(next, next);
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
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
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function countNewlines(text, upToIndex) {
  const chunk = text.slice(0, Math.max(0, upToIndex));
  return (chunk.match(/\n/g) || []).length;
}

function computeNextOrderedNumberAtIndent(textBeforeLine, indent) {
  const prev = findPreviousOrderedNumberAtIndent(textBeforeLine, indent);
  return Number.isFinite(prev) ? prev + 1 : 1;
}

function sum(values, fromIndex, toIndex) {
  let total = 0;
  for (let i = fromIndex; i <= toIndex; i++) {
    total += values[i] || 0;
  }
  return total;
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
