<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { runtimeConfig } from './services/config'
import { useTaskStore } from './stores/task'

const store = useTaskStore()

const navItems = [
  { label: '任务总览', hint: 'TASK', to: '/' },
  { label: '监控与交接', hint: 'LIVE', to: '/tasks/' + runtimeConfig.taskId },
  { label: '可信追溯', hint: 'TRACE', to: '/trace/' + runtimeConfig.taskId },
]

const sourceLabel = computed(() =>
  runtimeConfig.dataSource === 'mock' ? 'Mock 演示数据' : '实时 API 联调',
)

let pollingId: number | undefined

onMounted(async () => {
  await store.bootstrap()
  pollingId = window.setInterval(() => {
    void store.refreshMonitoring()
  }, runtimeConfig.pollingIntervalMs)
})

onUnmounted(() => {
  if (pollingId !== undefined) {
    window.clearInterval(pollingId)
  }
})
</script>

<template>
  <div class="app-frame">
    <aside class="sidebar">
      <RouterLink class="brand" to="/" aria-label="返回任务总览">
        <span class="brand-mark"><i></i><i></i><i></i></span>
        <span>
          <strong>冷链转运</strong>
          <small>COLDCHAIN TRACE</small>
        </span>
      </RouterLink>

      <nav class="primary-nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
        >
          <span class="nav-code">{{ item.hint }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="side-status">
        <span class="status-pulse"></span>
        <div>
          <small>数据源</small>
          <strong>{{ sourceLabel }}</strong>
        </div>
      </div>

      <p class="side-footnote">
        第一阶段 MVP<br />
        所有状态与告警由后端判定
      </p>
    </aside>

    <main class="content-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">BIOLOGICAL SAMPLE · TRANSIT CONTROL</p>
          <h1>生物样本冷链转运管理</h1>
        </div>
        <div class="connection-state">
          <span :class="['connection-dot', { 'is-alert': Boolean(store.monitoringError) }]"></span>
          <span>{{ store.monitoringError ? '监测连接待恢复' : '监测连接正常' }}</span>
          <button class="icon-button" type="button" title="刷新数据" @click="store.bootstrap()">
            ↻
          </button>
        </div>
      </header>

      <div v-if="store.error" class="global-notice" role="alert">
        <span>接口提示：{{ store.error }}</span>
        <button type="button" @click="store.clearError()">关闭</button>
      </div>

      <RouterView />
    </main>
  </div>
</template>
