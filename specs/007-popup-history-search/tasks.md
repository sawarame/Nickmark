---

description: "Task list for popup browser history search with opt-in permission"
---

# Tasks: ポップアップ検索でのブラウザ履歴表示（オプトイン権限）

**Input**: Design documents from `/specs/007-popup-history-search/`
**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/research.md), [data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/data-model.md), [popup-history-search-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/contracts/popup-history-search-contract.md)

**Tests**: 本機能仕様では新規自動テスト基盤の導入は要求されていないため、テストタスクは省略し、`npm run build`（TypeScript 型チェック・Webpack バンドル検証）および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/quickstart.md) に沿った Chrome 実機 E2E 検証を実施する。

**Organization**: タスクは各ユーザーストーリーを独立して実装・検証できるよう、優先順位（P1 → P2）に沿ってフェーズ分割している。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを対象とし、未完了タスクへの依存がないため並列実行可能
- **[Story]**: 対応する User Story（`[US1]`, `[US2]`, `[US3]`）
- すべてのタスク説明には対象ファイルパスを明記している

---

## Phase 1: Setup（権限宣言・多言語リソース準備）

**Purpose**: 任意権限の宣言と、設定画面・ポップアップで使用する日英メッセージリソースを準備する。

- [X] T001 Add `"optional_permissions": ["history"]` (without adding `"history"` to `"permissions"`) in package/manifest.json
- [X] T002 [P] Add Japanese and English i18n keys (`historySearchTitle`, `historySearchLabel`, `historySearchDescription`, `historySearchEnabledMessage`, `historySearchDisabledMessage`, `historyPermissionDeniedMessage`, `popupHistorySectionTitle`, `popupHistoryTag`) in package/_locales/ja/messages.json and package/_locales/en/messages.json

---

## Phase 2: Foundational（共有型・URL正規化・ストレージ設定・遷移/権限基盤）

**Purpose**: 全ユーザーストーリーの前提となる共有型定義、重複判定用 URL 正規化、ローカル専用設定管理、スコア非更新遷移ヘルパー、および権限管理基盤を実装する。

**⚠️ CRITICAL**: Phase 3 以降のユーザーストーリー実装は本フェーズ完了後に開始すること。

- [X] T003 [P] Extend `PaletteItemKind` with `'history'` and export `MAX_HISTORY_SUGGESTIONS = 10` in src/shared/types.ts
- [X] T004 [P] Implement `normalizeUrlForComparison(rawUrl: string): string` (trimming, `decodeURI`, lowercasing scheme/host, stripping trailing single `/` except root path, with fallback for invalid URLs) and Japanese JSDoc in src/shared/url.ts
- [X] T005 [P] Add `historySearchEnabled` cache (`boolean | null`, default `false`, local-only in `chrome.storage.local`) and `getHistorySearchEnabled`, `setHistorySearchEnabled`, `updateHistorySearchEnabledCache` with Japanese JSDoc in src/shared/storage.ts
- [X] T006 [P] Extract score-free `openUrlWithDisposition(targetUrl, disposition, tabId)` from `navigateWithDisposition` (keeping `navigateWithDisposition` calling `updateScore` then `openUrlWithDisposition`) with Japanese JSDoc in src/shared/commands.ts
- [X] T007 Create `src/shared/history.ts` with `hasHistoryPermission()`, `requestHistoryPermission()`, and `getEffectiveHistorySearchEnabled()` (returning `getHistorySearchEnabled() && hasHistoryPermission()`, safely returning `false` on missing API or error) and Japanese JSDoc in src/shared/history.ts

**Checkpoint**: 任意権限確認・要求基盤、型定義、ローカル設定、重複正規化、スコア非更新遷移ヘルパーが揃い、各ユーザーストーリーを独立して実装可能な状態。

---

## Phase 3: User Story 1 - 設定画面からの履歴検索機能のオプトイン有効化・無効化 (Priority: P1) 🎯 MVP

**Goal**: ユーザーが設定画面から「ブラウザ履歴検索」をオプトインで ON/OFF でき、ON 操作時にのみ履歴アクセス許可を求めて許可時のみ有効化・拒否時は OFF 維持と通知を行えるようにする。

**Independent Test**: 初期状態（未許可・OFF）でポップアップ検索に履歴が出ないこと、設定画面でトグル ON 時にブラウザ権限確認ダイアログが出現し、拒否時は OFF 維持＋警告 Toast・許可時は ON 保存＋成功 Toast が表示されること、OFF 切り替え後に履歴が出なくなること、およびブラウザ側で権限が取り消された場合でもエラーなく OFF 扱いになることを単独で検証できる。

### Implementation for User Story 1

