<script setup lang="ts">
defineProps<{ visible: boolean; title: string; content: string; loading?: boolean }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <view v-if="visible" class="mask" @tap.self="$emit('cancel')">
    <view class="dialog">
      <view class="dialog-title">{{ title }}</view><view class="dialog-content">{{ content }}</view>
      <view class="actions"><button class="secondary" :disabled="loading" @tap="$emit('cancel')">取消</button><button class="primary" :loading="loading" :disabled="loading" @tap="$emit('confirm')">确认</button></view>
    </view>
  </view>
</template>

<style scoped>
.mask{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;z-index:20}.dialog{width:620rpx;background:#fff;border-radius:22rpx;padding:32rpx;box-sizing:border-box}.dialog-title{font-size:34rpx;font-weight:700}.dialog-content{color:#5f6f6d;line-height:1.7;margin:18rpx 0 30rpx}.actions{display:flex;gap:20rpx}.actions button{flex:1}
</style>
