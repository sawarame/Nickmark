# Tasks: ポップアップのコマンドパレット化とオムニボックス移行案内

**Input**: Design documents from `/specs/006-popup-command-palette/`
**Prerequisites**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/plan.md), [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/spec.md), [research.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/research.md), [data-model.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/data-model.md), [popup-command-palette-contract.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/contracts/popup-command-palette-contract.md)

**Tests**: 本仕様書では自動テストの新規導入は要求されていないため、テストタスクは省略し、ビルド検証および [quickstart.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/006-popup-command-palette/quickstart.md) に基づく実機確認を実施する。

**Organization**: タスクは独立して実装・検証できるよう User Story（P1 → P2）単位で整理している。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルを編集し、未完了タスクへの依存がないため並列実行可能
- **[Story]**: 対応する User Story（`[US1]`, `[US2]`, `[US3]`, `[US4]`）

---

## Phase 1: Setup（設定・レイアウト・多言語リソース準備）

**Purpose**: 拡張機能マニフェストのショートカット変更、ポップアップ外枠のサイズ変更、日英ロケール文言の追加を行う。

- [X] T001 Change `_execute_action.suggested_key.default` from `"Alt+Shift+D"` to `"Ctrl+Shift+U"` in package/manifest.json
- [X] T002 [P] Update popup body width to `600px` and adjust min-height/overflow styling for command palette layout in package/popup.html
- [X] T003 [P] Add Japanese and English i18n message keys for command palette placeholder, `:add` preview/hints, popup confirmation dialog, and omnibox migration banner in package/_locales/ja/messages.json and package/_locales/en/messages.json

---

## Phase 2: Foundational（共通型定義・共有ユーティリティ・コマンド実行基盤）

**Purpose**: 全ユーザーストーリーが依存する型定義、ファビコン・OS別ショートカット表記、および共有コマンド・ブックマークレット実行エンジンを構築する。

**⚠️ CRITICAL**: Phase 3 以降の実装は本フェーズ完了後に開始すること。

- [X] T004 Define `PaletteItemKind` (`'bookmark' | 'bookmarklet' | 'folder' | 'command' | 'completion'`), `PaletteItem` (required `id`, `kind`, `title`, `subtitle`, `fillText`, `executeValue`; optional `badge`, `typeTag`, `isPinned`, `faviconUrl`, `matchTarget`, `folderPath`, `previewMeta`), `AddPreviewMeta`, `TabDisposition`, `CommandExecutionOutcome`, `CommandExecutionResult`, `RuntimeMessage`, `BookmarkletExecutionResult`, and `OMNIBOX_MIGRATION_HINT_CONTENT` in src/shared/types.ts
- [X] T005 [P] Add `getFaviconUrl(pageUrl)` and `getShortcutLabel()` (`"Cmd+Shift+U"` on macOS, `"Ctrl+Shift+U"` otherwise) to src/shared/url.ts and replace duplicate `getFaviconUrl` in src/List.vue with import from src/shared/url.ts
- [X] T006 Create shared command and bookmarklet execution engine (`executeNickmarkCommand` supporting `source: 'popup' | 'omnibox'` and returning `CommandExecutionResult`, plus `executeBookmarklet` executing `chrome.userScripts.execute` without expanding `%s`) in src/shared/commands.ts
- [X] T007 Refactor command/bookmarklet execution in src/background.ts to delegate to `executeNickmarkCommand` / `executeBookmarklet`, add `EXECUTE_BOOKMARKLET` handler in `chrome.runtime.onMessage` returning `BookmarkletExecutionResult` via `sendResponse`, and re-export `src/shared/commands.ts`

**Checkpoint**: 共有コマンドエンジンと型基盤が整い、各 User Story を独立して実装可能な状態。

---

## Phase 3: User Story 1 - ショートカット起動のコマンドパレットによる検索とナビゲーション (Priority: P1) 🎯 MVP

**Goal**: ポップアップから通常検索・動的 URL（`%s`）展開・フォルダ一括オープン（確認 UI 含む）・ブックマークレット実行および各種タブ遷移を完結できるようにする。

