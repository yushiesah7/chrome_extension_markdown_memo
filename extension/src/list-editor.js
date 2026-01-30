/**
 * list-editor.js
 * Markdownリスト操作（番号付きリスト、タスクリスト）のロジック
 */

import {
  TAB_INDENT,
  getLineStartIndex,
  getLineEndIndex,
  getLineAndColumn,
  restoreSelectionByLineColumn,
  insertTextAtSelection,
  indentTextArea,
  unindentTextArea,
  dispatchInput,
} from "./textarea-utils.js";

// "one" = 常に1. / "ordered" = 連番（Markdown All in One互換）
const ORDERED_LIST_MARKER_MODE = "ordered";
// 番号付きリストの自動リナンバリング
const ORDERED_LIST_AUTO_RENUMBER = true;
// リスト継続とみなす最小インデント長（Markdown All in One互換）
const MIN_LIST_CONTINUATION_INDENT = 3;

/**
 * 行がリストプレフィックスのみかを判定
 * @param {string} currentLine - 現在の行
 * @param {RegExpMatchArray|null} match - リストマッチ結果
 * @returns {boolean}
 */
export function isLineOnlyListPrefix(currentLine, match) {
  if (!match) return false;
  const rest = currentLine.slice(match[0].length);
  return rest.trim().length === 0;
}

/**
 * 次の番号付きリストプレフィックスを生成
 * @param {RegExpMatchArray} matchOrdered - 正規表現マッチ結果
 * @returns {string} 次のプレフィックス
 */
export function buildNextOrderedPrefix(matchOrdered) {
  const leadingSpace = matchOrdered[1];
  const previousMarker = matchOrdered[2];
  const delimiter = matchOrdered[3];
  const trailingSpace = matchOrdered[4];
  const checkbox = matchOrdered[5] ? matchOrdered[5].replace(/\[x\]/i, "[ ]") : "";

  const marker =
    ORDERED_LIST_MARKER_MODE === "one"
      ? "1"
      : String(Number(previousMarker) + 1 || 1);

  const textIndent = (previousMarker + delimiter + trailingSpace).length;
  const adjustedTrailing = " ".repeat(
    Math.max(1, textIndent - (marker + delimiter).length)
  );
  return `${leadingSpace}${marker}${delimiter}${adjustedTrailing}${checkbox}`;
}

/**
 * 指定行以降で次のマーカー行を検索
 * @param {string[]} lines - 行配列
 * @param {number} line - 開始行
 * @returns {number} マーカー行番号（-1 = なし）
 */
function findNextMarkerLineNumber(lines, line) {
  let idx = Math.max(0, line);
  while (idx < lines.length) {
    const lineText = lines[idx] || "";
    if (lineText.startsWith("#")) {
      return -1;
    }
    if (/^\s*[0-9]+[.)] +/.test(lineText)) {
      return idx;
    }
    idx++;
  }
  return -1;
}

/**
 * 上方向にマーカーを探索して次の番号を決定
 * @param {string[]} lines - 行配列
 * @param {number} line - 現在行
 * @param {number} currentIndentation - 現在のインデント
 * @returns {number} 次の番号
 */
function lookUpwardForMarker(lines, line, currentIndentation) {
  let prevLine = line;
  while (--prevLine >= 0) {
    const prevLineText = (lines[prevLine] || "").replace(/\t/g, "    ");
    let matches = null;

    matches = /^(\s*)(([0-9]+)[.)] +)/.exec(prevLineText);
    if (matches) {
      const prevLeadingSpace = matches[1];
      const prevMarker = matches[3];
      if (currentIndentation < prevLeadingSpace.length) {
        continue;
      } else if (
        currentIndentation >= prevLeadingSpace.length &&
        currentIndentation <= (prevLeadingSpace + prevMarker).length
      ) {
        return Number(prevMarker) + 1;
      } else if (currentIndentation > (prevLeadingSpace + prevMarker).length) {
        return 1;
      }
      continue;
    }

    matches = /^(\s*)([-+*] +)/.exec(prevLineText);
    if (matches) {
      const prevLeadingSpace = matches[1];
      if (currentIndentation >= prevLeadingSpace.length) {
        break;
      }
      continue;
    }

    matches = /^(\s*)\S/.exec(prevLineText);
    if (matches) {
      if (matches[1].length < MIN_LIST_CONTINUATION_INDENT) {
        break;
      }
    }
  }
  return 1;
}

/**
 * 番号付きリストのマーカーを修正（再帰的）
 * @param {string[]} lines - 行配列
 * @param {number} line - 対象行
 */
