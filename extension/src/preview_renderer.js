import { renderMarkdown } from "./markdown.js";

// ---------------------------------------------------------------------------
// DOM-based sanitization（多層防御）
// renderMarkdown() の escapeHtml で基本的な XSS は防がれるが、
// 万が一のエスケープ漏れに備え innerHTML 代入後に危険な要素/属性を除去する。
// ---------------------------------------------------------------------------
const DANGEROUS_TAGS = new Set([
  "SCRIPT", "IFRAME", "OBJECT", "EMBED", "FORM",
  "STYLE", "LINK", "META", "BASE", "APPLET",
  "MATH", "SVG",          // SVGコンテキストでの攻撃防止（Mermaid由来は別途安全に処理）
  "TEMPLATE", "SLOT",
]);

function sanitizeDOM(container) {
  // 1. 危険な要素を除去
  const selector = Array.from(DANGEROUS_TAGS).join(",").toLowerCase();
  for (const el of Array.from(container.querySelectorAll(selector))) {
    el.remove();
  }

  // 2. 全要素のイベントハンドラ属性・危険 URL を除去
  for (const el of Array.from(container.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      // on* イベントハンドラ（onclick, onerror 等）
      if (/^on/i.test(attr.name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      // javascript: / data:text/html URL
      if (["href", "src", "action", "formaction", "xlink:href"].includes(attr.name)) {
        const val = attr.value.replace(/\s+/g, "").toLowerCase();
        if (val.startsWith("javascript:") || val.startsWith("data:text/html")) {
          el.removeAttribute(attr.name);
        }
      }
    }
  }
}

// Mermaid初期化フラグ（1回のみ初期化）
let mermaidInitialized = false;

function initMermaidIfNeeded() {
  if (mermaidInitialized || typeof mermaid === "undefined") return;
  // 現在の data-theme から Mermaid テーマを決定
  const dataTheme = document.documentElement.getAttribute("data-theme") || "light";
  const lightThemes = ["light", "solarized-light"];
  const mermaidTheme = lightThemes.includes(dataTheme) ? "default" : "dark";
  mermaid.initialize({
    startOnLoad: false,
    theme: mermaidTheme,
    securityLevel: "strict",
    flowchart: { htmlLabels: false },
  });
  mermaidInitialized = true;
}

/**
 * テーマ変更時にMermaidを再初期化する
 * @param {string} theme - 適用するテーマ名 ('dark', 'default', 'forest', 'neutral', etc.)
 */
export function reinitializeMermaidWithTheme(theme = "dark") {
  if (typeof mermaid === "undefined") return;

  // 初期化されていなければ先に初期化
  if (!mermaidInitialized) {
    initMermaidIfNeeded();
  }

  // テーマ設定を更新
  mermaid.initialize({
    startOnLoad: false,
    theme: theme,
    securityLevel: "strict",
    flowchart: { htmlLabels: false },
  });

  // 既存のダイアグラムを再レンダリング
  const mermaidElements = document.querySelectorAll(".preview-markdown .mermaid");
  mermaidElements.forEach((el) => {
    // data-processed を削除して再処理可能にする
    el.removeAttribute("data-processed");
  });

  // 再レンダリング実行
  if (mermaidElements.length > 0) {
    try {
      mermaid.run({ querySelector: ".preview-markdown .mermaid" });
    } catch (e) {
      console.error("Mermaid re-render error", e);
    }
  }
}

export function renderPreview({ text, target }) {
  if (!target) return;
  // プレビュー領域を初期化（毎回描画し直す）
  target.replaceChildren();

  const container = document.createElement("div");
  container.className = "preview preview-markdown";

  // ```mermaid ... ``` は Markdown 本体と分離し、レンダリング後に図へ差し替える
  const mermaidBlocks = [];
  // ランダムnonce付きプレースホルダーでユーザー入力との衝突を防止
  // NOTE: NUL(\x00)はHTMLパーサで置換される可能性があるため使わない
  const nonce = crypto.randomUUID();
  const placeholderPrefix = `@@MERMAID_BLOCK_${nonce}_`;
  const placeholderSuffix = "@@";

  const processed = (text || "").replace(
    /```mermaid\s*\n([\s\S]*?)\n```/g,
    (_, code) => {
      const idx = mermaidBlocks.length;
      mermaidBlocks.push(String(code || "").trim());
      return `\n${placeholderPrefix}${idx}${placeholderSuffix}\n`;
    }
  );

  // Markdown を HTML に変換して表示
  container.innerHTML = renderMarkdown(processed);
  // 多層防御: 万が一のエスケープ漏れに備え危険な要素/属性を除去
  sanitizeDOM(container);

  // Mermaidプレースホルダーを図ブロックへ差し替え
  let hasMermaid = false;
  for (let i = 0; i < mermaidBlocks.length; i++) {
    const token = `${placeholderPrefix}${i}${placeholderSuffix}`;
    const candidates = Array.from(container.querySelectorAll("p"));
    const targetEl = candidates.find((p) => p.textContent?.trim() === token);
    if (!targetEl) continue;

    const wrapper = document.createElement("div");
    wrapper.className = "mermaid-block";

    const code = mermaidBlocks[i];
    // ブロック単位コピー（元の mermaid コードとしてコピーする）
    const copyBtn = buildCopyButton("```mermaid\n" + code + "\n```\n");
    const el = document.createElement("div");
    el.className = "mermaid";
    el.textContent = code;
    wrapper.appendChild(copyBtn);
    wrapper.appendChild(el);

    targetEl.replaceWith(wrapper);
    hasMermaid = true;
  }

  // 通常のコードブロック（<pre>）にもコピーを付ける
  const preEls = Array.from(container.querySelectorAll("pre"));
  for (const pre of preEls) {
    if (pre.closest(".mermaid-block")) continue;
    if (pre.parentElement?.classList.contains("code-block")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    const copyBtn = buildCopyButton(pre.textContent || "");
    pre.replaceWith(wrapper);
    wrapper.appendChild(copyBtn);
    wrapper.appendChild(pre);
  }

  if (!container.textContent?.trim()) {
    container.innerHTML = "<p>(プレビュー対象がありません)</p>";
  }

  target.appendChild(container);

  if (hasMermaid && typeof mermaid !== "undefined") {
    try {
      initMermaidIfNeeded();
      mermaid.run({ querySelector: ".preview-markdown .mermaid" });
    } catch (e) {
      console.error("Mermaid render error", e);
    }
  }
}

function buildCopyButton(text) {
  // UI上の「コピー」ボタン（クリックでクリップボードへ）
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copy-button";
  btn.textContent = "コピー";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "コピー済";
      setTimeout(() => (btn.textContent = "コピー"), 1200);
    } catch (e) {
      btn.textContent = "失敗";
      setTimeout(() => (btn.textContent = "コピー"), 1200);
    }
  });
  return btn;
}