**Independent Test**: 新ショートカットまたはツールバーアイコンでポップアップを開き、空欄時非表示、1文字以上の入力での通常検索、通常 URL の現在タブ/新規タブ遷移、フォルダ一括オープン（上限超過時のポップアップ内確認含む）、ブックマークレット実行（成功時クローズ・失敗時ポップアップ内エラー）を単独で検証できる。

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement `buildRegularPaletteItems` and initial `buildPaletteSuggestions` (returning `[]` when `rawQuery.trim()` is empty or slash-only, mapping matched bookmarks/dynamic URLs/bookmarklets/folders into `PaletteItem[]` with `faviconUrl`, `typeTag`, `isPinned`, `matchTarget`, `folderPath`) in src/shared/search.ts
- [X] T009 [US1] Replace the bookmark registration form with a command-palette search input (auto-focus, placeholder hint, empty-input blank list), candidate list rendering (favicon, folder/code icon, badges), URL navigation (`Enter` for `currentTab`, `Cmd/Ctrl/Alt+Enter` for `newForegroundTab`, `Shift` for `newBackgroundTab`, click support), score updates, popup-contained folder batch-open confirmation UI (`needs_confirmation`), and `EXECUTE_BOOKMARKLET` invocation with inline error display in src/Popup.vue

**Checkpoint**: User Story 1（ポップアップ検索・遷移・フォルダ一括オープン・ブックマークレット実行）が MVP として単独動作する状態。

---

## Phase 4: User Story 2 - `:add` 統一によるブックマーク登録とコマンドのポップアップ完結実行 (Priority: P1)

**Goal**: ポップアップ上で `:add`（`:a`）・`:addall`（`:aa`）・`:open`（`:o`）・`:rm`・`:ls`・`:prefs`・`:help` を入力・補完・実行でき、登録・削除・エラー通知を管理画面へ遷移せずポップアップ内で完結させる。

**Independent Test**: ポップアップ上で `:add` のフォルダ補完および対象タブプレビューを確認し、`:add <nick>` で保存→ポップアップ内完了通知→自動クローズ、`:add` 引数なしでポップアップ内入力促し、`:rm` 複数 URL 時・`chrome://` ページ上でも `list.html` へ強制遷移せず完結することを検証できる。

### Implementation for User Story 2

- [X] T010 [US2] Extend `buildPaletteSuggestions` in src/shared/search.ts to handle `:` command mode, including `extractFolders`-based `folder/` prefix completions (`kind: 'completion'`) and `AddPreviewMeta` target tab / direct URL previews for `:add`/`:a`, plus structured `PaletteItem[]` for `:addall`, `:open`, `:rm`, `:ls`, `:prefs`, and `:help`
- [X] T011 [US2] Integrate `executeNickmarkCommand(..., { source: 'popup' })` and popup-contained feedback states (success notice with auto-close timer, `info_prompt` for empty `:add` or multi-URL `:rm` keeping popup open with optional `suggestedInput`, and `error` banner without redirecting to `list.html` on restricted pages) in src/Popup.vue

**Checkpoint**: User Story 1 と User Story 2 が連携し、検索・遷移と `:add` 統一登録を含む全コマンド実行がポップアップ内で完結する状態。

---

## Phase 5: User Story 3 - キーボードファーストの補完操作とパレット UI の視認性 (Priority: P2)

**Goal**: `↑`/`↓`・`Ctrl+N`/`Ctrl+P` 移動、`Tab` 補完、IME 誤爆防止、`Esc` クローズ、および入力欄右端アイコンボタン・約 600px パレットデザインを仕上げる。

**Independent Test**: ポップアップ上で日本語 IME 確定 `Enter`、矢印キー/`Ctrl+N`/`Ctrl+P` による入力文字列非変更のハイライト移動＋自動スクロール、`Tab` による候補補完、`Esc` クローズ、一覧/設定アイコンボタンクリック（`Tab` フォーカス除外）を検証できる。

### Implementation for User Story 3

- [X] T012 [US3] Implement keyboard navigation (`ArrowDown`/`ArrowUp`/`Ctrl+N`/`Ctrl+P` highlight movement with `scrollIntoView({ block: 'nearest' })`, `Tab` completion writing `fillText` to query without moving focus, `Esc` confirmation cancel or popup close, and `isComposing || keyCode === 229` IME Enter guard) in src/Popup.vue
- [X] T013 [P] [US3] Add right-aligned List (`list.html`) and Preferences (`preferences.html`) icon buttons (`tabindex="-1"`) next to the search input and finalize PrimeVue CSS variable-based `<style scoped>` styling (`600px` width, scrollable candidate container, active/hover states, badge alignment) in src/Popup.vue

**Checkpoint**: キーボード操作とパレット UI の視認性・アクセシビリティが仕様通りに機能する状態。

---

## Phase 6: User Story 4 - 移行期間中のオムニボックスでのポップアップ利用促進案内 (Priority: P2)

**Goal**: 現行のオムニボックス（`nm`）を後方互換として維持しつつ、起動時および入力時にショートカット版ポップアップへの移行を促す候補を表示し、案内候補選択時は安全に終了させる。

