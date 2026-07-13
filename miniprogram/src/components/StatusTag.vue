<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@/types/api'
import { taskStatusText } from '@/utils/status'

const props = defineProps<{ status: TaskStatus }>()
const tone = computed(() => {
  const tones: Partial<Record<TaskStatus, string>> = { signed: 'ok', rejected: 'bad', canceled: 'muted', in_transit: 'active' }
  return tones[props.status] || 'waiting'
})
</script>

<template><text class="tag" :class="tone">{{ taskStatusText[status] }}</text></template>

<style scoped>
.tag { display:inline-block; padding: 6rpx 16rpx; border-radius: 999rpx; font-size: 24rpx; background:#fff1cc; color:#875b00; }
.active { background:#dff4ef; color:#087f6d; }.ok { background:#e3f5e8;color:#18733b}.bad {background:#fee4e2;color:#b42318}.muted {background:#edf0f0;color:#667573}
</style>
