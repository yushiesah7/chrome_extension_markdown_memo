const NOTE_STORAGE_KEY = "notes";
const ORDER_STORAGE_KEY = "noteSortOrder";

function withStorage(action) {
  return new Promise((resolve) => {
    action(resolve);
  });
}

export async function loadNotesData() {
  const defaults = {
    [NOTE_STORAGE_KEY]: [],
    [ORDER_STORAGE_KEY]: [],
  };

  const result = await withStorage((resolve) => {
    chrome.storage.local.get(defaults, (items) => resolve(items));
  });

  return {
    notes: result[NOTE_STORAGE_KEY] || [],
    sortOrder: result[ORDER_STORAGE_KEY] || [],
  };
}

export async function persistNotesData(notes, sortOrder) {
  const payload = {
    [NOTE_STORAGE_KEY]: notes,
    [ORDER_STORAGE_KEY]: sortOrder,
  };

  await withStorage((resolve) => {
    chrome.storage.local.set(payload, () => resolve());
  });
}
