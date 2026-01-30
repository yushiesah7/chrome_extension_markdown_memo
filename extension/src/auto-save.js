/**
 * auto-save.js
 * 自動保存ロジック
 */

import { persistState } from "./state.js";
import { setStatus } from "./render.js";

// 自動保存の遅延時間（ミリ秒）
// ユーザーの入力が落ち着いてから保存（体感速度とAPI負荷のバランス）
const AUTO_SAVE_DELAY = 400;

// 自動保存タイマーID
let autoSaveTimeout = null;
// ステータスリセットタイマーID
let statusResetTimeout = null;

/**
 * 自動保存をスケジュール
 * 連続した変更はデバウンスされ、最後の変更から AUTO_SAVE_DELAY ミリ秒後に保存
 */
export function scheduleAutoSave() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  setStatus("saving", "自動保存中…");
  autoSaveTimeout = setTimeout(async () => {
    autoSaveTimeout = null;
    await persistState();
    setStatus("saved", "保存しました");
    if (statusResetTimeout) {
      clearTimeout(statusResetTimeout);
    }
    statusResetTimeout = setTimeout(() => {
      setStatus("idle", "編集中");
    }, 1500);
  }, AUTO_SAVE_DELAY);
}
