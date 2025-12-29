const NOTE_STORAGE_KEY = "notes";
const ORDER_STORAGE_KEY = "noteSortOrder";
const SORT_DIRECTION_KEY = "sortDirection";

function withStorage(action) {
  return new Promise((resolve) => {
    action(resolve);
  });
}

export async function loadNotesData() {
  const defaults = {
    [NOTE_STORAGE_KEY]: [],
    [ORDER_STORAGE_KEY]: [],
    [SORT_DIRECTION_KEY]: "desc",
  };

  const result = await withStorage((resolve) => {
    chrome.storage.local.get(defaults, (items) => resolve(items));
  });

  return {
    notes: result[NOTE_STORAGE_KEY] || [],
    sortOrder: result[ORDER_STORAGE_KEY] || [],
    sortDirection: result[SORT_DIRECTION_KEY] || "desc",
  };
}

export async function persistNotesData(notes, sortOrder, sortDirection) {
  const payload = {
    [NOTE_STORAGE_KEY]: notes,
    [ORDER_STORAGE_KEY]: sortOrder,
    [SORT_DIRECTION_KEY]: sortDirection || "desc",
  };

  await withStorage((resolve) => {
    chrome.storage.local.set(payload, () => resolve());
  });
}
