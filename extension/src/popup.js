import { ensureElementsExist } from "./dom.js";
import { initializeTheme } from "./theme.js";
import { initializeState } from "./state.js";
import { attachEventListeners, renderApp } from "./events.js";
import { setStatus } from "./render.js";

async function init() {
  try {
    ensureElementsExist();
  } catch (error) {
    console.error("ポップアップ初期化に必要なDOM要素が見つかりません。", error);
    return;
  }

  initializeTheme();
  attachEventListeners();

  try {
    await initializeState();
  } catch (error) {
    console.error("メモの読み込みに失敗しました。", error);
    setStatus("idle", "メモの読み込みに失敗しました");
    return;
  }

  renderApp();
}

init();
