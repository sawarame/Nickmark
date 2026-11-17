# Research: コマンド入力モード時のアイコン表示修正

**Feature**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/013-popup-command-icon/spec.md) | **Date**: 2026-11-17

## 1. 現状調査と根本原因

1. **`src/Popup.vue` のアイコン切り替え実装**
   - 検索入力欄左側（L5-8）では、`isCommandInput`（`query.value.trimStart().startsWith(':')`）の真偽に応じて `'pi-terminal'` と `'pi-search'` を切り替える実装になっていた。
   - 候補一覧のコマンド・補完候補行（L145-149）でも `class="pi pi-terminal item-icon item-icon-cmd"` が指定されていた。
2. **PrimeIcons 7.0.0 における `pi-terminal` の不在**
   - `package.json` で採用している `primeicons`（`^7.0.0`）の `node_modules/primeicons/primeicons.css` を全検索した結果、`.pi-terminal` クラスは定義されていなかった。
   - そのため、`:` を入力して `isCommandInput` が `true` になると `.pi-search` のグリフが外れ、代替グリフが適用されずにアイコンが空白（未描画）となる不具合が生じていた。コマンド候補行の左側アイコンも同様に空白となっていた。

## 2. 設計選択肢の比較と技術的根拠

### 検討した選択肢

| 案 | 方式 | メリット | デメリット | 採否 |
|---|---|---|---|---|
| **案 A** | 再利用可能なインライン SVG コンポーネント（`src/components/CommandPromptIcon.vue`）を新設し、`>_`（ターミナルプロンプト）を描画 | ・Issue #26 添付画像と一致する `>_` 形状を正確に表現可能<br>・`stroke="currentColor"` により `--p-primary-color`（緑系）やライト／ダークモードに自動追従<br>・外部 npm 依存を増やさずバンドル増が極めて小さい<br>・検索欄左側と候補一覧の 2 箇所でロジック／SVG を重複させずに共通利用可能 | ・`DESIGN.md` の「`primeicons` を使用する」原則に対する最小限の局所的例外となる（ただし対象アイコンが `primeicons` に存在しないため） | **採用** |
| **案 B** | `primeicons` に存在する別アイコン（`pi-code` や `pi-chevron-right`）へ変更 | ・`primeicons` のみで完結し独自 SVG が不要 | ・Issue #26 の添付画像（`>_`）と見た目が一致しない<br>・`pi-code`（`</>`）は既にブックマークレット行で使用済みであり、視覚的役割が衝突する | 不採用 |
| **案 C** | `lucide-vue-next` 等の別アイコンパッケージを追加導入 | ・既存のライブラリからターミナルアイコンを呼び出せる | ・1 アイコン表示のみのために依存パッケージが増え、バンドル肥大化や保守コスト増につながる | 不採用 |

### 採用理由（技術的根拠）

`primeicons` v7.0.0 に `>_` に相当するターミナル／コマンドプロンプトアイコンが存在しない以上、Issue #26 の要望（「画像のように虫眼鏡アイコンからコマンド入力アイコンに変更する」）を忠実に満たしつつ、既存ブックマークレット用アイコン（`pi-code`）との混同や不要な依存追加を避けるには **案 A** が最適である。

## 3. レイアウト・スタイル設計上の考慮点

- **横ズレ防止（0px 維持）**: `.pi` クラスは `display: inline-block; line-height: 1;` で `1em × 1em`（検索欄では `font-size: 1rem` 相当の 16px 四方）を占有する。SVG アイコンも `width="1em" height="1em"` とし、`.search-leading-icon` に `display: inline-flex; align-items: center; justify-content: center; width: 1rem; height: 1rem;` を設定することで、検索アイコンとコマンド入力アイコン切り替え時の枠幅を完全に一致させる。
- **色・テーマ追従**: `stroke="currentColor"` を使用し、`.search-leading-icon` および `.item-icon-cmd` に設定されている `color: var(--p-primary-color, #10b981)` をそのまま継承することで、ライトモード／ダークモードを問わず Issue 添付画像と同じ緑系アクセントカラーで描画する。
- **アクセシビリティ**: 装飾アイコンであるため SVG 要素に `aria-hidden="true"` を付与し、スクリーンリーダーの読み上げノイズを防ぐ。
