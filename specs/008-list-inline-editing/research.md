# Phase 0 技術調査・設計判断: 管理画面一覧の列幅固定・URL省略表示およびインライン編集化

**Feature**: `008-list-inline-editing` | **Branch**: `009-list-inline-editing` | **Date**: 2026-11-15

## 1. 固定列幅レイアウトと URL の 1 行「...」省略表示

### 調査内容

現在の [List.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/List.vue) では、`DataTable` に `tableStyle="min-width: 50rem"` のみを指定しており、HTML テーブルの標準レイアウト（`table-layout: auto`）で描画されている。そのため、ページ切り替えや登録データの内容（長いニックネーム、長いタイトル、長大な URL・ブックマークレット）に応じて各列の横幅が毎回変動してしまう。また、URL 列は `.url-text` が `word-break: break-all`、ブックマークレットが `-webkit-line-clamp: 3` となっており、1 行で `...` 省略表示されていない。

### 設計選択肢の比較

| 選択肢 | メリット | デメリット |
| ------ | -------- | ---------- |
| **案 A（採用）: PrimeVue `DataTable` に `table-layout: fixed` を適用し、各 `Column` に固定幅を設定する** | Constitution III に準拠し既存の `sortable` / `paginator` / `stripedRows` を維持できる。列幅の変動を完全に 0px に抑えられる。 | Flexbox 内のテキスト省略（`text-overflow: ellipsis`）を効かせるため、ラッパー側に `min-width: 0; overflow: hidden;` を明示する必要がある。 |
| 案 B: `DataTable` を廃止し、CSS Grid ベースの独自テーブルを構築する | 列幅とセル高さの完全な自由度が得られる。 | Constitution III（PrimeVue コンポーネント優先、独自 UI 再発明の禁止）に反し、ソート・ページングの再実装コストが大きい。 |

### 決定と根拠

- **決定**: **案 A** を採用する。`DataTable` のテーブル要素（`.p-datatable-table` または `:pt="{ table: { style: '...' } }"`）に `table-layout: fixed; width: 100%; min-width: 820px;` を適用する。
- **列幅配分**:
  - **ニックネーム列**: 固定幅 `180px`（長文やスペースなし連続文字列は `overflow-wrap: anywhere;` でセル幅内に収める）
  - **タイトル列**: 固定幅 `220px`（同上、`overflow-wrap: anywhere;` でセル幅内に収める）
  - **URL 列**: 残余幅すべて（他 4 列を固定 px 幅とすることで、`table-layout: fixed` かつ同一ウィンドウ幅ではページやデータ内容によらず列幅が完全に不変となり、広いウィンドウでは URL の閲覧性を最大限確保できる）
  - **ピン留め列**: 固定幅 `72px`（中央揃え）
  - **操作列**: 固定幅 `104px`（「新しいタブで開く」ボタンと「削除」ボタンの 2 つを余裕を持って横並び表示可能）
- **URL 1 行省略表示の実装方針**:
  - セル内のフレックスコンテナ（アイコン＋URL テキスト）に `display: flex; align-items: center; gap: 0.5rem; min-width: 0; width: 100%;` を設定する。
  - URL テキスト要素（通常 URL・ブックマークレット共通）に `display: block; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` を適用し、`:title="slotProps.data.url"`（または `v-tooltip`）でホバー時に全文を確認できるようにする。

---

## 2. インライン編集の状態管理・UI コンポーネントとキー操作

### 調査内容

従来の編集ボタン（`pi-pencil`）と編集用 `Dialog`（`showEditDialog` / `editBookmarkData`）を廃止し、ニックネーム・タイトル・URL の各セルをクリックすると `Textarea` に切り替わり、フォーカスアウトまたは `Enter` キーで保存、`Escape` キーでキャンセルするように変更する。

### 設計選択肢の比較

| 選択肢 | メリット | デメリット |
| ------ | -------- | ---------- |
| **案 A（採用）: 単一アクティブ編集状態（`inlineEdit`）と PrimeVue `Textarea` + コンテナ単位 `@focusout` 制御** | 同時に 1 セルのみ編集中に限定でき、行データの再ソートやページ遷移を伴う保存でも対象行の識別（`originalNickname` + `originalUrl`）がずれない。URL セル内の `default_value` 入力欄との間のフォーカス移動でも誤保存を防げる。 | `Escape` キャンセル直後に発生する `blur` / `focusout` や、`Enter` 確定後の二重保存を防ぐ排他制御が必要になる。 |
| 案 B: PrimeVue `DataTable` の組み込み `editMode="cell"` を使用する | PrimeVue 標準のセル編集イベントを利用できる。 | URL セル内での動的 URL 用 `default_value` 複合入力、単一行テキストエリアでの `Enter` 即確定＋`Escape` キャンセル、空タイトルセルのクリック領域カスタマイズに対して制御が窮屈になり、PrimeVue 内部の編集終了タイミングと独自検証＋ロールバックが競合しやすい。 |

### 決定と根拠

- **決定**: **案 A** を採用する。
- **キー操作と IME ガード**:
  - `Enter` キー（`!event.isComposing && event.keyCode !== 229`）：`event.preventDefault()` で改行文字の挿入を阻止し、インライン保存処理を即時実行する（ユーザー指定により `Shift+Enter` での改行は不要なため、`Shift+Enter` を含め改行は挿入せず確定動作とする）。
  - `Escape` キー：`event.preventDefault()` のうえキャンセル確定フラグを立てて即座に編集状態をクリア（元の表示に戻す）し、保存は一切行わない。
