import { defineStore } from 'pinia'
import { ApiError, remoteDeviceGateway } from '../services/api'
import type { Device, DeviceBinding, RegisterDeviceInput } from '../types/contracts'

interface DeviceState {
  devices: Device[]
  loading: boolean
  submitting: boolean
  bindingHistory: Record<string, DeviceBinding[]>
  historyLoadingDeviceId: string | null
  error: string | null
}

function displayError(error: unknown) {
  if (error instanceof ApiError) {
    const detail = [error.status ? `HTTP ${error.status}` : '', error.code ? `code ${error.code}` : '']
      .filter(Boolean)
      .join(' / ')
    return detail ? `${error.message}（${detail}）` : error.message
  }
  return error instanceof Error ? error.message : '设备请求失败，请稍后重试。'
}

/**
 * A defensive client-side boundary only. The backend must still never return
 * secrets: values in an HTTP response are already observable in browser tools.
 */
function stripSensitiveDeviceFields(device: Device): Device {
  const { device_secret: _deviceSecret, device_secret_hash: _deviceSecretHash, ...safeDevice } = device as Device &
    Record<string, unknown>
  return safeDevice as Device
}

/**
 * Device state is intentionally refreshed from the API after every mutation.
 * The server remains the source of truth for binding, online/offline status and
 * the task currently associated with a device.
 */
export const useDeviceStore = defineStore('device', {
  state: (): DeviceState => ({
    devices: [],
    loading: false,
    submitting: false,
    bindingHistory: {},
    historyLoadingDeviceId: null,
    error: null,
  }),
  actions: {
    clearError() {
      this.error = null
    },
    async load() {
      this.loading = true
      this.error = null
      try {
        const result = await remoteDeviceGateway.listDevices()
        this.devices = result.items.map(stripSensitiveDeviceFields)
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.loading = false
      }
    },
    async register(input: RegisterDeviceInput) {
      this.submitting = true
      this.error = null
      try {
        const device = stripSensitiveDeviceFields(await remoteDeviceGateway.registerDevice(input))
        await this.load()
        return device
      } catch (error) {
        this.error = displayError(error)
        return null
      } finally {
        this.submitting = false
      }
    },
    async bind(deviceId: string, taskId: string): Promise<DeviceBinding | null> {
      this.submitting = true
      this.error = null
      try {
        const binding = await remoteDeviceGateway.bindDevice(deviceId, taskId)
        delete this.bindingHistory[deviceId]
        await this.load()
        return binding
      } catch (error) {
        this.error = displayError(error)
        return null
      } finally {
        this.submitting = false
      }
    },
    async unbind(deviceId: string) {
      this.submitting = true
      this.error = null
      try {
        const device = stripSensitiveDeviceFields(await remoteDeviceGateway.unbindDevice(deviceId))
        delete this.bindingHistory[deviceId]
        await this.load()
        return device
      } catch (error) {
        this.error = displayError(error)
        return null
      } finally {
        this.submitting = false
      }
    },
    async loadBindings(deviceId: string) {
      this.historyLoadingDeviceId = deviceId
      this.error = null
      try {
        const result = await remoteDeviceGateway.getBindings(deviceId)
        this.bindingHistory[deviceId] = result.items
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.historyLoadingDeviceId = null
      }
    },
  },
})
