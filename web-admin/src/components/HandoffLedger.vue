<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { formatTime } from '../lib/format'
import { runtimeConfig } from '../services/config'
import { useHandoffStore } from '../stores/handoff'
import type { HandoffRecord, Task, UserRole } from '../types/contracts'

const props = defineProps<{
  task: Task
  role: UserRole | null
  userId: number | null
}>()
const emit = defineEmits<{ taskUpdated: [] }>()
const handoff = useHandoffStore()
const verifyTarget = ref<HandoffRecord | null>(null)
const verifyToken = ref('')
const rejectTarget = ref<HandoffRecord | null>(null)
const rejectReason = ref('')
const selectedFile = ref<File | null>(null)
const uploadTarget = ref<HandoffRecord | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const isApiMode = computed(() => runtimeConfig.dataSource === 'api')
const canCreateSenderHandoff = computed(() =>
  ['sender', 'admin'].includes(props.role ?? '') && Boolean(props.task.carrier_user_id),
)
const canCreateReceiverHandoff = computed(() =>
  ['carrier', 'admin'].includes(props.role ?? '') && Boolean(props.task.receiver_user_id),
)

const handoffTypeLabel: Record<string, string> = {
  sender_to_carrier: '发出方 → 承运方',
  carrier_to_carrier: '承运方 → 承运方',
  carrier_to_receiver: '承运方 → 接收方',
}

function isIssuer(item: HandoffRecord) {
  return props.role === 'admin' || item.from_user_id === props.userId
}

function isRecipient(item: HandoffRecord) {
  return props.role === 'admin' || (props.role === 'receiver' && item.to_user_id === props.userId)
}

async function create(type: HandoffRecord['handoff_type'], toUserId: number | null | undefined) {
  if (!toUserId) return
  await handoff.create(props.task.task_id, { handoff_type: type, to_user_id: toUserId })
}

function openVerify(item: HandoffRecord) {
  rejectTarget.value = null
  verifyTarget.value = item
  verifyToken.value = ''
}

async function submitVerify() {
  if (!verifyTarget.value || !verifyToken.value.trim()) return
  const done = await handoff.verifyAndConfirm(props.task.task_id, verifyTarget.value.handoff_id, verifyToken.value)
  if (done) {
    verifyTarget.value = null
    verifyToken.value = ''
    emit('taskUpdated')
  }
}

function openReject(item: HandoffRecord) {
  verifyTarget.value = null
  rejectTarget.value = item
  rejectReason.value = ''
}

async function submitReject() {
  if (!rejectTarget.value || !rejectReason.value.trim()) return
  const done = await handoff.reject(props.task.task_id, rejectTarget.value.handoff_id, rejectReason.value)
  if (done) {
    rejectTarget.value = null
    emit('taskUpdated')
  }
}

