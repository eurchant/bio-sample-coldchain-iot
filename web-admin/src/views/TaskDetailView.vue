<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AsyncStatePanel from '../components/AsyncStatePanel.vue'
import {
  boxLabel,
  formatTime,
  formatValue,
  isActionableStatus,
  moveLabel,
  statusTone,
  taskLabel,
  temperatureLabel,
} from '../lib/format'
import { useTaskStore } from '../stores/task'
import { useAuthStore } from '../stores/auth'
import type { Alarm, TaskStatus } from '../types/contracts'

type TaskAction = 'start' | 'sign' | 'reject'

const route = useRoute()
const store = useTaskStore()
const auth = useAuthStore()
const pendingAction = ref<TaskAction | null>(null)
const reason = ref('')
const pendingAlarm = ref<Alarm | null>(null)
const alarmResolution = ref('')

const task = computed(() => store.task)
const telemetry = computed(() => store.telemetry)
const routeTaskId = computed(() => String(route.params.taskId || ''))
const canStart = computed(
  () =>
    (task.value?.status === 'pending_pack' || task.value?.status === 'pending_handoff') &&
    auth.hasPermission('start_task'),
)
const canSign = computed(
  () => task.value && isActionableStatus(task.value.status) && auth.hasPermission('sign_task'),
)
const canReject = computed(
  () => task.value && isActionableStatus(task.value.status) && auth.hasPermission('reject_task'),
)
const canManageAlarms = computed(() => auth.role === 'admin')

const actionCopy: Record<TaskAction, { title: string; description: string; confirm: string }> = {
  start: {
    title: '确认发出交接',
    description: '将向后端提交发出操作，任务状态会由后端更新为“运输中”。',
    confirm: '确认发出',
  },
  sign: {
    title: '确认到达签收',
    description: '将向后端提交签收操作，后端校验状态后更新最终交接结果。',
    confirm: '确认签收',
  },
  reject: {
    title: '提交拒收',
    description: '拒收原因将原样传给后端记录，并由后端更新任务状态。',
    confirm: '确认拒收',
  },
}

const statusTimeline = computed(() => {
  if (!task.value) return []
  const current = task.value.status
  const statusItems: Array<{ key: TaskStatus; label: string; time: string | null }> = [
    { key: 'pending_pack', label: '任务建档', time: task.value.updated_at },
    { key: 'in_transit', label: '发出交接', time: task.value.started_at },
    { key: 'signed', label: '到达签收', time: task.value.signed_at },
  ]
  if (current === 'rejected') {
    statusItems[2] = { key: 'rejected', label: '到达拒收', time: task.value.rejected_at }
  }
  return statusItems
})

function openAction(action: TaskAction) {
  pendingAlarm.value = null
  pendingAction.value = action
  reason.value = ''
}

function closeAction() {
  pendingAction.value = null
  reason.value = ''
}

async function submitAction() {
  if (!pendingAction.value) return
  await store.performAction(pendingAction.value, reason.value, routeTaskId.value)
  if (!store.error) closeAction()
}

const alarmStatusLabel: Record<string, string> = {
  new: '待确认',
  acknowledged: '已确认',
  resolved: '已解决',
}

function alarmStatusText(alarm: Alarm) {
  return alarmStatusLabel[alarm.alarm_status ?? 'new'] ?? alarm.alarm_status ?? '待确认'
}

function alarmActionBusy(alarmId: number, action?: 'acknowledge' | 'resolve') {
  return (
    store.alarmActionLoading?.alarmId === alarmId &&
    (!action || store.alarmActionLoading.action === action)
  )
}

async function acknowledgeAlarm(alarm: Alarm) {
  await store.performAlarmAction(alarm.id, 'acknowledge')
}

function openAlarmResolve(alarm: Alarm) {
  pendingAction.value = null
  pendingAlarm.value = alarm
  alarmResolution.value = ''
}

function closeAlarmResolve() {
  if (store.alarmActionLoading) return
  pendingAlarm.value = null
  alarmResolution.value = ''
}

