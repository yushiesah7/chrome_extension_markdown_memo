# Mermaid Markdown Memo

Chrome 拡張として動作する Markdown + Mermaid メモアプリです。ポップアップでも別タブでも編集・プレビューでき、チェックリストや Mermaid 図のプレビュー、Markdown 挿入ツールバーを備えています。

<p align="center">
  <img src="./extension/assets/screenshot-main.png" alt="Mermaid Markdown Memo メイン画面" width="800" style="border:1px solid #e1e4e8;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,0.12);">
  <br>
  <em>ポップアップとタブで同じUIのエディタ/プレビューを利用可能</em>
</p>

## 主な特徴
- ポップアップとタブの両方で編集/プレビュー
- Markdown 挿入ツールバー（H1/H2/箇条書き/番号/チェック/コード/mermaid 雛形）
- チェックリストをプレビューでチェックボックス表示、Enter で継続入力
- Mermaid 図のプレビュー（セキュア設定）
- ノート一覧のドラッグ＆ドロップ並び替え、昇順/降順切替
- 全文コピー、仕様書（docs.html）リンク
- データは Chrome の `chrome.storage.local` に保存（外部送信なし）

## ディレクトリ構成（抜粋）
```
extension/
  manifest.json         # MV3 マニフェスト
  src/
    popup.html / popup.css / popup.js         # ポップアップ画面
    preview.html / preview.css / preview.js   # タブ表示画面
    markdown.js / preview_renderer.js         # Markdown/Mermaid レンダラ
    events.js / state.js / storage.js         # 状態管理とイベント
    lib/mermaid.min.js                        # Mermaid ライブラリ
mock/                                         # スタイル合わせのモック
SPEC.md                                       # 仕様書（docs.htmlの元）
```

## インストール（デベロッパーモードで読み込み）
1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」を押し、本リポジトリの `extension/` ディレクトリを選択

## 使い方
- 左サイドバー: メモ一覧、件数表示、並び替え、全文コピー、仕様書ボタン、＋ボタン
- 右ペイン: タイトル入力、本文（Markdown）、ゴミ箱、タブを開く
- タブ画面: 「編集/プレビュー」切替、Markdown 挿入ツールバー、全文コピー
- チェックリスト: `- [ ]` / `- [x]` をプレビューでチェックボックス表示。Enter で `- [ ] ` を継続挿入
- Mermaid: ```mermaid ブロックをプレビューすると図を描画

## 保存データ（chrome.storage.local）
- `notes`: メモ本体（タイトル/本文/更新日時など）
- `noteSortOrder`: 一覧の並び順
- `sortDirection`: 並び替えの昇順/降順
- `activeNoteId`: 最後に開いていたメモID（タブでも同じメモを開くため）

## 開発メモ
- 依存: バンドル不要のプレーン JS/CSS/HTML（Mermaid は同梱済み）
- アイコン: `extension/icons/` に配置済み、manifest.json で指定
- 仕様/ドキュメント: `SPEC.md` と `extension/src/docs.html` が対応

## ライセンス
本リポジトリにライセンス表記が未設定です。必要に応じて追記してください。
