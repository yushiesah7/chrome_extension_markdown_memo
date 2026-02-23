import { initializeTheme, getCurrentTheme } from "./theme.js";
import { PRESET_BASE_COLORS } from "./theme-presets.js";
import { isLightMode } from "./color-engine.js";

async function init() {
  // テーマを初期化（ストレージから読み込み）
  await initializeTheme();

  // 仕様書ページ（docs.html）内の閉じるボタン
  const closeBtn = document.getElementById("close");
  closeBtn?.addEventListener("click", () => {
    // タブで開かれた場合は window.close() が効かないことがあるため、フォールバックを用意する
    try {
      window.close();
    } catch (e) {
      // ignore
    }

    // closeが失敗した場合のフォールバック（戻る or 案内表示）
    setTimeout(() => {
      if (window.closed) return;
      try {
        if (typeof history !== "undefined" && history.length > 1) {
          history.back();
          return;
        }
      } catch (e) {
        // ignore
      }
      showNotice("このページは自動で閉じられません。ブラウザの「×」で閉じてください。");
    }, 100);
  });

  const contentEl = document.getElementById("content");
  const showNotice = (message) => {
    if (!contentEl) return;
    const notice = document.createElement("div");
    notice.className = "docs__notice docs__notice--error";
    notice.textContent = message;
    contentEl.prepend(notice);
  };

  if (typeof mermaid !== "undefined") {
    try {
      // 現在のテーマに応じた Mermaid テーマを選択
      const theme = getCurrentTheme();
      const baseColors = PRESET_BASE_COLORS[theme];
      const mermaidTheme = baseColors && isLightMode(baseColors.bg) ? "default" : "dark";
      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        securityLevel: "strict",
        flowchart: { htmlLabels: false },
      });
      mermaid.run({ querySelector: ".docs__content .mermaid" });
    } catch (e) {
      console.error("Mermaid render error", e);
      showNotice("Mermaidの描画に失敗しました。拡張を再読み込みし、コンソールエラーを確認してください。");
    }
  } else {
    showNotice(
      "Mermaidが読み込まれていないため、図が表示できません。mermaid.min.js の配置（src/lib/mermaid.min.js）を確認してください。"
    );
  }
}

init();
