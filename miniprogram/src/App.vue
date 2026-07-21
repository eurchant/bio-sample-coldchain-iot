<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useSessionStore } from '@/stores/session'

onLaunch(() => useSessionStore().restore())
</script>

<style lang="scss">
page { background: #f4f7f8; color: #18322f; font-size: 28rpx; }
.page { min-height: 100vh; padding: 32rpx; box-sizing: border-box; }
.card { background: #fff; border-radius: 20rpx; padding: 28rpx; margin-bottom: 24rpx; box-shadow: 0 8rpx 28rpx rgba(18, 72, 64, .07); }
.title { font-size: 40rpx; font-weight: 700; margin-bottom: 12rpx; }
.muted { color: #71817f; }
.primary { background: #087f6d; color: #fff; border-radius: 14rpx; }
.secondary { background: #e6f3f0; color: #087f6d; border-radius: 14rpx; }
.danger { color: #b42318; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.field { padding: 18rpx 0; border-bottom: 1rpx solid #edf1f0; }
.label { color: #71817f; }
button[disabled] { opacity: .55; }
</style>
