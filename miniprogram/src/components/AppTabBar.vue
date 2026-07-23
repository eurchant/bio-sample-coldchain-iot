<template>
  <view class="app-tabbar">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: current === tab.key }"
      @click="switchTo(tab.key)"
    >
      <view class="tab-icon-wrap">
        <!-- 监控：同心圆 + 中心点 -->
        <view v-if="tab.key === 'monitor'" class="ic ic-monitor">
          <view class="ic-ring"></view>
          <view class="ic-dot"></view>
        </view>
        <!-- 交接追溯：勾选 -->
        <view v-else class="ic ic-check">
          <view class="ic-check-mark"></view>
        </view>
      </view>
      <text class="tab-text">{{ tab.text }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{ current: string; hasAlarm?: boolean }>()

const tabs = [
  { key: 'monitor', text: '运输监控' },
  { key: 'handoff', text: '交接追溯' },
]

function switchTo(key: string) {
  const map: Record<string, string> = {
    monitor: '/pages/monitor/index',
    handoff: '/pages/handoff/index',
  }
  const url = map[key]
  if (!url) return
  uni.redirectTo({ url })
}
</script>

<style scoped>
.app-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 56px;
  display: flex;
  background: var(--cc-canvas, #fff);
  border-top: 1px solid var(--cc-hairline, #e3e8ee);
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.tab-icon-wrap {
  position: relative;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tab-text {
  font-size: 11px;
  color: var(--cc-ink-faint, #94a3b8);
  line-height: 1;
}
.tab-item.active .tab-text {
  color: var(--cc-primary, #533afd);
  font-weight: 600;
}

/* 图标默认色 */
.ic { color: var(--cc-ink-faint, #94a3b8); }
.tab-item.active .ic { color: var(--cc-primary, #533afd); }

/* 监控：同心圆 */
.ic-monitor { position: relative; width: 20px; height: 20px; }
.ic-ring {
  width: 16px; height: 16px;
  border: 2px solid currentColor;
  border-radius: 50%;
  position: absolute; left: 2px; top: 2px;
  box-sizing: border-box;
}
.ic-dot {
  width: 4px; height: 4px;
  background: currentColor;
  border-radius: 50%;
  position: absolute; left: 8px; top: 8px;
}

/* 交接：勾 */
.ic-check { position: relative; width: 20px; height: 20px; }
.ic-check-mark {
  width: 14px; height: 7px;
  border-left: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  position: absolute; left: 3px; top: 6px;
}
</style>
