<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncStatePanel from '../components/AsyncStatePanel.vue'
import { formatTime } from '../lib/format'
import { runtimeConfig } from '../services/config'
import { useDashboardStore } from '../stores/dashboard'

const dashboard = useDashboardStore()
const dashboardRoot = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const fullscreenError = ref<string | null>(null)
const sourceLabel = computed(() => runtimeConfig.dataSource === 'api' ? '实时 API 聚合' : 'Mock 模式')
const statusItems = computed(() => Object.entries(dashboard.summary?.status_distribution ?? {}))
const alarmItems = computed(() => Object.entries(dashboard.summary?.alarm_distribution ?? {}))
let pollingId: number | undefined

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === dashboardRoot.value
}

async function toggleFullscreen() {
  fullscreenError.value = null
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    if (!dashboardRoot.value?.requestFullscreen) {
      fullscreenError.value = '当前浏览器不支持全屏展示。'
      return
    }
    await dashboardRoot.value.requestFullscreen()
  } catch {
    fullscreenError.value = '无法进入全屏模式，请检查浏览器权限后重试。'
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  void dashboard.load()
  pollingId = window.setInterval(() => void dashboard.load(), runtimeConfig.pollingIntervalMs)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  if (pollingId !== undefined) window.clearInterval(pollingId)
})
</script>

<template>
  <section ref="dashboardRoot" class="dashboard-page page-section aggregate-dashboard" aria-labelledby="dashboard-title">
    <header class="dashboard-header">
      <div>
        <p class="section-kicker">ADMIN / GLOBAL OPERATIONS SCREEN</p>
        <h2 id="dashboard-title">冷链转运实时大屏</h2>
        <p>统计数据直接来自后端聚合接口，不由前端任务列表推算。</p>
      </div>
      <div class="dashboard-header-actions">
        <span class="dashboard-source" :data-tone="dashboard.error ? 'danger' : 'safe'">{{ dashboard.error ? '刷新待恢复' : sourceLabel }}</span>
        <button class="ghost-button" type="button" :disabled="dashboard.refreshing" @click="dashboard.load()">{{ dashboard.refreshing ? '刷新中…' : '立即刷新' }}</button>
        <button class="dashboard-fullscreen-button" type="button" @click="toggleFullscreen">{{ isFullscreen ? '退出全屏' : '进入全屏' }}</button>
      </div>
    </header>

    <div v-if="dashboard.error" class="dashboard-offline-notice" role="status">
      <strong>聚合刷新暂时中断</strong>
      <span>{{ dashboard.error }}。页面保留最近一次成功数据，服务恢复后会继续自动刷新。</span>
    </div>
    <p v-if="fullscreenError" class="dashboard-fullscreen-error" role="status">{{ fullscreenError }}</p>

    <AsyncStatePanel v-if="dashboard.loading && !dashboard.summary" state="loading" title="正在读取全局聚合数据" description="正在同步任务、设备和当日告警统计。" />

    <template v-else-if="dashboard.summary">
      <p class="aggregate-updated">后端聚合时间：{{ formatTime(dashboard.summary.updated_at) }} · 本页上次成功同步：{{ formatTime(dashboard.lastSuccessAt) }}</p>
      <section class="dashboard-metric-grid" aria-label="全局运营指标">
        <article class="dashboard-metric-card"><span>运输中/已到达任务</span><strong>{{ dashboard.summary.active_tasks }}</strong><p>由后端状态聚合</p></article>
        <article class="dashboard-metric-card" :data-tone="dashboard.summary.abnormal_tasks ? 'danger' : 'safe'"><span>未处置异常任务</span><strong>{{ dashboard.summary.abnormal_tasks }}</strong><p>存在异常时需优先核查</p></article>
        <article class="dashboard-metric-card"><span>在线或绑定设备</span><strong>{{ dashboard.summary.online_devices }}</strong><p>设备心跳和绑定状态</p></article>
        <article class="dashboard-metric-card" :data-tone="dashboard.summary.offline_devices ? 'danger' : 'safe'"><span>离线设备</span><strong>{{ dashboard.summary.offline_devices }}</strong><p>后端主动离线判定</p></article>
        <article class="dashboard-metric-card" :data-tone="dashboard.summary.today_alarm_count ? 'danger' : 'safe'"><span>今日告警</span><strong>{{ dashboard.summary.today_alarm_count }}</strong><p>按服务器当天统计</p></article>
      </section>

      <section class="aggregate-grid">
        <article class="dashboard-alert-card">
          <div class="dashboard-card-heading"><div><span>TASK STATUS DISTRIBUTION</span><h3>任务状态分布</h3></div></div>
          <div v-if="statusItems.length" class="distribution-list">
            <div v-for="[status, count] in statusItems" :key="status"><span>{{ status }}</span><strong>{{ count }}</strong></div>
          </div>
          <div v-else class="dashboard-empty-list">当前后端未返回任务状态统计。</div>
        </article>
        <article class="dashboard-alert-card">
          <div class="dashboard-card-heading"><div><span>TODAY ALARM DISTRIBUTION</span><h3>当日告警类型</h3></div></div>
          <div v-if="alarmItems.length" class="distribution-list">
            <div v-for="[eventType, count] in alarmItems" :key="eventType"><span>{{ eventType }}</span><strong>{{ count }}</strong></div>
          </div>
          <div v-else class="dashboard-empty-list">今日暂未出现后端记录的告警。</div>
        </article>
      </section>
      <RouterLink to="/tasks" class="dashboard-detail-link">返回任务总览并查看具体任务</RouterLink>
    </template>

    <AsyncStatePanel v-else state="offline" title="暂未获取大屏聚合数据" description="请确认使用管理员账号、实时 API 地址和后端服务后重试。" @retry="dashboard.load()" />
  </section>
</template>

<style scoped>
.aggregate-dashboard { min-height:calc(100vh - 8rem); }.aggregate-updated { color:var(--ink-muted); font-size:.8rem; margin:.9rem 0; }.aggregate-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem; margin-top:1rem; }.distribution-list { display:grid; gap:.55rem; }.distribution-list > div { display:flex; justify-content:space-between; gap:.8rem; padding:.55rem 0; border-bottom:1px solid var(--line); color:var(--ink-muted); }.distribution-list strong { color:var(--ink); }.dashboard-detail-link { display:inline-block; margin-top:1rem; } @media (max-width:760px) { .aggregate-grid { grid-template-columns:1fr; } }
</style>
