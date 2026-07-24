// ISO 8601 时间字符串 -> 本地友好显示，例如 2026-07-13T10:05:00+08:00 -> 07-13 10:05
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 仅时分，用于时间线节点
export function formatShort(iso: string | null | undefined): string {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 保留一位小数
export function fmtNum(n: number | null | undefined, unit = ''): string {
  if (n === null || n === undefined || isNaN(n)) return '--'
  return `${Number(n.toFixed(1))}${unit}`
}
