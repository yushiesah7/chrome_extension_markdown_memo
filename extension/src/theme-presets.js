// =================================================================
// Mermaid Markdown Memo - Theme Presets (Single Source of Truth)
//
// 全プリセットテーマの基本色を一元管理する。
// color-engine.js の deriveThemeVars() と組み合わせて、
// ここの定義だけで全CSS変数が自動派生される。
// =================================================================

/**
 * プリセットテーマの基本色定義。
 * 各テーマは5色の必須色で識別される。
 * deriveThemeVars() がこれらから ~70 のCSS変数を自動計算する。
 *
 * @type {Object.<string, {bg: string, text: string, accent: string, sidebar: string, code: string}>}
 */
export const PRESET_BASE_COLORS = {
  light: {
    bg:      '#ffffff',
    text:    '#0f172a',
    accent:  '#2563eb',
    sidebar: '#ffffff',
    code:    '#0f172a',
  },
  dark: {
    bg:      '#1e1e1e',
    text:    '#e0e0e0',
    accent:  '#4da6ff',
    sidebar: '#0b1120',
    code:    '#0f172a',
  },
  'solarized-light': {
    bg:      '#fdf6e3',
    text:    '#657b83',
    accent:  '#268bd2',
    sidebar: '#fdf6e3',
    code:    '#002b36',
  },
  nord: {
    bg:      '#2e3440',
    text:    '#eceff4',
    accent:  '#88c0d0',
    sidebar: '#2e3440',
    code:    '#242933',
  },
  dracula: {
    bg:      '#282a36',
    text:    '#f8f8f2',
    accent:  '#bd93f9',
    sidebar: '#21222c',
    code:    '#1e1f29',
  },
};

/**
 * テーマ一覧（表示順序付き）。
 * UI のテーマ選択グリッドやドロップダウンで使用する。
 *
 * @type {Array<{id: string, label: string}>}
 */
export const THEME_LIST = [
  { id: 'light',            label: 'Light' },
  { id: 'dark',             label: 'Dark' },
  { id: 'solarized-light',  label: 'Solarized Light' },
  { id: 'nord',             label: 'Nord' },
  { id: 'dracula',          label: 'Dracula' },
  { id: 'custom',           label: 'Custom' },
];

/**
 * 有効なテーマID一覧。
 * @type {string[]}
 */
export const THEME_IDS = THEME_LIST.map(t => t.id);

/**
 * テーマID → ラベルのマップ。
 * @type {Object.<string, string>}
 */
export const THEME_LABELS = Object.fromEntries(THEME_LIST.map(t => [t.id, t.label]));

/**
 * デフォルトテーマ。
 * @type {string}
 */
export const DEFAULT_THEME = 'light';
