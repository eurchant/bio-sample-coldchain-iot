<template>
  <view class="page">
    <!-- 任务状态卡 -->
    <view class="card">
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
      <view class="meta-grid">
        <view class="meta-item">
          <text class="cc-eyebrow">发出</text>
          <text class="meta-val">{{ task?.sender || '--' }}</text>
        </view>
        <view class="meta-item">
          <text class="cc-eyebrow">接收</text>
          <text class="meta-val">{{ task?.receiver || '--' }}</text>
        </view>
        <view class="meta-item">
          <text class="cc-eyebrow">设备</text>
          <text class="meta-val">{{ task?.device_id || '--' }}</text>
        </view>
      </view>
    </view>

    <!-- 设备快照与异常（签收前核对） -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">设备快照与异常</text>
        <text class="card-sub">签收前核对</text>
      </view>

      <view v-if="latest" class="snapshot-grid">
        <view class="snap-item" :class="{ 'snap-crit': latest.temp_status === 'TEMP_ALERT' }">
          <text class="cc-eyebrow">温度</text>
          <text class="snap-num">{{ fmtNum(latest.temperature) }}<text class="snap-unit">℃</text></text>
          <view class="cc-badge cc-badge-sm" :class="`cc-badge-${tempSemantic(latest.temp_status)}`">
            {{ tempText(latest.temp_status) }}
          </view>
        </view>
        <view class="snap-item">
          <text class="cc-eyebrow">湿度</text>
          <text class="snap-num">{{ fmtNum(latest.humidity) }}<text class="snap-unit">%</text></text>
        </view>
        <view class="snap-item">
          <text class="cc-eyebrow">箱体</text>
          <text class="snap-val">{{ boxText(latest.box_status) }}</text>
          <view class="cc-badge cc-badge-sm" :class="`cc-badge-${boxSemantic(latest.box_status)}`">
            {{ boxText(latest.box_status) }}
          </view>
        </view>
        <view class="snap-item" :class="{ 'snap-crit': isMoveAlert }">
          <text class="cc-eyebrow">运动</text>
          <text class="snap-val">{{ moveText(latest.move_status) }}</text>
          <text class="snap-sub">加速度 {{ fmtNum(latest.acc_total) }}</text>
        </view>
      </view>
      <view v-else class="empty-block">暂无设备快照</view>

      <view class="alarm-row">
        <text class="alarm-label">异常数量</text>
        <view class="cc-badge" :class="alarmCount > 0 ? 'cc-badge-crit' : 'cc-badge-success'">
          {{ alarmCount }}
        </view>
      </view>
      <text class="snap-updated">快照更新于 {{ formatTime(latest?.timestamp) }}</text>
    </view>

    <!-- 操作区 -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">交接操作</text>
      </view>

      <!-- 可操作状态 -->
      <view v-if="canAct" class="actions">
        <button class="cc-btn cc-btn-primary" :disabled="submitting" @click="onSign">
          {{ submitting ? '处理中...' : '确认签收' }}
        </button>
        <button class="cc-btn cc-btn-danger" :disabled="submitting" @click="onReject">
          拒收
        </button>
      </view>

      <!-- 已签收终态 -->
      <view v-else-if="task?.status === 'signed'" class="terminal terminal-success">
        <view class="terminal-icon icon-success">✓</view>
        <view class="terminal-text">
          <text class="terminal-title">任务已签收</text>
          <text class="terminal-time">签收时间：{{ formatTime(task.signed_at) }}</text>
        </view>
      </view>

      <!-- 已拒收终态 -->
      <view v-else-if="task?.status === 'rejected'" class="terminal terminal-crit">
        <view class="terminal-icon icon-crit">×</view>
        <view class="terminal-text">
          <text class="terminal-title">任务已拒收</text>
          <text class="terminal-time">拒收时间：{{ formatTime(task.rejected_at) }}</text>
          <text class="terminal-reason">原因：{{ task.rejection_reason || '--' }}</text>
        </view>
      </view>

      <!-- 其它不可操作状态 -->
      <view v-else class="terminal terminal-neutral">
        <view class="terminal-text">
          <text class="terminal-title">当前状态「{{ task ? statusText(task.status) : '--' }}」不可操作</text>
          <text class="terminal-time">仅运输中或已到达的任务允许签收或拒收</text>
        </view>
      </view>
    </view>

    <!-- 监测摘要 -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">监测摘要</text>
      </view>
      <view v-if="report" class="summary-grid">
        <view class="sum-item">
          <text class="sum-num">{{ report.summary.total_records ?? '--' }}</text>
          <text class="sum-label">记录数</text>
        </view>
        <view class="sum-item" :class="{ 'sum-crit': (report.summary.event_count ?? 0) > 0 }">
          <text class="sum-num">{{ report.summary.event_count ?? '--' }}</text>
          <text class="sum-label">异常数</text>
        </view>
        <view class="sum-item">
          <text class="sum-num">{{ fmtNum(report.summary.min_temperature) }}<text class="sum-unit">℃</text></text>
          <text class="sum-label">最低温</text>
        </view>
        <view class="sum-item">
          <text class="sum-num">{{ fmtNum(report.summary.max_temperature) }}<text class="sum-unit">℃</text></text>
          <text class="sum-label">最高温</text>
        </view>
        <view class="sum-item">
          <text class="sum-num">{{ fmtNum(report.summary.avg_temperature) }}<text class="sum-unit">℃</text></text>
          <text class="sum-label">平均温</text>
        </view>
        <view class="sum-item">
          <text class="sum-num">{{ fmtNum(report.summary.min_humidity) }}<text class="sum-unit">%</text></text>
          <text class="sum-label">最低湿度</text>
        </view>
        <view class="sum-item">
          <text class="sum-num">{{ fmtNum(report.summary.max_humidity) }}<text class="sum-unit">%</text></text>
          <text class="sum-label">最高湿度</text>
        </view>
      </view>
      <view v-else class="empty-block">暂无监测摘要</view>
    </view>

    <!-- 交接节点 -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">交接节点</text>
      </view>
      <view v-if="report && report.handoff_nodes.length > 0" class="timeline">
        <view
          v-for="(node, idx) in report.handoff_nodes"
          :key="idx"
          class="timeline-item"
        >
          <view class="tl-rail">
            <view class="tl-dot" :class="`dot-${nodeSemantic(node.type)}`"></view>
          </view>
          <view class="tl-content">
            <text class="node-name">{{ nodeName(node.type) }}</text>
            <text class="node-time">{{ formatTime(node.timestamp) }}</text>
            <text v-if="node.reason" class="node-reason">原因：{{ node.reason }}</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-block">暂无交接节点</view>
    </view>

    <!-- 事件记录 -->
    <view class="card">
      <view class="card-head">
        <text class="cc-section-title">事件记录</text>
        <text class="card-sub">共 {{ report?.events.length ?? 0 }} 条</text>
      </view>
      <view v-if="report && report.events.length > 0" class="event-list">
        <view v-for="ev in report.events" :key="ev.id" class="event-item">
          <view class="ev-dot" :class="`dot-${eventSemantic(ev.event_type)}`"></view>
          <view class="ev-body">
            <view class="ev-head">
              <text class="event-name">{{ ev.event_name }}</text>
              <text class="event-time">{{ formatTime(ev.timestamp) }}</text>
            </view>
            <text class="event-detail">{{ ev.event_detail }}</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-block">运输全程无异常</view>
    </view>

    <AppTabBar current="handoff" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { signTask, rejectTask, getTelemetryLatest, getAlarms, getTraceReport } from '@/shared/api/task'
