import { useEffect, useState } from 'react'

export function Table(props: {
  headers: string[]
  rows: (string | number | React.ReactNode)[][]
  compact?: boolean
}) {
  return (
    <div className={(props.compact ? 'max-h-[280px] ' : 'max-h-[420px] ') + 'overflow-auto rounded-xl border border-white/10'}>
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-[#0b1024]/90 text-white/70 backdrop-blur">
          <tr>
            {props.headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={i} className={i % 2 ? 'bg-black/10' : 'bg-black/20'}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-white/70">
                  <div className={j === r.length - 1 ? 'max-w-[420px] truncate font-mono text-[11px]' : ''}>{c}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function useJson<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(url)
        const json = await res.json()
        if (!cancelled) {
          setData(json)
          setErr(res.ok ? null : `HTTP ${res.status}`)
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e))
      }
    }

    load()
    const t = setInterval(load, intervalMs)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [url, intervalMs])

  return { data, err }
}
