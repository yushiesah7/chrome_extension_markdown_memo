// =================================================================
// Mermaid Markdown Memo - Options Page
// =================================================================

import { initializeTheme, setTheme, getCurrentTheme } from './theme.js';
import { deriveThemeVars } from './color-engine.js';
import { PRESET_BASE_COLORS, THEME_LIST } from './theme-presets.js';

// 全12色のメタデータ一元管理
const COLOR_DEFS = [
  // 必須5色（基本色グループ）
  { key: 'bg',       id: 'Bg',       label: '背景',           group: 'basic', required: true },
  { key: 'text',     id: 'Text',     label: 'テキスト',       group: 'basic', required: true },
  { key: 'accent',   id: 'Accent',   label: 'アクセント',     group: 'basic', required: true },
  { key: 'sidebar',  id: 'Sidebar',  label: 'サイドバー',     group: 'basic', required: true },
  { key: 'code',     id: 'Code',     label: 'コード背景',     group: 'basic', required: true },
  // オプショナル7色
  { key: 'border',        id: 'Border',        label: 'ボーダー',         group: 'ui',         required: false },
  { key: 'hover',         id: 'Hover',         label: 'ホバー',           group: 'ui',         required: false },
  { key: 'button',        id: 'Button',        label: 'ボタン',           group: 'ui',         required: false },
  { key: 'danger',        id: 'Danger',        label: 'エラー/削除',      group: 'state',      required: false },
  { key: 'success',       id: 'Success',       label: '保存成功',         group: 'state',      required: false },
  { key: 'secondaryText', id: 'SecondaryText', label: 'サブテキスト',     group: 'textDetail', required: false },
  { key: 'mutedText',     id: 'MutedText',     label: 'ミュートテキスト', group: 'textDetail', required: false },
];

const OPTIONAL_KEYS = COLOR_DEFS.filter(d => !d.required).map(d => d.key);

// DOM 要素
const $ = (id) => document.getElementById(id);

// 現在の色状態（オプショナルは null = 自動派生）
let currentColors = {
  ...PRESET_BASE_COLORS.dark,
  border: null, hover: null, button: null,
  danger: null, success: null,
  secondaryText: null, mutedText: null,
};

// 現在のプレビュータブ
let activePreviewTab = 'popup';

async function init() {
  await initializeTheme();
  const active = getCurrentTheme();

  buildThemeGrid(active);
  loadCustomColorsFromStorage(active);
  bindEvents();
}

// -----------------------------------------------------------------
// テーマグリッド
// -----------------------------------------------------------------
function buildThemeGrid(activeTheme) {
  const grid = $('themeGrid');
  grid.replaceChildren();

  for (const { id, label } of THEME_LIST) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card' + (id === activeTheme ? ' theme-card--active' : '');
    card.dataset.theme = id;
    card.innerHTML = `
      <span class="theme-card__swatch theme-card__swatch--${id}"></span>
      <span class="theme-card__label">${label}</span>
    `;
    card.addEventListener('click', () => selectTheme(id));
    grid.appendChild(card);
  }
}

async function selectTheme(themeId) {
  if (themeId === 'custom') {
    // カスタムセクションを開くだけ。テーマは保存するまで適用しない
    $('customSection').hidden = false;
    applyPreview();
    return;
  }

  $('customSection').hidden = true;
  await setTheme(themeId);

  updateGridActive(themeId);
}

function updateGridActive(themeId) {
  const cards = document.querySelectorAll('.theme-card');
  cards.forEach(c => {
    c.classList.toggle('theme-card--active', c.dataset.theme === themeId);
  });
}

// -----------------------------------------------------------------
// カスタムカラー
// -----------------------------------------------------------------
async function loadCustomColorsFromStorage(activeTheme) {
  try {
    const result = await chrome.storage.local.get('customThemeColors');
    if (result.customThemeColors) {
      // 旧5色フォーマットとの後方互換: オプショナルキーが存在しなければ null
      const saved = result.customThemeColors;
      currentColors = {
        bg: saved.bg,
        text: saved.text,
        accent: saved.accent,
        sidebar: saved.sidebar,
        code: saved.code,
        border: saved.border ?? null,
        hover: saved.hover ?? null,
        button: saved.button ?? null,
        danger: saved.danger ?? null,
        success: saved.success ?? null,
        secondaryText: saved.secondaryText ?? null,
        mutedText: saved.mutedText ?? null,
      };
    }
  } catch {
    // デフォルトのまま
  }

  syncPickersFromColors();

  if (activeTheme === 'custom') {
    $('customSection').hidden = false;
    applyPreview();
  }
}

