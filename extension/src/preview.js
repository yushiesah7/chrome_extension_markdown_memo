import { ensureElementsExist, elements } from "./dom.js";
import { initializeTheme } from "./theme.js";
import { initializeState, getActiveNote } from "./state.js";
import { attachEventListeners, renderApp } from "./events.js";
import { setStatus } from "./render.js";
import { renderPreview } from "./preview_renderer.js";

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

  // テーマ（ダーク/ライト）を反映
  initializeTheme();
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

  // 画面を描画（一覧/エディタ/メタ情報）
  renderApp();
  // 初回表示時のプレビュー内容
  renderPreviewPanel();
}

function bindModeToggle() {
  const { modeEditEl, modePreviewEl, editPanelEl, previewPanelEl } = elements;
  if (!modeEditEl || !modePreviewEl || !editPanelEl || !previewPanelEl) return;

  const setMode = (mode) => {
    const isEdit = mode === "edit";
    // 編集: textarea / プレビュー: rendered view
    editPanelEl.hidden = !isEdit;
    previewPanelEl.hidden = isEdit;
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

export function renderPreviewPanel() {
  // 現在のメモ本文をMarkdownとして描画し、Mermaidブロックがあれば図にする
  const note = getActiveNote();
  const text = note?.body || "";
  const { previewContainerEl } = elements;
  if (!previewContainerEl) return;
  renderPreview({ text, target: previewContainerEl });
}

init();
