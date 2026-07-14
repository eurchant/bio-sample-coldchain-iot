<template>
  <view class="page">
    <!-- 任务头卡：靛蓝竖条 + 大数遥测 -->
    <view class="card task-header">
      <view class="th-bar"></view>
      <view class="th-body">
        <view class="th-top">
          <view class="th-title-wrap">
            <text class="cc-eyebrow">任务 {{ task?.task_id || '--' }}</text>
            <text class="th-title">{{ task?.sample_name || '加载中...' }}</text>
          </view>
          <view
            v-if="task"
            class="cc-badge"
            :class="`cc-badge-${taskSemantic(task.status)}`"
          >
            {{ statusText(task.status) }}
          </view>
        </view>

        <view class="th-metrics">
          <view class="hero-metric" :class="{ 'metric-crit': isTempAlert }">
            <text class="cc-eyebrow">温度</text>
            <view class="hero-num-row">
              <text class="cc-metric-xl">{{ fmtNum(latest?.temperature) }}</text>
              <text class="cc-metric-unit">℃</text>
            </view>
            <view
              v-if="latest"
              class="cc-badge cc-badge-sm"
              :class="`cc-badge-${tempSemantic(latest.temp_status)}`"
            >
              {{ tempText(latest.temp_status) }}
            </view>
          </view>
          <view class="hero-divider"></view>
          <view class="hero-metric">
            <text class="cc-eyebrow">湿度</text>
            <view class="hero-num-row">
              <text class="cc-metric-lg">{{ fmtNum(latest?.humidity) }}</text>
              <text class="cc-metric-unit">%</text>
            </view>
            <text class="hero-sub">{{ latest ? (isStale ? '可能过期' : '实时') : '--' }}</text>
          </view>
        </view>

        <view class="th-route">
          <text class="route-point">{{ task?.sender || '--' }}</text>
          <text class="route-arrow">→</text>
          <text class="route-point">{{ task?.receiver || '--' }}</text>
        </view>
        <text class="th-updated">更新于 {{ formatTime(task?.updated_at) }}</text>
      </view>
    </view>

    <!-- 过期数据提示 -->
    <view v-if="isStale" class="stale-banner">
      <text class="stale-text">数据可能过期，最后上传 {{ formatTime(latest?.timestamp) }}</text>
    </view>
    <view v-else-if="!latest" class="stale-banner stale-empty">
      <text class="stale-text">暂无设备数据，等待设备上传…</text>
    </view>

    <!-- 次级指标卡 -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">设备状态</text>
        <text class="refresh-hint" @click="loadLatest">刷新</text>
      </view>
      <view class="metric-grid">
        <view class="metric-cell">
          <text class="cc-eyebrow">箱体</text>
          <text class="metric-md">{{ latest ? boxText(latest.box_status) : '--' }}</text>
          <view
            v-if="latest"
            class="cc-badge cc-badge-sm"
            :class="`cc-badge-${boxSemantic(latest.box_status)}`"
          >
            {{ boxText(latest.box_status) }}
          </view>
        </view>
        <view class="metric-cell" :class="{ 'metric-crit': isMoveAlert }">
          <text class="cc-eyebrow">运动</text>
          <text class="metric-md">{{ latest ? moveText(latest.move_status) : '--' }}</text>
          <text class="metric-sub" :class="{ 'sub-crit': isMoveAlert }">
            {{ latest ? '加速度 ' + fmtNum(latest.acc_total) : '--' }}
          </text>
        </view>
        <view class="metric-cell">
          <text class="cc-eyebrow">设备</text>
          <text class="metric-md mono">{{ task?.device_id || '--' }}</text>
          <text class="metric-sub">承运 {{ task?.carrier || '--' }}</text>
        </view>
      </view>
    </view>

    <!-- 温湿度趋势 -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">温湿度趋势</text>
        <text class="card-sub">最近 {{ history.length }} 条</text>
      </view>
      <TrendChart :items="history" />
    </view>

    <!-- 异常统计 -->
    <view class="card stats-card">
      <view class="stat-row">
        <view class="stat-item">
          <text class="stat-num">{{ alarms.length }}</text>
          <text class="stat-label">异常总数</text>
        </view>
        <view class="stat-sep"></view>
        <view class="stat-item">
          <view class="stat-badge stat-badge-crit">{{ countByType('TEMP_ALERT') }}</view>
          <text class="stat-label">温度异常</text>
        </view>
        <view class="stat-sep"></view>
        <view class="stat-item">
          <view class="stat-badge stat-badge-warn">{{ countByType('BOX_OPEN') + countByType('BOX_OPENED') }}</view>
          <text class="stat-label">开箱</text>
        </view>
        <view class="stat-sep"></view>
        <view class="stat-item">
          <view class="stat-badge stat-badge-crit">{{ severeCount }}</view>
          <text class="stat-label">碰撞/跌落</text>
        </view>
      </view>
    </view>

    <!-- 异常时间线 -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">异常时间线</text>
        <text class="card-sub">共 {{ alarms.length }} 条</text>
      </view>
      <view v-if="alarms.length === 0" class="empty-block">
        <text>运输全程无异常记录</text>
      </view>
      <view v-else class="timeline">
        <view v-for="item in alarms" :key="item.id" class="timeline-item">
          <view class="tl-rail">
            <view class="tl-dot" :class="`dot-${eventSemantic(item.event_type)}`"></view>
          </view>
          <view class="tl-content">
            <view class="tl-title-row">
              <text class="ev-name">{{ item.event_name }}</text>
              <view class="cc-badge cc-badge-sm" :class="`cc-badge-${eventSemantic(item.event_type)}`">
                {{ eventTypeText(item.event_type) }}
              </view>
            </view>
            <text class="ev-detail">{{ item.event_detail }}</text>
            <text class="ev-time">{{ formatTime(item.timestamp) }}</text>
          </view>
        </view>
      </view>
    </view>

    <AppTabBar current="monitor" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onHide, onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getTelemetryLatest, getTelemetryHistory, getAlarms } from '@/shared/api/task'
