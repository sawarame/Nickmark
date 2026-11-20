<template>
  <svg
    class="command-prompt-icon"
    viewBox="2 2 20 20"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    stroke-width="1.85"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- コマンド入力モードおよびコマンド候補を表すターミナルプロンプト（>_）アイコン -->
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
</template>

<script setup lang="ts">
/**
 * コマンド入力用のターミナルプロンプト（>_）アイコンコンポーネント。
 * primeicons に存在しないコマンドプロンプト形状を currentColor 継承で描画します。
 * 親コンポーネントから渡された class や scoped CSS 属性を <svg> へ確実に継承させるため、
 * テンプレート直下には <svg> のみを単一ルート要素として配置しています。
 */
</script>

<style scoped>
/* 親コンポーネント側のクラス（.search-leading-icon 等）が常に優先されるよう詳細度を低く抑える */
:where(.command-prompt-icon) {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
