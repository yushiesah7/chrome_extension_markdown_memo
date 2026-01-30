/**
 * textarea-utils.js
 * テキストエリア操作のユーティリティ関数群
 */

// インデントに使用するスペース（2スペース）
export const TAB_INDENT = "  ";

/**
 * テキスト内の改行数をカウント
 * @param {string} text - 対象テキスト
 * @param {number} upToIndex - この位置までカウント
 * @returns {number} 改行数
 */
export function countNewlines(text, upToIndex) {
  const chunk = text.slice(0, Math.max(0, upToIndex));
  return (chunk.match(/\n/g) || []).length;
}

/**
 * 配列の指定範囲の合計を計算
 * @param {number[]} values - 数値配列
 * @param {number} fromIndex - 開始インデックス
 * @param {number} toIndex - 終了インデックス
 * @returns {number} 合計値
 */
export function sum(values, fromIndex, toIndex) {
  let total = 0;
  for (let i = fromIndex; i <= toIndex; i++) {
    total += values[i] || 0;
  }
  return total;
}

/**
 * 指定位置の行開始インデックスを取得
 * @param {string} text - 対象テキスト
 * @param {number} pos - 現在位置
 * @returns {number} 行開始位置
 */
export function getLineStartIndex(text, pos) {
  return text.lastIndexOf("\n", pos - 1) + 1;
}

/**
 * 指定位置の行終了インデックスを取得
 * @param {string} text - 対象テキスト
 * @param {number} pos - 現在位置
 * @returns {number} 行終了位置
 */
export function getLineEndIndex(text, pos) {
  const next = text.indexOf("\n", pos);
  return next === -1 ? text.length : next;
}

/**
 * 指定位置のカラム番号を取得
 * @param {string} text - 対象テキスト
 * @param {number} pos - 現在位置
 * @returns {number} カラム番号
 */
export function getColumnFromPos(text, pos) {
  const lineStart = getLineStartIndex(text, pos);
  return pos - lineStart;
}

/**
 * 指定位置の行番号とカラム番号を取得
 * @param {string} text - 対象テキスト
 * @param {number} pos - 現在位置
 * @returns {{line: number, column: number}} 行番号とカラム番号
 */
export function getLineAndColumn(text, pos) {
  const line = countNewlines(text, pos);
  return { line, column: getColumnFromPos(text, pos) };
}

/**
 * 行番号とカラム番号から位置を取得
 * @param {string} text - 対象テキスト
 * @param {number} line - 行番号
 * @param {number} column - カラム番号
 * @returns {number} 位置
 */
export function getPosFromLineAndColumn(text, line, column) {
  const lines = text.split("\n");
  const safeLine = Math.max(0, Math.min(line, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < safeLine; i++) {
    offset += lines[i].length + 1;
  }
  const safeCol = Math.max(0, Math.min(column, lines[safeLine].length));
  return offset + safeCol;
}

/**
 * 行番号・カラム番号で選択範囲を復元
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {{line: number, column: number}} startLC - 開始位置
 * @param {{line: number, column: number}} endLC - 終了位置
 */
export function restoreSelectionByLineColumn(textarea, startLC, endLC) {
  const nextStart = getPosFromLineAndColumn(textarea.value, startLC.line, startLC.column);
  const nextEnd = getPosFromLineAndColumn(textarea.value, endLC.line, endLC.column);
  textarea.setSelectionRange(nextStart, nextEnd);
}

/**
 * 選択位置にテキストを挿入
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {string} text - 挿入するテキスト
 */
export function insertTextAtSelection(textarea, text) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  const next = start + text.length;
  textarea.setSelectionRange(next, next);
}

/**
 * テキストエリアの行をインデント
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {string} indent - インデント文字列
 */
export function indentTextArea(textarea, indent) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (start === end) {
    const lineStart = getLineStartIndex(value, start);
    textarea.value = value.slice(0, lineStart) + indent + value.slice(lineStart);
    const nextPos = start + indent.length;
    textarea.setSelectionRange(nextPos, nextPos);
    return;
  }

  const firstLineStart = value.lastIndexOf("\n", start - 1) + 1;
  const blockEndIndex = value.indexOf("\n", end);
  const blockEnd = blockEndIndex === -1 ? value.length : blockEndIndex;
  const block = value.slice(firstLineStart, blockEnd);
  const lines = block.split("\n");

  const nextBlock = lines.map((line) => indent + line).join("\n");

  const startOffset = start - firstLineStart;
  const endOffset = end - firstLineStart;
  const startLineIndex = countNewlines(block, startOffset);
  const endLineIndex = countNewlines(block, endOffset);
  const addedBeforeStart = indent.length * (startLineIndex + 1);
  const addedBeforeEnd = indent.length * (endLineIndex + 1);

  textarea.value = value.slice(0, firstLineStart) + nextBlock + value.slice(blockEnd);
  textarea.setSelectionRange(start + addedBeforeStart, end + addedBeforeEnd);
}

/**
 * テキストエリアの行をアンインデント
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {string} indent - インデント文字列
 */
export function unindentTextArea(textarea, indent) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const removePrefix = (line) => {
    if (line.startsWith(indent)) return { line: line.slice(indent.length), removed: indent.length };
    if (line.startsWith("\t")) return { line: line.slice(1), removed: 1 };
    if (line.startsWith(" ")) return { line: line.slice(1), removed: 1 };
    return { line, removed: 0 };
  };

  if (start === end) {
    const lineStart = getLineStartIndex(value, start);
    const lineEnd = getLineEndIndex(value, start);
    const line = value.slice(lineStart, lineEnd);
    const { line: nextLine, removed } = removePrefix(line);
    if (removed === 0) return;

    textarea.value = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
    const next = Math.max(lineStart, start - removed);
    textarea.setSelectionRange(next, next);
    return;
  }

  const firstLineStart = value.lastIndexOf("\n", start - 1) + 1;
  const blockEndIndex = value.indexOf("\n", end);
  const blockEnd = blockEndIndex === -1 ? value.length : blockEndIndex;
  const block = value.slice(firstLineStart, blockEnd);
  const lines = block.split("\n");

  const results = lines.map((line) => removePrefix(line));
  const removeLens = results.map((r) => r.removed);
  const nextBlock = results.map((r) => r.line).join("\n");

  const startOffset = start - firstLineStart;
  const endOffset = end - firstLineStart;
  const startLineIndex = countNewlines(block, startOffset);
  const endLineIndex = countNewlines(block, endOffset);

  const removedBeforeStart = sum(removeLens, 0, startLineIndex);
  const removedBeforeEnd = sum(removeLens, 0, endLineIndex);

  textarea.value = value.slice(0, firstLineStart) + nextBlock + value.slice(blockEnd);
  textarea.setSelectionRange(start - removedBeforeStart, end - removedBeforeEnd);
}

/**
 * テキストエリアに input イベントを発火
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 */
export function dispatchInput(textarea) {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}
