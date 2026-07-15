<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore, type DemoUser } from '@/stores/session'

const session = useSessionStore()
const identities: DemoUser[] = [
  { name: '发出方演示人员', role: 'sender' }, { name: '承运演示人员', role: 'carrier' },
  { name: '接收方演示人员', role: 'receiver' }, { name: '管理员演示人员', role: 'admin' },
]
onMounted(() => { session.restore(); if (session.user) uni.reLaunch({ url: '/pages/tasks/index' }) })
function choose(user: DemoUser) { session.selectIdentity(user); uni.reLaunch({ url: '/pages/tasks/index' }) }
</script>
<template><view class="page login"><view class="hero"><view class="title">冷链转运交接</view><view class="muted">请选择本次演示身份</view></view><view v-for="item in identities" :key="item.role" class="card identity" @tap="choose(item)"><view><view class="name">{{ item.name }}</view><view class="muted">{{ item.role }}</view></view><text>›</text></view><view class="notice">当前为 MVP 简化身份入口，不代表后端已实现正式权限认证。</view></view></template>
<style scoped>.login{padding-top:100rpx}.hero{margin-bottom:50rpx}.identity{display:flex;justify-content:space-between;align-items:center}.name{font-weight:600;font-size:32rpx}.notice{color:#875b00;background:#fff7df;padding:24rpx;border-radius:16rpx;line-height:1.6}</style>
