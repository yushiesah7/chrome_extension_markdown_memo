const NOTE_STORAGE_KEY = "notes";
const ORDER_STORAGE_KEY = "noteSortOrder";
const SORT_DIRECTION_KEY = "sortDirection";
const ACTIVE_NOTE_KEY = "activeNoteId";

function withStorage(action) {
  return new Promise((resolve, reject) => {
    action((result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

export async function loadNotesData() {
  const defaults = {
    [NOTE_STORAGE_KEY]: [],
    [ORDER_STORAGE_KEY]: [],
    [SORT_DIRECTION_KEY]: "desc",
    [ACTIVE_NOTE_KEY]: null,
  };

  const result = await withStorage((resolve) => {
    chrome.storage.local.get(defaults, (items) => resolve(items));
  });

  return {
    notes: result[NOTE_STORAGE_KEY] || [],
    sortOrder: result[ORDER_STORAGE_KEY] || [],
    sortDirection: result[SORT_DIRECTION_KEY] || "desc",
    activeNoteId: result[ACTIVE_NOTE_KEY] || null,
  };
}

export async function persistNotesData(notes, sortOrder, sortDirection, activeNoteId) {
  const payload = {
    [NOTE_STORAGE_KEY]: notes,
    [ORDER_STORAGE_KEY]: sortOrder,
    [SORT_DIRECTION_KEY]: sortDirection || "desc",
    [ACTIVE_NOTE_KEY]: activeNoteId || null,
  };

  await withStorage((resolve) => {
    chrome.storage.local.set(payload, () => resolve());
  });
}
