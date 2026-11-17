# Phase 0 Research: ダークモード時の設定画面・管理画面の配色と視認性修正

**Feature**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/spec.md) | **Plan**: [plan.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/011-fix-dark-mode-design/plan.md) | **Related Issue**: #22

## 1. 原因調査結果

`@primeuix/themes/aura`（`2.0.3`）のトークン定義を検査した結果、以下の仕様上の挙動により本事象が発生していることを確認した。

1. **カラースケールトークンはライト／ダークで反転しない**:
   - `aura.semantic.colorScheme.light.surface`: `100` が `{slate.100}`（薄いグレー）、`50` が `{slate.50}`、`200` が `{slate.200}`。
   - `aura.semantic.colorScheme.dark.surface`: `0` が `#ffffff`、`50` が `{zinc.50}`、`100` が `{zinc.100}`（`#f4f4f5` 相当の非常に明るい色）、`200` が `{zinc.200}`、`900` が `{zinc.900}`、`950` が `{zinc.950}`。
   - 一方、セマンティックトークンはダークモード時に反転する（`--p-text-color` は `{surface.0}` = `#ffffff`、`--p-content-background` は `{surface.900}`、`--p-content-hover-background` は `{surface.800}`、`--p-content-border-color` は `{surface.700}`、`--p-highlight-background` は `color-mix(in srgb, {primary.400}, transparent 84%)`）。
2. **具体的な不具合箇所**:
   - [Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue)（`.container`）および [preferences.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/preferences.html)（`body`）が `var(--p-surface-100)` を背景色に使用しているため、ダークモード時に「ほぼ白の背景（`{zinc.100}`）＋ 白文字（`--p-text-color`: `#ffffff`）」となりヘッダ文字が見づらくなっていた。
   - [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue)（`.container`）および [list.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/list.html)（`body`）も同一の構造で `var(--p-surface-100)` を使用しており、ダークモード時に同じ現象が発生していた。
   - [Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue) のデータ移行ダイアログ内 `.comparison-grid`（`background: var(--p-surface-50)`, `border: 1px solid var(--p-surface-200)`）および `.comparison-item.latest`（`background: var(--p-primary-50)`, `border: 1px solid var(--p-primary-200)`）も非反転スケールトークンを使用しており、ダークモード時の視認性を損ねていた。
   - [popup.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/popup.html) の `body` フォールバックが `#ffffff` / `#18181b` のみであり、ダークモード起動直後（PrimeVue マウント前）に一瞬白くちらつく余地があった。

---

## 2. 設計選択肢の比較と技術的根拠

### 決定 1: ページ背景用テーマトークンの導入方式

