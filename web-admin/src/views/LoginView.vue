<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { runtimeConfig } from '../services/config'
import { DEMO_ROLE_OPTIONS, type DemoRole, useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const selectedRole = ref<DemoRole>(auth.role ?? 'admin')
const username = ref('')
const password = ref('')
const isApiMode = computed(() => runtimeConfig.dataSource === 'api')

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
  auth.enterDemo(selectedRole.value)
  void router.replace(redirectTarget.value)
}

async function login() {
  if (!username.value.trim() || !password.value) {
    auth.error = '请输入账号和密码。'
    return
  }
  const loggedIn = await auth.loginWithPassword(username.value.trim(), password.value)
  if (loggedIn) void router.replace(redirectTarget.value === '/' ? '/tasks' : redirectTarget.value)
}
</script>

<template>
  <main class="login-page">
    <section class="login-card" aria-labelledby="login-title">
      <p class="section-kicker">COLDCHAIN TRACE / ACCESS CONTROL</p>
      <h1 id="login-title">{{ isApiMode ? '登录管理端' : '选择演示身份' }}</h1>
      <p class="login-intro" v-if="isApiMode">
        使用后端分配的账号登录。登录凭据仅发送至当前配置的 API，Token 只保存在本浏览器会话中。
      </p>
      <p class="login-intro" v-else>
        这是离线演示身份，非后端认证。请选择本次展示的用户类型后进入管理端。
      </p>

      <form v-if="isApiMode" class="login-form" @submit.prevent="login">
        <label class="login-field">
          <span>账号或手机号</span>
          <input v-model="username" autocomplete="username" maxlength="40" placeholder="输入后端账号" />
        </label>
        <label class="login-field">
          <span>密码</span>
          <input v-model="password" type="password" autocomplete="current-password" maxlength="80" placeholder="输入密码" />
        </label>
        <p class="login-notice" role="note">
          不会显示、记录或提交 Token；权限以服务端返回结果为准。
        </p>
        <p v-if="auth.error" class="login-error" role="alert">{{ auth.error }}</p>
        <button class="primary-action login-submit" type="submit" :disabled="auth.loading">
          {{ auth.loading ? '登录中…' : '登录并查看我的任务' }}
        </button>
      </form>

      <template v-else>
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
      </template>
    </section>
  </main>
</template>
