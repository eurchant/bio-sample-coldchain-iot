<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AsyncStatePanel from '../components/AsyncStatePanel.vue'
import {
  buildHandoffRouteNodes,
  getGnssTrajectoryEmptyState,
  getHandoffProgress,
} from '../lib/route'
import { formatTime, taskLabel } from '../lib/format'
import { useTaskStore } from '../stores/task'

const store = useTaskStore()
const task = computed(() => store.task)
const progress = computed(() => (task.value ? getHandoffProgress(task.value.status) : null))
const routeNodes = computed(() =>
  task.value ? buildHandoffRouteNodes(task.value, store.trace?.handoff_nodes ?? []) : [],
)
const gnssEmptyState = getGnssTrajectoryEmptyState()

onMounted(() => {
  if (!store.task && !store.loading) void store.bootstrap()
  if (!store.trace && !store.traceLoading) void store.loadTrace()
})

function retryLoad() {
  void Promise.all([store.bootstrap(), store.loadTrace()])
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

      <section class="gnss-empty-state" data-testid="gnss-empty-state" role="status" aria-live="polite">
        <div class="gnss-empty-icon" aria-hidden="true">⌁</div>
        <div>
          <p>MAP DATA UNAVAILABLE</p>
          <h3>{{ gnssEmptyState.title }}</h3>
          <strong>{{ gnssEmptyState.message }}</strong>
          <p>
            如需显示真实地图轨迹，后端定位/轨迹数据需提供实际采集的
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
