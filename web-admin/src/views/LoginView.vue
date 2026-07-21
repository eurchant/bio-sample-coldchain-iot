<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEMO_ROLE_OPTIONS, type DemoRole, useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const selectedRole = ref<DemoRole>(auth.role ?? 'admin')

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  if (
    typeof redirect !== 'string' ||
    !redirect.startsWith('/') ||
    redirect.startsWith('//') ||
    redirect.startsWith('/login')
  ) {
    return '/'
  }
  return redirect
})

function enterWorkspace() {
  auth.login(selectedRole.value)
  void router.replace(redirectTarget.value)
}
</script>

<template>
  <main class="login-page">
    <section class="login-card" aria-labelledby="login-title">
      <p class="section-kicker">COLDCHAIN TRACE / DEMO ACCESS</p>
      <h1 id="login-title">选择演示身份</h1>
      <p class="login-intro">
        这是演示身份，非后端认证。请选择本次展示的用户类型后进入管理端。
      </p>
      <p class="login-notice" role="note">
        不需要输入账号、密码或 Token；选择结果仅保存在当前浏览器会话中，不会发送至后端。
      </p>

      <fieldset class="role-options">
        <legend>用户类型</legend>
        <label
          v-for="option in DEMO_ROLE_OPTIONS"
          :key="option.role"
          :class="['role-option', { 'is-selected': selectedRole === option.role }]"
        >
          <input v-model="selectedRole" type="radio" name="demo-role" :value="option.role" />
          <span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </span>
        </label>
      </fieldset>

      <button class="primary-action login-submit" type="button" data-testid="enter-demo" @click="enterWorkspace">
        进入演示管理端
      </button>
    </section>
  </main>
</template>