function chooseFile(item: HandoffRecord) {
  uploadTarget.value = item
  selectedFile.value = null
  fileInput.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

async function uploadSelectedFile() {
  if (!uploadTarget.value || !selectedFile.value) return
  await handoff.upload(props.task.task_id, uploadTarget.value.handoff_id, 'handoff_evidence', selectedFile.value)
  selectedFile.value = null
  uploadTarget.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function downloadLatest(item: HandoffRecord) {
  const file = handoff.latestFiles[item.handoff_id]
  if (!file) return
  const blob = await handoff.download(file.file_id)
  if (!blob) return
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = file.file_name
  anchor.click()
  URL.revokeObjectURL(href)
}

function refresh() { void handoff.load(props.task.task_id) }

onMounted(refresh)
watch(() => props.task.task_id, refresh)
</script>

<template>
  <article class="panel ledger-panel">
    <div class="card-heading">
      <div>
        <p class="section-kicker">CHAIN OF CUSTODY / QR EVIDENCE</p>
        <h3>交接记录与证据</h3>
      </div>
      <button class="ghost-button ledger-refresh" type="button" :disabled="handoff.loading" @click="refresh">
        {{ handoff.loading ? '同步中…' : '刷新记录' }}
      </button>
    </div>
    <p class="ledger-intro">动态码仅临时显示给发起人；接收方验证后才能由后端确认。人脸信息仅用于模拟核验/人工复核。</p>

    <p v-if="!isApiMode" class="ledger-note">Mock 模式不生成真实二维码或文件；切换到实时 API 可完成正式流程。</p>
    <template v-else>
      <div class="ledger-actions">
        <button class="secondary-action ledger-button" type="button" :disabled="!canCreateSenderHandoff || handoff.actionLoading !== null" @click="create('sender_to_carrier', task.carrier_user_id)">创建「发出方 → 承运方」交接</button>
        <button class="secondary-action ledger-button" type="button" :disabled="!canCreateReceiverHandoff || handoff.actionLoading !== null" @click="create('carrier_to_receiver', task.receiver_user_id)">创建「承运方 → 接收方」交接</button>
      </div>

      <div v-if="handoff.loading && !handoff.handoffs.length" class="compact-empty">正在读取后端交接记录…</div>
      <div v-else-if="handoff.handoffs.length" class="ledger-list">
        <article v-for="item in handoff.handoffs" :key="item.handoff_id" class="ledger-item">
          <div class="ledger-item-head">
            <div>
              <strong>{{ handoffTypeLabel[item.handoff_type] || item.handoff_type }}</strong>
              <p><span class="mono">{{ item.handoff_id }}</span> · {{ formatTime(item.created_at) }}</p>
            </div>
            <span class="handoff-status" :data-status="item.status">{{ item.status === 'confirmed' ? '已确认' : item.status === 'rejected' ? '已拒绝' : '待确认' }}</span>
          </div>
          <p class="ledger-parties">{{ item.from_user?.name || '发起方' }} → {{ item.to_user?.name || `用户 #${item.to_user_id}` }}</p>
          <div class="ledger-evidence">
            <span>{{ item.evidence.qr_verified ? '✓ 二维码已验证' : '○ 等待二维码验证' }}</span>
            <span>附件 {{ item.evidence.file_count }} 份</span>
            <span>人脸：{{ item.evidence.face_manual_review_required ? '人工复核' : '模拟核验未提交' }}</span>
          </div>
          <p v-if="item.reason" class="ledger-reason">原因：{{ item.reason }}</p>
          <div v-if="item.status === 'pending'" class="ledger-item-actions">
            <button v-if="isIssuer(item)" class="action-link" type="button" :disabled="handoff.actionLoading !== null" @click="handoff.issueQr(task.task_id, item.handoff_id)">生成动态交接码</button>
            <button v-if="isRecipient(item)" class="action-link" type="button" :disabled="handoff.actionLoading !== null" @click="openVerify(item)">验证并确认</button>
            <button v-if="isRecipient(item)" class="action-link danger-link" type="button" :disabled="handoff.actionLoading !== null" @click="openReject(item)">拒绝交接</button>
            <button class="action-link" type="button" :disabled="handoff.actionLoading !== null" @click="chooseFile(item)">上传证据</button>
            <button v-if="handoff.latestFiles[item.handoff_id]" class="action-link" type="button" :disabled="handoff.actionLoading !== null" @click="downloadLatest(item)">下载刚上传的文件</button>
          </div>
        </article>
      </div>
      <div v-else class="compact-empty">当前任务尚无后端交接记录。</div>
    </template>

    <p v-if="handoff.error" class="inline-feedback danger" role="alert">{{ handoff.error }}</p>
    <p v-else-if="handoff.message" class="inline-feedback success" role="status">{{ handoff.message }}</p>

    <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,application/pdf" @change="onFileSelected" />
    <div v-if="selectedFile && uploadTarget" class="file-confirm-row">
      <span>待上传：{{ selectedFile.name }}（{{ Math.ceil(selectedFile.size / 1024) }} KB）</span>
      <button class="primary-action compact-action" type="button" :disabled="handoff.actionLoading !== null" @click="uploadSelectedFile">上传并校验</button>
      <button class="ghost-button" type="button" @click="selectedFile = null; uploadTarget = null">取消</button>
    </div>

    <div v-if="handoff.activeQr" class="modal-backdrop" role="presentation" @click.self="handoff.closeQr()">
      <section class="action-modal" role="dialog" aria-modal="true" aria-label="动态交接码">
        <button class="modal-close" type="button" aria-label="关闭" @click="handoff.closeQr()">×</button>
        <p class="section-kicker">ONE-TIME HANDOFF TOKEN</p>
        <h3>动态交接码</h3>
        <p>请由指定接收方在小程序扫码验证。此码仅在当前会话显示，到期后自动失效。</p>
        <code class="qr-token">{{ handoff.activeQr.qr_payload }}</code>
        <p>有效至：{{ formatTime(handoff.activeQr.expires_at) }}</p>
      </section>
    </div>

    <div v-if="verifyTarget" class="modal-backdrop" role="presentation" @click.self="verifyTarget = null">
      <section class="action-modal" role="dialog" aria-modal="true" aria-label="验证并确认交接">
        <button class="modal-close" type="button" aria-label="关闭" @click="verifyTarget = null">×</button>
        <p class="section-kicker">RECEIVER QR VERIFICATION</p>
        <h3>验证并确认交接</h3>
        <p>粘贴扫码得到的动态码。验证成功后才会调用确认接口。</p>
        <textarea v-model="verifyToken" rows="3" class="token-input" placeholder="coldchain://handoff?token=… 或 token"></textarea>
        <div class="modal-actions"><button class="ghost-button" type="button" @click="verifyTarget = null">取消</button><button class="primary-action modal-confirm" type="button" :disabled="handoff.actionLoading !== null || !verifyToken.trim()" @click="submitVerify">{{ handoff.actionLoading ? '验证中…' : '验证并确认' }}</button></div>
      </section>
    </div>

    <div v-if="rejectTarget" class="modal-backdrop" role="presentation" @click.self="rejectTarget = null">
      <section class="action-modal" role="dialog" aria-modal="true" aria-label="拒绝交接">
        <button class="modal-close" type="button" aria-label="关闭" @click="rejectTarget = null">×</button>
        <p class="section-kicker">HANDOFF REJECTION</p>
        <h3>拒绝交接</h3>
        <textarea v-model="rejectReason" rows="3" maxlength="200" class="token-input" placeholder="请说明拒绝原因"></textarea>
        <div class="modal-actions"><button class="ghost-button" type="button" @click="rejectTarget = null">取消</button><button class="danger-action modal-confirm" type="button" :disabled="handoff.actionLoading !== null || !rejectReason.trim()" @click="submitReject">{{ handoff.actionLoading ? '提交中…' : '确认拒绝' }}</button></div>
      </section>
    </div>
  </article>
</template>

<style scoped>
.ledger-panel { margin-top:1rem; }.ledger-intro,.ledger-note { color:var(--ink-muted); font-size:.88rem; line-height:1.65; }.ledger-actions,.ledger-item-actions,.file-confirm-row { display:flex; flex-wrap:wrap; gap:.55rem; align-items:center; }.ledger-button { min-height:2.55rem; padding:.5rem .75rem; }.ledger-list { display:grid; gap:.7rem; margin-top:.9rem; }.ledger-item { border:1px solid var(--line); background:var(--panel-soft); padding:.8rem; }.ledger-item-head { display:flex; justify-content:space-between; gap:.8rem; }.ledger-item-head p,.ledger-parties,.ledger-reason { margin:.25rem 0 0; color:var(--ink-muted); font-size:.8rem; }.handoff-status { white-space:nowrap; font-size:.78rem; font-weight:700; color:var(--accent-strong); }.handoff-status[data-status='rejected'] { color:var(--danger); }.ledger-evidence { display:flex; flex-wrap:wrap; gap:.35rem .8rem; margin-top:.6rem; color:var(--ink-muted); font-size:.78rem; }.ledger-item-actions { margin-top:.75rem; }.action-link { border:0; background:transparent; color:var(--accent-strong); padding:0; cursor:pointer; font-size:.8rem; }.danger-link,.danger { color:var(--danger); }.inline-feedback { margin:.75rem 0 0; font-size:.86rem; }.success { color:var(--accent-strong); }.visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }.file-confirm-row { margin-top:.8rem; padding:.65rem; border:1px dashed var(--line); color:var(--ink-muted); font-size:.82rem; }.compact-action { min-height:2.35rem; padding:.45rem .75rem; }.qr-token { display:block; margin:.75rem 0; padding:.65rem; background:var(--panel-soft); color:var(--ink); word-break:break-all; white-space:pre-wrap; }.token-input { width:100%; box-sizing:border-box; border:1px solid var(--line); border-radius:.35rem; background:var(--panel-soft); color:var(--ink); padding:.55rem; }.ledger-refresh { padding:.45rem .65rem; }
</style>
