import { ensureElementsExist, elements } from "./dom.js";
import { initializeTheme, createThemeSelectorUI } from "./theme.js";
import { initializeState, getActiveNote } from "./state.js";
import { attachEventListeners, renderApp } from "./events.js";
import { setStatus } from "./render.js";
import { renderPreviewPanel } from "./preview_panel.js";

// プレビュータブであることを明示
document.body.dataset.previewTab = "true";

async function init() {
  // プレビュータブは「ポップアップと同じUI」でメモを編集/プレビューする
  try {
    ensureElementsExist();
  } catch (error) {
    console.error("プレビュータブ初期化に必要なDOM要素が見つかりません。", error);
    return;
  }

  // テーマを初期化（ストレージから読み込み）
  await initializeTheme();

  // テーマセレクターUIを追加
  const themeSelectorContainer = document.getElementById("themeSelector");
  if (themeSelectorContainer) {
    themeSelectorContainer.appendChild(createThemeSelectorUI());
  }

  // 既存のイベント一式（作成/削除/並び替え/編集）を使い回す
  attachEventListeners();

  try {
    // 保存済みメモをロード
    await initializeState();
  } catch (error) {
    console.error("メモの読み込みに失敗しました。", error);
    setStatus("idle", "メモの読み込みに失敗しました");
    return;
  }

  // 画面内の「編集/プレビュー」切替
  bindModeToggle();
  // 全文コピー
  bindCopyAll();
  // 編集しながらプレビューを更新（プレビュー表示中のみ）
  bindLivePreview();
  bindMarkdownToolbar();

  // 画面を描画（一覧/エディタ/メタ情報）
  renderApp();
  // 初回表示時のプレビュー内容
  renderPreviewPanel();
}

function bindModeToggle() {
  const { modeEditEl, modePreviewEl, editPanelEl, previewPanelEl } = elements;
  if (!modeEditEl || !modePreviewEl || !editPanelEl || !previewPanelEl) return;

  const toolbar = document.getElementById("mdToolbar");

  const setMode = (mode) => {
    const isEdit = mode === "edit";
    // 編集: textarea / プレビュー: rendered view
    editPanelEl.hidden = !isEdit;
    previewPanelEl.hidden = isEdit;
    if (toolbar) {
      toolbar.hidden = !isEdit;
    }
    modeEditEl.setAttribute("aria-pressed", isEdit ? "true" : "false");
    modePreviewEl.setAttribute("aria-pressed", isEdit ? "false" : "true");
    if (!isEdit) {
      renderPreviewPanel();
    }
  };

  modeEditEl.addEventListener("click", () => setMode("edit"));
  modePreviewEl.addEventListener("click", () => setMode("preview"));
}

function bindCopyAll() {
  const { copyAllEl } = elements;
  if (!copyAllEl) return;
  copyAllEl.addEventListener("click", async () => {
    // 現在開いているメモ本文をクリップボードへ
    const note = getActiveNote();
    const text = note?.body || "";
    try {
      await navigator.clipboard.writeText(text);
      copyAllEl.textContent = "コピー済";
      setTimeout(() => (copyAllEl.textContent = "全文コピー"), 1200);
    } catch (e) {
      copyAllEl.textContent = "失敗";
      setTimeout(() => (copyAllEl.textContent = "全文コピー"), 1200);
    }
  });
}

function bindMarkdownToolbar() {
  const textarea = elements.noteBodyEl;
  const toolbar = document.getElementById("mdToolbar");
  if (!textarea || !toolbar) return;

  const h1 = document.getElementById("mdH1");
  const h2 = document.getElementById("mdH2");
  const bullet = document.getElementById("mdBullet");
  const numbered = document.getElementById("mdNumbered");
  const task = document.getElementById("mdTask");
  const code = document.getElementById("mdCode");
  const mermaid = document.getElementById("mdMermaid");

  h1?.addEventListener("click", () => applyLinePrefix(textarea, "# "));
  h2?.addEventListener("click", () => applyLinePrefix(textarea, "## "));
  bullet?.addEventListener("click", () => applyLinePrefix(textarea, "- "));
  task?.addEventListener("click", () => applyLinePrefix(textarea, "- [ ] "));
  numbered?.addEventListener("click", () => applyNumberedList(textarea));
  code?.addEventListener("click", () => wrapWithBlock(textarea, "```", "\n", "\n```"));
  mermaid?.addEventListener("click", () =>
    wrapWithBlock(
      textarea,
      "```mermaid",
      "\n",
      "\n```",
      'flowchart TD\n  A["Start"] --> B["Next"]\n'
    )
  );
}

function dispatchInput(textarea) {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyLinePrefix(textarea, prefix) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const selectedBlock = value.slice(lineStart, blockEnd);
  const lines = selectedBlock.split("\n");

  const shouldRemove = lines.every((line) => line.startsWith(prefix));
  const nextBlock = shouldRemove
    ? lines.map((line) => line.slice(prefix.length)).join("\n")
    : lines.map((line) => prefix + line).join("\n");
  const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(blockEnd);

  textarea.value = nextValue;

  const isSingleLine = lines.length === 1;
  const deltaPerLine = shouldRemove ? -prefix.length : prefix.length;
  if (isSingleLine && start === end) {
    const caret = Math.max(lineStart, start + deltaPerLine);
    textarea.setSelectionRange(caret, caret);
  } else {
    const nextStart = Math.max(lineStart, start + deltaPerLine);
    const nextEnd = Math.max(lineStart, end + deltaPerLine * lines.length);
    textarea.setSelectionRange(nextStart, nextEnd);
  }
  textarea.focus();
  dispatchInput(textarea);
}

function applyNumberedList(textarea) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const selectedBlock = value.slice(lineStart, blockEnd);
  const lines = selectedBlock.split("\n");

  const nextLines = lines.map((line, idx) => `${idx + 1}. ${line}`);
  const nextBlock = nextLines.join("\n");
  const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(blockEnd);

  textarea.value = nextValue;

  const prefixLenFirst = `${1}. `.length;
  if (lines.length === 1 && start === end) {
    const caret = start + prefixLenFirst;
    textarea.setSelectionRange(caret, caret);
  } else {
    const totalPrefix = nextLines.reduce((acc, _, idx) => acc + `${idx + 1}. `.length, 0);
    textarea.setSelectionRange(start + prefixLenFirst, end + totalPrefix);
  }
  textarea.focus();
  dispatchInput(textarea);
}

function wrapWithBlock(textarea, opening, afterOpening, closing, placeholder = "") {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const selected = value.slice(start, end);
  const content = selected || placeholder;
  const insert = `${opening}${afterOpening}${content}${closing}`;

  textarea.value = value.slice(0, start) + insert + value.slice(end);

  if (selected) {
    const nextStart = start + opening.length + afterOpening.length;
    const nextEnd = nextStart + selected.length;
    textarea.setSelectionRange(nextStart, nextEnd);
  } else {
    const caret = start + opening.length + afterOpening.length;
    textarea.setSelectionRange(caret, caret);
  }
  textarea.focus();
  dispatchInput(textarea);
}

function bindLivePreview() {
  const { noteBodyEl } = elements;
  if (!noteBodyEl) return;
  noteBodyEl.addEventListener("input", () => {
    const { previewPanelEl } = elements;
    // プレビュー表示中だけ更新（編集モードでは無駄な再描画をしない）
    if (previewPanelEl && !previewPanelEl.hidden) {
      renderPreviewPanel();
    }
  });
}

init();
