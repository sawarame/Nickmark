# Phase 0 技術調査・設計判断: ポップアップ初期表示時の Tips 表示

**Feature**: ポップアップ初期表示時の Tips 表示 (`specs/009-popup-tips/spec.md`)
**Date**: 2026-11-17

## 1. Tips カタログとランダム選出ロジックの配置

### 検討した選択肢

- **案 A（採用）**: `src/shared/tips.ts` を新規作成し、`POPUP_TIPS` 定数と `pickRandomTipIndex` などの純粋関数を切り出し、型定義を `src/shared/types.ts` に追加する。
- **案 B**: `src/Popup.vue` の `<script setup>` 内に Tips 配列とランダム選出ロジックを直接記述する。

### 設計判断と技術的根拠

- **採用**: **案 A**
- **根拠**:
  - プロジェクト憲章（原則 IV）および既存の `src/shared/` 構成（`search.ts`, `history.ts`, `commands.ts`）に沿い、UI 描画（`Popup.vue`）とデータ・選出ロジック（`shared/tips.ts`）を分離することで見通しと保守性を高めるため。
  - `pickRandomTipIndex(totalCount, excludeIndex)` を純粋関数として切り出すことで、連続クリック時の同一 Tip 除外ロジックの正しさを単体で検証しやすくなるため。

---

## 2. クリック時の連続重複回避アルゴリズム

### 検討した選択肢

- **案 A（採用）**: 除外インデックス法（`count - 1` 通りの乱数を引き、`index >= excludeIndex` なら `+1` する $O(1)$ 方式）。
- **案 B**: `do { next = random() } while (next === current)` によるリトライループ方式。

### 設計判断と技術的根拠

- **採用**: **案 A**
- **根拠**:
  - `count <= 1` に対する安全な境界ガードを含めつつ、常に 1 回の乱数生成（定数時間 $O(1)$）で残り `count - 1` 件から均等確率で異なる Tip を選出できるため。

---

## 3. 多言語メッセージ管理と起動時の言語チラつき防止

### 検討した選択肢

- **案 A（採用）**: 各 Tip 本文・バッジ・切替補助ラベルをすべて `package/_locales/{ja,en}/messages.json` に定義し、`src/i18n.ts` の `t()`（`Popup.vue` 内のリアクティブラッパー `tr()`）経由で取得する。また、`initI18n()` 完了後（`i18nVersion > 0`）にのみ Tips を描画する。
- **案 B**: `src/shared/tips.ts` 内に `{ ja, en }` の直書き辞書を持ち、フォールバック文字列で初期描画する。

### 設計判断と技術的根拠

- **採用**: **案 A**
- **根拠**:
  - プロジェクト憲章（原則 V）および `AGENTS.md` で定められた「UI 文言はハードコードせず `package/_locales/{ja,en}/messages.json` に定義する」規約に完全準拠するため。
  - `onMounted` で `initI18n()` が完了する数ミリ秒の間だけ描画を待つことで、たとえば英語設定ユーザーが日本語フォールバックを一瞬目にするような言語チラつきを確実に防げるため（検索欄は即座に描画・フォーカスされるため操作の妨げにならない）。

---

## 4. 空白状態判定・フィードバック競合回避・フォーカス維持

### 検討した選択肢

- **案 A（採用）**: `shouldShowTips` を `query.trim().length === 0 && !pendingBatchConfirm && !feedback && i18nVersion > 0` とし、Tips 領域には `tabindex="-1"` と `@mousedown.prevent` を付与した上で、クリックハンドラ内でも `focusSearchInput()` を呼ぶ。
- **案 B**: `query.length === 0` のみで判定し、`feedback` 表示中も下に Tips を並べて表示する。

### 設計判断と技術的根拠

- **採用**: **案 A**
- **根拠**:
  - スペースのみ（`"   "`）の入力時は候補リストが出ない（`shouldShowList` が `false`）ため、`query.trim().length === 0` に揃えることで「リストも Tips も出ない空白状態」の発生を防止できるため。
  - `:add` 成功直後は `query` が空文字へリセットされると同時に `feedback` バナーが 2.5 秒間表示されるため、`!feedback` を条件に含めることで成功・エラー通知の視認性を損なわず、自動消去後に自然な空白案内（Tips）へ復帰できるため。
  - `tabindex="-1"` と `@mousedown.prevent` + `focusSearchInput()` の組み合わせにより、クリック直後でも検索入力欄からフォーカスが外れず、直後のキー入力が 1 文字も取りこぼされないため。

---

## 5. OS に合わせた修飾キー表記の統一

### 検討した選択肢

- **案 A（採用）**: 既存の `src/shared/url.ts` にある `getShortcutLabel()` の OS 判定パターンを再利用し、共通ヘルパー（例: `isMacPlatform()` / `getPrimaryModifierLabel()`）を用いて Mac では `Cmd`、Windows/Linux では `Ctrl` として Tip プレースホルダー（`$1`）へ展開する。
- **案 B**: 常に `Cmd/Ctrl` の併記文字列をメッセージファイルに固定記述する。

### 設計判断と技術的根拠

- **採用**: **案 A**（ただしキー表記を簡潔にするため `getShortcutLabel()` のプラットフォーム判定ロジックを共有化して重複を排除する）
- **根拠**:
  - 既存の `url.ts` にあるプラットフォーム判定ロジックと設計を統一することでコード重複を防ぎ、ユーザーの使用 OS に即した読みやすいショートカット表記（例: Mac なら `Cmd+Enter`、Win/Linux なら `Ctrl+Enter`）を提示できるため。
