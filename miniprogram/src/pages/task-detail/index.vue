<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import StatusTag from '@/components/StatusTag.vue'
import StatePanel from '@/components/StatePanel.vue'
import { taskService } from '@/services/tasks'
import { errorMessage } from '@/services/request'
import type { Task, Telemetry } from '@/types/api'
import { canStartTask, formatTime } from '@/utils/status'

const taskId = ref('')
const task = ref<Task | null>(null)
const telemetry = ref<Telemetry | null>(null)
const loading = ref(true)
const error = ref('')
const canStart = computed(() => task.value ? canStartTask(task.value.status) : false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    [task.value, telemetry.value] = await Promise.all([
      taskService.getTask(taskId.value),
      taskService.getLatestTelemetry(taskId.value),
    ])
  } catch (e) { error.value = errorMessage(e) }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

function handoff() {
  uni.navigateTo({ url: `/pages/handoff/index?task_id=${encodeURIComponent(taskId.value)}` })
}

onLoad((query) => {
  taskId.value = String(query?.task_id || '')
  if (!taskId.value) { error.value = '缺少 task_id'; loading.value = false; return }
  load()
})
onPullDownRefresh(load)
</script>

<template>
  <view class="page detail-page">
    <StatePanel v-if="loading" state="loading" />
    <StatePanel v-else-if="error" state="error" :message="error" @retry="load" />

    <template v-else-if="task">
      <view class="card hero-card">
        <view class="accent" />
        <view class="row hero-top">
          <view class="task-code">任务 {{ task.task_id }}</view>
          <StatusTag :status="task.status" />
        </view>
        <view class="sample-name">{{ task.sample_name }}</view>

        <view class="metric-grid">
          <view class="metric-box">
            <view class="metric-label">温度</view>
            <view class="metric-value">{{ telemetry ? telemetry.temperature : '--' }}<text v-if="telemetry" class="unit">℃</text></view>
            <view class="metric-status">{{ telemetry?.temp_status || '等待设备上传' }}</view>
          </view>
          <view class="divider" />
          <view class="metric-box">
            <view class="metric-label">湿度</view>
            <view class="metric-value">{{ telemetry ? telemetry.humidity : '--' }}<text v-if="telemetry" class="unit">%</text></view>
            <view class="metric-status">{{ telemetry ? '实时数据' : '等待设备上传' }}</view>
          </view>
        </view>

        <view class="route-line-text">
          <text>{{ task.sender }}</text><text class="arrow">→</text><text>{{ task.receiver }}</text>
        </view>
        <view class="updated">更新于 {{ formatTime(task.updated_at) }}</view>
      </view>

      <view v-if="!telemetry" class="empty-strip">暂无设备数据，等待设备上传…</view>

      <view class="card status-card">
        <view class="section-heading">
          <view class="section-title">设备状态</view>
          <view class="refresh" @tap="load">刷新</view>
        </view>
        <view class="status-grid">
          <view class="status-box"><view class="box-label">箱体</view><view class="box-value">{{ telemetry?.box_status || '--' }}</view><view class="box-hint">{{ telemetry ? '实时状态' : '—' }}</view></view>
          <view class="status-box"><view class="box-label">运动</view><view class="box-value">{{ telemetry?.move_status || '--' }}</view><view class="box-hint">{{ telemetry ? '实时状态' : '—' }}</view></view>
          <view class="status-box"><view class="box-label">设备</view><view class="box-value">{{ task.device_id }}</view><view class="box-hint">承运 {{ task.carrier }}</view></view>
        </view>
      </view>

      <view class="card info-card">
        <view class="section-heading"><view class="section-title">交接信息</view><view class="section-hint">任务档案</view></view>
        <view class="info-row"><view class="info-icon purple">发</view><view><view class="info-label">发出单位</view><view class="info-value">{{ task.sender }}</view></view></view>
        <view class="info-row"><view class="info-icon green">收</view><view><view class="info-label">接收单位</view><view class="info-value">{{ task.receiver }}</view></view></view>
        <view class="info-row"><view class="info-icon blue">时</view><view><view class="info-label">发出时间</view><view class="info-value">{{ formatTime(task.started_at) }}</view></view></view>
      </view>

      <button v-if="canStart" class="primary action-button" @tap="handoff">进入发出交接</button>
    </template>
  </view>
</template>

<style scoped>
.detail-page { background: #f4f7fb; }.hero-card { padding: 32rpx 34rpx 30rpx 42rpx; }.accent { position: absolute; left: 0; top: 0; bottom: 0; width: 8rpx; background: #6558ff; }.hero-top { margin-bottom: 5rpx; }.task-code { color: #8b9bb0; font-size: 24rpx; }.sample-name { color: #102a43; font-size: 40rpx; font-weight: 800; line-height: 1.35; }
.metric-grid { display: grid; grid-template-columns: 1fr 1rpx 1fr; gap: 28rpx; margin: 36rpx 0 30rpx; }.divider { background: #e8edf4; }.metric-label { margin-bottom: 12rpx; color: #8a9aaf; font-size: 24rpx; }.metric-value { color: #17334d; font-size: 44rpx; font-weight: 760; }.unit { margin-left: 6rpx; color: #8898ac; font-size: 24rpx; font-weight: 500; }.metric-status { margin-top: 8rpx; color: #a1adbd; font-size: 21rpx; }
.route-line-text { display: flex; align-items: center; gap: 14rpx; color: #63778f; font-size: 27rpx; }.arrow { color: #9caabd; }.updated { margin-top: 10rpx; color: #a6b1c0; font-size: 22rpx; }.empty-strip { margin: 0 0 22rpx; padding: 20rpx 24rpx; border-radius: 16rpx; color: #8999ae; background: #eef2f8; font-size: 24rpx; }
.refresh { color: #6558ff; font-size: 25rpx; }.status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; }.status-box { min-width: 0; min-height: 140rpx; padding: 22rpx 18rpx; box-sizing: border-box; border-radius: 18rpx; background: #f2f5fa; }.box-label { color: #8e9db0; font-size: 23rpx; }.box-value { margin: 14rpx 0 6rpx; overflow: hidden; color: #455a72; font-size: 27rpx; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }.box-hint { overflow: hidden; color: #a1adbd; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.info-row { display: flex; align-items: center; gap: 20rpx; padding: 20rpx 0; border-top: 1rpx solid #eef1f6; }.info-icon { display: flex; align-items: center; justify-content: center; width: 62rpx; height: 62rpx; flex: 0 0 auto; border-radius: 18rpx; font-size: 23rpx; font-weight: 720; }.purple { color: #6255f6; background: #efedff; }.green { color: #29996b; background: #e8f7ef; }.blue { color: #247ca7; background: #e7f5fb; }.info-label { color: #98a6b7; font-size: 22rpx; }.info-value { margin-top: 4rpx; color: #41566e; font-size: 27rpx; font-weight: 620; }.action-button { margin-top: 30rpx; }
</style>