/**
 * currentColors の状態をピッカーに反映する。
 * オプショナルが null の場合は派生値をピッカーに表示し、.color-picker--auto を付与する。
 */
function syncPickersFromColors() {
  // 必須5色
  for (const def of COLOR_DEFS.filter(d => d.required)) {
    $(`color${def.id}`).value = currentColors[def.key];
    $(`color${def.id}Hex`).value = currentColors[def.key];
  }

  // 派生値を取得（現在のオプショナル込みで）
  const vars = deriveThemeVars(currentColors);

  // CSS変数名からオプショナルキーへのマッピング
  const optionalVarMap = {
    border: '--border-color',
    hover: '--bg-hover',
    button: '--bg-button',
    danger: '--danger-color',
    success: '--success-color',
    secondaryText: '--text-secondary',
    mutedText: '--text-muted',
  };

  // オプショナル7色
  for (const def of COLOR_DEFS.filter(d => !d.required)) {
    const colorInput = $(`color${def.id}`);
    const hexInput = $(`color${def.id}Hex`);
    const pickerRow = colorInput.closest('.color-picker');
    const autoBtn = document.querySelector(`[data-auto-for="${def.key}"]`);
    const val = currentColors[def.key];

    if (val) {
      // 手動設定済み
      colorInput.value = val;
      hexInput.value = val;
      pickerRow.classList.remove('color-picker--auto');
      pickerRow.classList.add('color-picker--manual');
      if (autoBtn) autoBtn.classList.remove('color-picker__auto-btn--active');
    } else {
      // 自動派生 → 派生値を表示
      const derivedVal = vars[optionalVarMap[def.key]] || '#888888';
      colorInput.value = derivedVal;
      hexInput.value = derivedVal;
      pickerRow.classList.add('color-picker--auto');
      pickerRow.classList.remove('color-picker--manual');
      if (autoBtn) autoBtn.classList.add('color-picker__auto-btn--active');
    }
  }
}

// -----------------------------------------------------------------
// リアルタイムプレビュー
// -----------------------------------------------------------------
function applyPreview() {
  applyPreviewPopup();
  applyPreviewTab();
}

function applyPreviewPopup() {
  const vars = deriveThemeVars(currentColors);
  const panel = $('previewMini');
  if (!panel) return;

  const sidebar = panel.querySelector('.preview-mini__sidebar');
  const sidebarHeader = panel.querySelector('.preview-mini__sidebar-header');
  const sidebarItems = panel.querySelectorAll('.preview-mini__sidebar-item');
  const activeItem = panel.querySelector('.preview-mini__sidebar-item--active');
  const editor = panel.querySelector('.preview-mini__editor');
  const toolbar = panel.querySelector('.preview-mini__toolbar');
  const toolbarBtns = panel.querySelectorAll('.preview-mini__toolbar-btn');
  const activeBtn = panel.querySelector('.preview-mini__toolbar-btn--active');
  const content = panel.querySelector('.preview-mini__content');
  const titleBar = panel.querySelector('.preview-mini__title-bar');
  const textLines = panel.querySelectorAll('.preview-mini__text-line');
  const mutedLine = panel.querySelector('.preview-mini__text-line--muted');
  const codeBlock = panel.querySelector('.preview-mini__code-block');
  const codeText = panel.querySelector('.preview-mini__code-text');
  const accentBar = panel.querySelector('.preview-mini__accent-bar');

  // サイドバー
  sidebar.style.background = currentColors.sidebar;
  sidebar.style.borderColor = vars['--border-color'];
  sidebarHeader.style.color = vars['--text-inverse'];
  sidebarHeader.style.background = vars['--bg-sidebar-header'];
  sidebarItems.forEach(item => {
    item.style.color = vars['--text-inverse'];
  });
  if (activeItem) {
    activeItem.style.background = vars['--bg-hover'];
    activeItem.style.color = vars['--accent-color'];
  }

  // エディタ
  editor.style.background = currentColors.bg;
  toolbar.style.background = vars['--bg-toolbar'];
  toolbar.style.borderBottom = `1px solid ${vars['--border-toolbar']}`;
  toolbarBtns.forEach(btn => {
    btn.style.color = vars['--text-secondary'];
  });
  if (activeBtn) {
    activeBtn.style.background = vars['--bg-segmented-active'];
    activeBtn.style.color = vars['--accent-color'];
  }

  // コンテンツ
  content.style.background = currentColors.bg;
  titleBar.style.color = currentColors.text;
  textLines.forEach(line => {
    line.style.color = currentColors.text;
  });
  if (mutedLine) {
    mutedLine.style.color = vars['--text-muted'];
  }

  // コードブロック
  codeBlock.style.background = vars['--bg-code-block'];
  codeBlock.style.border = `1px solid ${vars['--border-code-block']}`;
  codeText.style.color = vars['--text-code-block'];

  // アクセントバー
  accentBar.style.background = currentColors.accent;

  // パネル外枠
  panel.style.borderColor = vars['--border-color'];
}

