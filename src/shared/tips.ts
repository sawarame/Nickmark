import { TipEntry } from './types';
import { getPrimaryModifierLabel } from './url';

/**
 * ポップアップ初期表示時の空白領域に表示する活用ヒント（Tips）カタログです。
 * すべての項目は Nickmark に実在するコマンド・ショートカット・機能に対応しています。
 */
export const POPUP_TIPS: readonly TipEntry[] = [
  {
    id: 'add-command',
    messageKey: 'popupTipAddCommand',
    icon: 'pi-lightbulb'
  },
  {
    id: 'addall-command',
    messageKey: 'popupTipAddallCommand',
    icon: 'pi-lightbulb'
  },
  {
    id: 'folder-open',
    messageKey: 'popupTipFolderOpen',
    icon: 'pi-lightbulb'
  },
  {
    id: 'dynamic-url',
    messageKey: 'popupTipDynamicUrl',
    icon: 'pi-lightbulb'
  },
  {
    id: 'tab-disposition',
    messageKey: 'popupTipTabDisposition',
    icon: 'pi-lightbulb',
    usesPrimaryModifier: true
  },
  {
    id: 'keyboard-nav',
    messageKey: 'popupTipKeyboardNav',
    icon: 'pi-lightbulb'
  },
  {
    id: 'bookmarklet',
    messageKey: 'popupTipBookmarklet',
    icon: 'pi-lightbulb'
  },
  {
    id: 'management-commands',
    messageKey: 'popupTipManagementCommands',
    icon: 'pi-lightbulb'
  },
  {
    id: 'presets',
    messageKey: 'popupTipPresets',
    icon: 'pi-lightbulb'
  }
];

/**
 * 指定された総数の中からランダムなインデックスを 1 つ選出します。
 * 2 件以上あり、かつ有効な除外インデックスが指定された場合は、同じ項目が連続しないよう別のインデックスを定数時間で選出します。
 * @param totalCount - 候補の総件数
 * @param excludeIndex - 連続選出を避けたい現在のインデックス（任意）
 * @returns 選出されたインデックス（`totalCount <= 0` の場合は `-1`）
 */
export function pickRandomTipIndex(totalCount: number, excludeIndex?: number): number {
  if (totalCount <= 0) return -1;
  if (totalCount === 1) return 0;

  const hasValidExclude =
    excludeIndex !== undefined &&
    Number.isInteger(excludeIndex) &&
    excludeIndex >= 0 &&
    excludeIndex < totalCount;

  if (!hasValidExclude) {
    return Math.floor(Math.random() * totalCount);
  }

  // 除外対象を除いた (totalCount - 1) 通りから乱数を引き、除外位置以降を +1 シフトして均等分布を保つ
  const candidate = Math.floor(Math.random() * (totalCount - 1));
  return candidate >= excludeIndex ? candidate + 1 : candidate;
}

/**
 * Tip エントリと翻訳関数から、表示用のローカライズ済みヒント文字列を生成します。
 * @param tip - 表示対象の Tip エントリ
 * @param translate - キーと置換引数を受け取り翻訳済み文字列を返す関数
 * @returns 表示用のヒント本文文字列
 */
export function formatTipMessage(
  tip: TipEntry,
  translate: (key: string, substitutions?: string[]) => string
): string {
  if (tip.usesPrimaryModifier) {
    return translate(tip.messageKey, [getPrimaryModifierLabel()]);
  }
  return translate(tip.messageKey);
}
