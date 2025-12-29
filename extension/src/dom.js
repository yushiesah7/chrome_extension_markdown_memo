export const elements = {
  noteListEl: document.getElementById("noteList"),
  noteTitleEl: document.getElementById("noteTitle"),
  noteBodyEl: document.getElementById("noteBody"),
  createBtn: document.getElementById("createNote"),
  deleteBtn: document.getElementById("deleteNote"),
  editorEl: document.querySelector(".editor"),
  noteMetaEl: document.getElementById("noteMeta"),
  noteCountEl: document.getElementById("noteCount"),
  statusIndicatorEl: document.querySelector(".status-indicator"),
  statusTextEl: document.querySelector(".editor__status-text"),
  sidebarEl: document.querySelector(".sidebar"),
  sortToggleEl: document.getElementById("sortToggle"),
  previewButtonEl: document.getElementById("previewButton"),
  previewModalEl: document.getElementById("previewModal"),
  previewBackdropEl: document.getElementById("previewBackdrop"),
  previewBodyEl: document.getElementById("previewBody"),
  previewCloseEl: document.getElementById("previewClose"),
};

export function ensureElementsExist() {
  const missing = Object.entries(elements)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`必須DOM要素が見つかりません: ${missing.join(", ")}`);
  }
}
