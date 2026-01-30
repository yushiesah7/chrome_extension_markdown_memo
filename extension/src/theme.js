// =================================================================
// Mermaid Markdown Memo - Theme Management
// =================================================================

const THEMES = ['light', 'dark', 'solarized-light', 'nord', 'dracula'];
const THEME_LABELS = {
  'light': 'Light',
  'dark': 'Dark',
  'solarized-light': 'Solarized Light',
  'nord': 'Nord',
  'dracula': 'Dracula'
};
const DEFAULT_THEME = 'light';
const STORAGE_KEY = 'selectedTheme';

let currentTheme = DEFAULT_THEME;

/**
 * Load theme from storage and apply it
 * @returns {Promise<string>} The loaded theme name
 */
export async function loadTheme() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const theme = result[STORAGE_KEY];
    if (theme && THEMES.includes(theme)) {
      currentTheme = theme;
    } else {
      currentTheme = DEFAULT_THEME;
    }
  } catch (error) {
    console.warn('Failed to load theme from storage:', error);
    currentTheme = DEFAULT_THEME;
  }
  applyTheme(currentTheme);
  return currentTheme;
}

/**
 * Apply theme to document
 * @param {string} theme - Theme name to apply
 */
export function applyTheme(theme) {
  if (!THEMES.includes(theme)) {
    theme = DEFAULT_THEME;
  }
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme = theme;
}

/**
 * Set and save theme
 * @param {string} theme - Theme name to set
 * @returns {Promise<void>}
 */
export async function setTheme(theme) {
  if (!THEMES.includes(theme)) {
    theme = DEFAULT_THEME;
  }
  applyTheme(theme);
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: theme });
  } catch (error) {
    console.error('Failed to save theme to storage:', error);
  }
}

/**
 * Get current theme
 * @returns {string} Current theme name
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * Get all available themes
 * @returns {Array<{id: string, label: string}>}
 */
export function getThemes() {
  return THEMES.map(id => ({ id, label: THEME_LABELS[id] }));
}

/**
 * Cycle to next theme
 * @returns {Promise<string>} The new theme name
 */
export async function cycleTheme() {
  const currentIndex = THEMES.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % THEMES.length;
  const nextTheme = THEMES[nextIndex];
  await setTheme(nextTheme);
  return nextTheme;
}

/**
 * Initialize theme - for backward compatibility
 * This replaces the old initializeTheme that used prefers-color-scheme
 */
export async function initializeTheme() {
  await loadTheme();
}

/**
 * Create theme selector UI element
 * @returns {HTMLElement} Theme selector container element
 */
export function createThemeSelectorUI() {
  const container = document.createElement('div');
  container.className = 'theme-selector';

  const button = document.createElement('button');
  button.className = 'theme-selector__button';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
    <span class="theme-selector__label">${THEME_LABELS[currentTheme]}</span>
  `;

  const dropdown = document.createElement('div');
  dropdown.className = 'theme-selector__dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('data-open', 'false');

  THEMES.forEach(themeId => {
    const option = document.createElement('button');
    option.className = 'theme-selector__option';
    option.type = 'button';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', themeId === currentTheme ? 'true' : 'false');
    option.dataset.theme = themeId;
    option.innerHTML = `
      <span class="theme-selector__swatch theme-selector__swatch--${themeId}"></span>
      <span>${THEME_LABELS[themeId]}</span>
    `;
    option.addEventListener('click', async () => {
      await setTheme(themeId);
      updateSelectorUI(container);
      closeDropdown(container);
    });
    dropdown.appendChild(option);
  });

  button.addEventListener('click', () => {
    const isOpen = dropdown.getAttribute('data-open') === 'true';
    dropdown.setAttribute('data-open', isOpen ? 'false' : 'true');
    button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      closeDropdown(container);
    }
  });

  container.appendChild(button);
  container.appendChild(dropdown);

  return container;
}

function updateSelectorUI(container) {
  const label = container.querySelector('.theme-selector__label');
  if (label) {
    label.textContent = THEME_LABELS[currentTheme];
  }
  const options = container.querySelectorAll('.theme-selector__option');
  options.forEach(option => {
    option.setAttribute('aria-selected', option.dataset.theme === currentTheme ? 'true' : 'false');
  });
}

function closeDropdown(container) {
  const dropdown = container.querySelector('.theme-selector__dropdown');
  const button = container.querySelector('.theme-selector__button');
  if (dropdown) dropdown.setAttribute('data-open', 'false');
  if (button) button.setAttribute('aria-expanded', 'false');
}
