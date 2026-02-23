export function renderMarkdown(text) {
  if (!text) {
    return "<p>内容がありません。</p>";
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inUl = false;
  let inOl = false;
  let inCodeBlock = false;
  const codeBuffer = [];

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  const escapeHtml = (str) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatInline = (str) => {
    const codeSpans = [];
    // ランダムnonce付きプレースホルダーでユーザー入力との衝突を防止
    // NOTE: NUL(\x00)はHTMLパーサで置換される可能性があるため使わない
    const nonce = crypto.randomUUID();
    const placeholderPrefix = `@@INLINE_CODE_SPAN_${nonce}_`;
    const placeholderSuffix = "@@";

    // 1. コードスパンをプレースホルダーに置換して退避
    const processed = String(str || "").replace(/`([^`]+)`/g, (_, code) => {
      const idx = codeSpans.length;
      codeSpans.push(String(code ?? ""));
      return `${placeholderPrefix}${idx}${placeholderSuffix}`;
    });

    // 2. エスケープと他のインライン書式処理
    let escaped = escapeHtml(processed);
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // 3. プレースホルダーを実際のcodeタグに復元
    for (let i = 0; i < codeSpans.length; i++) {
      const token = `${placeholderPrefix}${i}${placeholderSuffix}`;
      escaped = escaped.replaceAll(token, `<code>${escapeHtml(codeSpans[i])}</code>`);
    }
    return escaped;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```") && !inCodeBlock) {
      closeLists();
      inCodeBlock = true;
      codeBuffer.length = 0;
      continue;
    }

    if (trimmed.startsWith("```") && inCodeBlock) {
      const codeHtml = escapeHtml(codeBuffer.join("\n"));
      html.push(`<pre><code>${codeHtml}</code></pre>`);
      codeBuffer.length = 0;
      inCodeBlock = false;
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!trimmed) {
      closeLists();
      html.push("<p></p>");
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      const content = formatInline(headingMatch[2]);
      html.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!inUl) {
        closeLists();
        html.push("<ul>");
        inUl = true;
      }
      const itemText = ulMatch[1];
      const taskMatch = itemText.match(/^\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        const checked = String(taskMatch[1]).toLowerCase() === "x";
        const content = formatInline(taskMatch[2]);
        html.push(
          `<li class="task-list-item"><input type="checkbox" disabled${
            checked ? " checked" : ""
          }> ${content}</li>`
        );
      } else {
        html.push(`<li>${formatInline(itemText)}</li>`);
      }
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        html.push("<ol>");
        inOl = true;
      }
      html.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeLists();

  return html.join("\n");
}
