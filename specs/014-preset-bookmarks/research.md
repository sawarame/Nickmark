# Research: 定番ブックマーク・ブックマークレットのプリセット機能

**Feature**: `014-preset-bookmarks`  
**Date**: 2026-11-18  
**Related Issue**: #28

## 1. プリセットの保持方式とストレージ設計

- **Decision**:
  - 全 12 件のプリセット定義（URL、タイトル翻訳キー、種別）は拡張機能のコードベース内（`src/shared/presets.ts`）に静的カタログとして定義する。
  - ストレージには有効化されたプリセット ID の配列（キー名: `enabledPresets`、型: `PresetId[]`、初期値: `[]`）のみを保存する。
  - Google アカウント同期（`isSyncEnabled`）が ON の場合は `chrome.storage.sync`（およびローカルキャッシュ）に保存し、OFF の場合は `chrome.storage.local` に保存する。
- **Rationale**:
  - Issue #28 の要件「通常の JSON のブックマークの方式で保存すると容量が無駄になるので、チェックボックスの有無だけ保存する」およびオーナー回答「有効化された ID リストは Google アカウント同期の対象になるようにしてください（選択肢 B）」に完全合致する。
  - 12 件すべてを有効化しても JSON 文字列長は約 85 バイトであり、`chrome.storage.sync` の 1 項目上限（8KB）および全体上限（100KB）をほとんど消費しない。
- **Alternatives considered**:
  - 案 A: チェック ON 時に通常の `bookmarks` 辞書へエントリをコピー追加し、OFF 時に削除する方式。
    - 却下理由: ストレージ容量を消費するほか、ユーザーが一覧画面で編集した場合の整合性管理が複雑化し、Issue の明示要件（チェック有無のみ保存）に反するため。
  - 案 B: `chrome.storage.local` のみに保存する方式。
    - 却下理由: オーナーより選択肢 B（Google アカウント同期対象に含める）が指定されたため。

## 2. `chrome.storage.sync` におけるブックマークチャンク保存との共存

- **Decision**:
  - `src/shared/storage.ts` の `saveToStorage('sync', bookmarks)` において、従来の `await chrome.storage.sync.clear()` を廃止し、`SYNC_KEY_PREFIX`（`sync_data_`）で始まる既存チャンクキーのみを特定して削除・更新する方式に変更する。
  - 設定画面（`src/Preferences.vue`）での同期 ON/OFF 切り替え（データ移行）時には、ブックマークデータとあわせて `enabledPresets` も移行方向に応じて同期・コピーする。
- **Rationale**:
  - `chrome.storage.sync.clear()` を呼ぶと、同一ストレージ領域に別キーとして保存されている `enabledPresets` まで消去されてしまうため、チャンクキーのみをクリーンアップする設計が不可欠である。
- **Alternatives considered**:
  - `sync_data_N` の JSON 文字列の中に `enabledPresets` を同梱してチャンク化する方式。
    - 却下理由: 既存の `sync_data_N` は `Record<string, BookmarkEntry[]>` 直下の JSON としてシリアライズされており、スキーマ変更を行うと後方互換性が崩れる。独立キー `enabledPresets` として保存し、`clear()` をチャンクキー限定削除に改める方が後方互換性とパフォーマンスの両面で優れている。

## 3. 検索時の動的合成と優先度・重複排除ルール

- **Decision**:
  - 通常検索（ポップアップの `buildRegularPaletteItems` およびオムニボックスの `handleRegularSearchSuggestions` / `onInputEntered`）において、ユーザー登録の `bookmarks` 辞書と有効なプリセット配列を合成する純粋関数 `mergeBookmarksWithPresets(bookmarks, enabledPresetIds, locale)` を介して検索を行う。
  - 合成されるプリセットの仮想 `BookmarkEntry` は `score: 1.0`, `is_pinned: false`, `created_at: 0`, `last_used_at: 0` とする。
  - 同一ニックネーム配下に `isSameUrl`（または正規化 URL 一致）で同じ URL が既にユーザー登録されている場合は、プリセット側を合成せずユーザー登録エントリのみを残す。
  - プリセット実行時は `bookmarks` ストレージ内に該当エントリが存在しない（または一致しない）ため、`updateScore` によるストレージ書き込みは発生しない。
  - 管理画面一覧（`List.vue`）、JSON エディタ、インポート／エクスポート、および `:rm`・`:add` のニックネーム補完では、合成前の `loadBookmarksData()` をそのまま参照する。
- **Rationale**:
  - 検索・動的 URL（`%s`）展開・ブックマークレット実行・ゼロ幅マーカー復元の既存パイプラインを一切変更せずにそのまま活用でき、かつユーザー登録ブックマーク（スコア `> 1.0` またはピン留め）が既存のソート規則によって自動的にプリセットより上位に表示される。
- **Alternatives considered**:
  - 検索結果（`ResolvedSearchMatch[]`）が出た後にプリセット用の独自マッチ処理を追加する方式。
    - 却下理由: ティア判定やオムニボックスのゼロ幅文字インデックス解決（`resolveMatchFromZeroWidthMarker`）で二重実装が必要になるため、入力辞書段階で仮想合成する方がシンプルでバグが生じにくい。

## 4. 収録するブックマークレット（`mdlink`, `wayback`）の実装方式

- **Decision**:
  - `mdlink`（Markdown リンクをコピー）:
    - 現在のページの `document.title`（角括弧 `[` `]` をエスケープ）と `location.href` から `[タイトル](URL)` を生成し、`navigator.clipboard.writeText`（フォールバックとして一時 `textarea` + `document.execCommand('copy')`）でコピーした上で、画面上部に控えめな完了トーストを短時間表示する自己完結ワンライナー `javascript:` コードとする。
  - `wayback`（Wayback Machine で表示）:
    - `javascript:(()=>{location.href='https://web.archive.org/web/*/'+location.href;})();` とし、現在のタブで Internet Archive Wayback Machine のスナップショット一覧／最新ページへ遷移させる。
- **Rationale**:
  - 既存の `executeBookmarklet`（`chrome.userScripts.execute`, `world: "MAIN"`）でそのまま安全に動作し、追加権限を必要としない。
