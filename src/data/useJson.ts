import { useEffect, useState } from 'react'

// 前端只读 public/data/*.json（由数据管道生成、git 提交）。
// base './' → 生产为 './data/x.json'（相对 /holdings-tracker/），开发为 '/data/x.json'。
export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

export type DataStatus = 'loading' | 'live' | 'fallback'

/**
 * 读取一个管道生成的 JSON，附带兜底：
 * - 加载中 → 先显示传入的 mock（fallback），status='loading'
 * - 成功   → 显示真实数据，status='live'
 * - 失败   → 回落到 mock，status='fallback'（数据缺失时页面不崩）
 */
export function useJson<T>(path: string, fallback: T): { data: T; status: DataStatus } {
  const [data, setData] = useState<T>(fallback)
  const [status, setStatus] = useState<DataStatus>('loading')

  useEffect(() => {
    let alive = true
    fetch(dataUrl(path), { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (alive) {
          setData(json as T)
          setStatus('live')
        }
      })
      .catch(() => {
        if (alive) {
          setData(fallback)
          setStatus('fallback')
        }
      })
    return () => {
      alive = false
    }
  }, [path])

  return { data, status }
}
