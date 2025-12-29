import { loadNotesData, persistNotesData } from "./storage.js";

const DEFAULT_NOTE_TITLE = "新しいメモ";

const state = {
  notes: [],
  sortOrder: [],
  sortDirection: "desc",
  activeNoteId: null,
  draggedNoteId: null,
};

export async function initializeState() {
  const { notes, sortOrder, sortDirection, activeNoteId } = await loadNotesData();
  state.notes = Array.isArray(notes) ? [...notes] : [];
  state.sortOrder = normalizeSortOrder(state.notes, Array.isArray(sortOrder) ? sortOrder : []);
  state.sortDirection = sortDirection === "asc" ? "asc" : "desc";
  state.activeNoteId = activeNoteId || null;
  ensureActiveNote();
}

export function getNotes() {
  return state.notes;
}

export function getSortOrder() {
  return state.sortOrder;
}

export function setSortOrder(order) {
  if (!Array.isArray(order)) return;
  const noteIds = new Set(state.notes.map((note) => note.id));
  state.sortOrder = order.filter((id) => noteIds.has(id));
  ensureActiveNote();
}

export function getSortDirection() {
  return state.sortDirection;
}

export function getActiveNoteId() {
  return state.activeNoteId;
}

export function getActiveNote() {
  return state.notes.find((note) => note.id === state.activeNoteId) || null;
}

export function ensureActiveNote() {
  if (state.activeNoteId && state.notes.some((note) => note.id === state.activeNoteId)) {
    return;
  }
  state.activeNoteId = state.sortOrder[0] || null;
}

export function setActiveNoteId(noteId) {
  if (noteId && !state.notes.some((note) => note.id === noteId)) {
    return;
  }
  state.activeNoteId = noteId || null;
  ensureActiveNote();
}

export function createNote() {
  const timestamp = Date.now();
  const newNote = {
    id: crypto.randomUUID(),
    title: DEFAULT_NOTE_TITLE,
    body: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.notes.unshift(newNote);
  state.sortOrder.unshift(newNote.id);
  state.activeNoteId = newNote.id;
  return newNote;
}

export function deleteNote(noteId) {
  if (!noteId) return;
  state.notes = state.notes.filter((note) => note.id !== noteId);
  state.sortOrder = state.sortOrder.filter((id) => id !== noteId);
  if (state.activeNoteId === noteId) {
    state.activeNoteId = null;
  }
  ensureActiveNote();
}

export function updateActiveNote({ title, body }) {
  const note = getActiveNote();
  if (!note) return null;
  note.title = title;
  note.body = body;
  note.updatedAt = Date.now();
  return note;
}

export function reorderNotes(sourceId, targetId) {
  const fromIndex = state.sortOrder.indexOf(sourceId);
  const toIndex = state.sortOrder.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1) return;
  state.sortOrder.splice(fromIndex, 1);
  state.sortOrder.splice(toIndex, 0, sourceId);
}

export function setSortDirection(direction) {
  state.sortDirection = direction === "asc" ? "asc" : "desc";
}

export function setDraggedNoteId(noteId) {
  state.draggedNoteId = noteId;
}

export function getDraggedNoteId() {
  return state.draggedNoteId;
}

export async function persistState() {
  await persistNotesData(
    state.notes,
    state.sortOrder,
    state.sortDirection,
    state.activeNoteId
  );
}

function normalizeSortOrder(notes, sortOrder) {
  const noteIds = new Set(notes.map((note) => note.id));
  const normalizedOrder = sortOrder.filter((id) => noteIds.has(id));
  for (const note of notes) {
    if (!normalizedOrder.includes(note.id)) {
      normalizedOrder.push(note.id);
    }
  }
  return normalizedOrder;
}
