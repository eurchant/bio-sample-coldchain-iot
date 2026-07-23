<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import StatusTag from '@/components/StatusTag.vue'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/stores/session'
import { taskService } from '@/services/tasks'
import { errorMessage } from '@/services/request'
import type { Task, TaskStatus } from '@/types/api'
import { canStartTask, formatTime } from '@/utils/status'

const session = useSessionStore()
const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const filter = ref<'all' | TaskStatus>('all')

const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return tasks.value.filter((task) => {
    const matchesStatus = filter.value === 'all' || task.status === filter.value
    const matchesQuery = !query || [task.task_id, task.sample_name, task.device_id, task.sender, task.receiver]
      .some((value) => value.toLowerCase().includes(query))
    return matchesStatus && matchesQuery
  })
})

const featuredTask = computed(() => filtered.value[0] || null)
const quickFilters: Array<{ value: 'all' | TaskStatus; label: string; short: string; tone: string }> = [
  { value: 'all', label: '全部任务', short: '全', tone: 'purple' },
  { value: 'pending_handoff', label: '待发出', short: '发', tone: 'orange' },
  { value: 'in_transit', label: '运输中', short: '运', tone: 'blue' },
  { value: 'signed', label: '已签收', short: '收', tone: 'green' },
]

function countBy(status: 'all' | TaskStatus) {
  return status === 'all' ? tasks.value.length : tasks.value.filter((task) => task.status === status).length
}

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

