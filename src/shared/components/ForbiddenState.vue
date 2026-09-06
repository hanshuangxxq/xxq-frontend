<script setup lang="ts">
import { NResult } from 'naive-ui'

/** 权限不足(403)守卫页:门禁扫描终端视觉,替代 NResult 默认的手掌插画 */
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <div class="forbidden-state">
    <NResult
      :title="title ?? $t('common.forbidden.title')"
      :description="description ?? $t('common.forbidden.desc')"
    >
      <template #icon>
        <div class="forbidden-visual" aria-hidden="true">
          <span class="forbidden-code">403</span>
          <div class="forbidden-terminal">
            <div class="terminal-screen">
              <span class="terminal-tag"
                >ERR_403 // FORBIDDEN<span class="terminal-cursor"></span
              ></span>
              <i class="corner corner-tl"></i>
              <i class="corner corner-tr"></i>
              <i class="corner corner-bl"></i>
              <i class="corner corner-br"></i>
              <svg
                class="terminal-card"
                viewBox="0 0 120 76"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="2"
                  y="2"
                  width="116"
                  height="72"
                  rx="10"
                  fill="#f6f9fe"
                  stroke="#c9d6ea"
                  stroke-width="2"
                />
                <rect x="88" y="12" width="18" height="14" rx="3" fill="#f2c94c" />
                <circle cx="28" cy="34" r="13" fill="#dbe5f4" />
                <circle cx="28" cy="30" r="5.5" fill="#a9bcdf" />
                <path d="M18 44.5a13 13 0 0 0 20 0c-2-5.5-6-8-10-8s-8 2.5-10 8z" fill="#a9bcdf" />
                <rect x="48" y="24" width="30" height="6" rx="3" fill="#dbe4f2" />
                <rect x="48" y="36" width="22" height="6" rx="3" fill="#e6ecf6" />
                <rect x="14" y="58" width="92" height="6" rx="3" fill="#e6ecf6" />
              </svg>
              <span class="scan-line"></span>
              <span class="deny-badge">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="#fff"
                    stroke-width="3.5"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
            </div>
            <div class="terminal-base">
              <span class="led led-red"></span>
              <span class="led"></span>
              <span class="led"></span>
            </div>
            <div class="hazard-strip"></div>
          </div>
        </div>
      </template>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
    </NResult>
  </div>
</template>
<style scoped src="./ForbiddenState.css"></style>
