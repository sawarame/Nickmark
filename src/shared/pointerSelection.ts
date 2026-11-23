/**
 * マウスイベントから取得するポインター座標を表すインターフェース
 */
export interface PointerCoordinates {
  /** ビューポート基準の X 座標 */
  clientX: number;
  /** ビューポート基準の Y 座標 */
  clientY: number;
  /** スクリーン基準の X 座標 */
  screenX: number;
  /** スクリーン基準の Y 座標 */
  screenY: number;
}

/**
 * ポップアップ候補リストにおけるポインターホバー選択の状態を表すインターフェース
 */
export interface PointerSelectionState {
  /** 実際のマウス移動を検知してホバーによる選択追従・ハイライトが有効になっているかどうか */
  isPointerHoverActive: boolean;
  /** 最後に観測したポインター座標（未観測時は null） */
  lastCoordinates: PointerCoordinates | null;
}

/**
 * ポインターホバー選択の初期状態を生成します。
 * 起動直後は静止中のマウスカーソルによる誤フォーカスを防ぐため無効状態とします。
 * @returns 初期化されたポインター選択状態
 */
export function createPointerSelectionState(): PointerSelectionState {
  return {
    isPointerHoverActive: false,
    lastCoordinates: null
  };
}

/**
 * 2 つのポインター座標を比較し、実際にマウスカーソルが移動したかどうかを判定します。
 * 実ブラウザではポップアップのリサイズや再配置の影響を受けない物理座標（screenX / screenY）を優先し、
 * テスト用の合成イベント等で screenX / screenY がともに 0 の場合のみ clientX / clientY で比較します。
 * @param previous - 前回記録したポインター座標
 * @param current - 今回受信したポインター座標
 * @returns 座標が変化していれば true、同一位置であれば false
 */
export function hasPointerCoordinatesChanged(
  previous: PointerCoordinates,
  current: PointerCoordinates
): boolean {
  const hasScreenCoords =
    Number.isFinite(previous.screenX) &&
    Number.isFinite(previous.screenY) &&
    Number.isFinite(current.screenX) &&
    Number.isFinite(current.screenY) &&
    (previous.screenX !== 0 ||
      previous.screenY !== 0 ||
      current.screenX !== 0 ||
      current.screenY !== 0);

  if (hasScreenCoords) {
    return previous.screenX !== current.screenX || previous.screenY !== current.screenY;
  }

  return previous.clientX !== current.clientX || previous.clientY !== current.clientY;
}

/**
 * ポインター移動イベントを受信した際の状態遷移を計算します。
 * 未観測時の初回イベントはレイアウト変化に伴う疑似 mousemove の可能性があるため基準座標の記録のみ行い、
 * 記録済み座標との差分を検知した場合に初めてポインターホバーを有効化します。
 * @param state - 現在のポインター選択状態
 * @param coordinates - 受信したポインター座標
 * @returns 更新後のポインター選択状態
 */
export function recordPointerMove(
  state: PointerSelectionState,
  coordinates: PointerCoordinates
): PointerSelectionState {
  const normalized: PointerCoordinates = {
    clientX: coordinates.clientX,
    clientY: coordinates.clientY,
    screenX: coordinates.screenX,
    screenY: coordinates.screenY
  };

  // 初回受信時は基準座標の記録のみ行い、疑似イベントによる即時有効化を防ぐ
  if (state.lastCoordinates === null) {
    return {
      isPointerHoverActive: state.isPointerHoverActive,
      lastCoordinates: normalized
    };
  }

  // 座標が実際に変化した場合のみホバー選択を有効化する
  if (hasPointerCoordinatesChanged(state.lastCoordinates, normalized)) {
    return {
      isPointerHoverActive: true,
      lastCoordinates: normalized
    };
  }

  // 同一座標の疑似イベントでは現在の有効／抑止状態を維持する
  return state;
}

/**
 * キーボード操作・検索語変更・候補リスト更新・スクロール発生時にポインターホバーを抑止状態へ戻します。
 * 直前の基準座標は保持し、次にユーザーが実際にマウスを動かした際に即座に再有効化できるようにします。
 * @param state - 現在のポインター選択状態
 * @returns ホバー抑止後のポインター選択状態
 */
export function suppressPointerHoverState(
  state: PointerSelectionState
): PointerSelectionState {
  if (!state.isPointerHoverActive) {
    return state;
  }

  return {
    isPointerHoverActive: false,
    lastCoordinates: state.lastCoordinates
  };
}

/**
 * 候補アイテム上でホバーイベントが発生した際に適用すべき選択インデックスを解決します。
 * ポインターホバーが有効な場合のみ対象インデックスを返し、抑止中は現在の選択インデックスを維持します。
 * @param state - 現在のポインター選択状態
 * @param hoveredIndex - カーソルが乗っている候補アイテムのインデックス
 * @param currentSelectedIndex - 現在の選択インデックス
 * @returns 適用すべき選択インデックス
 */
export function resolveHoverSelectedIndex(
  state: PointerSelectionState,
  hoveredIndex: number,
  currentSelectedIndex: number
): number {
  if (!state.isPointerHoverActive || hoveredIndex < 0) {
    return currentSelectedIndex;
  }
  return hoveredIndex;
}