function fixMarkerIterative(lines, line) {
  if (line < 0 || line >= lines.length) return;

  const currentLineText = lines[line] || "";
  const matches = /^(\s*)([0-9]+)([.)])( +)/.exec(currentLineText);
  if (!matches) return;

  const leadingSpace = matches[1];
  const marker = matches[2];
  const delimiter = matches[3];
  const trailingSpace = matches[4];
  const fixedMarker = lookUpwardForMarker(
    lines,
    line,
    leadingSpace.replace(/\t/g, "    ").length
  );

  const listIndent = marker.length + delimiter.length + trailingSpace.length;
  let fixedMarkerString = String(fixedMarker);

  if (marker !== fixedMarkerString) {
    fixedMarkerString +=
      delimiter +
      " ".repeat(Math.max(1, listIndent - (fixedMarkerString + delimiter).length));
    const start = leadingSpace.length;
    const end = leadingSpace.length + listIndent;
    lines[line] = currentLineText.slice(0, start) + fixedMarkerString + currentLineText.slice(end);
  }

  let nextLine = line + 1;
  while (nextLine < lines.length) {
    const nextLineText = lines[nextLine] || "";
    if (/^\s*[0-9]+[.)] +/.test(nextLineText)) {
      fixMarkerIterative(lines, nextLine);
      return;
    }

    const prevLineText = lines[nextLine - 1] || "";
    if (/^\s*$/.test(prevLineText) && !nextLineText.startsWith(TAB_INDENT) && !nextLineText.startsWith("\t")) {
      return;
    }
    nextLine++;
  }
}

/**
 * 番号付きリストのマーカーを修正
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {number} fromLine - 開始行
 */
function fixOrderedListMarkers(textarea, fromLine = 0) {
  if (!ORDERED_LIST_AUTO_RENUMBER) return;
  if (ORDERED_LIST_MARKER_MODE === "one") return;

  const lines = textarea.value.split("\n");
  const start = findNextMarkerLineNumber(lines, fromLine);
  if (start < 0) return;
  fixMarkerIterative(lines, start);
  textarea.value = lines.join("\n");
}

/**
 * 選択範囲を保持しながらマーカーを修正
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {number} fromLineOffset - 開始行オフセット
 */
export function fixMarkersPreservingSelection(textarea, fromLineOffset = 1) {
  if (!ORDERED_LIST_AUTO_RENUMBER) return;
  const selectionStart = { ...getLineAndColumn(textarea.value, textarea.selectionStart) };
  const selectionEnd = { ...getLineAndColumn(textarea.value, textarea.selectionEnd) };
  fixOrderedListMarkers(textarea, Math.max(0, selectionStart.line - fromLineOffset));
  restoreSelectionByLineColumn(textarea, selectionStart, selectionEnd);
}

/**
 * Tab キー押下時のリスト処理
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {KeyboardEvent} event - キーボードイベント
 */
export function handleListTab(textarea, event) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const { column } = getLineAndColumn(value, start);
  const lineStart = getLineStartIndex(value, start);
  const lineEnd = getLineEndIndex(value, start);
  const lineText = value.slice(lineStart, lineEnd);

  const listPrefixMatch = /^\s*([-+*]|[0-9]+[.)]) +(\[[ xX]\] +)?/.exec(lineText);
  const shouldIndentAsList =
    Boolean(listPrefixMatch) &&
    (event.shiftKey || start !== end || column <= (listPrefixMatch?.[0]?.length ?? 0));

  event.preventDefault();

  if (event.shiftKey) {
    unindentTextArea(textarea, TAB_INDENT);
  } else if (shouldIndentAsList) {
    indentTextArea(textarea, TAB_INDENT);
  } else {
    insertTextAtSelection(textarea, TAB_INDENT);
  }

  fixMarkersPreservingSelection(textarea, 1);

  dispatchInput(textarea);
}

/**
 * Backspace キー押下時のリスト処理
 * @param {HTMLTextAreaElement} textarea - テキストエリア
 * @param {KeyboardEvent} event - キーボードイベント
 */
export function handleListBackspace(textarea, event) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start !== end) return;

  const lineStart = getLineStartIndex(value, start);
  const lineEnd = getLineEndIndex(value, start);
  const lineText = value.slice(lineStart, lineEnd);
  const textBeforeCursor = lineText.slice(0, start - lineStart);

  if (/^\s+([-+*]|[0-9]+[.)]) $/.test(textBeforeCursor)) {
    event.preventDefault();
    unindentTextArea(textarea, TAB_INDENT);
    fixMarkersPreservingSelection(textarea, 1);
    dispatchInput(textarea);
    return;
  }

  if (/^([-+*]|[0-9]+[.)]) $/.test(textBeforeCursor)) {
    event.preventDefault();
    const replaced = " ".repeat(textBeforeCursor.length);
    textarea.value =
      value.slice(0, lineStart) + replaced + value.slice(lineStart + textBeforeCursor.length);
    textarea.setSelectionRange(start, start);
    fixMarkersPreservingSelection(textarea, 1);
    dispatchInput(textarea);
    return;
  }

  const checkboxMatch = /^\s*([-+*]|[0-9]+[.)]) +(\[[ xX]\] )$/.exec(textBeforeCursor);
  if (checkboxMatch) {
    event.preventDefault();
    const checkboxLen = checkboxMatch[2].length;
    const removeStart = Math.max(lineStart, start - checkboxLen);
    textarea.value = value.slice(0, removeStart) + value.slice(start);
    const next = removeStart;
    textarea.setSelectionRange(next, next);
    fixMarkersPreservingSelection(textarea, 1);
    dispatchInput(textarea);
  }
}