- **選択肢 A（採用）**: [appBootstrap.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/appBootstrap.ts) で `@primeuix/themes` の `definePreset` を使い、`Aura` プリセットに `semantic.colorScheme.{light,dark}.page.background`（light: `{surface.100}`, dark: `{surface.950}`）を追加して `NickmarkPreset` を構成し、PrimeVue が自動生成する `--p-page-background` を [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) と [Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue) で参照する。HTML 側（[list.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/list.html), [preferences.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/preferences.html)）では `<body style="...">` のインライン背景指定を廃止し、`<head><style>` で `var(--p-page-background, <fallback>)` と `@media (prefers-color-scheme: dark)` による初期フォールバックを設定する。
  - **メリット**:
    - プロジェクト憲章（原則 III）および [DESIGN.md](file:///Users/sawarame_yasushi/dev/Nickmark/DESIGN.md) が定める「背景色や文字色には PrimeVue の CSS 変数（`--p-*`）を利用しテーマに追従させる」方針に完全に合致する。
    - `@primeuix/themes` の `Theme.getCommon` により `@media (prefers-color-scheme: dark)` の切り替えルールが `:root, :host` へ自動生成されるため、Vue コンポーネント内に重複した `@media` ルールを書かずに済む。
    - HTML の `<style>` 側フォールバックにより、JS 実行前の一瞬の白フラッシュ（FOUC）も防止でき、かつ `<body style="...">` の詳細度勝ちによる上書きも防げる。
  - **デメリット**:
    - 静的 HTML 側に JS ロード前のフォールバック色（`#f1f5f9` / `#09090b`）を併記する必要がある（ただし JS ロード後は PrimeVue の `--p-page-background` が優先されるため整合性は保たれる）。
- **選択肢 B（不採用）**: ページ背景も既存の `--p-content-background` に統一する。
  - **メリット**: 新しいプリセットトークン追加が不要。
  - **デメリット**: ライトモード時は背景もカードも `#ffffff`（同色）になり、従来の「薄いグレーの背景の上に白いカードが並ぶ」視覚的階層が失われる。ダークモード時も同様にカードと背景が同色（`zinc.900`）になってしまう。
- **選択肢 C（不採用）**: Vue コンポーネント側の `<style scoped>` ごとに `@media (prefers-color-scheme: dark)` を個別記述して `--p-surface-950` を上書きする。
  - **メリット**: `appBootstrap.ts` への変更が不要。
  - **デメリット**: `List.vue`、`Preferences.vue`、各 HTML に類似メディアクエリが重複し、PrimeVue テーマシステムから切り離された独自ルールが増える。

**検証確認**: `node -e` により `@primeuix/themes` の `definePreset` と `@primeuix/styled` の `Theme.getCommon` で `--p-page-background: var(--p-surface-100)`（通常）および `@media (prefers-color-scheme: dark)` 内の `--p-page-background: var(--p-surface-950)` が生成されることを実測確認済み。

### 決定 2: 設定画面データ移行ダイアログ（`.comparison-grid` / `.comparison-item.latest`）の配色設計

- **選択肢 A（採用）**: PrimeVue の反転対応済みセマンティックトークンへ置き換える。
  - `.comparison-grid`: `background: var(--p-form-field-filled-background)`（Light: `{surface.50}`, Dark: `{surface.800}`）、`border: 1px solid var(--p-content-border-color)`（Light: `{surface.200}`, Dark: `{surface.700}`）、`color: var(--p-text-color)`
  - `.comparison-item.latest`: `background: var(--p-highlight-background)`（Light: `{primary.50}`, Dark: `color-mix(in srgb, {primary.400}, transparent 84%)`）、`border: 1px solid color-mix(in srgb, var(--p-primary-color) 35%, transparent)`、`color: var(--p-highlight-color)`
  - **メリット**: [Popup.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Popup.vue) で既に採用されている `var(--p-highlight-background)` / `color-mix(in srgb, var(--p-primary-color) ..., transparent)` と同じ設計パターンで統一でき、ライト／ダーク双方で自然なコントラストを確保できる。
  - **デメリット**: なし（Chrome 135 以降が要件であるため `color-mix()` は標準サポート済み）。
- **選択肢 B（不採用）**: `@media (prefers-color-scheme: dark)` で `--p-surface-800` や `--p-primary-950` を個別指定する。
  - **デメリット**: PrimeVue のセマンティックトークンが既に存在するにもかかわらず重複したメディアクエリを書くことになり冗長。

### 決定 3: HTML 初期読み込み時のちらつき防止（FOUC 対策）

- **選択肢 A（採用）**: [preferences.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/preferences.html) と [list.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/list.html) では `<body style="...">` を削除し、`<head><style>` にライト/ダーク両対応の `var(--p-page-background, ...)` と `var(--p-text-color, ...)` を記述する。[popup.html](file:///Users/sawarame_yasushi/dev/Nickmark/package/popup.html) にも同様に `@media (prefers-color-scheme: dark)` 時のフォールバック（`#18181b` / `#ffffff`）を追加する。
  - **メリット**: 拡張機能ページを開いた瞬間にダークモード環境でも白いフラッシュが発生しない。
- **選択肢 B（不採用）**: HTML 側は変更せず `appBootstrap.ts` 側のみ変更する。
  - **デメリット**: `preferences.html` / `list.html` に `<body style="margin: 0; background-color: var(--p-surface-100);">` がインラインで残るため、ブラウザ幅が 1200px を超えた領域やページ下部の `body` 背景が引き続き `--p-surface-100`（白）のままになってしまう。よって HTML 側の修正は必須。