- [X] T008 [US1] Add the "Browser History Search" `Card` section using `ToggleSwitch` + `.toggle-overlay` click interception in src/Preferences.vue, loading effective state via `getHistorySearchEnabled() && hasHistoryPermission()` on mount, calling `requestHistoryPermission()` directly inside the click handler before any `await` when enabling, persisting `setHistorySearchEnabled(true|false)`, and showing localized `Toast` notifications for enabled, disabled, and permission-denied outcomes

**Checkpoint**: User Story 1 が単独で動作し、オプトイン権限の取得・拒否ハンドリング・永続化・UI 反映が完結する状態。

---

## Phase 4: User Story 2 - ポップアップ検索時のブックマーク候補下へのブラウザ履歴候補表示と遷移 (Priority: P1)

**Goal**: 履歴検索が有効な場合、ポップアップの通常検索時にブックマーク候補の下へ「ブラウザ履歴」セクション見出しと重複除外済み履歴候補（最大 10 件）を表示し、クリックおよびショートカットキーでスコア非更新のまま各タブ種別へ遷移できるようにする。

**Independent Test**: 履歴検索 ON 状態でポップアップを開き、ブックマーク＋履歴双方一致時と履歴のみ一致時の双方でブックマーク候補の下に重複なし・最大 10 件の履歴一覧が表示されること、および `Enter`・`Cmd/Ctrl+Enter`・`Shift+Enter`・クリックで遷移しブックマークの `score` / `last_used_at` が変化しないことを検証できる。

### Implementation for User Story 2

- [X] T009 [P] [US2] Implement `shouldSearchHistoryForQuery(rawQuery)` (excluding empty, whitespace-only, slash-only, `:`-prefixed commands, and trailing `/` folder inputs) and `searchHistoryPaletteItems(rawQuery, excludeUrls, limit = MAX_HISTORY_SUGGESTIONS)` calling `chrome.history.search({ text, startTime: 0, maxResults: 30 })`, filtering valid navigable URLs, deduplicating against `excludeUrls` and prior history items via `normalizeUrlForComparison`, mapping to `PaletteItem` (`kind: 'history'`, `title: title || formatUrlForOmniboxDisplay(url)`, `subtitle: formatUrlForOmniboxDisplay(url)`, `typeTag: t('popupHistoryTag') || '履歴'`, `faviconUrl: getFaviconUrl(url)`, `fillText: ''`, `executeValue: url`, `matchTarget: undefined`), and returning `[]` safely on errors in src/shared/history.ts
- [X] T010 [US2] Integrate `getEffectiveHistorySearchEnabled()` on mount, split `bookmarkItems` (`computed`) and `historyItems` (`ref<PaletteItem[]>([])`) combined into `items`, pass `bookmarkItems` URLs as `excludeUrls` to `searchHistoryPaletteItems`, render a `role="presentation"` history section header (`pi-history` + `popupHistorySectionTitle`) above the first history item, keep list visible when only history items exist, and handle `item.kind === 'history'` in `executeItem` via `openUrlWithDisposition` (preserving popup & focus only on `newBackgroundTab`) in src/Popup.vue

**Checkpoint**: User Story 1 と User Story 2 が連携し、オプトイン設定からポップアップ履歴検索・重複除外・タブ遷移・スコア非汚染までの一連のコア価値が動作する状態。

---

## Phase 5: User Story 3 - キーボード操作・検索モードとの自然な共存 (Priority: P2)

**Goal**: 非同期履歴到着時のレースコンディション防止と既存選択ハイライトの安定化、セクション見出しを跨ぐキーボード上下移動・スクロール追従、`Tab` キー非干渉、および PrimeVue スタイル調和を完成させる。

**Independent Test**: 連続高速タイピングや入力クリア時に古い履歴結果が上書きされないこと、ブックマーク候補の下矢印移動中に履歴が遅れて到着してもハイライトが先頭へ戻らないこと、`↑`/`↓`・`Ctrl+N`/`Ctrl+P` で見出しを飛ばして履歴候補へ移動できること、`Tab` キーで入力欄が書き換わらないこと、および `:` コマンド・末尾 `/` 入力時に履歴が出ないことを検証できる。

### Implementation for User Story 3

- [X] T011 [US3] Implement 80ms debounce timer and monotonic `historyRequestSeq` cancellation in `query` watcher (immediately clearing pending timer, bumping `historyRequestSeq`, and resetting `historyItems = []` on empty/command/folder/`pendingBatchConfirm` states), and preserve active `selectedIndex` by item ID when `historyItems` updates asynchronously (resetting only when `bookmarkItems` changes or selecting index `0` if `selectedIndex === -1` and history arrives) in src/Popup.vue
- [X] T012 [P] [US3] Add `.palette-section-header`, history icon fallback styling (`pi-history`), and PrimeVue CSS variable-compliant `<style scoped>` rules for the history section in src/Popup.vue, verifying `Tab` key leaves input unchanged when a `kind === 'history'` item (`fillText === ''`) is highlighted

