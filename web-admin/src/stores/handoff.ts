import { defineStore } from 'pinia'
import { describeApiError, remoteHandoffGateway } from '../services/api'
import { runtimeConfig } from '../services/config'
import type { EvidenceFile, HandoffList, HandoffRecord, QrTokenResult } from '../types/contracts'

const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

export function validateEvidenceFile(file: File) {
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type as (typeof ALLOWED_EVIDENCE_TYPES)[number])) {
    return '仅支持 JPEG、PNG 或 PDF 证据文件。'
  }
  if (file.size === 0) return '不能上传空文件。'
  if (file.size > MAX_EVIDENCE_FILE_SIZE) return '证据文件不能超过 5 MB。'
  return null
}

export async function validateEvidenceFileSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const matchesJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
  const matchesPng =
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  const matchesPdf = new TextDecoder().decode(header.slice(0, 5)) === '%PDF-'
  const matchesType =
    (file.type === 'image/jpeg' && matchesJpeg) ||
    (file.type === 'image/png' && matchesPng) ||
    (file.type === 'application/pdf' && matchesPdf)
  return matchesType ? null : '文件扩展名/MIME 类型与实际内容不一致，请选择真实的 JPEG、PNG 或 PDF 文件。'
}

async function calculateSha256(file: File) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前浏览器不支持文件完整性校验，请更换现代浏览器后重试。')
  }
  const bytes = await file.arrayBuffer()
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

function extractQrToken(value: string) {
  const candidate = value.trim()
  if (!candidate.startsWith('coldchain://')) return candidate
  try {
    return new URL(candidate).searchParams.get('token')?.trim() || candidate
  } catch {
    return candidate
  }
}

interface HandoffState {
  result: HandoffList
  loading: boolean
  actionLoading: string | null
  error: string | null
  message: string | null
  activeQr: QrTokenResult | null
  latestFiles: Record<string, EvidenceFile>
}

function emptyResult(): HandoffList {
  return { items: [], page: 1, page_size: 100, total: 0 }
}

export const useHandoffStore = defineStore('handoff', {
  state: (): HandoffState => ({
    result: emptyResult(),
    loading: false,
    actionLoading: null,
    error: null,
    message: null,
    activeQr: null,
    latestFiles: {},
  }),
  getters: {
    handoffs: (state) => state.result.items,
  },
  actions: {
    clearFeedback() {
      this.error = null
      this.message = null
    },
    closeQr() {
      this.activeQr = null
    },
    async load(taskId: string) {
      if (runtimeConfig.dataSource !== 'api') return
      this.loading = true
      this.error = null
      try {
        this.result = await remoteHandoffGateway.listHandoffs(taskId)
      } catch (error) {
        this.error = describeApiError(error)
      } finally {
        this.loading = false
      }
    },
    async create(taskId: string, input: { handoff_type: HandoffRecord['handoff_type']; to_user_id: number }) {
      this.actionLoading = 'create'
      this.clearFeedback()
      try {
        const handoff = await remoteHandoffGateway.createHandoff(taskId, input)
        this.message = '交接记录已创建，请由发起方生成动态二维码。'
        await this.load(taskId)
        return handoff
      } catch (error) {
        this.error = describeApiError(error)
        return null
      } finally {
        this.actionLoading = null
      }
    },
    async issueQr(taskId: string, handoffId: string) {
      this.actionLoading = `qr:${handoffId}`
      this.clearFeedback()
      try {
        this.activeQr = await remoteHandoffGateway.createQrToken(taskId, {
          handoff_id: handoffId,
          action: 'handoff_confirm',
          ttl_seconds: 60,
        })
        this.message = '动态交接码已生成，仅在当前会话临时显示。'
        return this.activeQr
      } catch (error) {
        this.error = describeApiError(error)
        return null
      } finally {
        this.actionLoading = null
      }
    },
    async verifyAndConfirm(taskId: string, handoffId: string, token: string) {
      this.actionLoading = `confirm:${handoffId}`
      this.clearFeedback()
      try {
        const verification = await remoteHandoffGateway.verifyQrToken(extractQrToken(token))
        if (!verification.valid || verification.handoff_id !== handoffId || verification.task_id !== taskId) {
          throw new Error('动态交接码与当前交接记录不匹配。')
        }
        await remoteHandoffGateway.confirmHandoff(handoffId)
        this.message = '二维码已核验，交接已由后端确认。'
        await this.load(taskId)
        return true
      } catch (error) {
        this.error = describeApiError(error)
        return false
      } finally {
        this.actionLoading = null
      }
    },
    async reject(taskId: string, handoffId: string, reason: string) {
      this.actionLoading = `reject:${handoffId}`
      this.clearFeedback()
      try {
        await remoteHandoffGateway.rejectHandoff(handoffId, reason.trim())
        this.message = '交接拒绝原因已由后端记录。'
        await this.load(taskId)
        return true
      } catch (error) {
        this.error = describeApiError(error)
        return false
      } finally {
        this.actionLoading = null
      }
    },
    async upload(taskId: string, handoffId: string, usage: string, file: File): Promise<EvidenceFile | null> {
      const validation = validateEvidenceFile(file)
      if (validation) {
        this.error = validation
        return null
      }
      const signatureError = await validateEvidenceFileSignature(file)
      if (signatureError) {
        this.error = signatureError
        return null
      }
      this.actionLoading = `upload:${handoffId}`
      this.clearFeedback()
      try {
        const sha256 = await calculateSha256(file)
        const record = await remoteHandoffGateway.uploadEvidence({
          taskId,
          handoffId,
          usage: usage.trim() || 'handoff_evidence',
          file,
          sha256,
        })
        this.latestFiles[handoffId] = record
        this.message = record.file_name === file.name ? '证据文件已上传并完成后端校验。' : '相同证据文件已存在，已复用后端记录。'
        await this.load(taskId)
        return record
      } catch (error) {
        this.error = describeApiError(error)
        return null
      } finally {
        this.actionLoading = null
      }
    },
    async download(fileId: string) {
      this.actionLoading = `download:${fileId}`
      this.clearFeedback()
      try {
        return await remoteHandoffGateway.downloadEvidence(fileId)
      } catch (error) {
        this.error = describeApiError(error)
        return null
      } finally {
        this.actionLoading = null
      }
    },
  },
})
