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
  // 既存のタイマーをクリア
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  // statusResetTimeoutもクリア（新しい保存が始まるため）
  if (statusResetTimeout) {
    clearTimeout(statusResetTimeout);
  }
  setStatus("saving", "自動保存中…");
  autoSaveTimeout = setTimeout(async () => {
    autoSaveTimeout = null;
    try {
      await persistState();
      setStatus("saved", "保存しました");
      statusResetTimeout = setTimeout(() => {
        setStatus("idle", "編集中");
      }, 1500);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setStatus("error", "保存に失敗しました");
      // エラー後もidle復帰（3秒後）
      statusResetTimeout = setTimeout(() => {
        setStatus("idle", "編集中");
      }, 3000);
    }
  }, AUTO_SAVE_DELAY);
}

/**
 * 即時保存（タブを開く等の場面で使用）
 * 遅延保存をキャンセルして即座に保存する
 */
export async function persistNow() {
  // 既存のタイマーをクリア
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  if (statusResetTimeout) {
    clearTimeout(statusResetTimeout);
    statusResetTimeout = null;
  }

  setStatus("saving", "保存中…");
  try {
    await persistState();
    setStatus("saved", "保存しました");
    statusResetTimeout = setTimeout(() => {
      setStatus("idle");
    }, 1500);
  } catch (error) {
    console.error("即時保存に失敗:", error);
    setStatus("error", "保存に失敗しました");
    statusResetTimeout = setTimeout(() => {
      setStatus("idle");
    }, 3000);
  }
}
