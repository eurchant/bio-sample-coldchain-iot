import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AsyncStatePanel from './AsyncStatePanel.vue'

describe('AsyncStatePanel', () => {
  it.each([
    ['loading', '正在加载数据', '正在请求最新数据，请稍候。', 'status', 'polite'],
    ['empty', '暂无可显示的数据', '当前条件下没有可展示的记录。', 'status', 'polite'],
    ['offline', '网络连接暂时中断', '请检查网络或服务状态，恢复后可重新加载。', 'status', 'polite'],
    ['error', '数据加载失败', '请求未能完成，请检查服务状态后重试。', 'alert', 'assertive'],
  ] as const)('renders the %s state with accessible copy', (state, title, description, role, live) => {
    const wrapper = mount(AsyncStatePanel, { props: { state } })
    const panel = wrapper.get('[data-state]')

    expect(panel.attributes('data-state')).toBe(state)
    expect(panel.attributes('role')).toBe(role)
    expect(panel.attributes('aria-live')).toBe(live)
    expect(panel.text()).toContain(title)
    expect(panel.text()).toContain(description)
    expect(panel.attributes('aria-labelledby')).toBeTruthy()
    expect(panel.attributes('aria-describedby')).toBeTruthy()
  })

  it('only offers retry by default for recoverable offline and error states', () => {
    expect(mount(AsyncStatePanel, { props: { state: 'loading' } }).find('button').exists()).toBe(false)
    expect(mount(AsyncStatePanel, { props: { state: 'empty' } }).find('button').exists()).toBe(false)
    expect(mount(AsyncStatePanel, { props: { state: 'offline' } }).get('button').text()).toBe('重新加载')
    expect(mount(AsyncStatePanel, { props: { state: 'error' } }).get('button').text()).toBe('重新加载')
  })

  it('emits retry when the retry action is selected', async () => {
    const wrapper = mount(AsyncStatePanel, {
      props: { state: 'offline', retryLabel: '立即重试' },
    })

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('立即重试')
    await button.trigger('click')

    expect(wrapper.emitted('retry')).toEqual([[]])
  })
})
