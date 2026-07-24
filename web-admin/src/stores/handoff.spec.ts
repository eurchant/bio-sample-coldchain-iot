import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { handoffMock } = vi.hoisted(() => ({
  handoffMock: {
    listHandoffs: vi.fn(),
    createHandoff: vi.fn(),
    createQrToken: vi.fn(),
    verifyQrToken: vi.fn(),
    confirmHandoff: vi.fn(),
    rejectHandoff: vi.fn(),
    uploadEvidence: vi.fn(),
    downloadEvidence: vi.fn(),
  },
}))

vi.mock('../services/config', () => ({
  runtimeConfig: { dataSource: 'api', apiBaseUrl: 'http://example.test', pollingIntervalMs: 4000 },
}))

vi.mock('../services/api', () => ({
  remoteHandoffGateway: handoffMock,
  describeApiError: (error: unknown) => error instanceof Error ? error.message : '请求失败',
}))

import { useHandoffStore, validateEvidenceFile, validateEvidenceFileSignature } from './handoff'

const handoff = {
  handoff_id: 'HO-001', task_id: 'TASK-001', handoff_type: 'carrier_to_receiver' as const,
  from_user_id: 2, to_user_id: 3, status: 'pending', created_at: '2026-07-24T10:00:00+08:00',
  evidence: { qr_verified: false, qr_verified_by_user_id: null, face_status: 'not_submitted', face_verified: false, face_manual_review_required: false, file_count: 0 },
}

describe('handoff store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    handoffMock.listHandoffs.mockResolvedValue({ items: [handoff], page: 1, page_size: 100, total: 1 })
  })

  it('blocks an unsupported evidence file before any network upload', async () => {
    const invalid = new File(['not a PDF'], 'evidence.txt', { type: 'text/plain' })
    expect(validateEvidenceFile(invalid)).toContain('JPEG、PNG 或 PDF')

    const store = useHandoffStore()
    const uploaded = await store.upload('TASK-001', 'HO-001', 'handoff_evidence', invalid)

    expect(uploaded).toBeNull()
    expect(handoffMock.uploadEvidence).not.toHaveBeenCalled()
    expect(store.error).toContain('JPEG、PNG 或 PDF')
  })

  it('explains a misleading image extension before sending it to the backend', async () => {
    const jpegPretendingToBePng = new File([
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
    ], 'evidence.png', { type: 'image/png' })

    await expect(validateEvidenceFileSignature(jpegPretendingToBePng)).resolves.toContain('实际内容不一致')
  })

  it('refreshes the ledger after the receiver verifies and confirms the QR handoff', async () => {
    handoffMock.verifyQrToken.mockResolvedValue({ valid: true, token_id: 8, task_id: 'TASK-001', handoff_id: 'HO-001', action: 'handoff_confirm' })
    handoffMock.confirmHandoff.mockResolvedValue({ ...handoff, status: 'confirmed' })
    const store = useHandoffStore()

    const completed = await store.verifyAndConfirm('TASK-001', 'HO-001', 'coldchain://handoff?token=one-time-token')

    expect(completed).toBe(true)
    expect(handoffMock.verifyQrToken).toHaveBeenCalledWith('one-time-token')
    expect(handoffMock.confirmHandoff).toHaveBeenCalledWith('HO-001')
    expect(handoffMock.listHandoffs).toHaveBeenCalledWith('TASK-001')
  })

  it('keeps a clear failure message when the handoff endpoint is unavailable', async () => {
    handoffMock.createHandoff.mockRejectedValue(new Error('无法连接后端服务，请检查网络或服务是否运行'))
    const store = useHandoffStore()

    const created = await store.create('TASK-001', { handoff_type: 'carrier_to_receiver', to_user_id: 3 })

    expect(created).toBeNull()
    expect(store.error).toContain('无法连接后端服务')
  })
})