import { ApiError } from '@/shared/utils/request'
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
  EVENT_TYPE_SEMANTIC,
  type Semantic,
} from '@/shared/constants/enum'
import type {
  TaskStatus,
  Telemetry,
  Alarm,
  TempStatus,
  BoxStatus,
  MoveStatus,
  TraceReport,
  HandoffNode,
} from '@/shared/types/api'
import { formatTime, fmtNum } from '@/shared/utils/format'
import AppTabBar from '@/components/AppTabBar.vue'

const taskStore = useTaskStore()
const task = computed(() => taskStore.task)
const submitting = ref(false)
const latest = ref<Telemetry | null>(null)
const alarms = ref<Alarm[]>([])
const report = ref<TraceReport | null>(null)

// uni.showModal 需要字面量 hex，与 DESIGN.md §2 --cc-crit 保持一致
const CRIT_COLOR = '#e0433a'

const canAct = computed(
  () => task.value?.status === 'in_transit' || task.value?.status === 'arrived'
)
const alarmCount = computed(() => alarms.value.length)
const isMoveAlert = computed(() => {
  const s = latest.value?.move_status
  return s === 'SEVERE' || s === 'IMPACT' || s === 'FREE_FALL'
})

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
function eventSemantic(t: string): Semantic {
  return EVENT_TYPE_SEMANTIC[t] || 'neutral'
}
function nodeName(t: HandoffNode['type']): string {
  return t === 'started' ? '发出交接' : t === 'signed' ? '到达签收' : '拒收'
}
function nodeSemantic(t: HandoffNode['type']): Semantic {
  return t === 'started' ? 'info' : t === 'signed' ? 'success' : 'crit'
}

async function loadSnapshot() {
  const taskId = taskStore.currentTaskId
  try {
    latest.value = await getTelemetryLatest(taskId)
  } catch (e) {
    console.warn('load latest failed', e)
  }
  try {
    const res = await getAlarms(taskId, 100)
    alarms.value = res.items || []
  } catch (e) {
    console.warn('load alarms failed', e)
  }
}

async function loadTrace() {
  try {
    report.value = await getTraceReport(taskStore.currentTaskId)
  } catch (e) {
    console.warn('load trace failed', e)
  }
}

async function onSign() {
  if (submitting.value) return
  submitting.value = true
  try {
    await signTask(taskStore.currentTaskId)
    uni.showToast({ title: '签收成功', icon: 'success' })
    await taskStore.loadTask()
  } catch (e) {
    handleError(e)
  } finally {
    submitting.value = false
  }
}

