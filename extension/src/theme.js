// =================================================================
// Mermaid Markdown Memo - Theme Management
//
// 全テーマ（プリセット + カスタム）を color-engine.js 経由で統一的に
// CSS変数を派生・適用する。テーマの「正体」は基本色の組み合わせであり、
// それ以外の ~70 のCSS変数は全て自動計算される。
// =================================================================

import { deriveThemeVars, isLightMode } from './color-engine.js';
import {
  PRESET_BASE_COLORS,
  THEME_IDS,
  THEME_LABELS,
  DEFAULT_THEME,
} from './theme-presets.js';

const STORAGE_KEY = 'selectedTheme';

let currentTheme = DEFAULT_THEME;

/**
 * Load theme from storage and apply it.
 * @returns {Promise<string>} The loaded theme name
 */
export async function loadTheme() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY, 'customThemeColors']);
    const theme = result[STORAGE_KEY];
    if (theme && THEME_IDS.includes(theme)) {
      currentTheme = theme;
    } else {
      currentTheme = DEFAULT_THEME;
    }
    if (currentTheme === 'custom' && result.customThemeColors) {
      cachedCustomColors = result.customThemeColors;
    }
  } catch (error) {
    console.warn('Failed to load theme from storage:', error);
    currentTheme = DEFAULT_THEME;
  }
  applyTheme(currentTheme);
  return currentTheme;
}

/** カスタムテーマの基本色キャッシュ */
let cachedCustomColors = null;

/**
 * Apply theme to document.
 * 全テーマ（プリセット含む）を deriveThemeVars() 経由で CSS変数に変換して適用する。
 * @param {string} theme - Theme name to apply
 */
export function applyTheme(theme) {
  if (!THEME_IDS.includes(theme)) {
    theme = DEFAULT_THEME;
  }

  // data-theme 属性を設定（CSS フォールバック + コンポーネントスタイル用）
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme = theme;

  // 基本色を決定
  let baseColors = null;
  if (theme === 'custom') {
    baseColors = cachedCustomColors;
  } else {
    baseColors = PRESET_BASE_COLORS[theme];
  }

  if (baseColors) {
    // color-engine.js で全CSS変数を派生して適用
    const vars = deriveThemeVars(baseColors);
    applyVarsToRoot(vars);
    // Mermaid 図のテーマも連動（ライト系 → default、ダーク系 → dark）
    syncMermaidTheme(baseColors.bg);
  } else {
    // 基本色がない場合（custom が未保存など）→ インライン変数をクリア
    clearInlineVars();
  }
}

/**
 * 背景色に応じて Mermaid のテーマを切り替える。
 * @param {string} bgHex - 背景色
 */
function syncMermaidTheme(bgHex) {
  if (typeof globalThis.mermaid === 'undefined') return;
  const mermaidTheme = isLightMode(bgHex) ? 'default' : 'dark';
  try {
    globalThis.mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'strict',
      flowchart: { htmlLabels: false },
    });
    // 既存の図を再レンダリング
    const els = document.querySelectorAll('.mermaid[data-processed]');
    els.forEach(el => el.removeAttribute('data-processed'));
    if (els.length > 0) {
      globalThis.mermaid.run({ querySelector: '.mermaid' });
    }
  } catch (e) {
    console.warn('Mermaid theme sync failed:', e);
  }
}

/**
 * CSS変数を :root にインライン適用する。
 * @param {Object.<string, string>} vars - CSS変数名→値のマップ
 */
function applyVarsToRoot(vars) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('--')) {
      root.style.setProperty(key, value);
    }
  }
}

/**
 * :root のインラインCSS変数をすべて除去する。
 */
function clearInlineVars() {
  const root = document.documentElement;
  const toRemove = [];
  for (let i = 0; i < root.style.length; i++) {
    const prop = root.style[i];
    if (prop.startsWith('--')) {
      toRemove.push(prop);
    }
  }
  for (const prop of toRemove) {
    root.style.removeProperty(prop);
  }
}

/**
 * Set and save theme.
 * @param {string} theme - Theme name to set
 * @returns {Promise<void>}
 */
export async function setTheme(theme) {
  if (!THEME_IDS.includes(theme)) {
    theme = DEFAULT_THEME;
  }
  // custom テーマの場合、保存済みの基本色をロードしてキャッシュ
  if (theme === 'custom') {
    try {
      const result = await chrome.storage.local.get('customThemeColors');
      cachedCustomColors = result.customThemeColors || null;
    } catch (e) {
      console.warn('Failed to load custom theme colors:', e);
    }
  }
  applyTheme(theme);
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: theme });
  } catch (error) {
    console.error('Failed to save theme to storage:', error);
  }
}

/**
 * Get current theme.
 * @returns {string} Current theme name
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * Get all available themes.
 * @returns {Array<{id: string, label: string}>}
 */
export function getThemes() {
  return THEME_IDS.map(id => ({ id, label: THEME_LABELS[id] }));
}

/**
 * Cycle to next theme.
 * @returns {Promise<string>} The new theme name
 */
export async function cycleTheme() {
  const currentIndex = THEME_IDS.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % THEME_IDS.length;
  const nextTheme = THEME_IDS[nextIndex];
  await setTheme(nextTheme);
  return nextTheme;
}

/**
 * Initialize theme — for backward compatibility.
 * テーマのロードとストレージ変更リスナーの登録を行う。
 */
export async function initializeTheme() {
  await loadTheme();
  // 他ページでのテーマ変更をリアルタイムで反映
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY]) {
      const newTheme = changes[STORAGE_KEY].newValue;
      if (newTheme && THEME_IDS.includes(newTheme)) {
        if (newTheme === 'custom') {
          // カスタムテーマ: 基本色が同バッチに含まれているか確認
          if (changes.customThemeColors) {
            cachedCustomColors = changes.customThemeColors.newValue || null;
          } else {
            chrome.storage.local.get('customThemeColors').then(result => {
              cachedCustomColors = result.customThemeColors || null;
              applyTheme(newTheme);
              updateAllSelectorUIs();
            });
            return;
          }
        }
        applyTheme(newTheme);
        currentTheme = newTheme;
        updateAllSelectorUIs();
      }
    } else if (changes.customThemeColors && currentTheme === 'custom') {
      // カスタムテーマ適用中に基本色のみ更新された場合
      cachedCustomColors = changes.customThemeColors.newValue || null;
      applyTheme('custom');
    }
  });
}

/** ページ内の全テーマセレクタUIを更新する */
function updateAllSelectorUIs() {
  const containers = document.querySelectorAll('.theme-selector');
  for (const container of containers) {
    updateSelectorUI(container);
  }
}

/**
 * Create theme selector UI element.
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

  THEME_IDS.forEach(themeId => {
    const option = document.createElement('button');
    option.className = 'theme-selector__option';
    option.type = 'button';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', themeId === currentTheme ? 'true' : 'false');
    option.dataset.theme = themeId;
    if (themeId === 'custom') {
      option.innerHTML = `
        <span class="theme-selector__swatch theme-selector__swatch--${themeId}"></span>
        <span>${THEME_LABELS[themeId]}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto;opacity:0.5">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      `;
    } else {
      option.innerHTML = `
        <span class="theme-selector__swatch theme-selector__swatch--${themeId}"></span>
        <span>${THEME_LABELS[themeId]}</span>
      `;
    }
    option.addEventListener('click', async () => {
      if (themeId === 'custom') {
        await setTheme(themeId);
        updateSelectorUI(container);
        closeDropdown(container);
        chrome.runtime.openOptionsPage();
        return;
      }
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
