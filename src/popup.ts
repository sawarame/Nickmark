/**
 * コマンドパレット型ポップアップ（popup.html）のエントリーポイント
 */
import Popup from './Popup.vue';
import { mountNickmarkPopupApp } from './shared/popupBootstrap';

mountNickmarkPopupApp(Popup);