async function submitAlarmResolve() {
  if (!pendingAlarm.value) return
  await store.performAlarmAction(pendingAlarm.value.id, 'resolve', alarmResolution.value)
  if (!store.error) closeAlarmResolve()
}

function retryLoad() {
  void store.bootstrap(routeTaskId.value)
}

function loadTask() {
  if (!routeTaskId.value) return
  if (store.task?.task_id === routeTaskId.value) {
    store.activeTaskId = routeTaskId.value
    return
  }
  void store.bootstrap(routeTaskId.value)
}

onMounted(loadTask)
watch(routeTaskId, loadTask)
</script>

<template>
  <section class="page-section detail-page">
    <div class="page-heading">
      <div>
        <p class="section-kicker">02 / LIVE TASK CONTROL</p>
        <h2>实时监控与交接</h2>
        <p>任务 <span class="mono">{{ routeTaskId }}</span> 的监测信息会自动刷新，状态变更只由后端确认。</p>
      </div>
      <button class="ghost-button" type="button" @click="retryLoad" :disabled="store.loading">
        {{ store.loading ? '同步中…' : '立即同步' }}
      </button>
    </div>

    <div v-if="store.monitoringError" class="offline-notice" role="status">
      <span class="offline-icon">!</span>
      <div>
        <strong>监测刷新暂时中断</strong>
        <p>{{ store.monitoringError }}。页面保留最近一次成功数据，恢复网络后会自动重试。</p>
      </div>
    </div>

    <template v-if="task">
      <article class="task-hero">
        <div class="task-hero-main">
          <p class="section-kicker">TASK IDENTIFICATION</p>
          <div class="task-title-line">
            <h3>{{ task.sample_name }}</h3>
            <em class="status-chip" :data-tone="statusTone(task.status)">{{ taskLabel(task.status) }}</em>
          </div>
          <div class="identity-grid">
            <div><span>任务编号</span><strong class="mono">{{ task.task_id }}</strong></div>
            <div><span>绑定设备</span><strong class="mono">{{ task.device_id || '未绑定' }}</strong></div>
            <div><span>承运人员</span><strong>{{ task.carrier }}</strong></div>
            <div><span>最近更新</span><strong>{{ formatTime(task.updated_at) }}</strong></div>
          </div>
        </div>
        <div class="route-visual">
          <div><small>发出单位</small><strong>{{ task.sender }}</strong></div>
          <span class="route-line"><i></i><i></i><i></i></span>
          <div><small>接收单位</small><strong>{{ task.receiver }}</strong></div>
        </div>
      </article>

      <div v-if="store.actionMessage" class="success-notice" role="status">
        <span>✓</span>{{ store.actionMessage }}
      </div>

      <div class="monitor-grid">
        <article class="panel live-panel">
          <div class="card-heading">
            <div>
              <p class="section-kicker">LATEST TELEMETRY</p>
              <h3>实时环境</h3>
            </div>
            <span class="live-ping">LIVE</span>
          </div>

          <div v-if="telemetry" class="telemetry-cards">
            <div class="telemetry-card temperature-card" :data-tone="statusTone(telemetry.temp_status)">
              <span>温度</span>
              <strong>{{ formatValue(telemetry.temperature) }}<small>°C</small></strong>
              <em>{{ temperatureLabel(telemetry.temp_status) }}</em>
            </div>
            <div class="telemetry-card">
              <span>湿度</span>
              <strong>{{ formatValue(telemetry.humidity) }}<small>%RH</small></strong>
              <em>当前环境</em>
            </div>
            <div class="telemetry-card">
              <span>箱体状态</span>
              <strong class="compact" :data-tone="statusTone(telemetry.box_status)">{{ boxLabel(telemetry.box_status) }}</strong>
              <em>光照原始值 {{ telemetry.light_raw }}</em>
            </div>
            <div class="telemetry-card">
              <span>运动状态</span>
              <strong class="compact" :data-tone="statusTone(telemetry.move_status)">{{ moveLabel(telemetry.move_status) }}</strong>
              <em>运动分 {{ formatValue(telemetry.motion_score) }}</em>
            </div>
          </div>
          <div v-else class="empty-telemetry">
            <span class="empty-orbit"></span>
            <div>
              <strong>尚未接收到设备监测数据</strong>
              <p>请确认开发板已向绑定任务上传数据。</p>
            </div>
          </div>
          <p class="freshness">最近上报：{{ telemetry ? formatTime(telemetry.timestamp) : '—' }}</p>
        </article>

        <article class="panel handoff-panel">
          <div class="card-heading">
            <div>
              <p class="section-kicker">HANDOFF CONTROL</p>
              <h3>交接操作</h3>
            </div>
            <span class="guarded-label">后端校验</span>
          </div>
          <p class="handoff-lead">界面只发起操作请求，不在前端推断状态流转。</p>
          <div class="action-stack">
            <button data-testid="start-task" class="primary-action" type="button" :disabled="!canStart || store.actionLoading !== null" @click="openAction('start')">
              <span>01</span>
              <b>{{ store.actionLoading === 'start' ? '正在发出…' : '发出交接' }}</b>
              <small>进入运输中</small>
            </button>
            <button data-testid="sign-task" class="secondary-action" type="button" :disabled="!canSign || store.actionLoading !== null" @click="openAction('sign')">
              <span>02</span>
              <b>{{ store.actionLoading === 'sign' ? '正在签收…' : '到达签收' }}</b>
              <small>完成交接</small>
            </button>
            <button data-testid="reject-task" class="danger-action" type="button" :disabled="!canReject || store.actionLoading !== null" @click="openAction('reject')">
              <span>03</span>
              <b>{{ store.actionLoading === 'reject' ? '正在提交…' : '拒收并记录原因' }}</b>
              <small>保留追溯证据</small>
            </button>
          </div>
        </article>
      </div>

      <div class="detail-bottom">
        <article class="panel lifecycle-panel">
          <div class="card-heading">
            <div>
              <p class="section-kicker">TASK TIMELINE</p>
              <h3>状态时间线</h3>
            </div>
          </div>
          <ol class="status-timeline">
            <li v-for="(item, index) in statusTimeline" :key="item.label" :class="{ done: Boolean(item.time), active: task.status === item.key }">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <div>
                <strong>{{ item.label }}</strong>
                <p>{{ item.time ? formatTime(item.time) : '等待后端状态更新' }}</p>
              </div>
            </li>
          </ol>
          <p v-if="task.rejection_reason" class="rejection-reason">拒收原因：{{ task.rejection_reason }}</p>
        </article>

        <article class="panel events-panel">
          <div class="card-heading">
            <div>
              <p class="section-kicker">EXCEPTION TIMELINE</p>
              <h3>异常记录</h3>
            </div>
            <span class="count-badge">{{ String(store.alarms.length).padStart(2, '0') }}</span>
          </div>
          <div v-if="store.alarms.length" class="event-list">
            <div v-for="alarm in store.alarms" :key="alarm.id" class="event-row">
              <span class="event-marker"></span>
              <div>
                <strong>{{ alarm.event_name }}</strong>
                <p>{{ alarm.event_detail }}</p>
              </div>
              <time>{{ formatTime(alarm.timestamp) }}</time>
              <div class="alarm-action-cell">
                <span class="alarm-status-label">{{ alarmStatusText(alarm) }}</span>
                <template v-if="canManageAlarms && alarm.alarm_status !== 'resolved'">
                  <button
                    v-if="alarm.alarm_status !== 'acknowledged'"
                    class="alarm-action-button"
                    type="button"
                    :disabled="Boolean(store.alarmActionLoading)"
                    @click="acknowledgeAlarm(alarm)"
                  >
                    {{ alarmActionBusy(alarm.id, 'acknowledge') ? '确认中…' : '确认' }}
                  </button>
                  <button
                    class="alarm-action-button alarm-resolve-button"
                    type="button"
                    :disabled="Boolean(store.alarmActionLoading)"
                    @click="openAlarmResolve(alarm)"
                  >
                    处置
                  </button>
                </template>
              </div>
            </div>
          </div>
          <div v-else class="compact-empty">暂无异常事件。</div>
        </article>
      </div>

      <article class="panel history-panel">
        <div class="card-heading">
          <div>
            <p class="section-kicker">RECENT DEVICE RECORDS</p>
            <h3>最近监测记录</h3>
          </div>
          <span class="record-note">按最新到最早</span>
        </div>
        <div v-if="store.history.length" class="history-table">
          <div class="history-head">
            <span>上报时间</span><span>温度</span><span>湿度</span><span>箱体</span><span>运动</span><span>状态</span>
          </div>
          <div v-for="record in store.history" :key="record.id" class="history-row">
            <span>{{ formatTime(record.timestamp) }}</span>
            <span>{{ formatValue(record.temperature) }} °C</span>
            <span>{{ formatValue(record.humidity) }} %RH</span>
            <span>{{ boxLabel(record.box_status) }}</span>
            <span>{{ moveLabel(record.move_status) }}</span>
            <span><em class="status-chip" :data-tone="statusTone(record.temp_status)">{{ temperatureLabel(record.temp_status) }}</em></span>
          </div>
        </div>
        <div v-else class="compact-empty">当前没有可展示的历史记录。</div>
      </article>
    </template>

    <AsyncStatePanel
      v-else
      :state="store.monitoringError ? 'offline' : 'error'"
      title="没有读取到任务详情"
      description="请检查数据源配置和网络连接后重新同步。"
      @retry="retryLoad"
    />

    <div v-if="pendingAction" class="modal-backdrop" role="presentation" @click.self="closeAction">
      <section class="action-modal" role="dialog" aria-modal="true" :aria-label="actionCopy[pendingAction].title">
        <button class="modal-close" type="button" aria-label="关闭" @click="closeAction">×</button>
        <p class="section-kicker">SERVER CONFIRMATION REQUIRED</p>
        <h3>{{ actionCopy[pendingAction].title }}</h3>
        <p>{{ actionCopy[pendingAction].description }}</p>
        <label v-if="pendingAction === 'reject'" class="reason-field">
          <span>拒收原因</span>
          <textarea v-model="reason" rows="4" maxlength="200" placeholder="例如：温度异常"></textarea>
        </label>
        <div class="modal-actions">
          <button class="ghost-button" type="button" @click="closeAction">取消</button>
          <button
            class="primary-action modal-confirm"
            type="button"
            :disabled="store.actionLoading !== null || (pendingAction === 'reject' && !reason.trim())"
            @click="submitAction"
          >
            {{ store.actionLoading ? '提交中…' : actionCopy[pendingAction].confirm }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="pendingAlarm" class="modal-backdrop" role="presentation" @click.self="closeAlarmResolve">
      <section class="action-modal" role="dialog" aria-modal="true" aria-label="记录告警处置">
        <button class="modal-close" type="button" aria-label="关闭" @click="closeAlarmResolve">×</button>
        <p class="section-kicker">ALARM RESOLUTION</p>
        <h3>记录告警处置</h3>
        <p>
          正在处置“{{ pendingAlarm.event_name }}”。处置说明将提交给后端并显示在后续追溯记录中。
        </p>
        <label class="reason-field">
          <span>处置说明</span>
          <textarea v-model="alarmResolution" rows="4" maxlength="300" placeholder="例如：已复核设备并完成样本检查"></textarea>
        </label>
        <div class="modal-actions">
          <button class="ghost-button" type="button" @click="closeAlarmResolve">取消</button>
          <button
            class="primary-action modal-confirm"
            type="button"
            :disabled="Boolean(store.alarmActionLoading) || !alarmResolution.trim()"
            @click="submitAlarmResolve"
          >
            {{ store.alarmActionLoading ? '提交中…' : '确认处置完成' }}
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