function applyPreviewTab() {
  const vars = deriveThemeVars(currentColors);
  const panel = $('previewTab');
  if (!panel) return;

  // パネル全体
  panel.style.background = currentColors.bg;
  panel.style.borderColor = vars['--border-color'];

  // Markdownツールバー
  const mdToolbar = panel.querySelector('.preview-mini__md-toolbar');
  mdToolbar.style.background = vars['--bg-toolbar'];
  mdToolbar.style.borderBottom = `1px solid ${vars['--border-toolbar']}`;
  const mdBtns = panel.querySelectorAll('.preview-mini__md-btn');
  mdBtns.forEach(btn => {
    btn.style.color = vars['--text-secondary'];
    btn.style.background = vars['--bg-button-subtle'];
  });

  // 左右分割 - エディタ側
  const splitEditor = panel.querySelector('.preview-mini__split-editor');
  splitEditor.style.background = currentColors.bg;

  const editorTextLines = splitEditor.querySelectorAll('.preview-mini__text-line');
  editorTextLines.forEach(line => {
    line.style.color = currentColors.text;
  });
  const editorMuted = splitEditor.querySelector('.preview-mini__text-line--muted');
  if (editorMuted) editorMuted.style.color = vars['--text-muted'];
  const editorAccent = splitEditor.querySelector('.preview-mini__text-line--accent');
  if (editorAccent) editorAccent.style.color = vars['--accent-color'];

  const editorCode = splitEditor.querySelector('.preview-mini__code-block');
  if (editorCode) {
    editorCode.style.background = vars['--bg-code-block'];
    editorCode.style.border = `1px solid ${vars['--border-code-block']}`;
    const editorCodeText = editorCode.querySelector('.preview-mini__code-text');
    if (editorCodeText) editorCodeText.style.color = vars['--text-code-block'];
  }

  // 分割線
  const divider = panel.querySelector('.preview-mini__split-divider');
  divider.style.background = vars['--border-color'];

  // 左右分割 - プレビュー側
  const splitPreview = panel.querySelector('.preview-mini__split-preview');
  splitPreview.style.background = vars['--bg-preview'];

  const renderedHeading = splitPreview.querySelector('.preview-mini__rendered-heading');
  if (renderedHeading) renderedHeading.style.color = currentColors.text;

  const renderedText = splitPreview.querySelector('.preview-mini__rendered-text');
  if (renderedText) renderedText.style.color = vars['--text-muted'];

  const renderedLink = splitPreview.querySelector('.preview-mini__rendered-link');
  if (renderedLink) renderedLink.style.color = vars['--accent-color'];

  const renderedCode = splitPreview.querySelector('.preview-mini__rendered-code');
  if (renderedCode) {
    renderedCode.style.background = vars['--bg-code-block'];
    renderedCode.style.color = vars['--text-code-block'];
    renderedCode.style.border = `1px solid ${vars['--border-code-block']}`;
  }

  // ステータスバー
  const statusbar = panel.querySelector('.preview-mini__statusbar');
  statusbar.style.background = vars['--bg-toolbar'];
  statusbar.style.borderTop = `1px solid ${vars['--border-toolbar']}`;

  const statusDot = panel.querySelector('.preview-mini__status-dot--saved');
  if (statusDot) statusDot.style.background = vars['--status-saved'];

  const statusText = panel.querySelector('.preview-mini__status-text');
  if (statusText) statusText.style.color = vars['--status-saved'];

  const statusInfo = panel.querySelector('.preview-mini__status-info');
  if (statusInfo) statusInfo.style.color = vars['--text-muted'];
}

// -----------------------------------------------------------------
// 保存 / リセット
// -----------------------------------------------------------------
async function saveCustomTheme() {
  try {
    // 基本色を保存 → theme.js がランタイムで全CSS変数を派生する
    await chrome.storage.local.set({
      customThemeColors: { ...currentColors },
      selectedTheme: 'custom',
    });
    // setTheme() が deriveThemeVars() → applyVarsToRoot() を一括実行
    await setTheme('custom');
    updateGridActive('custom');
    showStatus('保存しました');
  } catch (e) {
    console.error('Failed to save custom theme:', e);
    showStatus('保存に失敗しました');
  }
}

