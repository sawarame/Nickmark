# Data Model: 定番ブックマーク・ブックマークレットのプリセット機能

**Feature**: `014-preset-bookmarks`  
**Date**: 2026-11-18

## 1. プリセット識別子とカテゴリ型 (`src/shared/types.ts`)

```typescript
/**
 * 標準プリセットの種別
 */
export type PresetCategory = 'dynamic_url' | 'bookmarklet';

/**
 * 標準収録される全 12 件のプリセット ID リテラル型
 */
export type PresetId =
  | 'g'
  | 'yt'
  | 'gh'
  | 'map'
  | 'tr'
  | 'wiki'
  | 'amz'
  | 'x'
  | 'npm'
  | 'mdn'
  | 'mdlink'
  | 'wayback';

/**
 * 内蔵プリセット 1 件の静的定義モデル
 */
export interface PresetDefinition {
  /** プリセットの一意な識別子（ニックネームと同一） */
  id: PresetId;
  /** 検索・呼び出しに使用するニックネーム */
  nickname: PresetId;
  /** プリセットの種別（動的 URL またはブックマークレット） */
  category: PresetCategory;
  /** `messages.json` 上のタイトルメッセージキー */
  titleKey: string;
  /** `messages.json` 上の補足説明メッセージキー（主にブックマークレットの内容表示用） */
  descriptionKey?: string;
  /** デフォルト（日本語設定時）の URL または `javascript:` コード */
  urlJa: string;
  /** 英語設定時の URL（言語により検索先ドメインが異なる `wiki` 等で指定） */
  urlEn?: string;
}
```

## 2. ストレージ保存スキーマ (`chrome.storage.local` / `chrome.storage.sync`)

| キー名 | 保存先ストレージ | 型 | 初期値 | 制約・バリデーションルール |
| :--- | :--- | :--- | :--- | :--- |
| `enabledPresets` | `isSyncEnabled === true` のときは `chrome.storage.sync`（および `local` ミラー）、`false` のときは `chrome.storage.local` | `PresetId[]` | `[]`（すべて OFF） | 配列内の要素は定義済み `PresetId`（全 12 種）に含まれる文字列のみを有効とし、未知の文字列・非文字列・重複要素は読み込みおよび保存時に `normalizeEnabledPresetIds` で自動除外し、`PRESET_DEFINITIONS` の定義順に正規化する。 |

## 3. 収録プリセット一覧（全 12 件）

| `id` (`nickname`) | `category` | 日本語タイトル | 英語タイトル | URL / 動作内容 |
| :--- | :--- | :--- | :--- | :--- |
| `g` | `dynamic_url` | Google 検索 | Google Search | `https://www.google.com/search?q=%s` |
| `yt` | `dynamic_url` | YouTube 検索 | YouTube Search | `https://www.youtube.com/results?search_query=%s` |
| `gh` | `dynamic_url` | GitHub 検索 | GitHub Search | `https://github.com/search?q=%s` |
| `map` | `dynamic_url` | Google マップ検索 | Google Maps | `https://www.google.com/maps/search/%s` |
| `tr` | `dynamic_url` | Google 翻訳 | Google Translate | `https://translate.google.com/?text=%s` |
| `wiki` | `dynamic_url` | Wikipedia 検索 | Wikipedia | 日本語: `https://ja.wikipedia.org/w/index.php?search=%s`<br>英語: `https://en.wikipedia.org/w/index.php?search=%s` |
| `amz` | `dynamic_url` | Amazon 検索 | Amazon Search | `https://www.amazon.co.jp/s?k=%s` |
| `x` | `dynamic_url` | X (Twitter) 検索 | X Search | `https://x.com/search?q=%s` |
| `npm` | `dynamic_url` | npm パッケージ検索 | npm Search | `https://www.npmjs.com/search?q=%s` |
| `mdn` | `dynamic_url` | MDN Web Docs 検索 | MDN Search | `https://developer.mozilla.org/search?q=%s` |
| `mdlink` | `bookmarklet` | Markdown リンクをコピー | Copy Markdown Link | 現在のページの `[タイトル](URL)` をクリップボードへコピー |
| `wayback` | `bookmarklet` | Wayback Machine で表示 | Open in Wayback Machine | 現在のページ URL を `https://web.archive.org/web/*/` で開く |

## 4. 検索時における仮想 `BookmarkEntry` への変換規則

有効化された各プリセットは、通常検索時に以下の固定属性を持つ仮想 `BookmarkEntry` に変換されて検索対象の辞書に合成される。

- `url`: 現在のロケールに応じて解決された URL または `javascript:` コード
- `title`: 現在のロケールに応じて翻訳解決されたタイトル文字列
- `score`: `1.0`（固定。遷移や実行を行ってもストレージへのスコア更新は行わない）
- `is_pinned`: `false`
- `created_at`: `0`
- `last_used_at`: `0`
- **重複排除条件**: ユーザー登録ブックマーク内の同一ニックネーム（`preset.nickname`）に `isSameUrl(entry.url, presetUrl)` が真となるエントリが既に存在する場合は、仮想エントリを追加しない。
