import { elements } from "./dom.js";
import { getActiveNote } from "./state.js";
import { renderPreview } from "./preview_renderer.js";

export function renderPreviewPanel() {
  // 現在のメモ本文をMarkdownとして描画し、Mermaidブロックがあれば図にする
  // プレビュー切替の瞬間に state へ反映前の入力があるため、textarea の値を優先する
  const editorText = elements.noteBodyEl?.value;
  const note = getActiveNote();
  const text = (typeof editorText === "string" ? editorText : note?.body) || "";
  const { previewContainerEl } = elements;
  if (!previewContainerEl) return;
  renderPreview({ text, target: previewContainerEl });
}

