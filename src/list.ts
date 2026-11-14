/**
 * ブックマーク管理画面（list.html）のエントリーポイント
 */
import List from './List.vue';
import { mountNickmarkApp } from './shared/appBootstrap';

mountNickmarkApp(List, { useConfirm: true });
