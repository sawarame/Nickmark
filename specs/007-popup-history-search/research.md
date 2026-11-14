# Phase 0 技術調査・設計判断: ポップアップ検索でのブラウザ履歴表示（オプトイン権限）

**対象機能**: `007-popup-history-search` | **作成日**: 2026-11-14 | **関連仕様**: [spec.md](file:///Users/sawarame_yasushi/dev/Nickmark/specs/007-popup-history-search/spec.md)

## 1. 任意権限（`optional_permissions`）の採用と権限リクエストフロー

### 決定
- `package/manifest.json` の `permissions` は変更せず、`optional_permissions` として `"history"` を宣言する。
- 履歴検索の有効状態は、`chrome.storage.local` に保存するデバイス固有フラグ（`historySearchEnabled`）と、`chrome.permissions.contains({ permissions: ['history'] })` による実行時権限チェックの双方（AND 条件）で判定する。
- 設定画面（[Preferences.vue](file:///Users/sawarame_yasushi/dev/Nickmark/src/Preferences.vue)）でトグルを ON にする操作時は、クリックイベント内で不要な非同期処理を挟まずに直接 `chrome.permissions.request({ permissions: ['history'] })` を呼び出す。

### 根拠
- **ユーザージェスチャー要件の遵守**: Chrome 拡張機能 API の仕様上、`chrome.permissions.request()` はユーザージェスチャー（クリック等）の直後に呼び出す必要があり、事前に `await chrome.storage...` 等の非同期処理を挟むとユーザージェスチャーコンテキストが失われて例外・拒否の原因になる。なお、すでに権限が付与されている状態で `chrome.permissions.request()` を呼んだ場合でも Chrome はプロンプトを再表示せず即座に `true` を返すため、事前確認なしで直接呼び出すのが最も安全である。
- **最小権限の維持**: 憲章（[constitution.md](file:///Users/sawarame_yasushi/dev/Nickmark/.specify/memory/constitution.md)）の「権限は最小限の原則」に従い、履歴検索を望まないユーザーにはインストール・アップデート時の権限警告を一切発生させない。
- **外部取り消しへの耐性**: ユーザーが Chrome の拡張機能詳細画面（`chrome://extensions/`）から権限を取り消した場合でも、実行時に `chrome.permissions.contains` で安全に判定することで、例外を出さずに無効状態へフォールバックできる。

### 検討した代替案
- **必須権限 `permissions: ["history"]` への追加**: 実装は単純になるが、既存ユーザーのアップデート時に権限再承認（拡張機能の一時無効化）が発生し、プライバシー上の心理的ハードルも高いため不採用。
- **トグル OFF 時に `chrome.permissions.remove()` を実行する方式**: トグル OFF 時にブラウザ権限自体を削除する案も検討したが、一時的に OFF → ON を切り替えるたびにブラウザの確認ダイアログが再出現し煩雑になるため、設定フラグで無効化しつつ、設定画面初期表示時および検索前に実効権限を確認する方式を採用した。

---

## 2. `chrome.history.search` の仕様と検索・ソート戦略

### 決定
- `chrome.history.search({ text: searchQuery, startTime: 0, maxResults: 30 })` を用いてブラウザ履歴を検索する。
- 取得した候補に対して、不正 URL 除外、ブックマーク候補との重複除外（URL 正規化比較）、および履歴リスト内の重複除外を適用し、最大 **10 件** に制限して返却する。
- `Popup.vue` の検索クエリが通常検索（`:` コマンド以外、空白・`/` のみ以外、末尾 `/` フォルダ指定以外）の場合のみ履歴検索を実行する。

### 根拠
- **`startTime: 0` の必須指定**: Chrome の `chrome.history.search` API は `startTime` を省略した場合、デフォルトで「過去 24 時間以内」のみを検索対象とする仕様がある。数日〜数週間前に閲覧したページも検索できるようにするため、`startTime: 0`（全履歴期間）を明示指定する必要がある。
- **`maxResults: 30` のバッファ取得**: 上部のブックマーク候補と重複する URL が除外された場合でも最大 10 件の履歴候補を安定して提示できるよう、多めの `30` 件を取得した上で重複除外後に先頭 `10` 件を切り出す。
- **フォルダ指定（末尾 `/`）の除外**: `work/` のような入力はフォルダ一括オープンを意図した操作であるため、末尾 `/` 時は履歴検索を行わずフォルダ操作の正確性を保つ。

### 検討した代替案
- **`maxResults: 10` での直接取得**: ブックマーク候補と URL が多く重複した場合に履歴表示件数が不当に減るため、`30` 件取得後にフィルタリングする方式を選択した。
- **Service Worker（`background.ts`）経由のメッセージ通信で履歴検索する方式**: `Popup.vue` は拡張機能コンテキスト（`chrome-extension://`）上で動作しており、`chrome.history` API を直接呼び出せる。Service Worker 経由の IPC オーバーヘッドを省き、300ms 以内の応答性を確保するため、共有モジュール（`src/shared/history.ts`）を通じてポップアップから直接呼び出す。

---

## 3. URL 重複除外と正規化ロジック

### 決定
- [url.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/url.ts) に重複判定用の URL 正規化ヘルパー `normalizeUrlForComparison(url: string): string` を追加する。
- 正規化では、空白除去、`decodeURI` によるパーセントエンコード正規化、スキーム・ホストの小文字化、およびパス末尾のスラッシュ（ルートパス `/` を除く単一末尾 `/`、例: `https://example.com/` と `https://example.com` の統一）を統一した比較キーを生成する。
- ブックマーク候補（`kind === 'bookmark'`）が持つ解決済み URL（`executeValue`、動的 URL 展開後を含む）の正規化キー集合と一致する履歴アイテムを除外する。

### 根拠
- 既存の `isSameUrl` は末尾スラッシュの有無を厳密に区別して別 URL とみなす仕様（ブックマーク登録・削除の厳密一致用）であるため、既存の削除ロジック等の破壊的変更を避けるべく、検索表示時の重複除外専用の正規化比較関数を別途定義する。
- ルート URL のトレイリングスラッシュ違い（`https://github.com` vs `https://github.com/`）はブラウザ履歴とブックマーク間で非常に頻繁に発生するため、これを吸収することで二重表示率 0% を担保できる。

### 検討した代替案
- **完全文字列一致のみで除外**: `https://example.com` と `https://example.com/` が両方表示されてしまい UX を損なうため不採用。
- **既存の `isSameUrl` 自体の変更**: `:rm` コマンド等による既存データの削除判定に影響を与えるリスクがあるため、別関数として分離した。

---

## 4. 非同期結果の統合・レースコンディション防止・選択状態の安定化

### 決定
- **デバウンス + 世代トークン方式**: `Popup.vue` 内で `query` の変化を監視し、通常検索条件を満たす場合は約 `80ms` のデバウンスタイマーと単調増加するリクエスト番号（`historySearchSeq`）を用いて非同期検索を実行する。応答時に `seq === historySearchSeq` を検証し、古いクエリの結果による上書きを防止する。
- **即座のクリア**: 入力が空、コマンドモード（`:`）、フォルダ明示（末尾 `/`）、または一括確認ダイアログ表示中は、待機タイマーをキャンセルし `historySearchSeq` を進め、`historyItems` を即座に `[]` にクリアする。
- **選択インデックスの安定化**:
  - `bookmarkItems`（同期 `computed`）が変化した時は、従来通り `selectedIndex` を先頭（`0` または履歴到着待ち中は `-1`）にリセットする。
  - `historyItems` だけが非同期で更新された時は、現在ハイライトされている候補（`items[selectedIndex]`）が更新後の `items` にも存在する場合はそのインデックスを維持し、ブックマーク候補が 0 件で履歴候補が後から到着した場合（`selectedIndex === -1`）のみ `0` を選択する。

### 根拠
- `bookmarkItems` は同期計算であるため入力と同時に描画され、ユーザーが即座に `↓` キーでブックマークの 2 件目を選んだ直後に `historyItems` が遅延到着するケースが想定される。ここで `watch(items)` によって無条件に `selectedIndex = 0` へリセットされると操作が妨げられるため、ブックマーク変化と履歴到着でリセット条件を分離する設計が必要不可欠である。

### 検討した代替案
- **デバウンスなしでの毎文字即時呼び出し**: 日本語入力や高速タイピング時に不要な IPC と画面ちらつきが増えるため、体感遅延を感じさせない `80ms` デバウンスを採用した。
- **セクション見出しを `items` 配列に含める方式**: 見出しを配列要素として混ぜると `↑`/`↓` や `selectedIndex` のスキップ制御・スクロール計算・`aria-activedescendant` が複雑化する。代わりに `items` には選択可能アイテムのみを保持し、テンプレート上で `index === bookmarkItems.length` の直前に `role="presentation"` の見出しを描画することで、既存のキーボード操作と WAI-ARIA 構造を簡潔かつ堅牢に維持できる。

---

## 5. `Tab` 補完と遷移時のスコア非更新

### 決定
- `PaletteItemKind` に `'history'` を追加する（[types.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/types.ts)）。
- 履歴アイテムの `fillText` は空文字 `""` とし、`Popup.vue` の `applyTabCompletion()` における既存の `if (!target || !target.fillText) return;` ガードにより `Tab` キー押下時は検索入力欄を書き換えない。
- 遷移処理として、[commands.ts](file:///Users/sawarame_yasushi/dev/Nickmark/src/shared/commands.ts) にスコア更新を行わずタブ遷移のみを実行する関数 `openUrlWithDisposition(targetUrl, disposition, tabId)` を抽出し、`navigateWithDisposition` から再利用するとともに、`item.kind === 'history'` 時は `openUrlWithDisposition` のみを呼び出す。

### 根拠
- 履歴項目にはニックネームが存在しないため、長い URL で検索欄を上書きするとユーザーの検索文脈が失われる。空文字 `fillText` とすることで仕様（FR-012）を既存構造のまま自然に満たせる。
- `navigateWithDisposition` から純粋なタブ操作部分を共通ヘルパー化することで、ロジック重複を排除しつつ履歴遷移時に `updateScore()` が誤って呼ばれることを型レベル・関数レベルで防止できる。