function openHandoff() {
  const task = tasks.value.find((item) => canStartTask(item.status))
  if (!task) {
    uni.showToast({ title: '当前没有待发出的任务', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/handoff/index?task_id=${encodeURIComponent(task.task_id)}` })
}

onLoad(() => { if (session.requireSession()) load() })
onShow(() => { if (session.isAuthenticated && !loading.value) load() })
onPullDownRefresh(load)
</script>

<template>
  <view class="page dashboard-page">
    <view class="header">
      <view class="profile">
        <view class="profile-avatar">{{ session.user?.name.slice(0, 1) }}</view>
        <view>
          <view class="hello">你好，{{ session.user?.name }}</view>
          <view class="greeting">今日转运顺利</view>
        </view>
      </view>
      <view class="notification" @tap="load">
        <view class="bell">⌁</view>
        <view class="notification-dot" />
      </view>
    </view>

    <view class="search-row">
      <view class="search-box">
        <view class="search-icon" />
        <input v-model="keyword" class="search-input" placeholder="搜索任务、样本或设备" placeholder-class="search-placeholder" />
      </view>
      <view class="filter-button" @tap="filter = 'all'">
        <view class="slider-line line-one"><view class="slider-dot" /></view>
        <view class="slider-line line-two"><view class="slider-dot" /></view>
        <view class="slider-line line-three"><view class="slider-dot" /></view>
      </view>
    </view>

    <view class="section-bar">
      <view class="dashboard-title">快速查看</view>
      <view class="show-all" @tap="filter = 'all'">查看全部</view>
    </view>

    <view class="quick-card">
      <scroll-view scroll-x class="quick-scroll" :show-scrollbar="false">
        <view class="quick-list">
          <view
            v-for="item in quickFilters"
            :key="item.value"
            class="quick-item"
            :class="{ active: filter === item.value }"
            @tap="filter = item.value"
          >
            <view class="quick-icon" :class="item.tone">{{ item.short }}</view>
            <view class="quick-label">{{ item.label }}</view>
            <view class="quick-count">{{ countBy(item.value) }} 项</view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section-bar recommended-heading">
      <view class="dashboard-title">重点任务</view>
      <view class="show-all">{{ filtered.length }} 项</view>
    </view>

    <StatePanel v-if="loading" state="loading" />
    <StatePanel v-else-if="error" state="error" :message="error" @retry="load" />
    <StatePanel v-else-if="!featuredTask" state="empty" message="没有找到符合条件的任务" />

    <view v-else-if="featuredTask" class="featured-card" @tap="open(featuredTask)">
      <view class="featured-visual">
        <view class="visual-circle circle-one" />
        <view class="visual-circle circle-two" />
        <view class="cold-box">
          <view class="box-lid" />
          <view class="box-body">+</view>
        </view>
        <view class="visual-copy">
          <view class="visual-label">BIO SAMPLE</view>
          <view class="visual-title">可信冷链转运</view>
          <view class="visual-subtitle">全程记录 · 安全交接</view>
        </view>
        <view class="favorite">◇</view>
      </view>

      <view class="featured-content">
        <view class="row">
          <view>
            <view class="featured-code">任务 {{ featuredTask.task_id }}</view>
            <view class="featured-name">{{ featuredTask.sample_name }}</view>
          </view>
          <StatusTag :status="featuredTask.status" />
        </view>

        <view class="featured-route">
          <view class="route-node"><view class="route-dot start" /><view><view class="route-caption">发出</view><view class="route-place">{{ featuredTask.sender }}</view></view></view>
          <view class="route-track"><view class="moving-dot" /></view>
          <view class="route-node end-node"><view class="route-dot end" /><view><view class="route-caption">接收</view><view class="route-place">{{ featuredTask.receiver }}</view></view></view>
        </view>

        <view class="featured-footer">
          <view><view class="footer-label">绑定设备</view><view class="footer-value">{{ featuredTask.device_id }}</view></view>
          <view class="footer-right"><view class="footer-label">最后更新</view><view class="footer-value small-value">{{ formatTime(featuredTask.updated_at) }}</view></view>
        </view>
      </view>
    </view>

    <view v-if="filtered.length > 1" class="more-list">
      <view v-for="task in filtered.slice(1)" :key="task.task_id" class="compact-task" @tap="open(task)">
        <view class="compact-icon">冷</view>
        <view class="compact-content"><view class="compact-name">{{ task.sample_name }}</view><view class="compact-code">{{ task.task_id }} · {{ task.device_id }}</view></view>
        <StatusTag :status="task.status" />
      </view>
    </view>

    <view class="bottom-space" />
    <view class="bottom-nav">
      <view class="nav-item active"><view class="nav-icon home-icon"><view class="home-roof" /></view><text>任务</text></view>
      <view class="nav-item" @tap="openHandoff"><view class="nav-icon handoff-icon">✓</view><text>交接</text></view>
      <view class="nav-item" @tap="load"><view class="nav-icon refresh-icon">↻</view><text>刷新</text></view>
      <view class="nav-item" @tap="session.logout"><view class="nav-icon user-icon"><view class="user-head" /><view class="user-body" /></view><text>退出</text></view>
    </view>
  </view>
</template>

<style scoped>
.dashboard-page { padding: 34rpx 30rpx 0; background: linear-gradient(180deg, #eef4ff 0, #f6f8fc 510rpx); }
.header { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 4rpx 38rpx; }.profile { display: flex; align-items: center; gap: 20rpx; }.profile-avatar { display: flex; align-items: center; justify-content: center; width: 78rpx; height: 78rpx; border: 5rpx solid rgba(255,255,255,.85); border-radius: 50%; color: #fff; background: linear-gradient(145deg, #263b5b, #6e7c91); box-shadow: 0 8rpx 20rpx rgba(34,52,82,.16); font-size: 30rpx; font-weight: 750; }.hello { color: #64748a; font-size: 23rpx; }.greeting { margin-top: 5rpx; color: #132b43; font-size: 37rpx; font-weight: 800; }.notification { position: relative; display: flex; align-items: center; justify-content: center; width: 72rpx; height: 72rpx; border-radius: 23rpx; background: rgba(255,255,255,.72); }.bell { transform: rotate(-12deg); color: #53657b; font-size: 41rpx; font-weight: 700; }.notification-dot { position: absolute; right: 17rpx; top: 16rpx; width: 11rpx; height: 11rpx; border: 3rpx solid #fff; border-radius: 50%; background: #6558ff; }
.search-row { display: flex; gap: 18rpx; margin-bottom: 38rpx; }.search-box { display: flex; align-items: center; flex: 1; height: 94rpx; padding: 0 28rpx; box-sizing: border-box; border: 1rpx solid rgba(224,230,240,.8); border-radius: 25rpx; background: rgba(255,255,255,.94); box-shadow: 0 12rpx 26rpx rgba(60,74,104,.07); }.search-icon { position: relative; width: 28rpx; height: 28rpx; margin-right: 22rpx; border: 4rpx solid #a1adbd; border-radius: 50%; }.search-icon::after { position: absolute; right: -11rpx; bottom: -7rpx; width: 14rpx; height: 4rpx; border-radius: 2rpx; background: #a1adbd; content: ''; transform: rotate(45deg); }.search-input { flex: 1; color: #40566e; font-size: 27rpx; }.search-placeholder { color: #aab5c3; }.filter-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9rpx; width: 94rpx; height: 94rpx; border-radius: 26rpx; background: linear-gradient(145deg, #7567ff, #5146f6); box-shadow: 0 14rpx 26rpx rgba(91,77,247,.25); }.slider-line { position: relative; width: 40rpx; height: 3rpx; border-radius: 2rpx; background: rgba(255,255,255,.9); }.slider-dot { position: absolute; top: -5rpx; width: 13rpx; height: 13rpx; border: 3rpx solid #fff; border-radius: 50%; background: #6558ff; }.line-one .slider-dot, .line-three .slider-dot { right: 5rpx; }.line-two .slider-dot { left: 5rpx; }
.section-bar { display: flex; align-items: center; justify-content: space-between; padding: 0 2rpx; }.dashboard-title { color: #152c44; font-size: 37rpx; font-weight: 800; }.show-all { color: #8b96b0; font-size: 23rpx; }.quick-card { margin-top: 20rpx; padding: 25rpx 20rpx; overflow: hidden; border: 1rpx solid #e8edf4; border-radius: 28rpx; background: rgba(255,255,255,.92); box-shadow: 0 12rpx 30rpx rgba(40,55,86,.07); }.quick-scroll { width: 100%; white-space: nowrap; }.quick-list { display: flex; justify-content: space-between; min-width: 650rpx; }.quick-item { width: 132rpx; padding: 9rpx 4rpx; border: 2rpx solid transparent; border-radius: 22rpx; text-align: center; transition: .2s; }.quick-item.active { border-color: #e1ddff; background: #f7f5ff; }.quick-icon { display: flex; align-items: center; justify-content: center; width: 82rpx; height: 72rpx; margin: 0 auto 12rpx; border-radius: 22rpx; color: #fff; background: linear-gradient(145deg, #776aff, #5549ec); font-size: 28rpx; font-weight: 750; box-shadow: inset 0 0 0 1rpx rgba(255,255,255,.2); }.quick-icon.orange { background: linear-gradient(145deg, #f3b45d, #e88c45); }.quick-icon.blue { background: linear-gradient(145deg, #67b6e7, #4788d6); }.quick-icon.green { background: linear-gradient(145deg, #72c9ae, #48a482); }.quick-label { color: #40546c; font-size: 23rpx; font-weight: 650; }.quick-count { margin-top: 4rpx; color: #a2aebe; font-size: 20rpx; }.recommended-heading { margin-top: 42rpx; margin-bottom: 22rpx; }
.featured-card { overflow: hidden; margin: 0 12rpx; border: 1rpx solid #e5eaf2; border-radius: 30rpx; background: #fff; box-shadow: 0 18rpx 44rpx rgba(38,53,84,.12); }.featured-visual { position: relative; height: 310rpx; overflow: hidden; background: linear-gradient(145deg, #c9d9ff 0%, #a8bfff 48%, #7468e9 100%); }.visual-circle { position: absolute; border-radius: 50%; background: rgba(255,255,255,.17); }.circle-one { width: 350rpx; height: 350rpx; right: -80rpx; top: -110rpx; }.circle-two { width: 240rpx; height: 240rpx; left: -70rpx; bottom: -100rpx; }.cold-box { position: absolute; right: 60rpx; bottom: 38rpx; width: 190rpx; height: 132rpx; border-radius: 18rpx 18rpx 28rpx 28rpx; background: rgba(255,255,255,.92); box-shadow: 0 18rpx 28rpx rgba(59,57,126,.2); text-align: center; }.box-lid { position: absolute; left: -10rpx; top: -22rpx; width: 210rpx; height: 42rpx; border-radius: 16rpx; background: #eef2ff; box-shadow: 0 6rpx 10rpx rgba(59,57,126,.12); }.box-body { margin-top: 35rpx; color: #6558ff; font-size: 72rpx; font-weight: 300; }.visual-copy { position: absolute; left: 34rpx; top: 48rpx; color: #fff; }.visual-label { font-size: 18rpx; font-weight: 750; letter-spacing: 4rpx; opacity: .78; }.visual-title { margin-top: 12rpx; font-size: 36rpx; font-weight: 800; }.visual-subtitle { margin-top: 12rpx; font-size: 21rpx; opacity: .75; }.favorite { position: absolute; right: 22rpx; top: 22rpx; display: flex; align-items: center; justify-content: center; width: 58rpx; height: 58rpx; border-radius: 18rpx; color: #5d50ef; background: rgba(255,255,255,.9); font-size: 32rpx; font-weight: 750; }
.featured-content { padding: 28rpx 30rpx 26rpx; }.featured-code { color: #98a5b6; font-size: 21rpx; }.featured-name { margin-top: 5rpx; color: #172f47; font-size: 33rpx; font-weight: 780; }.featured-route { display: grid; grid-template-columns: 1fr 86rpx 1fr; align-items: center; margin: 30rpx 0; }.route-node { display: flex; align-items: center; gap: 11rpx; min-width: 0; }.end-node { justify-content: flex-end; text-align: right; }.route-dot { width: 13rpx; height: 13rpx; flex: 0 0 auto; border: 4rpx solid #dedaff; border-radius: 50%; background: #6558ff; }.route-dot.end { border-color: #d7f2e8; background: #54ae8c; }.route-caption { color: #a0acbc; font-size: 19rpx; }.route-place { max-width: 190rpx; margin-top: 3rpx; overflow: hidden; color: #556a81; font-size: 23rpx; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }.route-track { position: relative; height: 3rpx; margin: 0 12rpx; background: #dfe4ed; }.moving-dot { position: absolute; left: 44%; top: -5rpx; width: 13rpx; height: 13rpx; border-radius: 50%; background: #8b81ff; box-shadow: 0 0 0 6rpx #efedff; }.featured-footer { display: flex; justify-content: space-between; padding-top: 22rpx; border-top: 1rpx solid #edf1f5; }.footer-label { color: #a0acbc; font-size: 19rpx; }.footer-value { margin-top: 4rpx; color: #3f556d; font-size: 25rpx; font-weight: 680; }.footer-right { text-align: right; }.small-value { font-size: 21rpx; font-weight: 560; }
.more-list { margin: 22rpx 12rpx 0; overflow: hidden; border-radius: 24rpx; background: #fff; box-shadow: 0 10rpx 26rpx rgba(38,53,84,.07); }.compact-task { display: flex; align-items: center; gap: 18rpx; padding: 22rpx; border-bottom: 1rpx solid #eef1f5; }.compact-task:last-child { border-bottom: 0; }.compact-icon { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 19rpx; color: #6255f6; background: #efedff; font-size: 23rpx; font-weight: 750; }.compact-content { flex: 1; min-width: 0; }.compact-name { overflow: hidden; color: #40566e; font-size: 26rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.compact-code { margin-top: 5rpx; color: #a0acbc; font-size: 20rpx; }
.bottom-space { height: 170rpx; }.bottom-nav { position: fixed; z-index: 20; left: 24rpx; right: 24rpx; bottom: calc(18rpx + env(safe-area-inset-bottom)); display: flex; justify-content: space-around; height: 112rpx; padding: 12rpx 18rpx; box-sizing: border-box; border: 1rpx solid rgba(224,229,238,.9); border-radius: 34rpx; background: rgba(255,255,255,.96); box-shadow: 0 18rpx 45rpx rgba(34,48,78,.18); backdrop-filter: blur(16rpx); }.nav-item { display: flex; align-items: center; justify-content: center; gap: 8rpx; width: 116rpx; border-radius: 25rpx; color: #8391a5; font-size: 21rpx; }.nav-item.active { width: 142rpx; color: #5c4ff1; background: #e9e6ff; font-weight: 680; }.nav-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 34rpx; height: 34rpx; font-size: 30rpx; }.home-icon { width: 27rpx; height: 22rpx; margin-top: 6rpx; border-radius: 4rpx; background: currentColor; }.home-roof { position: absolute; left: 2rpx; top: -10rpx; width: 20rpx; height: 20rpx; background: currentColor; transform: rotate(45deg); }.handoff-icon, .refresh-icon { font-weight: 750; }.user-head { position: absolute; top: 0; width: 13rpx; height: 13rpx; border: 4rpx solid currentColor; border-radius: 50%; }.user-body { position: absolute; bottom: 0; width: 28rpx; height: 16rpx; border: 4rpx solid currentColor; border-bottom: 0; border-radius: 18rpx 18rpx 0 0; }
</style>