**Independent Test**: アドレスバーで `nm ` を入力した直後およびキーワード・コマンド入力時に OS 別ショートカット表記の移行案内が表示され、通常検索の `Enter` 遷移は維持されたまま、移行案内候補選択時は破壊的操作や強制ページ遷移が起きないことを検証できる。

### Implementation for User Story 4

- [X] T014 [US4] Update `chrome.omnibox.onInputStarted`, `onInputChanged`, and `onInputEntered` in src/background.ts to display OS-aware (`getShortcutLabel()`) popup migration guidance in default suggestion and as the top suggestion item (`OMNIBOX_MIGRATION_HINT_CONTENT`) while preserving default top-match execution and safely handling selection of the migration item (showing toast only on scriptable tabs without forcing `list.html` navigation)

**Checkpoint**: すべての User Story（US1〜US4）が独立かつ統合的に機能する状態。

---

## Phase 7: Polish & Cross-Cutting Concerns（ドキュメント同期・ビルド・最終検証）

**Purpose**: プロジェクトドキュメントの同期、本番ビルド確認、および実機 E2E 検証シナリオの点検を完了する。

- [X] T015 [P] Update `.context/spec.md` (refresh section H for popup command palette and add transition notice to sections A/B) and `.context/tech_stack.md` (add `src/shared/commands.ts` and updated popup role)
- [X] T016 Run `npm run build` and verify clean TypeScript/Webpack compilation and updated `package/js/` and `package.zip` artifacts
- [X] T017 Validate all end-to-end scenarios (including Japanese/English i18n switching) against `specs/006-popup-command-palette/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即時開始可能（`T001`, `T002`, `T003` は並列可能）
- **Foundational (Phase 2)**: Phase 1（特に `T003` ロケールキー定義）と連携しつつ開始可能 — Phase 3〜6 をブロック
  - `T004` → `T006` → `T007`（順番に依存）
  - `T005` は `T004` と並列可能、`T006` より前に完了
- **User Story 1 (Phase 3 - P1)**: Foundational 完了後に開始（`T008` → `T009`）
- **User Story 2 (Phase 4 - P1)**: `T008`, `T009` 完了後に統合（`T010` → `T011`）
- **User Story 3 (Phase 5 - P2)**: `T009` / `T011` 完了後に仕上げ（`T012`, `T013`）
- **User Story 4 (Phase 6 - P2)**: Foundational（`T003`, `T005`, `T007`）完了後、Phase 3〜5 と独立・並列で実装可能（`T014`）
- **Polish (Phase 7)**: 全 User Story 完了後に実行（`T015` 並列 → `T016` → `T017`）

### Parallel Opportunities

- Phase 1: `T001`, `T002`, `T003` を並列実行可能
- Phase 2: `T004` と `T005` を並列実行可能
- Phase 3 開始後: `T008`（`src/shared/search.ts`）と `T014`（`src/background.ts` の US4）を並列実行可能
- Phase 5: `T013`（ヘッダーボタン・CSS）は `T009` 完了後に `T010`〜`T012` と調整しつつ並列推進可能
- Phase 7: `T015`（ドキュメント同期）は実装完了後すぐに並列着手可能

---

## Parallel Example: Foundational & Cross-Story

```bash
# Phase 1 を並列実行:
Task: "T001 Update shortcut in package/manifest.json"
Task: "T002 Update layout width in package/popup.html"
Task: "T003 Add ja/en locale messages in package/_locales/{ja,en}/messages.json"

# Phase 2 完了後、検索候補構築（US1）とオムニボックス移行案内（US4）を並列実行:
Task: "T008 [P] [US1] Implement buildRegularPaletteItems in src/shared/search.ts"
Task: "T014 [US4] Implement omnibox migration suggestions in src/background.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1（Setup）および Phase 2（Foundational）を完了する
2. Phase 3（User Story 1: ポップアップの起動・検索・遷移・フォルダ一括オープン・ブックマークレット）を実装する
3. **検証ポイント**: `npm run build` を通し、新ショートカットからの検索・ページ遷移が単独で動作することを確認する

### Incremental Delivery

1. Setup + Foundational 完了
2. **US1（P1）**: 検索・ナビゲーション MVP 完成
3. **US2（P1）**: `:add` 統一登録・全コマンド・ポップアップ完結通知を追加
4. **US3（P2）**: キーボード補完（`Tab`, `Ctrl+N/P`, IME ガード）とアイコン・スタイル仕上げ
5. **US4（P2）**: オムニボックスへの移行案内候補を追加
6. **Polish**: `.context/` 同期、`npm run build`、`quickstart.md` に沿った最終検証
