<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncStatePanel from '../components/AsyncStatePanel.vue'
import { buildDashboardMetrics } from '../lib/metrics'
import {
  boxLabel,
  formatTime,
  formatValue,
  moveLabel,
  statusTone,
  taskLabel,
  temperatureLabel,
} from '../lib/format'
import { runtimeConfig } from '../services/config'
import { useTaskStore } from '../stores/task'

const store = useTaskStore()
const TelemetryTrendChart = defineAsyncComponent(
  () => import('../components/TelemetryTrendChart.vue'),
)
const dashboardRoot = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const fullscreenError = ref<string | null>(null)

const task = computed(() => store.task)
const telemetry = computed(() => store.telemetry)
const metrics = computed(() => buildDashboardMetrics(store.history, telemetry.value, store.alarms))
const handoffNodes = computed(() => store.trace?.handoff_nodes ?? [])
const sourceLabel = computed(() =>
  runtimeConfig.dataSource === 'mock' ? 'Mock 演示数据' : '实时 API 数据',
)
const currentTimestamp = computed(() => telemetry.value?.timestamp ?? task.value?.updated_at ?? null)
const alarmPreview = computed(() => store.alarms.slice(0, 3))
const riskLabel = computed(() => {
  if (!telemetry.value) return '等待设备上报'
  return metrics.value.hasCriticalSignal ? '存在风险信号' : '当前未发现风险信号'
})

const handoffLabel: Record<string, string> = {
  started: '发出交接',
  signed: '到达签收',
  rejected: '到达拒收',
}

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