**Checkpoint**: すべての User Story（US1〜US3）が仕様通りに競合なく安定動作する状態。

---

## Phase 6: Polish & Cross-Cutting Concerns（ドキュメント同期・ビルド・最終検証）

**Purpose**: プロジェクト基盤ドキュメントの同期、本番ビルド確認、および実機 E2E 検証を完了する。

- [X] T013 [P] Update `.context/spec.md` (document browser history search opt-in setting in Section C, popup history display/dedupe/score rules in Section H, and `optional_permissions: ["history"]` in Section 4) and `.context/tech_stack.md` (add `src/shared/history.ts`)
- [X] T014 Run `npm run build` and verify clean TypeScript/Webpack compilation and updated `package/js/` and `package.zip` artifacts
- [ ] T015 Validate all end-to-end scenarios (including Japanese/English i18n switching and permission revocation recovery) against specs/007-popup-history-search/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即時開始可能（`T001`, `T002` は並列実行可能）
- **Foundational (Phase 2)**: Phase 1 完了後に完了させる（`T003`, `T004`, `T005`, `T006` は並列実行可能、`T007` は `T005` 完了後）— Phase 3〜5 をブロック
- **User Story 1 (Phase 3 - P1)**: Foundational 完了後に開始（`T008`）
- **User Story 2 (Phase 4 - P1)**: Foundational 完了後に開始（`T009` → `T010`、`T009` は `T008` と並列可能）
- **User Story 3 (Phase 5 - P2)**: User Story 2（`T010`）完了後に統合仕上げ（`T011`, `T012`）
- **Polish (Phase 6)**: Phase 3〜5 完了後に実施（`T013` → `T014` → `T015`、`T013` はコード完了直後に並列開始可能）

### User Story Dependencies

- **User Story 1 (P1 - 設定・任意権限)**: Foundational（`T005`, `T007`）のみに依存し、単独で検証可能（MVP 土台）。
- **User Story 2 (P1 - ポップアップ履歴検索・表示・遷移)**: Foundational（`T003`, `T004`, `T006`, `T007`）に依存。実機では US1 で権限付与して動作させる。
- **User Story 3 (P2 - 非同期競合防止・キーボード体験完成)**: US2 の `Popup.vue` 統合（`T010`）を前提に品質と操作性を仕上げる。

### Parallel Opportunities

- Phase 1: `T001` と `T002` は別ファイルのため並列実行可能
- Phase 2: `T003`, `T004`, `T005`, `T006` はすべて別ファイルのため並列実行可能
- Phase 3 / Phase 4: `T008`（`src/Preferences.vue`）と `T009`（`src/shared/history.ts`）は別ファイルのため並列実行可能

---

## Parallel Example: Foundational & Core Stories

```text
# Phase 1（並列）:
- T001: package/manifest.json に optional_permissions 追加
- T002: package/_locales/{ja,en}/messages.json に多言語キー追加

# Phase 2（T003〜T006 を並列実行後、T007 を実行）:
- T003: src/shared/types.ts
- T004: src/shared/url.ts
- T005: src/shared/storage.ts
- T006: src/shared/commands.ts
→ T007: src/shared/history.ts（権限チェック・要求関数）

# Phase 3 & Phase 4（T008 と T009 を並列実行後、T010 を実行）:
- T008 [US1]: src/Preferences.vue（オプトイントグル・権限要求 UI）
- T009 [US2]: src/shared/history.ts（履歴検索・重複除外・変換）
→ T010 [US2]: src/Popup.vue（履歴セクション表示・遷移統合）
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Phase 1（`T001`〜`T002`）と Phase 2（`T003`〜`T007`）を完了する。
2. Phase 3（`T008`：設定画面のオプトイン許可 UI）を実装し、権限付与・拒否が動作することを確認する。
3. Phase 4（`T009`〜`T010`：履歴検索・重複除外・ポップアップ表示・タブ遷移）を実装する。
4. この時点で最小限のユーザー価値（オプトイン許可 → ブックマーク候補下への履歴検索表示・遷移）が完成する。

### Incremental Delivery

1. MVP（Phase 1〜4）に続けて Phase 5（`T011`〜`T012`）を実装し、連続入力時のレースコンディション防止・非同期到着時の選択位置維持・スタイル整備を完了する。
2. Phase 6（`T013`〜`T015`）で `.context/` ドキュメント同期、`npm run build`、および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/quickstart.md) による実機 E2E 検証を完了する。

---

## Notes

- [P] タスクは編集対象ファイルが分かれており並列実行が可能。
- すべての新規関数・型には日本語 JSDoc と日本語コメントを記述する（[constitution.md](file:///Users/sawarame_yasushi/dev/Nickmark/.specify/memory/constitution.md) 原則 IV）。
- `package/js/` 配下のビルド成果物は直接編集せず、必ず `npm run build` で生成すること。
