import { renderMarkdown } from "./markdown.js";

// Mermaid初期化フラグ（1回のみ初期化）
let mermaidInitialized = false;

function initMermaidIfNeeded() {
  if (mermaidInitialized || typeof mermaid === "undefined") return;
  // Mermaid はユーザー入力を描画するため、strict設定で安全側に倒す
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    flowchart: { htmlLabels: false },
  });
  mermaidInitialized = true;
}

export function renderPreview({ text, target }) {
  if (!target) return;
  // プレビュー領域を初期化（毎回描画し直す）
  target.innerHTML = "";

  const container = document.createElement("div");
  container.className = "preview preview-markdown";

  // ```mermaid ... ``` は Markdown 本体と分離し、レンダリング後に図へ差し替える
  const mermaidBlocks = [];
  const placeholderPrefix = "@@MERMAID_BLOCK_";
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
