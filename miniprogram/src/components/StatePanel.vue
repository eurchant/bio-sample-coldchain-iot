<script setup lang="ts">
defineProps<{ state: 'loading' | 'empty' | 'error'; message?: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <view class="panel">
    <view class="state-icon" :class="state">
      <view v-if="state === 'loading'" class="loader" />
      <text v-else>{{ state === 'error' ? '!' : '—' }}</text>
    </view>
    <view class="state-title">{{ state === 'empty' ? '暂无内容' : state === 'error' ? '加载失败' : '正在加载' }}</view>
    <view class="state-message">{{ message || (state === 'empty' ? '当前没有可展示的数据' : state === 'error' ? '请检查网络后重新尝试' : '数据马上就来') }}</view>
    <button v-if="state === 'error'" class="secondary retry" @tap="$emit('retry')">重新加载</button>
  </view>
</template>

<style scoped>
.panel { padding: 110rpx 30rpx; text-align: center; color: #91a1b5; }
.state-icon { display: flex; align-items: center; justify-content: center; width: 90rpx; height: 90rpx; margin: 0 auto 22rpx; border-radius: 28rpx; color: #7164ff; background: #efedff; font-size: 42rpx; font-weight: 700; }
.state-icon.error { color: #d84a55; background: #ffeaec; }
.state-title { color: #42566d; font-size: 30rpx; font-weight: 650; }
.state-message { margin-top: 10rpx; font-size: 25rpx; }
.loader { width: 34rpx; height: 34rpx; border: 5rpx solid #cbc6ff; border-top-color: #6558ff; border-radius: 50%; animation: spin .8s linear infinite; }
.retry { width: 240rpx; margin-top: 28rpx; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
