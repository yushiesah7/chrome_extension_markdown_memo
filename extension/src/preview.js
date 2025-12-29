import { ensureElementsExist, elements } from "./dom.js";
import { initializeTheme } from "./theme.js";
import { initializeState, getActiveNote, getNotes } from "./state.js";
import { attachEventListeners, renderApp } from "./events.js";
import { setStatus } from "./render.js";
import { renderPreview } from "./preview_renderer.js";

// プレビュータブであることを明示
document.body.dataset.previewTab = "true";

async function init() {
  try {
    ensureElementsExist();
  } catch (error) {
    console.error("プレビュータブ初期化に必要なDOM要素が見つかりません。", error);
    return;
  }

  initializeTheme();
  attachEventListeners();

  try {
    await initializeState();
  } catch (error) {
    console.error("メモの読み込みに失敗しました。", error);
    setStatus("idle", "メモの読み込みに失敗しました");
    return;
  }

  bindModeToggle();
  bindCopyAll();
  bindLivePreview();

  renderApp();
  renderPreviewPanel();
}

function bindModeToggle() {
  const { modeEditEl, modePreviewEl, editPanelEl, previewPanelEl } = elements;
  if (!modeEditEl || !modePreviewEl || !editPanelEl || !previewPanelEl) return;

  const setMode = (mode) => {
    const isEdit = mode === "edit";
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
    if (previewPanelEl && !previewPanelEl.hidden) {
      renderPreviewPanel();
    }
  });
}

export function renderPreviewPanel() {
  const note = getActiveNote();
  const text = note?.body || "";
  const { previewContainerEl } = elements;
  if (!previewContainerEl) return;
  renderPreview({ text, target: previewContainerEl });
}

init();
