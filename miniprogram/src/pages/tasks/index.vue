<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import StatusTag from '@/components/StatusTag.vue'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/stores/session'
import { taskService } from '@/services/tasks'
import { errorMessage } from '@/services/request'
import type { Task, TaskStatus } from '@/types/api'
import { formatTime } from '@/utils/status'

const session = useSessionStore()
const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref('')
const filter = ref<'all' | TaskStatus>('all')
const filtered = computed(() => filter.value === 'all' ? tasks.value : tasks.value.filter((task) => task.status === filter.value))
const filters: Array<{ value: 'all' | TaskStatus; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending_handoff', label: '待发出' },
  { value: 'in_transit', label: '运输中' },
  { value: 'signed', label: '已签收' },
  { value: 'rejected', label: '已拒收' },
]

async function load() {
  loading.value = true
  error.value = ''
  try { tasks.value = await taskService.listDemoTasks() }
  catch (e) { error.value = errorMessage(e) }
  finally { loading.value = false; uni.stopPullDownRefresh() }
}

function open(task: Task) {
  uni.navigateTo({ url: `/pages/task-detail/index?task_id=${encodeURIComponent(task.task_id)}` })
}

onLoad(() => { if (session.requireSession()) load() })
onShow(() => { if (session.isAuthenticated && !loading.value) load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page tasks-page">
    <view class="topbar">
      <view>
        <view class="welcome">你好，{{ session.user?.name }}</view>
        <view class="title">我的转运任务</view>
      </view>
      <button class="avatar" @tap="session.logout">退出</button>
    </view>

    <view class="overview-card">
      <view class="overview-copy">
        <view class="overview-label">当前任务</view>
        <view class="overview-number">{{ tasks.length }}</view>
        <view class="overview-hint">下拉页面可刷新最新状态</view>
      </view>
      <view class="overview-visual">
        <view class="ring ring-large" /><view class="ring ring-small" />
        <view class="box-icon">↗</view>
      </view>
    </view>

    <scroll-view scroll-x class="filters" :show-scrollbar="false">
      <view class="filter-row">
        <view v-for="item in filters" :key="item.value" class="filter" :class="{ selected: filter === item.value }" @tap="filter = item.value">{{ item.label }}</view>
      </view>
    </scroll-view>

    <view class="section-heading list-heading">
      <view class="section-title">任务列表</view>
      <view class="section-hint">{{ filtered.length }} 项</view>
    </view>

    <StatePanel v-if="loading" state="loading" />
    <StatePanel v-else-if="error" state="error" :message="error" @retry="load" />
    <StatePanel v-else-if="!filtered.length" state="empty" message="当前筛选条件下暂无任务" />

    <view v-for="task in filtered" v-else :key="task.task_id" class="card task-card" @tap="open(task)">
      <view class="accent" />
      <view class="row task-top">
        <view class="task-code">任务 {{ task.task_id }}</view>
        <StatusTag :status="task.status" />
      </view>
      <view class="sample-name">{{ task.sample_name }}</view>
      <view class="route">
        <view class="route-point start" />
        <text>{{ task.sender }}</text>
        <view class="route-line"><view class="route-arrow">›</view></view>
        <view class="route-point end" />
        <text>{{ task.receiver }}</text>
      </view>
      <view class="task-footer">
        <view class="device-chip">设备 {{ task.device_id }}</view>
        <view class="updated">更新于 {{ formatTime(task.updated_at) }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.tasks-page { background: linear-gradient(180deg, #fff 0, #f4f7fb 300rpx); }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 4rpx 32rpx; }
.welcome { margin-bottom: 7rpx; color: #8b9bb0; font-size: 24rpx; }.topbar .title { margin: 0; }
.avatar { width: 76rpx; height: 76rpx; margin: 0; padding: 0; border: 0; border-radius: 24rpx; color: #6457f6; background: #efedff; font-size: 23rpx; font-weight: 650; line-height: 76rpx; }
.overview-card { position: relative; display: flex; justify-content: space-between; min-height: 196rpx; margin-bottom: 28rpx; padding: 30rpx 34rpx; box-sizing: border-box; overflow: hidden; border-radius: 28rpx; color: #fff; background: linear-gradient(135deg, #7567ff 0%, #5146f6 100%); box-shadow: 0 18rpx 34rpx rgba(91,77,247,.24); }
.overview-label { font-size: 25rpx; opacity: .8; }.overview-number { margin: 2rpx 0; font-size: 62rpx; font-weight: 800; line-height: 1.15; }.overview-hint { font-size: 22rpx; opacity: .72; }
.overview-visual { position: relative; width: 180rpx; }.ring { position: absolute; border: 2rpx solid rgba(255,255,255,.18); border-radius: 50%; }.ring-large { width: 190rpx; height: 190rpx; right: -60rpx; top: -26rpx; }.ring-small { width: 120rpx; height: 120rpx; right: -8rpx; top: 12rpx; }.box-icon { position: absolute; right: 34rpx; top: 38rpx; display: flex; align-items: center; justify-content: center; width: 76rpx; height: 76rpx; border-radius: 24rpx; color: #6457f6; background: rgba(255,255,255,.94); font-size: 44rpx; font-weight: 600; }
.filters { width: 100%; margin: 2rpx 0 30rpx; white-space: nowrap; }.filter-row { display: flex; gap: 14rpx; }.filter { padding: 14rpx 27rpx; border-radius: 999rpx; color: #8292a7; background: #e9eef5; font-size: 25rpx; }.filter.selected { color: #fff; background: #6558ff; box-shadow: 0 8rpx 16rpx rgba(91,77,247,.18); }
.list-heading { padding: 0 4rpx; }.task-card { padding: 30rpx 30rpx 26rpx 38rpx; }.accent { position: absolute; left: 0; top: 0; bottom: 0; width: 8rpx; background: linear-gradient(180deg, #7668ff, #5146f6); }.task-top { margin-bottom: 8rpx; }.task-code { color: #8c9bb0; font-size: 24rpx; }.sample-name { color: #102a43; font-size: 36rpx; font-weight: 780; line-height: 1.4; }
.route { display: flex; align-items: center; gap: 10rpx; margin: 26rpx 0; color: #63778f; font-size: 25rpx; }.route-point { width: 12rpx; height: 12rpx; flex: 0 0 auto; border-radius: 50%; background: #6558ff; }.route-point.end { background: #72c9ae; }.route-line { position: relative; flex: 1; min-width: 34rpx; height: 2rpx; margin: 0 2rpx; background: #dfe4ec; }.route-arrow { position: absolute; right: -2rpx; top: -19rpx; color: #a9b4c3; font-size: 34rpx; }
.task-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 22rpx; border-top: 1rpx solid #edf1f6; }.device-chip { padding: 8rpx 15rpx; border-radius: 10rpx; color: #6255f6; background: #f0eeff; font-size: 22rpx; }.updated { color: #a0adbd; font-size: 21rpx; }
</style>
