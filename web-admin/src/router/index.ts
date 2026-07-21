import { createRouter, createWebHistory } from 'vue-router'
import { hasRoleAccess, type DemoRole, useAuthStore } from '../stores/auth'
import DashboardView from '../views/DashboardView.vue'
import LoginView from '../views/LoginView.vue'
import OverviewView from '../views/OverviewView.vue'
import TaskDetailView from '../views/TaskDetailView.vue'
import TaskMapView from '../views/TaskMapView.vue'
import TraceReportView from '../views/TraceReportView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
    { path: '/', name: 'overview', component: OverviewView, meta: { requiresAuth: true } },
    { path: '/tasks/:taskId', name: 'task-detail', component: TaskDetailView, meta: { requiresAuth: true } },
    {
      path: '/tasks/:taskId/map',
      name: 'task-map',
      component: TaskMapView,
      meta: { requiresAuth: true },
    },
    { path: '/trace/:taskId', name: 'trace-report', component: TraceReportView, meta: { requiresAuth: true } },
    {
      path: '/screen',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true, roles: ['admin'] satisfies DemoRole[] },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!auth.restored) auth.restore()

  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'overview' }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const allowedRoles = to.meta.roles as readonly DemoRole[] | undefined
  if (to.meta.requiresAuth && !hasRoleAccess(auth.role, allowedRoles)) {
    return { name: 'overview' }
  }

  return true
})

export default router