import { useTaskStore } from '@/shared/store/task'
import {
  TASK_STATUS_CN,
  TASK_STATUS_SEMANTIC,
  TEMP_STATUS_CN,
  TEMP_STATUS_SEMANTIC,
  BOX_STATUS_CN,
  BOX_STATUS_SEMANTIC,
  MOVE_STATUS_CN,
  MOVE_STATUS_SEMANTIC,
  EVENT_TYPE_CN,
  EVENT_TYPE_SEMANTIC,
  type Semantic,
} from '@/shared/constants/enum'
import type { Telemetry, TaskStatus, TempStatus, BoxStatus, MoveStatus, Alarm } from '@/shared/types/api'
import { formatTime, fmtNum } from '@/shared/utils/format'
import TrendChart from '@/components/TrendChart.vue'
import AppTabBar from '@/components/AppTabBar.vue'

const taskStore = useTaskStore()
const task = computed(() => taskStore.task)
const latest = ref<Telemetry | null>(null)
const history = ref<Telemetry[]>([])
const alarms = ref<Alarm[]>([])
const now = ref(Date.now())
let pollTimer: ReturnType<typeof setInterval> | null = null

// 过期阈值：设备数据超过 60s 未刷新视为过期
const STALE_MS = 60 * 1000
const isStale = computed(() => {
  const ts = latest.value?.timestamp
  if (!ts) return false
  const d = new Date(ts).getTime()
  if (isNaN(d)) return false
  return now.value - d > STALE_MS
})

const isTempAlert = computed(
  () => latest.value?.temp_status === 'TEMP_ALERT' || latest.value?.box_status === 'BOX_OPEN'
)
const isMoveAlert = computed(() => {
  const s = latest.value?.move_status
  return s === 'SEVERE' || s === 'IMPACT' || s === 'FREE_FALL'
})

const severeCount = computed(
  () => countByType('IMPACT') + countByType('FREE_FALL') + countByType('SEVERE')
)

function statusText(s: TaskStatus) {
  return TASK_STATUS_CN[s] || s
}
function taskSemantic(s: TaskStatus): Semantic {
  return TASK_STATUS_SEMANTIC[s] || 'neutral'
}
function tempText(s: string) {
  return TEMP_STATUS_CN[s as keyof typeof TEMP_STATUS_CN] || s
}
function tempSemantic(s: TempStatus): Semantic {
  return TEMP_STATUS_SEMANTIC[s] || 'neutral'
}
function boxText(s: string) {
  return BOX_STATUS_CN[s as keyof typeof BOX_STATUS_CN] || s
}
function boxSemantic(s: BoxStatus): Semantic {
  return BOX_STATUS_SEMANTIC[s] || 'neutral'
}
function moveText(s: string) {
  return MOVE_STATUS_CN[s as keyof typeof MOVE_STATUS_CN] || s
}
function eventTypeText(t: string): string {
  return EVENT_TYPE_CN[t] || t
}
function eventSemantic(t: string): Semantic {
  return EVENT_TYPE_SEMANTIC[t] || 'neutral'
}
function countByType(type: string): number {
  return alarms.value.filter((a) => a.event_type === type).length
}

async function loadLatest() {
  try {
    latest.value = await getTelemetryLatest(taskStore.currentTaskId)
    now.value = Date.now()
  } catch (e) {
    console.warn('loadLatest failed', e)
  }
}

