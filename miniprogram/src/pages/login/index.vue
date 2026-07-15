<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore, type DemoUser } from '@/stores/session'

const session = useSessionStore()
const identities: Array<DemoUser & { code: string; description: string }> = [
  { name: '发出方演示人员', role: 'sender', code: '发', description: '核对任务并完成发出交接' },
  { name: '承运演示人员', role: 'carrier', code: '运', description: '查看运输任务与设备信息' },
  { name: '接收方演示人员', role: 'receiver', code: '收', description: '查看待接收的冷链任务' },
  { name: '管理员演示人员', role: 'admin', code: '管', description: '浏览完整的演示数据' },
]

onMounted(() => {
  session.restore()
  if (session.user) uni.reLaunch({ url: '/pages/tasks/index' })
})

function choose(user: DemoUser) {
  session.selectIdentity(user)
  uni.reLaunch({ url: '/pages/tasks/index' })
}
</script>

<template>
  <view class="page login-page">
    <view class="brand-block">
      <view class="brand-icon">
        <view class="snow-dot dot-one" />
        <view class="snow-dot dot-two" />
        <view class="snow-dot dot-three" />
        <text>冷</text>
      </view>
      <view class="eyebrow">BIO COLD CHAIN</view>
      <view class="hero-title">冷链转运交接</view>
      <view class="hero-subtitle">让每一次样本流转都有迹可循</view>
    </view>

    <view class="choice-card">
      <view class="section-heading choice-heading">
        <view>
          <view class="section-title">选择演示身份</view>
          <view class="section-hint">进入对应的任务工作台</view>
        </view>
        <view class="step">01</view>
      </view>

      <view
        v-for="item in identities"
        :key="item.role"
        class="identity"
        @tap="choose(item)"
      >
        <view class="identity-icon">{{ item.code }}</view>
        <view class="identity-content">
          <view class="identity-name">{{ item.name }}</view>
          <view class="identity-description">{{ item.description }}</view>
        </view>
        <view class="arrow">›</view>
      </view>
    </view>

    <view class="security-note">
      <view class="security-dot" />
      <text>MVP 演示入口，仅使用虚构身份与样本数据</text>
    </view>
  </view>
</template>

<style scoped>
.login-page { padding-top: 68rpx; background: radial-gradient(circle at 85% 8%, #e8e5ff 0, transparent 35%), #f4f7fb; }
.brand-block { padding: 28rpx 18rpx 54rpx; }
.brand-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 102rpx; height: 102rpx; margin-bottom: 28rpx; border-radius: 30rpx; color: #fff; background: linear-gradient(145deg, #786aff, #5146f6); box-shadow: 0 18rpx 36rpx rgba(91, 77, 247, .28); font-size: 40rpx; font-weight: 750; }
.snow-dot { position: absolute; width: 8rpx; height: 8rpx; border-radius: 50%; background: rgba(255,255,255,.68); }
.dot-one { top: 20rpx; left: 24rpx; }.dot-two { top: 25rpx; right: 22rpx; }.dot-three { bottom: 21rpx; right: 29rpx; }
.eyebrow { margin-bottom: 10rpx; color: #6558ff; font-size: 22rpx; font-weight: 750; letter-spacing: 5rpx; }
.hero-title { color: #102a43; font-size: 50rpx; font-weight: 800; letter-spacing: 1rpx; }
.hero-subtitle { margin-top: 14rpx; color: #8494a8; font-size: 27rpx; }
.choice-card { padding: 34rpx 28rpx 20rpx; border: 1rpx solid #e5eaf2; border-radius: 30rpx; background: #fff; box-shadow: 0 14rpx 40rpx rgba(38,54,88,.08); }
.choice-heading { padding: 0 6rpx 18rpx; }
.step { color: #c7c2ff; font-size: 46rpx; font-weight: 800; }
.identity { display: flex; align-items: center; min-height: 112rpx; padding: 12rpx 6rpx; border-top: 1rpx solid #eef1f6; }
.identity-icon { display: flex; align-items: center; justify-content: center; width: 70rpx; height: 70rpx; margin-right: 22rpx; border-radius: 22rpx; color: #6255f6; background: #efedff; font-size: 28rpx; font-weight: 750; }
.identity-content { flex: 1; min-width: 0; }.identity-name { color: #203a52; font-size: 29rpx; font-weight: 680; }.identity-description { margin-top: 7rpx; color: #9aa8b9; font-size: 23rpx; }
.arrow { color: #bbb6ff; font-size: 48rpx; font-weight: 300; }
.security-note { display: flex; align-items: center; justify-content: center; gap: 12rpx; padding: 28rpx 10rpx; color: #9aa8b9; font-size: 23rpx; }
.security-dot { width: 12rpx; height: 12rpx; border: 4rpx solid #afa8ff; border-radius: 50%; }
</style>
