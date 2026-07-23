<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AsyncStatePanel from '../components/AsyncStatePanel.vue'
import {
  buildGnssTrajectory,
  buildHandoffRouteNodes,
  getGnssTrajectoryEmptyState,
  getHandoffProgress,
  projectGnssTrajectory,
} from '../lib/route'
import { formatTime, taskLabel } from '../lib/format'
import { useTaskStore } from '../stores/task'

const store = useTaskStore()
const route = useRoute()
const task = computed(() => store.task)
const routeTaskId = computed(() => String(route.params.taskId || ''))
const progress = computed(() => (task.value ? getHandoffProgress(task.value.status) : null))
const routeNodes = computed(() =>
  task.value ? buildHandoffRouteNodes(task.value, store.trace?.handoff_nodes ?? []) : [],
)
const gnssEmptyState = getGnssTrajectoryEmptyState()
const gnssTrajectory = computed(() => buildGnssTrajectory(store.history))
const projectedGnssPoints = computed(() => projectGnssTrajectory(gnssTrajectory.value.points))
const gnssSvgPoints = computed(() =>
  projectedGnssPoints.value.map((point) => `${point.x},${point.y}`).join(' '),
)

function loadTaskMap() {
  if (!routeTaskId.value) return
  void store.bootstrap(routeTaskId.value)
  void store.loadTrace(routeTaskId.value)
}

onMounted(loadTaskMap)
watch(routeTaskId, loadTaskMap)

function retryLoad() {
  void Promise.all([store.bootstrap(routeTaskId.value), store.loadTrace(routeTaskId.value)])
}
</script>

<template>
  <section class="page-section task-map-page">
    <div class="page-heading">
      <div>
        <p class="section-kicker">02 / HANDOFF MAP</p>
        <h2>交接路径</h2>
        <p>按任务参与方展示交接进度；此页面不将参与方名称解释为真实地理位置。</p>
      </div>
    </div>

    <AsyncStatePanel
      v-if="store.loading && !task"
      state="loading"
      title="正在读取任务交接信息"
      description="正在同步当前任务和后端提供的交接节点。"
    />

    <div v-else-if="task && progress" class="task-map-content">
      <section class="handoff-summary" aria-label="任务交接进度">
        <div>
          <span>任务编号</span>
          <strong class="mono">{{ task.task_id }}</strong>
        </div>
        <div>
          <span>当前状态</span>
          <strong>{{ taskLabel(task.status) }}</strong>
        </div>
        <div>
          <span>交接进度</span>
          <strong>{{ progress.label }} · {{ progress.percent }}%</strong>
        </div>
      </section>

      <section class="semantic-route" aria-label="非地理交接路径">
        <div class="route-section-heading">
          <div>
            <p>CHAIN OF CUSTODY</p>
            <h3>非地理交接路径</h3>
          </div>
          <span class="route-progress-label">{{ progress.label }}</span>
        </div>
        <div class="route-progress-track" aria-hidden="true">
          <span :style="{ width: progress.percent + '%' }"></span>
        </div>

        <ol class="handoff-route-nodes">
          <li v-for="(node, index) in routeNodes" :key="node.id" :class="['handoff-route-node', 'is-' + node.state]">
            <span class="route-node-index">{{ index + 1 }}</span>
            <div>
              <p>{{ node.title }}</p>
              <strong>{{ node.participant }}</strong>
              <small>任务 {{ node.taskId }} · {{ node.stateLabel }}</small>
              <time v-if="node.timestamp">交接时间：{{ formatTime(node.timestamp) }}</time>
              <time v-else>后端暂无该节点交接时间</time>
            </div>
          </li>
        </ol>
      </section>

      <section v-if="gnssTrajectory.available" class="gnss-trajectory-state" aria-label="真实 GNSS 轨迹">
        <div class="route-section-heading">
          <div>
            <p>REAL TELEMETRY COORDINATES</p>
            <h3>{{ gnssTrajectory.title }}</h3>
          </div>
          <span class="route-progress-label">{{ gnssTrajectory.points.length }} 个定位点</span>
        </div>
        <p class="gnss-trajectory-note">{{ gnssTrajectory.message }}</p>
        <div class="gnss-trajectory-canvas" aria-label="真实坐标相对投影">
          <svg viewBox="0 0 640 260" role="img" aria-label="GNSS 相对轨迹图">
            <polyline v-if="projectedGnssPoints.length > 1" :points="gnssSvgPoints" />
            <circle
              v-for="(point, index) in projectedGnssPoints"
              :key="point.id"
              :cx="point.x"
              :cy="point.y"
              :class="{ 'is-first': index === 0, 'is-last': index === projectedGnssPoints.length - 1 }"
              r="5"
            />
          </svg>
          <span class="gnss-canvas-caption">相对投影 · 北向上 · 不使用 Mock 坐标或参与方地址</span>
        </div>
        <ol class="gnss-coordinate-list">
          <li v-for="(point, index) in gnssTrajectory.points" :key="point.id">
            <b>{{ String(index + 1).padStart(2, '0') }}</b>
            <span class="mono">{{ point.lat.toFixed(6) }}, {{ point.lng.toFixed(6) }}</span>
            <time>{{ formatTime(point.timestamp) }}</time>
            <em>{{ point.accuracy === null ? '精度未上报' : `精度约 ${point.accuracy} m` }}</em>
          </li>
        </ol>
      </section>

      <section v-else class="gnss-empty-state" data-testid="gnss-empty-state" role="status" aria-live="polite">
        <div class="gnss-empty-icon" aria-hidden="true">⌁</div>
        <div>
          <p>MAP DATA UNAVAILABLE</p>
          <h3>{{ gnssEmptyState.title }}</h3>
          <strong>{{ gnssEmptyState.message }}</strong>
          <p>
            如需显示真实地图轨迹，硬件与后端定位/轨迹数据需提供实际采集的
            <code v-for="field in gnssEmptyState.requiredFields" :key="field">{{ field }}</code>
            字段；在接口提供前，本页只展示非地理交接路径。
          </p>
        </div>
      </section>
    </div>

    <AsyncStatePanel
      v-else
      :state="store.monitoringError ? 'offline' : 'error'"
      title="暂无任务数据，无法生成交接路径"
      description="恢复连接后可重新加载；没有 GNSS 数据时仍只显示非地理交接路径。"
      @retry="retryLoad"
    />
  </section>
</template>