function resetCustomColors() {
  const baseId = $('baseTheme').value;
  currentColors = {
    ...PRESET_BASE_COLORS[baseId],
    border: null, hover: null, button: null,
    danger: null, success: null,
    secondaryText: null, mutedText: null,
  };
  syncPickersFromColors();
  applyPreview();
  showStatus('ベーステーマに戻しました');
}

function showStatus(message) {
  const el = $('customStatus');
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2000);
}

// -----------------------------------------------------------------
// イベントバインド
// -----------------------------------------------------------------
function bindEvents() {
  // 必須5色のカラーピッカー
  for (const def of COLOR_DEFS.filter(d => d.required)) {
    const colorInput = $(`color${def.id}`);
    const hexInput = $(`color${def.id}Hex`);
    const key = def.key;

    colorInput.addEventListener('input', () => {
      hexInput.value = colorInput.value;
      currentColors[key] = colorInput.value;
      syncPickersFromColors(); // オプショナルの自動派生値も更新
      applyPreview();
    });

    hexInput.addEventListener('input', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        colorInput.value = val;
        currentColors[key] = val;
        syncPickersFromColors();
        applyPreview();
      }
    });
  }

  // オプショナル7色のカラーピッカー
  for (const def of COLOR_DEFS.filter(d => !d.required)) {
    const colorInput = $(`color${def.id}`);
    const hexInput = $(`color${def.id}Hex`);
    const key = def.key;

    colorInput.addEventListener('input', () => {
      hexInput.value = colorInput.value;
      currentColors[key] = colorInput.value;
      syncPickersFromColors();
      applyPreview();
    });

    hexInput.addEventListener('input', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        colorInput.value = val;
        currentColors[key] = val;
        syncPickersFromColors();
        applyPreview();
      }
    });
  }

  // 「自動」ボタン
  document.querySelectorAll('.color-picker__auto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.autoFor;
      if (currentColors[key] !== null) {
        // 自動に戻す
        currentColors[key] = null;
      } else {
        // 自動解除 → 現在の派生値を手動値として設定
        const vars = deriveThemeVars(currentColors);
        const varMap = {
          border: '--border-color',
          hover: '--bg-hover',
          button: '--bg-button',
          danger: '--danger-color',
          success: '--success-color',
          secondaryText: '--text-secondary',
          mutedText: '--text-muted',
        };
        currentColors[key] = vars[varMap[key]] || '#888888';
      }
      syncPickersFromColors();
      applyPreview();
    });
  });

  // グループ折りたたみ
  document.querySelectorAll('.color-group__header').forEach(header => {
    header.addEventListener('click', () => {
      const group = header.closest('.color-group');
      group.classList.toggle('color-group--open');
      const chevron = header.querySelector('.color-group__chevron');
      chevron.textContent = group.classList.contains('color-group--open') ? '▾' : '▸';
    });
  });

  // プレビュータブ切替
  document.querySelectorAll('.preview-tabs__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.previewTab;
      activePreviewTab = tab;

      // タブボタンのアクティブ状態を切替
      document.querySelectorAll('.preview-tabs__btn').forEach(b => {
        b.classList.toggle('preview-tabs__btn--active', b.dataset.previewTab === tab);
      });

      // プレビュービューの表示切替（style.display で直接制御）
      $('previewMini').style.display = (tab === 'popup') ? '' : 'none';
      $('previewTab').style.display = (tab === 'tab') ? '' : 'none';

      applyPreview();
    });
  });

  // ベーステーマ変更
  $('baseTheme').addEventListener('change', () => {
    const baseId = $('baseTheme').value;
    currentColors = {
      ...PRESET_BASE_COLORS[baseId],
      border: null, hover: null, button: null,
      danger: null, success: null,
      secondaryText: null, mutedText: null,
    };
    syncPickersFromColors();
    applyPreview();
  });

  // 保存 / リセットボタン
  $('saveCustom').addEventListener('click', saveCustomTheme);
  $('resetCustom').addEventListener('click', resetCustomColors);

  // 戻るボタン
  $('backBtn').addEventListener('click', () => {
    // 履歴があれば戻る、なければタブを閉じる
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });
}

// -----------------------------------------------------------------
// 初期化
// -----------------------------------------------------------------
init();
