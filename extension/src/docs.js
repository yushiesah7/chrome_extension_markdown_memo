function init() {
  // 仕様書ページ（docs.html）内の閉じるボタン
  const closeBtn = document.getElementById("close");
  closeBtn?.addEventListener("click", () => {
    window.close();
  });

  if (typeof mermaid !== "undefined") {
    try {
      // 仕様書内の Mermaid 図を描画（安全設定）
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        flowchart: { htmlLabels: false },
      });
      mermaid.run({ querySelector: ".docs__content .mermaid" });
    } catch (e) {
      console.error("Mermaid render error", e);
    }
  }
}

init();