- **二重保存・キャンセル後保存の防止**:
  - `inlineEdit` の保存／終了処理に `isClosing`（または処理中）ガードを設ける。`Enter` 押下時に保存処理を開始した直後にテキストエリアがアンマウントされ `focusout` が発火した場合、および `Escape` 押下後に `focusout` が発火した場合でも、状態が既にクリア（または保存処理中）であれば後続の `focusout` は即座にリターンする。
- **自動フォーカス制御**:
  - セルクリック時に `inlineEdit` へ対象行とフィールドをセットし、`await nextTick()` 後に編集ラッパー内の `textarea` 要素を検索して `.focus()` を呼び出す（`textarea` の高さを内容に合わせて見やすく確保し、カーソルがすぐ入力できる状態にする）。

---

## 3. URL セル内での「開く」操作と動的 URL（`%s`）デフォルト値編集の統合

### 調査内容

ユーザー決定（Q1: A、Q2: A）に基づき、以下を両立させる必要がある：
1. URL セルは文字列クリックを含めセル全体でインライン編集を開始し、ページを開く操作は「開く」アイコンボタンで提供する。
2. URL に `%s` を含む動的 URL（`isDynamicUrl(inlineEdit.url)`）の場合は、URL テキストエリアの直下に「引数省略時のデフォルト値」入力欄を同一セル内に表示してあわせて編集・保存できるようにする。

### 設計選択肢の比較（開くボタンの配置）

| 選択肢 | メリット | デメリット |
| ------ | -------- | ---------- |
| **案 1（採用）: 「操作（Actions）」列に「開く」ボタン（`pi pi-external-link`）と「削除」ボタンを並べる** | URL セルのクリック編集領域を 100% 編集専用に保てるため、「開こうとして編集になる／編集しようとして開く」誤操作が起きない。廃止される編集ボタン（`pi-pencil`）のスペースをそのまま活用できる。 | アイコンが URL 文字列から少し右に離れる（ただし同一行の操作列にあり十分視認できる）。 |
| 案 2: URL セル内の右端や左端に「開く」ボタンを置く | URL のすぐ隣にある。 | URL セルのクリックイベントとボタンクリックのバブリング制御（`@click.stop`）が必要になり、狭い幅で URL 省略表示領域がさらに圧迫される。 |

### 決定と根拠

- **決定**: **案 1** を採用する。操作列に通常 URL（`!isBookmarkletUrl(slotProps.data.url)`）の場合のみ `pi pi-external-link` ボタンを表示する（クリックで `window.open(resolveNavigableUrl(slotProps.data), '_blank', 'noopener,noreferrer')` により新規タブで開く）。ブックマークレット行では開くボタンを非表示とする。
- **同一セル内の複合編集（URL ＋ デフォルト値）のフォーカス管理**:
  - URL 編集時はセル内の `.inline-edit-wrapper` 要素に `@focusout="handleInlineFocusOut"` を設定する。
  - `handleInlineFocusOut(event: FocusEvent)` では、`const nextTarget = event.relatedTarget as Node | null;` が編集ラッパー内（`currentTarget.contains(nextTarget)`）であれば **編集を継続** し、ラッパー外部へフォーカスが移動したとき（`nextTarget === null` またはラッパー外要素）に保存処理を実行する。
  - また、編集中の URL テキストエリアで `%s` を入力した瞬間に `isDynamicUrl(inlineEdit.url)` がリアクティブに `true` へ切り替わり、同じ編集ラッパー内にデフォルト値用 `InputText` が出現するため、新規に動的 URL へ変更する場合もそのままデフォルト値を続けて入力・保存できる。逆に `%s` を消した場合はデフォルト値欄が消え、保存時に `default_value` も自動で除去される。

---

## 4. 変更なし時のスキップ判定とエラー時の安全な復元

### 検討内容

- ユーザーが間違えてセルをクリックし、何も変更せずにフォーカスを外した場合に毎回「正常に更新されました」トーストが出てストレージへ書き込まれると煩わしい。
- **判定ルール**:
  - `nickname`: `normalizeNicknamePath(draftValue) === normalizeNicknamePath(originalNickname)`
  - `title`: `draftValue.trim() === (originalTitle || '').trim()`
  - `url`（および `default_value`）: `draftUrl.trim() === originalUrl.trim()` かつ、動的 URL の場合は `(draftDefaultValue || '').trim() === (originalDefaultValue || '').trim()`（非動的 URL に変わった場合は `originalDefaultValue` が存在すれば変更ありとしてクリア保存する）
  - いずれも変更なしと判定された場合は保存・トースト表示を行わず編集終了のみ行う。
- **バリデーション・ストレージエラー時の扱い**:
  - ニックネームが空（正規化後 `""`）、URL が空（`""`）、または移動・変更先の `(newNickname, newUrl)` が既存別エントリと重複する場合はエラー `Toast` を表示し、元のブックマークデータ（`bookmarksData`）は一切書き換えず編集モードを閉じる（結果としてセル表示は元の有効な値のまま保たれる）。
  - ストレージ保存時（`saveBookmarksData`）が `QUOTA_EXCEEDED` 等で失敗した場合は、メモリ上の `bookmarksData` への変更もロールバック（または保存成功後に確定、あるいは失敗時に復元）して、表示とストレージが乖離しないようにする。
  - 特に現行 `saveEditBookmark` は `bookmarksData.value` を先に書き換えてから `await saveBookmarksData(...)` を呼んでいたため、今回のリファクタリングでは「事前にディープコピー（またはスナップショット）を保持し、`saveBookmarksData` 失敗時は元の `bookmarksData.value` に戻す」方式に改善するとより安全になる。
