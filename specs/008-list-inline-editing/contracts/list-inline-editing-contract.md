# UI & Behavior Contract: 管理画面一覧テーブルおよびインライン編集

**Feature**: `008-list-inline-editing` | **Date**: 2026-11-15 | **Spec**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/008-list-inline-editing/spec.md)

## 1. 一覧テーブル列レイアウト契約

`src/List.vue` の `DataTable` は `table-layout: fixed; width: 100%; min-width: 820px;` を採用し、以下の列定義・固定幅・オーバーフロー挙動を保証する。

| 列 | フィールド | 幅設定 | 表示・オーバーフロー仕様 | ソート |
| -- | ---------- | ------ | ------------------------ | ------ |
| 1. ニックネーム | `nickname` | `180px`（固定） | 通常表示はテキスト折り返し（`overflow-wrap: anywhere`）、セルクリックでインライン編集 | `sortable` |
| 2. タイトル | `title` | `220px`（固定） | 通常表示はテキスト折り返し（`overflow-wrap: anywhere`）、空文字時もクリック可能な領域（最小高さ確保）を提供、セルクリックでインライン編集 | `sortable` |
| 3. URL | `url` | 残余幅すべて（最小 `244px` 以上） | 左に Favicon（通常 URL）または `pi-code`（ブックマークレット）を固定サイズ（16px）で表示。URL テキストは **1 行固定＋末尾 `...` 省略**（`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`）、ホバー時のツールチップ（`:title`）で全文表示。セルクリックでインライン編集（`<a>` タグによるクリック遷移は廃止） | `sortable` |
| 4. ピン留め | `is_pinned` | `72px`（固定） | 中央揃えで既存のピン留めトグルボタン | なし |
| 5. 操作 | - | `104px`（固定） | 左：通常 URL（`!isBookmarkletUrl(url)`）のみ「新しいタブで開く」ボタン（`pi-external-link`）。右：削除ボタン（`pi-trash`）。**従来の編集ボタン（`pi-pencil`）および編集モーダルは廃止** | なし |

---

## 2. インライン編集インタラクション契約

1. **編集開始（クリック）**:
   - `nickname` / `title` / `url` いずれかの非編集セルをクリックすると `inlineEdit` を該当行・フィールドに設定し、`nextTick()` で編集用 `Textarea` へ自動フォーカスする。
   - 他セルが編集中だった状態で別セルをクリックした場合は、先のテキストエリアの `focusout` が先に発火して保存（または変更なし終了）された後、クリックしたセルの編集へ自然に移行する。
2. **編集中のテキストエリア表示**:
   - PrimeVue `Textarea` を使用し、セル幅いっぱいに広がるサイズとする（複数行折り返し表示により長い URL やブックマークレットも編集しやすい視認性を確保）。
   - `field === 'url'` かつ `isDynamicUrl(inlineEdit.draftValue)` が `true` の場合は、同一の編集ラッパー（`.inline-edit-wrapper`）内の直下に `defaultValueLabel` ラベル付きの `InputText`（`default_value` 用）を表示する。
3. **確定保存（`focusout` / `Enter`）**:
   - **フォーカスアウト**: `.inline-edit-wrapper` の `@focusout` で、`relatedTarget` が同ラッパー内部に含まれる場合は編集継続、外部（または `null`）へ移動した場合は保存処理を実行する。
   - **Enter キー**: テキストエリアおよび `default_value` 入力欄において、`!event.isComposing && event.keyCode !== 229` のときに `event.preventDefault()` を行い保存処理を実行する（改行は挿入しない。`Shift+Enter` も同様に改行せず確定とする）。
   - **二重保存防止**: 処理中ロック／キャンセル済みフラグにより、`Enter` 確定や `Escape` キャンセル直後に発生する `focusout` で保存処理が再実行されないことを保証する。
4. **キャンセル（`Escape`）**:
   - テキストエリアおよび `default_value` 入力欄で `Escape` キーが押された場合、変更内容を破棄して保存処理を行わず通常表示に戻す。
5. **通知と保護**:
   - 内容に変更がなければ保存処理・成功トーストをスキップする。
   - 正常に保存された場合は `successUpdated` トーストを表示する。
   - 空値または重複 URL の場合は既存の `errorNicknameUrlRequired` / `errorUrlExists` エラートーストを表示し、元の値へ戻す。
   - `saveBookmarksData` 失敗時は変更前のスナップショットへロールバックし、`getSaveErrorMessage(err)` をエラートースト表示する。
   - `inlineEdit !== null` の間、`onWindowFocusOrVisible` による自動再読み込みを抑止する。

---

## 3. 「新しいタブで開く」アクション契約

- 操作列の `pi-external-link` ボタンは `!isBookmarkletUrl(slotProps.data.url)` の行にのみレンダリングする。
- クリック時は `window.open(resolveNavigableUrl(slotProps.data), '_blank', 'noopener,noreferrer')` を呼び出し、解決済み URL を新しいタブで開く（ブックマーク管理画面自身のスコア更新は行わない既存仕様と同一）。

---

## 4. 多言語リソース契約（`package/_locales/{ja,en}/messages.json`）

### 追加キー

| キー | 日本語 (`ja`) | 英語 (`en`) | 用途 |
| ---- | ------------- | ----------- | ---- |
| `openInNewTabTooltip` | `新しいタブで開く` | `Open in new tab` | 操作列の外部リンクボタンのツールチップ・`aria-label` |
| `deleteBookmarkTooltip` | `削除` | `Delete` | 操作列の削除ボタンのツールチップ・`aria-label`（任意・統一性向上） |

### 廃止・不使用キーの扱い

- 編集ダイアログ見出し用だった `editBookmarkTitle` は `List.vue` から参照されなくなる。他画面（`Popup.vue`, `Preferences.vue`, `background.ts`, `shared/`）での参照がないことを確認済みのため、ロケールファイル内の不要キー整理対象（または互換維持）として実装時に確認のうえ整理する。
