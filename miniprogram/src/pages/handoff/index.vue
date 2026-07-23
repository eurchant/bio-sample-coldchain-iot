<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import StatePanel from '@/components/StatePanel.vue'
import StatusTag from '@/components/StatusTag.vue'
import { taskService } from '@/services/tasks'
import { errorMessage } from '@/services/request'
import type { Task, Telemetry } from '@/types/api'
import { canStartTask } from '@/utils/status'

const taskId = ref('')
const task = ref<Task | null>(null)
const telemetry = ref<Telemetry | null>(null)
const note = ref('')
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const confirmVisible = ref(false)
const allowed = computed(() => task.value ? canStartTask(task.value.status) : false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    [task.value, telemetry.value] = await Promise.all([
      taskService.getTask(taskId.value),
      taskService.getLatestTelemetry(taskId.value),
    ])
  } catch (e) { error.value = errorMessage(e) }
  finally { loading.value = false }
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    await taskService.startTask(taskId.value)
    task.value = await taskService.getTask(taskId.value)
    confirmVisible.value = false
    uni.showToast({ title: '发出成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 700)
  } catch (e) {
    confirmVisible.value = false
    uni.showToast({ title: errorMessage(e), icon: 'none', duration: 2600 })
  } finally { submitting.value = false }
}

onLoad((query) => {
  taskId.value = String(query?.task_id || '')
  if (taskId.value) load()
  else { loading.value = false; error.value = '缺少 task_id' }
})
</script>

<template>
  <view class="page handoff-page">
    <StatePanel v-if="loading" state="loading" />
    <StatePanel v-else-if="error" state="error" :message="error" @retry="load" />

    <template v-else-if="task">
      <view class="progress-card">
        <view class="progress-step done"><view class="step-dot">✓</view><text>任务确认</text></view>
        <view class="progress-line" />
        <view class="progress-step current"><view class="step-dot">2</view><text>发出交接</text></view>
        <view class="progress-line muted-line" />
        <view class="progress-step"><view class="step-dot">3</view><text>运输监控</text></view>
      </view>

      <view class="card summary-card">
        <view class="row"><view class="task-code">任务 {{ task.task_id }}</view><StatusTag :status="task.status" /></view>
        <view class="sample-name">{{ task.sample_name }}</view>
        <view class="route"><text>{{ task.sender }}</text><text class="arrow">→</text><text>{{ task.receiver }}</text></view>
      </view>

      <view class="card check-card">
        <view class="section-heading"><view class="section-title">交接核对</view><view class="section-hint">请确认信息无误</view></view>
        <view class="check-row"><view class="check-icon">✓</view><view class="check-content"><view class="check-label">绑定设备</view><view class="check-value">{{ task.device_id }}</view></view></view>
        <view class="check-row"><view class="check-icon">✓</view><view class="check-content"><view class="check-label">承运人员</view><view class="check-value">{{ task.carrier }}</view></view></view>
        <view class="check-row"><view class="check-icon" :class="{ warning: !telemetry }">{{ telemetry ? '✓' : '!' }}</view><view class="check-content"><view class="check-label">初始设备数据</view><view v-if="telemetry" class="check-value">{{ telemetry.temperature }}℃ · 湿度 {{ telemetry.humidity }}% · {{ telemetry.box_status }}</view><view v-else class="check-value warning-text">暂无数据，请确认设备状态</view></view></view>
      </view>

      <view class="card note-card">
        <view class="section-heading"><view class="section-title">交接备注</view><view class="section-hint">选填</view></view>
        <textarea v-model="note" maxlength="200" placeholder="记录本次交接需要说明的事项…" class="textarea" />
        <view class="note-footer"><text>备注仅用于本地核对，当前契约不会上传</text><text>{{ note.length }}/200</text></view>
      </view>

      <button class="primary submit-button" :disabled="!allowed || submitting" @tap="confirmVisible = true">
        {{ allowed ? '确认发出交接' : '当前状态不可发出' }}
      </button>

      <ConfirmDialog
        :visible="confirmVisible"
        title="确认发出交接？"
        :content="`任务 ${task.task_id} 发出后将由后端流转为运输中。${note ? '已填写本地核对备注。' : ''}`"
        :loading="submitting"
        @cancel="confirmVisible = false"
        @confirm="submit"
      />
    </template>
  </view>
</template>

<style scoped>
.handoff-page { background: linear-gradient(180deg, #f7f6ff 0, #f4f7fb 280rpx); }.progress-card { display: flex; align-items: flex-start; padding: 26rpx 12rpx 34rpx; }.progress-step { width: 116rpx; flex: 0 0 auto; color: #9aa8ba; text-align: center; font-size: 21rpx; }.step-dot { display: flex; align-items: center; justify-content: center; width: 48rpx; height: 48rpx; margin: 0 auto 10rpx; border: 4rpx solid #d8dee8; border-radius: 50%; box-sizing: border-box; color: #a4b0c0; background: #fff; font-size: 21rpx; font-weight: 700; }.progress-step.done, .progress-step.current { color: #6255f6; }.done .step-dot { color: #fff; border-color: #6558ff; background: #6558ff; }.current .step-dot { color: #6558ff; border-color: #6558ff; }.progress-line { flex: 1; height: 4rpx; margin-top: 22rpx; background: #6558ff; }.muted-line { background: #dfe4ec; }
.summary-card { border-color: #e4e0ff; background: linear-gradient(145deg, #fff, #faf9ff); }.task-code { color: #8c9bb0; font-size: 24rpx; }.sample-name { margin: 12rpx 0 22rpx; color: #102a43; font-size: 38rpx; font-weight: 780; }.route { display: flex; gap: 14rpx; color: #63778f; font-size: 26rpx; }.arrow { color: #9caabd; }
.check-row { display: flex; align-items: center; gap: 20rpx; padding: 22rpx 0; border-top: 1rpx solid #eef1f6; }.check-icon { display: flex; align-items: center; justify-content: center; width: 52rpx; height: 52rpx; flex: 0 0 auto; border-radius: 17rpx; color: #fff; background: #62b894; font-size: 24rpx; font-weight: 700; }.check-icon.warning { background: #f2b84b; }.check-content { flex: 1; min-width: 0; }.check-label { color: #94a2b4; font-size: 22rpx; }.check-value { margin-top: 5rpx; color: #40566e; font-size: 27rpx; font-weight: 620; }.warning-text { color: #b47b18; }
.textarea { width: 100%; height: 190rpx; padding: 24rpx; box-sizing: border-box; border: 1rpx solid #e8ecf3; border-radius: 18rpx; color: #40566e; background: #f5f7fb; line-height: 1.6; }.note-footer { display: flex; justify-content: space-between; gap: 18rpx; margin-top: 14rpx; color: #a0adbd; font-size: 20rpx; }.submit-button { margin-top: 30rpx; }
</style>