function onReject() {
  if (submitting.value) return
  uni.showModal({
    title: '拒收原因',
    editable: true,
    placeholderText: '请输入拒收原因',
    confirmText: '确认拒收',
    confirmColor: CRIT_COLOR,
    success: async (res) => {
      if (!res.confirm) return
      const reason = (res.content || '').trim()
      if (!reason) {
        uni.showToast({ title: '拒收原因不能为空', icon: 'none' })
        return
      }
      submitting.value = true
      try {
        await rejectTask(taskStore.currentTaskId, reason)
        uni.showToast({ title: '已拒收', icon: 'success' })
        await taskStore.loadTask()
      } catch (e) {
        handleError(e)
      } finally {
        submitting.value = false
      }
    },
  })
}

function handleError(e: unknown) {
  if (e instanceof ApiError) {
    if (e.code === 40901 || e.status === 409) {
      uni.showToast({ title: '当前状态不允许此操作', icon: 'none' })
    } else if (e.status === 400) {
      uni.showToast({ title: '拒收原因不能为空', icon: 'none' })
    } else if (e.code === 40401 || e.status === 404) {
      uni.showToast({ title: '任务不存在', icon: 'none' })
    } else {
      uni.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  } else {
    uni.showToast({ title: '网络错误', icon: 'none' })
  }
}

onShow(() => {
  taskStore.loadTask()
  loadSnapshot()
  loadTrace()
})
</script>

<style>
/* 任务头、卡片、meta-grid 等通用类见 App.vue */

/* 设备快照 */
.snapshot-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.snap-item {
  width: calc(50% - 4px);
  background: var(--cc-canvas-sunken);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
}
.snap-item.snap-crit {
  background: var(--cc-crit-bg);
}
.snap-num {
  font-size: 20px;
  font-weight: 300;
  letter-spacing: -0.3px;
  color: var(--cc-ink);
  line-height: 1.1;
}
.snap-item.snap-crit .snap-num {
  color: var(--cc-crit);
}
.snap-unit {
  font-size: 11px;
  color: var(--cc-ink-mute);
  margin-left: 1px;
}
.snap-val {
  font-size: 15px;
  font-weight: 500;
  color: var(--cc-ink);
  line-height: 1.2;
}
.snap-sub {
  font-size: 11px;
  color: var(--cc-ink-faint);
}
.alarm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 4px;
  border-top: 1px solid var(--cc-hairline);
}
.alarm-label {
  font-size: 13px;
  color: var(--cc-ink-mute);
}
.snap-updated {
  display: block;
  font-size: 11px;
  color: var(--cc-ink-faint);
}

/* 操作 */
.actions {
  display: flex;
  gap: 12px;
}
.actions .cc-btn { flex: 1; }

/* 终态 */
.terminal {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
}
.terminal-success { background: var(--cc-success-bg); }
.terminal-crit    { background: var(--cc-crit-bg); }
.terminal-neutral { background: var(--cc-canvas-sunken); }
.terminal-icon {
  width: 24px; height: 24px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700;
  flex-shrink: 0;
  color: var(--cc-on-primary);
}
.icon-success { background: var(--cc-success); }
.icon-crit    { background: var(--cc-crit); }
.terminal-text { flex: 1; }
.terminal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cc-ink);
  display: block;
  margin-bottom: 4px;
}
.terminal-time {
  font-size: 12px;
  color: var(--cc-ink-mute);
  display: block;
}
.terminal-reason {
  font-size: 12px;
  color: var(--cc-crit);
  display: block;
  margin-top: 4px;
}

/* 监测摘要网格 */
.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sum-item {
  width: calc(33.33% - 6px);
  background: var(--cc-canvas-sunken);
  border-radius: 8px;
  padding: 12px 6px;
  text-align: center;
  box-sizing: border-box;
}
.sum-item.sum-crit {
  background: var(--cc-crit-bg);
}
.sum-num {
  font-size: 18px;
  font-weight: 300;
  letter-spacing: -0.3px;
  color: var(--cc-ink);
  display: block;
  line-height: 1.1;
}
.sum-item.sum-crit .sum-num {
  color: var(--cc-crit);
}
.sum-unit {
  font-size: 11px;
  color: var(--cc-ink-mute);
  margin-left: 1px;
}
.sum-label {
  font-size: 11px;
  color: var(--cc-ink-mute);
  display: block;
  margin-top: 5px;
}

/* 交接节点时间线内容 */
.node-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--cc-ink);
  display: block;
}
.node-time {
  font-size: 12px;
  color: var(--cc-ink-mute);
  display: block;
  margin-top: 3px;
}
.node-reason {
  font-size: 12px;
  color: var(--cc-crit);
  display: block;
  margin-top: 3px;
}

/* 事件列表 */
.event-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.event-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--cc-canvas-sunken);
  border-radius: 8px;
}
.ev-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}
.ev-body { flex: 1; }
.ev-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}
.event-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--cc-ink);
}
.event-time {
  font-size: 11px;
  color: var(--cc-ink-faint);
}
.event-detail {
  font-size: 12px;
  color: var(--cc-ink-mute);
  display: block;
  line-height: 1.5;
}
</style>
