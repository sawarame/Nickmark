# Technical Research: ブックマークのインポート機能

**Feature**: `012-import-bookmarks` | **Date**: 2026-11-17 | **Related Issue**: #23

## 1. モジュール分割とアーキテクチャ設計

### Decision
JSON / Chrome ブックマーク HTML の解析・正規化・バリデーション・ベースフォルダ付与・マージ処理を担当するドメインモジュール `src/shared/bookmarkImport.ts` を新設し、`src/List.vue` から呼び出すとともに `src/background.ts` からも再エクスポートする。

### Rationale
- 既存の `src/shared/` 構成（`listSort.ts`, `tips.ts`, `history.ts`, `storage.ts`, `url.ts`）と一貫性があり、UI コンポーネント（`List.vue`）をプレゼンテーション・ユーザー操作制御に集中させられる。
- 解析・マージ・検証ロジックを UI から切り離すことで、境界値・不正入力・ラウンドトリップ整合性を独立して検証しやすくなる。
- Constitution 原則 IV（共有スキーマ・型安全性・日本語ドキュメンテーション）に完全準拠する。

### Alternatives Considered
- **案 B: `src/List.vue` 内に解析・マージロジックを直接記述する**
  - *却下理由*: `List.vue` は既に 1,600 行を超えており、HTML/JSON パーサーやマージ処理を直接書くと可読性・保守性が低下し、単体検証も困難になるため。

---

## 2. Chrome 標準ブックマーク HTML（Netscape Bookmark File Format）の解析方式

### Decision
ブラウザ標準の `DOMParser`（`parseFromString(htmlText, 'text/html')`）を用いて HTML5 DOM ツリーを構築し、`<DL>` / `<DT>` / `<H3>` / `<A>` 要素を再帰走査してフォルダ階層・タイトル・URL・`ADD_DATE` を抽出する。

### Rationale
- Chrome や他ブラウザが出力する Netscape Bookmark HTML は `<!DOCTYPE NETSCAPE-Bookmark-file-1>` を持ち、`</DT>` や `</p>` の閉じタグを省略した歴史的構文（例: `<DL><p><DT><H3>Folder</H3><DL><p>...`）を使用する。
- ブラウザ標準の HTML5 パーサー（`DOMParser`）は閉じタグの暗黙補完、ネストされた `<DL>`、UTF-8 文字列、HTML エンティティ（`&amp;`, `&quot;`, `&#39;` 等）を外部ライブラリゼロで正確に処理できる。
- `<DT>` 要素の閉じ方により `<DL>` が `<DT>` の子要素になるケースと兄弟要素になるケースの双方に対応するため、走査時に「直前に検出した `<H3>` フォルダ名（`pendingFolderName`）」を同一コンテナ内で引き継ぎ、直後の `<DL>` 進入時にフォルダスタックへ積む方式を採用することで、DOM 構造の差異に影響されない。

### Alternatives Considered
- **案 B: 正規表現または簡易文字列分割による HTML パース**
  - *却下理由*: 入れ子の `<DL>` 階層、属性内の特殊文字や `javascript:` ブックマークレット内の記号、HTML エンティティのデコードで誤動作しやすい。
- **案 C: 外部 HTML パーサーライブラリ（npm パッケージ）の導入**
  - *却下理由*: Chrome 拡張機能内で標準 `DOMParser` が利用可能であるにもかかわらずバンドルサイズと依存メンテナンスコストを増大させるため不要。

---

## 3. Chrome HTML からのニックネーム生成・URL フィルタ規則

### Decision
- **サニタイズ規則**: フォルダパス各セグメントおよび `<A>` のタイトル文字列について、`/` を `-` に置換し、連続する空白文字（スペース・タブ・改行等）を `-` に置換した上で `normalizeNicknamePath` で正規化する。タイトルが空またはサニタイズ後に空になった場合は、URL のホスト名（例: `github.com`）またはフォールバック文字列 `'bookmark'` を用いる。元の `<A>` の表示テキストは `title` フィールドに無加工（前後空白 trim のみ）で保持する。
- **URL 対象スキーム**: `http://`, `https://`, `file://`, `javascript:`（大文字・小文字不問）を有効対象として取り込み、空の `HREF` や `place:`, `about:`, `chrome:` 等のブラウザ内部スキームはスキップしてスキップ件数を集計する。
- **タイムスタンプ引き継ぎ**: `ADD_DATE` 属性が有効な数値であれば、秒単位（1e12 未満）をミリ秒へ変換して `created_at` / `last_used_at` に設定し、未指定・不正値時は現在時刻を用いる。
- **任意ベースフォルダ指定**: 確認ダイアログ上でユーザーが任意のベースフォルダ（例: `chrome`）を入力できるようし、入力がある場合は変換後の全ニックネーム先頭に `<baseFolder>/` を付与する。

### Rationale
- Nickmark の検索・コマンド体系（オムニボックスおよびコマンドパレット）はスペース区切りで「1語目＝ニックネーム、2語目以降＝引数またはキーワード」を判定するため、ニックネームに空白やスラッシュが残ると検索・フォルダ認識と衝突する。`-` へのサニタイズにより、取り込んだ直後から `nm` やポップアップでそのまま快適に呼び出せる。
- 元のブックマークタイトル自体は `title` フィールドに保持されるため、管理画面での視認性と横断検索の精度も損なわれない。

---

## 4. 適用方式（マージ・上書き）および UI / UX 設計

### Decision
1. 管理画面（`List.vue`）の「ニックネーム管理」カードヘッダー右上（`エクスポート` の左隣）に `インポート` ボタン（`icon="pi pi-upload"`, `severity="secondary"`, `size="small"`）と隠し `<input type="file">` を配置する。
2. ファイル選択直後に即保存せず、ファイル名・検出形式・ニックネーム数・ブックマーク件数（HTML 時のスキップ件数）を表示する PrimeVue `Dialog`（インポート確認ダイアログ）を開く。
3. ダイアログ内で PrimeVue `RadioButton` により適用方式を選択させる：
   - **マージ（デフォルト）**: 既存データを維持し、新規ニックネーム・新規 URL を追加。同一ニックネーム・同一 URL（`isSameUrl` 一致）が存在する場合は `normalizeBookmarksDictionary` と同じマージ規則（高い `score`、最新の `last_used_at`、古い `created_at`、`is_pinned` 維持、非空 `title`/`default_value` 補完）で統合する。
   - **上書き**: 既存のブックマークデータをインポートデータ全体で置き換える。選択時は PrimeVue `Message` (`severity="warn"`) で既存データが置き換わる旨を明示し、実行ボタンを `severity="danger"` に切り替えて誤操作を防ぐ。
4. 保存には既存の `saveBookmarksData` を使用し、Google アカウント同期有効時の 100KB 上限超過時は `QUOTA_EXCEEDED` を捕捉して既存データを一切変更せずエラートーストを表示する。

### Rationale
- デフォルトを安全な「マージ」にしつつ、明確な警告付きで「上書き」も選択できるため、バックアップからの完全復元と部分的な統合の双方を安全に満たせる。
- PrimeVue `Dialog` + `RadioButton` + `Message` + `Button` を用いることで Constitution 原則 III（PrimeVue コンポーネントの統一・ライト/ダーク両モード追従）に準拠できる。

### Alternatives Considered
- **案 B: ダイアログフッターに「マージ」「上書き」の 2 ボタンを並べる**
  - *却下理由*: 「ベースフォルダ指定」オプションと組み合わせた際にアクションが散らばり、上書き時の破壊的操作警告を事前に明確に見せにくいため。
