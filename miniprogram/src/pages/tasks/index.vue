<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import StatusTag from '@/components/StatusTag.vue'
import StatePanel from '@/components/StatePanel.vue'
import { useSessionStore } from '@/stores/session'
import { taskService } from '@/services/tasks'
import { errorMessage } from '@/services/request'
import type { Task, TaskStatus } from '@/types/api'

const session = useSessionStore(); const tasks = ref<Task[]>([]); const loading = ref(true); const error = ref(''); const filter = ref<'all' | TaskStatus>('all')
const filtered = computed(() => filter.value === 'all' ? tasks.value : tasks.value.filter((task) => task.status === filter.value))
const filters: Array<{ value: 'all' | TaskStatus; label: string }> = [{ value: 'all', label: '全部' }, { value: 'pending_handoff', label: '待发出' }, { value: 'in_transit', label: '运输中' }, { value: 'signed', label: '已签收' }, { value: 'rejected', label: '已拒收' }]
async function load() { loading.value=true; error.value=''; try { tasks.value=await taskService.listDemoTasks() } catch(e) { error.value=errorMessage(e) } finally { loading.value=false; uni.stopPullDownRefresh() } }
function open(task: Task) { uni.navigateTo({ url: `/pages/task-detail/index?task_id=${encodeURIComponent(task.task_id)}` }) }
onLoad(() => { if (session.requireSession()) load() }); onShow(() => { if (session.isAuthenticated && !loading.value) load() }); onPullDownRefresh(load)
</script>
<template><view class="page"><view class="row header"><view><view class="title">我的任务</view><view class="muted">{{ session.user?.name }}</view></view><button class="logout" @tap="session.logout">退出</button></view><scroll-view scroll-x class="filters"><view class="filter-row"><view v-for="item in filters" :key="item.value" class="filter" :class="{ selected: filter===item.value }" @tap="filter=item.value">{{ item.label }}</view></view></scroll-view><StatePanel v-if="loading" state="loading"/><StatePanel v-else-if="error" state="error" :message="error" @retry="load"/><StatePanel v-else-if="!filtered.length" state="empty" message="当前筛选条件下暂无任务"/><view v-for="task in filtered" v-else :key="task.task_id" class="card task" @tap="open(task)"><view class="row"><text class="task-id">{{ task.task_id }}</text><StatusTag :status="task.status"/></view><view class="sample">{{ task.sample_name }}</view><view class="muted">{{ task.sender }} → {{ task.receiver }}</view><view class="device">设备 {{ task.device_id }}</view></view></view></template>
<style scoped>.header{margin-bottom:28rpx}.logout{margin:0;font-size:24rpx;background:transparent;color:#60716e}.filters{white-space:nowrap;margin-bottom:24rpx}.filter-row{display:flex;gap:14rpx}.filter{padding:12rpx 24rpx;border-radius:999rpx;background:#e7eceb;color:#60716e}.selected{background:#087f6d;color:#fff}.task-id{font-weight:700}.sample{font-size:32rpx;font-weight:600;margin:24rpx 0 10rpx}.device{margin-top:18rpx;color:#087f6d}</style>
