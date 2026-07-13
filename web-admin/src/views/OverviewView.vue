<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { boxLabel, formatTime, formatValue, statusTone, taskLabel, temperatureLabel } from '../lib/format'
import { useTaskStore } from '../stores/task'

const store = useTaskStore()
const task = computed(() => store.task)
const telemetry = computed(() => store.telemetry)

const taskStats = computed(() => [
  {
    label: '当前温度',
    value: telemetry.value ? formatValue(telemetry.value.temperature) : '—',
    unit: '°C',
    tone: telemetry.value?.temp_status === 'TEMP_ALERT' ? 'danger' : 'safe',
    note: telemetry.value ? temperatureLabel(telemetry.value.temp_status) : '等待设备上报',
  },
  {
    label: '环境湿度',
    value: telemetry.value ? formatValue(telemetry.value.humidity) : '—',
    unit: '%RH',
    tone: 'neutral',
    note: telemetry.value ? '光照原始值 ' + telemetry.value.light_raw : '暂无监测记录',
  },
  {
    label: '异常事件',
    value: String(store.alarms.length),
    unit: '项',
    tone: store.alarms.length ? 'danger' : 'safe',
    note: store.alarms.length ? '需在详情页核查' : '尚未发现告警',
  },
])
</script>

<template>
  <section class="page-section overview-page">
    <div class="page-heading">
      <div>
        <p class="section-kicker">01 / TRANSIT QUEUE</p>
        <h2>任务总览</h2>
        <p>聚焦当前演示任务的状态、环境和交接进度。</p>
      </div>
      <button class="ghost-button" type="button" @click="store.bootstrap()" :disabled="store.loading">
        {{ store.loading ? '读取中…' : '刷新任务数据' }}
      </button>
    </div>

    <div v-if="store.loading && !task" class="state-panel">
      <span class="loader"></span>
      正在读取任务与监测数据…
    </div>

    <template v-else-if="task">
      <div class="metric-grid">
        <article v-for="item in taskStats" :key="item.label" class="metric-card">
          <div class="metric-label">{{ item.label }}</div>
          <div class="metric-number" :data-tone="item.tone">
            {{ item.value }} <small>{{ item.unit }}</small>
          </div>
          <p>{{ item.note }}</p>
        </article>
      </div>

      <article class="task-table-card">
        <div class="table-card-head">
          <div>
            <p class="section-kicker">ACTIVE TASK</p>
            <h3>当前转运任务</h3>
          </div>
          <span class="count-badge">01</span>
        </div>

        <div class="task-table" role="table" aria-label="当前转运任务">
          <div class="task-table-head" role="row">
            <span>任务 / 样本</span>
            <span>转运路径</span>
            <span>设备</span>
            <span>状态</span>
            <span>最近更新</span>
            <span aria-label="操作"></span>
          </div>
          <RouterLink :to="'/tasks/' + task.task_id" class="task-row" role="row">
            <span>
              <strong>{{ task.task_id }}</strong>
              <small>{{ task.sample_name }}</small>
            </span>
            <span class="route-cell">
              <b>{{ task.sender }}</b>
              <i></i>
              <b>{{ task.receiver }}</b>
            </span>
            <span class="mono">{{ task.device_id || '未绑定' }}</span>
            <span><em class="status-chip" :data-tone="statusTone(task.status)">{{ taskLabel(task.status) }}</em></span>
            <span>{{ formatTime(task.updated_at) }}</span>
            <span class="row-link">查看 <b>→</b></span>
          </RouterLink>
        </div>
      </article>

      <div class="overview-bottom">
        <article class="monitoring-snapshot">
          <div class="card-heading">
            <div>
              <p class="section-kicker">LIVE SIGNAL</p>
              <h3>监测快照</h3>
            </div>
            <span :class="['live-ping', { alert: telemetry?.temp_status === 'TEMP_ALERT' }]">4 秒刷新</span>
          </div>
          <div v-if="telemetry" class="snapshot-grid">
            <div>
              <span>箱体</span>
              <strong :data-tone="statusTone(telemetry.box_status)">{{ boxLabel(telemetry.box_status) }}</strong>
            </div>
            <div>
              <span>运动</span>
              <strong :data-tone="statusTone(telemetry.move_status)">{{ telemetry.move_status }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatTime(telemetry.timestamp) }}</strong>
            </div>
          </div>
          <div v-else class="compact-empty">暂无设备监测记录，等待开发板上传数据。</div>
        </article>

        <article class="alert-summary">
          <div class="card-heading">
            <div>
              <p class="section-kicker">EXCEPTION QUEUE</p>
              <h3>最新告警</h3>
            </div>
            <RouterLink :to="'/tasks/' + task.task_id" class="text-link">查看全部</RouterLink>
          </div>
          <div v-if="store.alarms.length" class="mini-alert">
            <span class="alert-index">A{{ String(store.alarms[0].id).padStart(2, '0') }}</span>
            <div>
              <strong>{{ store.alarms[0].event_name }}</strong>
              <p>{{ store.alarms[0].event_detail }}</p>
            </div>
            <time>{{ formatTime(store.alarms[0].timestamp) }}</time>
          </div>
          <div v-else class="compact-empty">当前没有异常事件。</div>
        </article>
      </div>
    </template>

    <div v-else class="state-panel is-error">
      没有读取到任务数据。请检查数据源配置和网络连接后重试。
    </div>
  </section>
</template>
