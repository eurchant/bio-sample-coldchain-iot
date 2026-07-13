<script setup lang="ts">
defineProps<{ state: 'loading' | 'empty' | 'error'; message?: string }>()
defineEmits<{ retry: [] }>()
</script>
<template><view class="panel"><view class="icon">{{ state === 'error' ? '!' : state === 'empty' ? '○' : '…' }}</view><view>{{ message || (state === 'empty' ? '暂无数据' : state === 'error' ? '加载失败' : '加载中') }}</view><button v-if="state==='error'" class="secondary retry" @tap="$emit('retry')">重新加载</button></view></template>
<style scoped>.panel{text-align:center;color:#71817f;padding:100rpx 20rpx}.icon{font-size:60rpx;margin-bottom:16rpx}.retry{margin-top:24rpx;width:240rpx}</style>
