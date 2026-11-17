# Implementation Plan: 定番ブックマーク・ブックマークレットのプリセット機能

**Branch**: `015-preset-bookmarks` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-preset-bookmarks/spec.md`

## Summary

定番の検索用動的 URL（10 件: `g`, `yt`, `gh`, `map`, `tr`, `wiki`, `amz`, `x`, `npm`, `mdn`）およびブックマークレット（2 件: `mdlink`, `wayback`）を内蔵プリセットとして用意し、設定画面（`Preferences.vue`）のチェックボックスで個別に ON / OFF を切り替えられるようにする。通常のブックマーク JSON には書き込まず、有効化されたプリセット ID 配列（`enabledPresets`）のみを保存・Google アカウント同期することでストレージ容量を節約し、ポップアップおよびオムニボックスでの検索時に固定スコア（`score: 1.0`, `is_pinned: false`）の仮想エントリとして動的に合成する。また、初期状態（すべて OFF）でもユーザーが機能に気づけるよう、ポップアップの Tips カタログにプリセットの案内を追加する。

## Technical Context

**Language/Version**: TypeScript (`^6.0.3`, Target: `ES2022`)  
**Primary Dependencies**: Vue 3 (`^3.5.34`), PrimeVue (`^4.5.5`), `@primeuix/themes` (`^2.0.3`), `primeicons` (`^7.0.0`)  
**Storage**: `chrome.storage.local` および `chrome.storage.sync`（ハイブリッドストレージ・チャンク分割対応）  
**Testing**: TypeScript 型チェック・Webpack 本番ビルド検証（`npm run build`）および単体ロジック検証  
**Target Platform**: Chrome Extension Manifest V3 (`minimum_chrome_version: "135"`)  
**Project Type**: Browser Extension (Service Worker + Vue 3 UI Pages: Popup, List, Preferences)  
**Performance Goals**: プリセット合成による検索遅延 1ms 未満、設定保存データサイズ 200B 未満  
**Constraints**: `chrome.storage.sync` 100KB 制限下でチャンク保存（`sync_data_*`）と `enabledPresets` キーが互いに干渉・消去しないこと  
**Scale/Scope**: 内蔵プリセット 12 件、新規共有モジュール 1 ファイル（`src/shared/presets.ts`）、既存 6 ファイル更新、ロケール・仕様書更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. キーボードファースト・オムニボックス中心設計**: ✅ PASS — 有効化したプリセットはポップアップおよびオムニボックス双方でニックネーム検索・`%s` 動的引数展開・ブックマークレット実行に対応し、ソート順位（ティア ＞ ピン留め ＞ スコア ＞ URL 昇順）を維持する。
- **II. Manifest V3 Service Worker とハイブリッドストレージの安全性**: ✅ PASS — `enabledPresets` はメモリキャッシュを備え、`saveToStorage('sync', ...)` では `chrome.storage.sync.clear()` の代わりに `sync_data_*` チャンクキーのみを削除することで `enabledPresets` の消失を防止する。同期 ON/OFF 移行ダイアログとも連動する。
- **III. Vue 3 Composition API と PrimeVue による一貫した UI 設計**: ✅ PASS — 設定画面のプリセットセクションには PrimeVue の `Card`, `Checkbox`, `Button` を使用し、`<style scoped>` と PrimeVue セマンティック CSS 変数でライト／ダークモードに対応する。
- **IV. 型安全性とモジュール間共有・日本語ドキュメンテーション**: ✅ PASS — `PresetId`, `PresetDefinition` 等の型を `src/shared/types.ts` で定義し、`src/shared/presets.ts` および `src/background.ts` から共有エクスポートする。すべての関数・型に日本語 JSDoc と日本語インラインコメントを記述する。
- **V. 即時反映される多言語対応とセキュアなスクリプト実行**: ✅ PASS — すべての UI ラベル・プリセット名・説明・Tips を `package/_locales/{ja,en}/messages.json` に定義し、ブックマークレットプリセット（`mdlink`, `wayback`）は既存の `chrome.userScripts.execute` 機構で安全に実行する。

## Project Structure

### Documentation (this feature)

```text
specs/014-preset-bookmarks/
├── plan.md              # 実装計画（本ファイル）
├── research.md          # 設計判断と技術調査
├── data-model.md        # データ構造とプリセット定義一覧
├── quickstart.md        # ビルド・検証手順
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md             # 実装タスクリスト（/speckit-tasks で生成）
```

### Source Code (repository root)

```text
src/
├── background.ts          # Service Worker エントリー・オムニボックスでのプリセット合成検索・storage監視
├── Popup.vue              # コマンドパレットでのプリセット合成検索・storage監視
├── Preferences.vue        # 設定画面への「プリセット」カード（Checkbox一覧・全選択/全解除・同期移行連携）追加
├── List.vue               # ブックマーク一覧画面（プリセット非混入を維持）
└── shared/
    ├── types.ts           # PresetId, PresetCategory, PresetDefinition, ENABLED_PRESETS_STORAGE_KEY 型・定数定義
    ├── presets.ts         # [新規] 全12件のプリセット定義、ID正規化、ロケール別URL解決、ブックマーク辞書への合成関数
    ├── storage.ts         # enabledPresets の読み書き・キャッシュ管理、sync保存時のチャンク限定クリア対応
    ├── commands.ts        # :open 単一ニックネーム指定時のプリセット解決対応（:rm 等は対象外を維持）
    ├── search.ts          # 検索・パレット候補構築
    └── tips.ts            # POPUP_TIPS へのプリセット案内 Tip 追加

package/
└── _locales/
    ├── ja/messages.json   # 日本語文言（プリセット見出し・各プリセット名/説明・Tip）追加
    └── en/messages.json   # 英語文言（プリセット見出し・各プリセット名/説明・Tip）追加
```

**Structure Decision**: 既存の `src/shared/` モジュール分割アーキテクチャに従い、プリセット定義と合成ロジックを `src/shared/presets.ts` に独立させ、`src/shared/storage.ts` で永続化と同期を管理する構成を採用する。

## Complexity Tracking

Constitution Check における違反事項なし。
