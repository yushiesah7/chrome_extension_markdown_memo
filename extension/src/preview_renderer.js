export function renderPreview({ text, target }) {
  if (!target) return;
  // プレビュー領域を初期化（毎回描画し直す）
  target.innerHTML = "";
  const container = document.createElement("div");
  container.className = "preview-markdown";

  // ``` で区切ってコードブロックを簡易的に抽出
  const parts = (text || "").split(/```/);
  let hasMermaid = false;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const block = parts[i];
      const firstLine = block.split("\n")[0].trim();
      if (firstLine === "mermaid") {
        // ```mermaid ... ``` を Mermaid 描画対象として扱う
        const code = block.split("\n").slice(1).join("\n");
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-block";

        // ブロック単位コピー（元の mermaid コードとしてコピーする）
        const copyBtn = buildCopyButton("```mermaid\n" + code + "\n```\n");
        const el = document.createElement("div");
        el.className = "mermaid";
        el.textContent = code;

        wrapper.appendChild(copyBtn);
        wrapper.appendChild(el);
        container.appendChild(wrapper);
        hasMermaid = true;
        continue;
      }
    }

    // Markdown本文（通常テキスト部分）はコードブロックとして表示
    const trimmed = parts[i].trim();
    if (trimmed) {
      const wrapper = document.createElement("div");
      wrapper.className = "code-block";
      // ブロック単位コピー（このブロックの文字列をそのままコピー）
      const copyBtn = buildCopyButton(parts[i]);
      const pre = document.createElement("pre");
      pre.textContent = parts[i];
      wrapper.appendChild(copyBtn);
      wrapper.appendChild(pre);
      container.appendChild(wrapper);
    }
  }

  if (!container.childElementCount) {
    const pre = document.createElement("pre");
    pre.textContent = text || "(プレビュー対象がありません)";
    container.appendChild(pre);
  }

  target.appendChild(container);

  if (hasMermaid && typeof mermaid !== "undefined") {
    try {
      // Mermaid はユーザー入力を描画するため、strict設定で安全側に倒す
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        flowchart: { htmlLabels: false },
      });
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