async function loadHistory() {
  try {
    const res = await getTelemetryHistory(taskStore.currentTaskId, 60)
    history.value = res.items || []
  } catch (e) {
    console.warn('loadHistory failed', e)
  }
}

async function loadAlarms() {
  try {
    const res = await getAlarms(taskStore.currentTaskId, 100)
    alarms.value = res.items || []
  } catch (e) {
    console.warn('loadAlarms failed', e)
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    now.value = Date.now()
    loadLatest()
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onLoad(async () => {
  await taskStore.loadTask()
  await Promise.all([loadLatest(), loadHistory(), loadAlarms()])
})

onShow(() => {
  startPolling()
  loadLatest()
  loadHistory()
  loadAlarms()
})

onHide(() => {
  stopPolling()
})

onPullDownRefresh(async () => {
  await Promise.all([loadLatest(), loadHistory(), loadAlarms()])
  uni.stopPullDownRefresh()
})
</script>

<style>
/* 页面、卡片、任务头共用类见 App.vue；以下为监控页专属 */

/* 任务头 hero 卡 */
.task-header {
  padding: 0;
  overflow: hidden;
  display: flex;
}
.task-header .th-title {
  font-size: 22px;
  letter-spacing: -0.3px;
}
.th-bar {
  width: 4px;
  background: var(--cc-primary);
  flex-shrink: 0;
}
.th-body {
  flex: 1;
  padding: 16px;
  box-sizing: border-box;
}
.th-metrics {
  display: flex;
  align-items: stretch;
  margin-top: 16px;
}
.hero-metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hero-metric .cc-badge-sm { align-self: flex-start; }
.hero-divider {
  width: 1px;
  background: var(--cc-hairline);
  margin: 0 16px;
}
.hero-num-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.hero-metric.metric-crit .cc-metric-xl {
  color: var(--cc-crit);
}
.hero-sub {
  font-size: 11px;
  color: var(--cc-ink-faint);
}
.th-route {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 13px;
}
.route-point {
  color: var(--cc-ink-secondary);
  font-weight: 500;
}
.route-arrow {
  color: var(--cc-ink-faint);
}
.th-updated {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--cc-ink-faint);
}

/* 卡片头间距收紧 */
.card-head { margin-bottom: 12px; }
.refresh-hint {
  font-size: 12px;
  color: var(--cc-primary);
}

/* 过期数据提示 */
.stale-banner {
  background: var(--cc-warn-bg);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
}
.stale-banner.stale-empty {
  background: var(--cc-canvas-sunken);
}
.stale-text {
  font-size: 12px;
  color: var(--cc-warn);
}
.stale-empty .stale-text {
  color: var(--cc-ink-mute);
}

/* 指标网格（DESIGN.md §4.4）*/
.metric-grid {
  display: flex;
  gap: 8px;
}
.metric-cell {
  flex: 1;
  background: var(--cc-canvas-sunken);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
}
.metric-cell:active { background: var(--cc-hairline); }
.metric-cell.metric-crit {
  background: var(--cc-crit-bg);
}
.metric-md {
  font-size: 18px;
  font-weight: 400;
  letter-spacing: -0.2px;
  color: var(--cc-ink);
  line-height: 1.2;
}
.metric-md.mono {
  font-size: 14px;
  letter-spacing: 0;
}
.metric-sub {
  font-size: 11px;
  color: var(--cc-ink-faint);
}
.sub-crit {
  color: var(--cc-crit);
}

/* 异常统计卡 */
.stats-card { padding: 14px 8px; }
.stat-row {
  display: flex;
  align-items: center;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.stat-sep {
  width: 1px;
  height: 28px;
  background: var(--cc-hairline);
}
.stat-num {
  font-size: 22px;
  font-weight: 300;
  letter-spacing: -0.5px;
  color: var(--cc-ink);
  line-height: 1;
}
.stat-label {
  font-size: 11px;
  color: var(--cc-ink-mute);
}
.stat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  padding: 3px 10px;
  min-width: 28px;
  border-radius: 9999px;
  line-height: 1.4;
  box-sizing: border-box;
}
.stat-badge-crit { color: var(--cc-crit); background: var(--cc-crit-bg); }
.stat-badge-warn { color: var(--cc-warn); background: var(--cc-warn-bg); }

/* 时间线内容 */
.tl-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.ev-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--cc-ink);
}
.ev-detail {
  font-size: 12px;
  color: var(--cc-ink-mute);
  display: block;
  margin-bottom: 4px;
  line-height: 1.5;
}
.ev-time {
  font-size: 11px;
  color: var(--cc-ink-faint);
  display: block;
}
</style>
