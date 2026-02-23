/**
 * color-engine.js
 *
 * 5色の必須入力 + 7色のオプショナル入力から全CSS変数を自動派生する計算エンジン。
 * テーマシステムの中核であり、ライトモード/ダークモードの判定、色の混合、
 * 明度調整、HSL/RGB変換などのユーティリティを提供する。
 */

/**
 * HEX カラー文字列を HSL に変換する。
 * @param {string} hex - '#rrggbb' 形式のカラー文字列
 * @returns {{ h: number, s: number, l: number }} h: 0-360, s: 0-100, l: 0-100
 */
export function hexToHSL(hex) {
  const { r, g, b } = hexToRGB(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
    } else if (max === gNorm) {
      h = ((bNorm - rNorm) / delta + 2) * 60;
    } else {
      h = ((rNorm - gNorm) / delta + 4) * 60;
    }
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * HSL を HEX カラー文字列に変換する。
 * @param {number} h - 色相 (0-360)
 * @param {number} s - 彩度 (0-100)
 * @param {number} l - 明度 (0-100)
 * @returns {string} '#rrggbb' 形式のカラー文字列
 */
export function hslToHex(h, s, l) {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h >= 0 && h < 60) {
    rPrime = c; gPrime = x; bPrime = 0;
  } else if (h >= 60 && h < 120) {
    rPrime = x; gPrime = c; bPrime = 0;
  } else if (h >= 120 && h < 180) {
    rPrime = 0; gPrime = c; bPrime = x;
  } else if (h >= 180 && h < 240) {
    rPrime = 0; gPrime = x; bPrime = c;
  } else if (h >= 240 && h < 300) {
    rPrime = x; gPrime = 0; bPrime = c;
  } else {
    rPrime = c; gPrime = 0; bPrime = x;
  }

  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);

  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * HEX カラー文字列を RGB に変換する。
 * @param {string} hex - '#rrggbb' 形式のカラー文字列
 * @returns {{ r: number, g: number, b: number }} r, g, b: 各 0-255
 */
