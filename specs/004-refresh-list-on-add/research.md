# Research & Technical Decisions: ブックマーク一覧タブの自動更新

**Feature Branch**: `004-refresh-list-on-add`  
**Date**: 2026-11-09  
**Related Spec**: [spec.md](./spec.md)

## 概要と課題の分析

Chrome の特殊ページ（`chrome://` や Chrome ウェブストアなど、拡張機能のスクリプト実行が制限されているページ）でオムニボックス（`:add` コマンド等）からブックマークを追加した場合、拡張機能はページ内トーストを表示できないため、フォールバックとして一覧画面（`list.html`）をアクティブにして通知を表示します。
しかし、既に一覧画面タブが開かれていた場合、タブがアクティブになり通知（トースト）が表示されるものの、画面上に表示されているブックマーク一覧が更新されず、追加したはずのブックマークが存在しないように見える現象が発生していました。

### 根本原因の特定

1. **`List.vue` でのメッセージ受信処理**:
   `background.ts` の `openOrReuseListTab` から既存タブへ `{ action: 'updatePage', msg: ... }` が送信されていますが、`List.vue` のメッセージリスナーでは通知表示（`showCustomToast`）と URL/Title 入力欄の補完のみを行っており、一覧データの再読み込み関数（`loadBookmarks()`）を呼び出していませんでした。

2. **モジュールレベル変数 `bookmarksCache` のプロセス間分離**:
   `src/background.ts` ではパフォーマンス向上のため `bookmarksCache` にデータをメモリキャッシュしています。
   しかし、Webpack のビルド構成上、Service Worker（`background.js`）と一覧画面（`list.js`）は別個の JavaScript 実行コンテキストで動作しています。
   Service Worker 側でオムニボックスから追加されたブックマークは Service Worker のキャッシュと Chrome ストレージに書き込まれますが、一覧画面側のプロセスにおける `bookmarksCache` は初期ロード時のまま保持されてしまいます。
   さらに、ストレージ変更を検知してキャッシュを無効化する `chrome.storage.onChanged` リスナーが `if (typeof window === 'undefined')` 内（Service Worker 専用ブロック）に配置されているため、一覧画面（`list.html`）プロセス側ではキャッシュが自動破棄されず、単に `loadBookmarksData()` を再度呼んだだけでは古いキャッシュが返却されてしまう設計となっていました。

---

## 技術的な選定と設計判断 (Decisions & Rationale)

### 決定事項 1: キャッシュ無効化 API の提供と強制再取得 (`clearBookmarksCache` / `forceRefresh`)

- **決定内容**:
  `src/background.ts` からメモリキャッシュをクリアする関数 `clearBookmarksCache(): void`（または `loadBookmarksData(forceRefresh?: boolean)`）をエクスポートし、一覧画面の再読み込み時に確実に Chrome ストレージから最新データを取得できるようにする。
- **選定理由 (Rationale)**:
  `src/background.ts` で定義されている `loadBookmarksData` をそのまま利用しつつ、プロセス固有のメモリキャッシュを安全に破棄して最新データを読み直すことができる。憲章 IV「型安全性とモジュール間共有」の原則（データアクセス関数の一元管理）にも合致する。
- **比較・検討した代替案 (Alternatives considered)**:
  - *代替案 A: `list.html` 側でも `chrome.storage.onChanged` を登録して `bookmarksCache = null` にする*  
    → キャッシュ無効化は可能だが、一覧画面自身が削除・編集・並び替えを行った際のストレージ変更イベントも拾ってしまい、意図しないタイミングでのキャッシュ破棄や競合を招く恐れがある。必要なタイミングで明示的にキャッシュを破棄して再取得する方が制御しやすく堅牢である。
  - *代替案 B: メモリキャッシュ自体を廃止し、毎回必ずストレージから読む*  
    → オムニボックス入力中のミリ秒単位のインクリメンタル検索においてキャッシュが重要な役割を果たしているため、廃止は不可。

### 決定事項 2: `updatePage` メッセージ受信時の `loadBookmarks` 実行

- **決定内容**:
  `src/List.vue` の `chrome.runtime.onMessage` リスナーにおいて、`request.action === 'updatePage'` を受信した際に、キャッシュをクリアした上で `await loadBookmarks()` を呼び出し、最新データをリアクティブに反映する。
- **選定理由 (Rationale)**:
  ユーザーの「特殊ページで追加した際、すでに一覧が開いていればそのタブに移動してトーストが表示され、一覧も更新される」という体験を最も直接的かつ低負荷に実現できる。画面全体のフルリロードを伴わないため、通知（トースト）の表示がリセットされることもない。
- **比較・検討した代替案 (Alternatives considered)**:
  - *代替案: `window.location.reload()` によるタブ全体の再読み込み*  
    → 画面全体が白くチラつき、表示しようとしていたトースト通知やスクロール位置、入力中の一時状態が失われるため不採用。

### 決定事項 3: タブ復帰時（フォーカス/可視性変化）のデータ最新化ガード

- **決定内容**:
  ユーザーが一覧画面タブを開いたまま別タブ（通常の Web ページなど）でオムニボックスから追加し、後から手動で一覧画面タブに戻ってきた場合にも備え、タブフォーカス復帰時（`window.addEventListener('focus')` や `document.addEventListener('visibilitychange')`）にも最新データを同期できるようにする。ただし、編集ダイアログを開いている最中などのユーザー操作を妨げないよう配慮する。
- **選定理由 (Rationale)**:
  特殊ページからの自動誘導時だけでなく、日常的なタブ切り替え操作においても「追加したのに一覧にない」という表示の不整合を包括的に防止できる。
- **比較・検討した代替案 (Alternatives considered)**:
  - *代替案: 常に何もしない（手動 F5 に頼る）*  
    → ユーザー体験として不親切であり、仕様書 SC-003（手動リロード回数の削減）に反するため不採用。

---

## 結論

1. `src/background.ts` にキャッシュクリア機構（`clearBookmarksCache()` または `loadBookmarksData(true)`）を追加・エクスポートする。
2. `src/List.vue` の `updatePage` メッセージハンドラ内で最新データの再取得とリアクティブ反映を行う。
3. タブ復帰時にも最新化が行われるようイベントリスナーを安全に連携させる。
