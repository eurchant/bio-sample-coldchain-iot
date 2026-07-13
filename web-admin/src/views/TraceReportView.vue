<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { formatTime, formatValue, statusTone, taskLabel, temperatureLabel } from '../lib/format'
import { useTaskStore } from '../stores/task'

const route = useRoute()
const store = useTaskStore()
const report = computed(() => store.trace)
const routeTaskId = computed(() => String(route.params.taskId || ''))

const handoffLabel: Record<string, string> = {
  started: '发出交接',
  signed: '到达签收',
  rejected: '到达拒收',
}

onMounted(() => {
  void store.loadTrace()
})

function printReport() {
  window.print()
}
</script>

<template>
  <section class="page-section trace-page">
    <div class="page-heading print-hidden">
      <div>
        <p class="section-kicker">03 / TRUSTED TRACE REPORT</p>
        <h2>可信追溯报告</h2>
        <p>报告数据直接来自后端聚合接口，可用于比赛现场投屏和查询对照。</p>
      </div>
      <div class="heading-actions">
        <button class="ghost-button" type="button" @click="store.loadTrace()" :disabled="store.traceLoading">
          {{ store.traceLoading ? '生成中…' : '刷新报告' }}
        </button>
        <button class="print-button" type="button" @click="printReport">打印视图</button>
      </div>
    </div>

    <div v-if="store.traceLoading && !report" class="state-panel">
      <span class="loader"></span>
      正在汇总追溯报告…
    </div>

    <article v-else-if="report" class="trace-document">
      <header class="report-header">
        <div>
          <p>CHAIN OF CUSTODY / MVP REPORT</p>
          <h3>生物样本冷链转运可信追溯单</h3>
        </div>
        <div class="report-id">
          <span>任务编号</span>
          <strong class="mono">{{ report.task.task_id }}</strong>
          <small>页面路由：{{ routeTaskId }}</small>
        </div>
      </header>

      <section class="report-task-strip">
        <div><span>样本 / 载体</span><strong>{{ report.task.sample_name }}</strong></div>
        <div><span>绑定设备</span><strong class="mono">{{ report.task.device_id || '未绑定' }}</strong></div>
        <div><span>承运人员</span><strong>{{ report.task.carrier }}</strong></div>
        <div><span>最终状态</span><em class="status-chip" :data-tone="statusTone(report.task.status)">{{ taskLabel(report.task.status) }}</em></div>
      </section>

      <section class="report-section">
        <div class="report-section-title">
          <span>01</span>
          <div><p>TRANSFER PATH</p><h4>交接路径</h4></div>
        </div>
        <div class="report-route">
          <div><span>发出单位</span><strong>{{ report.task.sender }}</strong></div>
          <i></i>
          <div><span>接收单位</span><strong>{{ report.task.receiver }}</strong></div>
        </div>
        <div class="trace-node-list">
          <div v-if="!report.handoff_nodes.length" class="compact-empty">尚未生成交接节点。</div>
          <div v-for="node in report.handoff_nodes" :key="node.type + node.timestamp" class="trace-node">
            <span></span>
            <div>
              <strong>{{ handoffLabel[node.type] || node.type }}</strong>
              <p>{{ formatTime(node.timestamp) }}<template v-if="node.reason"> · {{ node.reason }}</template></p>
            </div>
          </div>
        </div>
      </section>

      <section class="report-section evidence-section">
        <div class="report-section-title">
          <span>02</span>
          <div><p>ENVIRONMENTAL EVIDENCE</p><h4>环境证据摘要</h4></div>
        </div>
        <div class="evidence-grid">
          <div>
            <span>监测记录</span>
            <strong>{{ report.summary.total_records }}</strong>
            <small>条有效上报</small>
          </div>
          <div>
            <span>平均温度</span>
            <strong>{{ formatValue(report.summary.avg_temperature) }}<small>°C</small></strong>
            <small>温度区间 {{ formatValue(report.summary.min_temperature) }} — {{ formatValue(report.summary.max_temperature) }}</small>
          </div>
          <div>
            <span>湿度区间</span>
            <strong>{{ formatValue(report.summary.min_humidity) }}<small>%RH</small></strong>
            <small>最高 {{ formatValue(report.summary.max_humidity) }} %RH</small>
          </div>
          <div>
            <span>异常事件</span>
            <strong :data-tone="report.summary.event_count ? 'danger' : 'safe'">{{ report.summary.event_count }}</strong>
            <small>由后端记录</small>
          </div>
        </div>
        <div v-if="report.latest" class="latest-evidence">
          <span>最新一条证据</span>
          <strong>{{ formatTime(report.latest.timestamp) }}</strong>
          <p>
            {{ formatValue(report.latest.temperature) }} °C · {{ formatValue(report.latest.humidity) }} %RH ·
            <b :data-tone="statusTone(report.latest.temp_status)">{{ temperatureLabel(report.latest.temp_status) }}</b>
          </p>
        </div>
      </section>

      <section class="report-section">
        <div class="report-section-title">
          <span>03</span>
          <div><p>EXCEPTION LEDGER</p><h4>异常事件账本</h4></div>
        </div>
        <div v-if="report.events.length" class="report-event-list">
          <div v-for="event in report.events" :key="event.id" class="report-event">
            <span>{{ event.event_type }}</span>
            <div><strong>{{ event.event_name }}</strong><p>{{ event.event_detail }}</p></div>
            <time>{{ formatTime(event.timestamp) }}</time>
          </div>
        </div>
        <div v-else class="compact-empty">本次任务尚无异常事件。</div>
      </section>

      <footer class="report-footer">
        <span>数据依据：/api/v1/tasks/{task_id}/trace-report</span>
        <span>生成时间：{{ formatTime(report.task.updated_at) }}</span>
      </footer>
    </article>

    <div v-else class="state-panel is-error">报告暂不可用，请检查 API 或 Mock 数据后重试。</div>
  </section>
</template>
