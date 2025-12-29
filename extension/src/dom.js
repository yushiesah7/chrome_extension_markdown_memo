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
  openDocsEl: document.getElementById("openDocs"),
  copyAllEl: document.getElementById("copyAll"),
  modeEditEl: document.getElementById("modeEdit"),
  modePreviewEl: document.getElementById("modePreview"),
  editPanelEl: document.getElementById("editPanel"),
  previewPanelEl: document.getElementById("previewPanel"),
  previewContainerEl: document.getElementById("content"),
};

export function ensureElementsExist() {
  const requiredKeys = [
    "noteListEl",
    "noteTitleEl",
    "noteBodyEl",
    "createBtn",
    "deleteBtn",
    "sidebarEl",
    "sortToggleEl",
  ];

  const missing = requiredKeys.filter((key) => !elements[key]);
  if (missing.length > 0) {
    throw new Error(`必須DOM要素が見つかりません: ${missing.join(", ")}`);
  }
}
