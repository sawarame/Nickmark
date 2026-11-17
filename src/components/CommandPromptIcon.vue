<template>
  <!-- コマンド入力モードおよびコマンド候補を表すターミナルプロンプト（>_）アイコン -->
  <svg
    class="command-prompt-icon"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
</template>

<script setup lang="ts">
/**
 * コマンド入力用のターミナルプロンプト（>_）アイコンコンポーネント。
 * primeicons に存在しないコマンドプロンプト形状を currentColor 継承で描画します。
 */
</script>

<style scoped>
.command-prompt-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