export function hexToRGB(hex) {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

/**
 * sRGB チャンネル値 (0-255) をリニア値 (0-1) に変換する。
 * @param {number} channel - 0-255 の sRGB チャンネル値
 * @returns {number} リニアライズされた 0-1 の値
 */
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * HEX カラーの相対輝度を計算する（WCAG 2.2 準拠）。
 * @param {string} hex - '#rrggbb' 形式のカラー文字列
 * @returns {number} 相対輝度 (0-1)
 */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRGB(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * 背景色がライトモードかどうかを判定する。
 * W3C の相対輝度計算に基づき、WCAG の閾値 0.179 を使用する。
 * @param {string} bgHex - '#rrggbb' 形式の背景色
 * @returns {boolean} 相対輝度が 0.179 以上なら true（ライトモード）
 */
export function isLightMode(bgHex) {
  return relativeLuminance(bgHex) >= 0.179;
}

/**
 * 2色間の WCAG コントラスト比を計算する。
 * @param {string} hex1 - '#rrggbb' 形式のカラー文字列
 * @param {string} hex2 - '#rrggbb' 形式のカラー文字列
 * @returns {number} コントラスト比 (1-21)
 */
export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 背景色に対して WCAG AA (4.5:1) 以上のコントラストを持つテキスト色を返す。
 * 白(#ffffff)と黒(#000000)のうち、コントラスト比が高い方を選択する。
 * @param {string} bgHex - '#rrggbb' 形式の背景色
 * @returns {string} '#rrggbb' 形式のテキスト色
 */
export function ensureContrastText(bgHex) {
  const whiteCR = contrastRatio(bgHex, '#ffffff');
  const blackCR = contrastRatio(bgHex, '#000000');
  return whiteCR >= blackCR ? '#ffffff' : '#000000';
}

/**
 * 2色を指定比率で混合した不透明色を返す。
 * ratio=0 は color1、ratio=1 は color2 を意味する。
 * @param {string} color1 - '#rrggbb' 形式のカラー文字列
 * @param {string} color2 - '#rrggbb' 形式のカラー文字列
 * @param {number} ratio - 混合比率 (0-1)。0 で color1、1 で color2。
 * @returns {string} '#rrggbb' 形式の混合色
 */
export function mixColors(color1, color2, ratio) {
  const c1 = hexToRGB(color1);
  const c2 = hexToRGB(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
  const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
  const b = Math.round(c1.b + (c2.b - c1.b) * ratio);

  return '#' + [r, g, b].map(v =>
    Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  ).join('');
}

/**
 * 色の明度を指定量だけ調整する。
 * @param {string} hex - '#rrggbb' 形式のカラー文字列
 * @param {number} amount - 明度の調整量（%）。正で明るく、負で暗く。
 * @returns {string} '#rrggbb' 形式の調整後の色
 */
export function adjustLightness(hex, amount) {
  const { h, s, l } = hexToHSL(hex);
  const newL = Math.max(0, Math.min(100, l + amount));
  return hslToHex(h, s, newL);
}

/**
 * 5色の必須入力 + 7色のオプショナル入力から全CSS変数を自動派生する。
 * オプショナル色が null/undefined の場合は従来通り自動派生にフォールバック（後方互換）。
 *
 * @param {Object} colors - 基本色 + オプショナル色
 * @param {string} colors.bg - 背景色 '#rrggbb'（必須）
 * @param {string} colors.text - テキスト色 '#rrggbb'（必須）
 * @param {string} colors.accent - アクセント色 '#rrggbb'（必須）
 * @param {string} colors.sidebar - サイドバー色 '#rrggbb'（必須）
 * @param {string} colors.code - コード背景色 '#rrggbb'（必須）
 * @param {string|null} [colors.border] - ボーダー色（オプショナル）
 * @param {string|null} [colors.hover] - ホバー色（オプショナル）
 * @param {string|null} [colors.button] - ボタン色（オプショナル）
 * @param {string|null} [colors.danger] - エラー/削除色（オプショナル）
 * @param {string|null} [colors.success] - 保存成功色（オプショナル）
 * @param {string|null} [colors.secondaryText] - サブテキスト色（オプショナル）
 * @param {string|null} [colors.mutedText] - ミュートテキスト色（オプショナル）
 * @returns {Object.<string, string>} キーがCSS変数名、値がCSS値のオブジェクト
 */
export function deriveThemeVars({
  bg, text, accent, sidebar, code,
  border = null, hover = null, button = null,
  danger = null, success = null,
  secondaryText = null, mutedText = null,
}) {
  const light = isLightMode(bg);

  // サイドバーヘッダーのグラデーション中間色から WCAG AA 準拠テキスト色を算出
  const sidebarHeaderMid = mixColors(sidebar, '#000000', 0.2);
  const textOnSidebar = ensureContrastText(sidebarHeaderMid);

  // オプショナル色の実効値（指定があればその値、なければ自動派生）
  const eBorder = border || mixColors(bg, text, 0.08);
  const eHover = hover || mixColors(bg, accent, 0.15);
  const eButton = button || mixColors(bg, accent, 0.12);
  const eDanger = danger || (light ? '#ef4444' : '#f87171');
  const eSuccess = success || (light ? '#22c55e' : '#4ade80');
  const eSecondaryText = secondaryText || mixColors(text, bg, 0.35);
  const eMutedText = mutedText || mixColors(text, bg, 0.5);

  return {
    // 背景系
    '--bg-primary': bg,
    '--bg-secondary': adjustLightness(bg, light ? -3 : 5),
    '--bg-tertiary': adjustLightness(bg, light ? -6 : 10),
    '--bg-sidebar': sidebar,
    '--bg-sidebar-header': `linear-gradient(135deg, ${mixColors(sidebar, '#000000', 0.3)}, ${mixColors(sidebar, '#000000', 0.15)})`,
    '--bg-input': mixColors(bg, text, 0.05),
    '--bg-textarea': mixColors(bg, text, 0.03),
    '--bg-hover': eHover,
    '--bg-button': eButton,
    '--bg-button-hover': hover ? adjustLightness(hover, light ? -8 : 8) : mixColors(bg, accent, 0.22),
    '--bg-code': code,
    '--bg-preview': bg,

    // テキスト系
    '--text-primary': text,
    '--text-secondary': eSecondaryText,
    '--text-muted': eMutedText,
    '--text-inverse': textOnSidebar,

    // ボーダー系
    '--border-color': eBorder,
    '--border-color-light': border ? adjustLightness(border, light ? 5 : -5) : mixColors(bg, text, 0.14),
    '--border-color-input': border ? adjustLightness(border, light ? -12 : 12) : mixColors(bg, text, 0.25),

    // アクセント系
    '--accent-color': accent,
    '--accent-soft': mixColors(bg, accent, 0.12),
    '--accent-hover': adjustLightness(accent, light ? -10 : 10),

    // 状態色
    '--danger-color': eDanger,
    '--success-color': eSuccess,

    // シャドウ系
    '--shadow': `0 24px 50px ${light ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.35)'}`,
    '--shadow-soft': `0 10px 28px ${light ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.22)'}`,

    // ボタン系
    '--icon-color': secondaryText ? mixColors(eSecondaryText, bg, 0.1) : mixColors(text, bg, 0.3),
    '--icon-hover-color': eDanger,
    '--icon-hover-bg': mixColors(bg, text, 0.12),
    '--btn-ghost-hover-bg': mixColors(bg, text, 0.12),
    '--btn-copy-bg': mixColors(bg, text, 0.06),
    '--btn-copy-text': mixColors(text, bg, 0.2),
    '--btn-copy-border': mixColors(bg, text, 0.15),

    // コードブロック共通
    '--bg-code-block': mixColors(code, bg, 0.15),
    '--border-code-block': mixColors(bg, text, 0.2),
    '--text-code-block': light ? '#f8fafc' : mixColors(text, bg, 0.1),

    // モーダル
    '--bg-overlay': 'rgba(0, 0, 0, 0.55)',
    '--bg-modal': mixColors(code, bg, 0.1),
    '--bg-modal-border': mixColors(bg, text, 0.22),
    '--shadow-heavy': `0 24px 70px ${light ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.5)'}`,

    // ツールバー
    '--bg-toolbar': mixColors(bg, code, 0.25),
    '--border-toolbar': border ? mixColors(eBorder, text, 0.15) : mixColors(bg, text, 0.22),

    // セグメント
    '--bg-segmented': adjustLightness(bg, light ? -3 : 5),
    '--border-segmented': border ? mixColors(eBorder, text, 0.15) : mixColors(bg, text, 0.22),
    '--text-segmented': text,
    '--bg-segmented-active': mixColors(bg, accent, 0.18),

    // ステータス
    '--status-idle': eMutedText,
    '--status-saving': accent,
    '--status-saved': eSuccess,

    // ボタン補完
    '--bg-button-subtle': button ? mixColors(eButton, bg, 0.7) : mixColors(bg, text, 0.04),
    '--bg-button-default': button ? eButton : (light ? mixColors(bg, text, 0.1) : mixColors(bg, text, 0.2)),
    '--text-button-default': text,
    '--text-button-on-accent': ensureContrastText(accent),

    // ドキュメント
    '--bg-docs-header': adjustLightness(bg, light ? -6 : 8),
    '--bg-docs-content': bg,
    '--bg-docs-notice': adjustLightness(bg, light ? -3 : 5),
    '--bg-docs-details': adjustLightness(bg, light ? -1 : 3),
    '--bg-docs-error': mixColors(bg, eDanger, 0.06),
    '--border-docs-error': mixColors(bg, eDanger, 0.3),
    '--text-docs-heading': text,
    '--text-docs-body': mixColors(text, bg, 0.08),
    '--text-docs-muted': mutedText ? mixColors(eMutedText, bg, 0.1) : mixColors(text, bg, 0.4),
    '--text-docs-summary': mixColors(text, bg, 0.15),
    '--border-docs': border ? mixColors(eBorder, bg, 0.5) : mixColors(bg, text, 0.12),
    '--border-docs-section': border ? mixColors(eBorder, bg, 0.6) : mixColors(bg, text, 0.1),
    '--shadow-docs': `0 20px 54px ${light ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.35)'}`,

    // その他
    '--shadow-inset': `rgba(0, 0, 0, ${light ? '0.04' : '0.15'})`,
    '--text-info': mutedText ? eMutedText : mixColors(text, bg, 0.4),
    '--border-toolbar-btn': mixColors(bg, text, 0.2),
    '--text-toolbar-btn': text,
    '--checkbox-accent': accent,
  };
}