function retryLoad() {
  void Promise.all([store.bootstrap(), store.loadTrace()])
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  if (!store.task && !store.loading) void store.bootstrap()
  if (!store.trace && !store.traceLoading) void store.loadTrace()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<template>
  <section ref="dashboardRoot" class="dashboard-page page-section" aria-labelledby="dashboard-title">
    <header class="dashboard-header">
      <div>
        <p class="section-kicker">SINGLE TASK / LIVE COMMAND SCREEN</p>
        <h2 id="dashboard-title">单任务实时大屏</h2>
        <p v-if="task">
          正在展示 <strong class="mono">{{ task.task_id }}</strong> 的实时状态；不会聚合或推断其他任务数据。
        </p>
        <p v-else>正在连接当前配置的数据源，页面只展示已获取到的单任务数据。</p>
      </div>
      <div class="dashboard-header-actions">
        <span class="dashboard-source" :data-tone="store.monitoringError ? 'danger' : 'safe'">
          {{ store.monitoringError ? '刷新待恢复' : sourceLabel }}
        </span>
        <button class="dashboard-fullscreen-button" type="button" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '进入全屏' }}
        </button>
      </div>
    </header>

    <div v-if="store.monitoringError" class="dashboard-offline-notice" role="status">
      <strong>监测刷新暂时中断</strong>
      <span>{{ store.monitoringError }}。页面保留最近一次成功数据，恢复后将继续自动刷新。</span>
    </div>

    <p v-if="fullscreenError" class="dashboard-fullscreen-error" role="status">{{ fullscreenError }}</p>

    <AsyncStatePanel
      v-if="store.loading && !task"
      state="loading"
      title="正在加载单任务监测数据"
      description="正在同步当前任务、遥测历史、告警和交接节点。"
    />

    <template v-else-if="task">
      <section class="dashboard-task-strip" aria-label="当前任务摘要">
        <article class="dashboard-status-card">
          <span>当前任务</span>
          <strong class="mono">{{ task.task_id }}</strong>
          <p>{{ task.sample_name }}</p>
          <em class="status-chip" :data-tone="statusTone(task.status)">{{ taskLabel(task.status) }}</em>
        </article>
        <article class="dashboard-route-card">
          <span>交接路径</span>
          <strong>{{ task.sender }}</strong>
          <i aria-hidden="true"></i>
          <strong>{{ task.receiver }}</strong>
          <p>承运：{{ task.carrier }} · 设备：<b class="mono">{{ task.device_id || '未绑定' }}</b></p>
        </article>
        <article class="dashboard-refresh-card">
          <span>最近数据时间</span>
          <strong>{{ formatTime(currentTimestamp) }}</strong>
          <p>{{ riskLabel }}</p>
        </article>
      </section>

      <section class="dashboard-metric-grid" aria-label="实时环境指标">
        <article class="dashboard-metric-card" :data-tone="telemetry?.temp_status === 'TEMP_ALERT' ? 'danger' : 'safe'">
          <span>当前温度</span>
          <strong>{{ formatValue(metrics.temperature.latest) }}<small>°C</small></strong>
          <p>
            历史范围 {{ formatValue(metrics.temperature.min) }} — {{ formatValue(metrics.temperature.max) }} °C
          </p>
          <em v-if="telemetry">{{ temperatureLabel(telemetry.temp_status) }}</em>
          <em v-else>等待温度上报</em>
        </article>
        <article class="dashboard-metric-card">
          <span>当前湿度</span>
          <strong>{{ formatValue(metrics.humidity.latest) }}<small>%RH</small></strong>
          <p>
            历史范围 {{ formatValue(metrics.humidity.min) }} — {{ formatValue(metrics.humidity.max) }} %RH
          </p>
          <em>{{ metrics.trend.length ? `${metrics.trend.length} 条趋势记录` : '暂无有效历史记录' }}</em>
        </article>
        <article class="dashboard-metric-card" :data-tone="telemetry?.box_status === 'BOX_OPEN' ? 'danger' : 'safe'">
          <span>箱体状态</span>
          <strong>{{ telemetry ? boxLabel(telemetry.box_status) : '等待上报' }}</strong>
          <p>光照原始值 {{ telemetry ? telemetry.light_raw : '—' }}</p>
          <em>{{ metrics.hasBoxOpen ? '需要核查' : telemetry ? '状态已同步' : '暂无箱体信号' }}</em>
        </article>
        <article class="dashboard-metric-card" :data-tone="telemetry ? statusTone(telemetry.move_status) : 'neutral'">
          <span>运动状态</span>
          <strong>{{ telemetry ? moveLabel(telemetry.move_status) : '等待上报' }}</strong>
          <p>运动评分 {{ telemetry ? formatValue(telemetry.motion_score, 2) : '—' }}</p>
          <em>{{ metrics.hasMotionAlert ? '需要核查' : telemetry ? '状态已同步' : '暂无运动信号' }}</em>
        </article>
      </section>

      <section class="dashboard-main-grid">
        <article class="dashboard-chart-card">
          <div class="dashboard-card-heading">
            <div>
              <span>ENVIRONMENT TREND</span>
              <h3>温湿度历史趋势</h3>
            </div>
          </div>
          <TelemetryTrendChart :history="store.history" />
        </article>

        <article class="dashboard-alert-card">
          <div class="dashboard-card-heading">
            <div>
              <span>ALARM LEDGER</span>
              <h3>告警记录</h3>
            </div>
            <b :data-tone="metrics.alarmCount ? 'danger' : 'safe'">{{ metrics.alarmCount }} 项</b>
          </div>
          <div v-if="alarmPreview.length" class="dashboard-alarm-list">
            <article v-for="alarm in alarmPreview" :key="alarm.id" class="dashboard-alarm-item">
              <time>{{ formatTime(alarm.timestamp) }}</time>
              <div>
                <strong>{{ alarm.event_name }}</strong>
                <p>{{ alarm.event_detail }}</p>
              </div>
            </article>
          </div>
          <div v-else class="dashboard-empty-list">当前后端未返回告警记录。</div>
          <RouterLink :to="`/tasks/${task.task_id}`" class="dashboard-detail-link">查看任务监控与交接</RouterLink>
        </article>
      </section>

      <section class="dashboard-handoff-card">
        <div class="dashboard-card-heading">
          <div>
            <span>CHAIN OF CUSTODY</span>
            <h3>后端确认的交接节点</h3>
          </div>
          <RouterLink :to="`/trace/${task.task_id}`" class="dashboard-detail-link">查看追溯报告</RouterLink>
        </div>
        <div v-if="store.traceLoading && !handoffNodes.length" class="dashboard-empty-list">正在同步交接节点…</div>
        <div v-else-if="handoffNodes.length" class="dashboard-handoff-list">
          <article v-for="node in handoffNodes" :key="node.type + node.timestamp" class="dashboard-handoff-node">
            <span aria-hidden="true"></span>
            <div>
              <strong>{{ handoffLabel[node.type] || node.type }}</strong>
              <p>{{ formatTime(node.timestamp) }}<template v-if="node.reason"> · {{ node.reason }}</template></p>
            </div>
          </article>
        </div>
        <div v-else class="dashboard-empty-list">当前没有可展示的后端交接节点。</div>
      </section>
    </template>

    <AsyncStatePanel
      v-else
      :state="store.monitoringError ? 'offline' : 'error'"
      title="暂未获取到当前任务数据"
      description="请检查数据源或网络后重新同步；页面不会用其他任务数据替代当前任务。"
      @retry="retryLoad"
    />
  </section>
</template>
