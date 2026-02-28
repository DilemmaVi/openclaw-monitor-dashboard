import { useEffect, useMemo, useState } from 'react'
import { Table, useJson } from './widgets'
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react'

type Health = { ok: boolean; ts: number }

type HostSummary = {
  platform: string
  arch: string
  node: string
  hostname?: string
  uptimeSec: number
  cpuUsagePctApprox?: number
  mem?: { total: number; used: number; free: number; percent: number }
  disk?: { total: number; used: number; avail: number; percent: number } | null
}

type CronRunsResp = { ok: boolean; items: any[] }

type MetricsResp = { ok: boolean; items: any[] }

type CodezData = {
  as_of: string
  quota_per_unit: number
  today: {
    calls: number
    spend_usd: number
    cache_hit_rate_pct: number
    remaining_usd: number
  }
  history: {
    total_spend_usd: number
  }
}

type CodezResp = {
  ok: boolean
  data: CodezData | { raw: string }
  stderr?: string
}

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`
}

function fmtTs(ts: any) {
  const s = String(ts ?? '')
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function bytesToGiB(n: number) {
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`
}

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ' +
        (ok
          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
          : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30')
      }
    >
      {text}
    </span>
  )
}

function GlassCard(props: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-white/80">{props.icon}</div>
          <div className="text-sm font-semibold tracking-wide text-white/90">{props.title}</div>
        </div>
        <div>{props.right}</div>
      </div>

      <div className="relative text-sm text-white/80">{props.children}</div>
    </div>
  )
}

function Sparkline({ values, width = 220, height = 44 }: { values: number[]; width?: number; height?: number }) {
  const pts = useMemo(() => {
    if (!values.length) return ''
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    return values
      .map((v, i) => {
        const x = (i / Math.max(1, values.length - 1)) * width
        const y = height - ((v - min) / span) * height
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [values, width, height])

  if (!values.length) return <div className="text-xs text-white/40">no data</div>

  return (
    <svg width={width} height={height} className="block">
      <polyline fill="none" stroke="rgba(34,211,238,0.9)" strokeWidth="2" points={pts} />
    </svg>
  )
}

function CronStats() {
  const { data, err } = useJson<{ ok: boolean; stats: any[] }>('/api/cron/stats', 10_000)
  if (err) return <div className="text-rose-300">load failed: {err}</div>
  const stats = data?.stats ?? []
  if (!stats.length) return <div className="text-white/50">no stats</div>

  return (
    <Table
      compact
      headers={["job", "last", "ok", "artifact", "recent7"]}
      rows={stats.map((s) => {
        const ok = !!s.last_ok
        const shell = typeof s.last_artifact_size === 'number' && s.last_artifact_size <= 5 * 1024
        return [
          s.job,
          fmtTs(s.last_ts ?? '-'),
          <span className={ok ? 'text-emerald-300' : 'text-rose-300'} key={s.job + '-ok'}>{ok ? 'ok' : 'fail'}</span>,
          shell ? (
            <span className="text-rose-300" key={s.job + '-sz'}>{Math.round(s.last_artifact_size / 1024)} KB ⚠︎</span>
          ) : (
            typeof s.last_artifact_size === 'number' ? `${Math.round(s.last_artifact_size / 1024)} KB` : '-'
          ),
          `${s.recent7_ok}/${s.recent7_total}`
        ]
      })}
    />
  )
}

function TopProcesses({ sort }: { sort: 'mem' | 'cpu' }) {
  const { data, err } = useJson<{ ok: boolean; items: any[] }>(`/api/host/processes?sort=${sort}&top=10`, 10_000)
  if (err) return <div className="text-rose-300">load failed: {err}</div>
  const items = data?.items ?? []
  if (!items.length) return <div className="text-white/50">no data</div>

  return (
    <Table
      compact
      headers={["pid", "cpu%", "mem%", "rss", "etime", "comm"]}
      rows={items.map((p) => [
        p.pid,
        p.cpu,
        p.memPct,
        `${Math.round(p.rssKb / 1024)} MB`,
        p.etime,
        p.comm
      ])}
    />
  )
}

function RuntimeHealth() {
  const { data, err } = useJson<{ ok: boolean; ts: string; checks: any[]; history_tail: any[]; gateway: any | null }>(
    '/api/runtime/health',
    10_000
  )
  if (err) return <div className="text-rose-300">load failed: {err}</div>
  if (!data) return <div className="text-white/50">loading...</div>

  const checks = data.checks ?? []
  const ok = !!data.ok

  const okCount = checks.filter((c) => c.ok).length
  const total = checks.length
  const p = data.gateway

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40">as_of {fmtTs(data.ts)}</div>
        <Badge ok={ok} text={ok ? 'HEALTHY' : 'DEGRADED'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">api checks</div>
          <div className="mt-1 text-lg font-semibold text-white/90">
            {okCount}/{total}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">gateway rss</div>
          <div className="mt-1 text-lg font-semibold text-white/90">
            {p ? `${Math.round(p.rssKb / 1024)} MB` : '-'}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">gateway cpu%</div>
          <div className="mt-1 text-lg font-semibold text-white/90">{p ? p.cpu : '-'}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">gateway etime</div>
          <div className="mt-1 text-sm font-semibold text-white/90">{p ? p.etime : '-'}</div>
        </div>
      </div>

      <div className="space-y-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
            <div className="truncate text-white/60">{c.url.replace('http://127.0.0.1:4318', '')}</div>
            <div className="flex items-center gap-2">
              <span className={c.ok ? 'text-emerald-300' : 'text-rose-300'}>{c.ok ? 'ok' : 'fail'}</span>
              <span className="text-white/50">{c.status}</span>
              <span className="text-white/50">{c.ms}ms</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-white/40">(实时指标：RTT/成功率/网关资源；比纯 status 文本更有参考意义)</div>
    </div>
  )
}

function CronRuns() {
  const [items, setItems] = useState<any[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const r: CronRunsResp = await fetch('/api/cron/runs').then((x) => x.json())
        if (!cancelled) {
          setItems(Array.isArray(r.items) ? r.items : [])
          setErr(null)
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e))
      }
    }

    load()
    const t = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (err) return <div className="text-rose-300">load failed: {err}</div>
  if (!items.length) return <div className="text-white/50">no runs yet</div>

  return (
    <div className="space-y-2">
      {items.slice(0, 12).map((it, idx) => {
        const shell = typeof it.artifact_size === 'number' && it.artifact_size <= 5 * 1024
        return (
          <div key={idx} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className={"h-2.5 w-2.5 rounded-full " + (it.ok ? 'bg-emerald-400' : 'bg-rose-400')} />
            <div className="min-w-[160px] font-medium text-white/80">{it.job ?? it.id ?? 'unknown'}</div>
            <div className="flex-1 text-xs text-white/40">{fmtTs(it.ts ?? '')}</div>
            {it.note ? <div className="text-xs text-white/50">— {it.note}</div> : null}
            {shell ? <div className="text-xs font-semibold text-rose-300">artifact疑似空壳</div> : null}
          </div>
        )
      })}
    </div>
  )
}

function CostTrend() {
  const [items, setItems] = useState<any[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const r: MetricsResp = await fetch('/api/metrics/cost/recent?limit=180').then((x) => x.json())
        if (!cancelled) {
          setItems(Array.isArray(r.items) ? r.items : [])
          setErr(null)
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e))
      }
    }

    load()
    const t = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (err) return <div className="text-rose-300">trend load failed: {err}</div>

  const spend = items.map((it) => it?.data?.today?.spend_usd).filter((v) => typeof v === 'number') as number[]
  const remaining = items.map((it) => it?.data?.today?.remaining_usd).filter((v) => typeof v === 'number') as number[]

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="mb-1 text-xs text-white/50">today spend</div>
        <Sparkline values={spend.slice(-60)} />
      </div>
      <div>
        <div className="mb-1 text-xs text-white/50">remaining</div>
        <Sparkline values={remaining.slice(-60)} />
      </div>
    </div>
  )
}

function CodezCost() {
  const [resp, setResp] = useState<CodezResp | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/cost/codez')
        const txt = await res.text()
        let r: any
        try {
          r = JSON.parse(txt)
        } catch {
          r = { ok: false, data: { raw: txt }, parseError: true }
        }
        if (!cancelled) {
          setResp(r)
          setErr(res.ok ? null : `HTTP ${res.status}`)
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e))
      }
    }

    load()
    const t = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (err) return <div className="text-rose-300">load failed: {err}</div>
  if (!resp) {
    ;(globalThis as any).__COST_DEBUG = { at: new Date().toISOString(), note: 'still loading' }
    return <div className="text-white/50">loading... (fetch /api/cost/codez)</div>
  }

  const d: any = resp.data as any
  const structured = d && typeof d === 'object' && 'today' in d && 'history' in d

  if (!structured) {
    return <div className="text-white/60">unexpected: {JSON.stringify(resp.data)}</div>
  }

  const remainingLow = d.today.remaining_usd < 5

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40">as_of {d.as_of}</div>
        <Badge ok={!remainingLow} text={remainingLow ? 'LOW (<$5)' : 'OK'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">today spend</div>
          <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-white/90">
            <Wallet className="h-4 w-4" />
            {fmtMoney(d.today.spend_usd)}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">remaining</div>
          <div className={
            'mt-1 flex items-center gap-2 text-lg font-semibold ' +
            (remainingLow ? 'text-rose-300' : 'text-white/90')
          }>
            {remainingLow ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {fmtMoney(d.today.remaining_usd)}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">calls</div>
          <div className="mt-1 text-lg font-semibold text-white/90">{d.today.calls}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/40">cache hit</div>
          <div className="mt-1 text-lg font-semibold text-white/90">{d.today.cache_hit_rate_pct.toFixed(2)}%</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/50">
        history total: {fmtMoney(d.history.total_spend_usd)}
      </div>

      <CostTrend />
    </div>
  )
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [host, setHost] = useState<HostSummary | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const h = await fetch('/api/health').then((r) => r.json())
        const s = await fetch('/api/host/summary').then((r) => r.json())
        if (!cancelled) {
          setHealth(h)
          setHost(s)
          setErr(null)
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e))
      }
    }

    load()
    const t = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#060812]">
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute left-[-20%] top-[-30%] h-[520px] w-[520px] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-20%] top-[-30%] h-[520px] w-[520px] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute left-[10%] bottom-[-40%] h-[560px] w-[560px] rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-300" />
              <h1 className="text-lg font-semibold tracking-wide text-white/90">OpenClaw Monitor</h1>
              <span className="text-xs text-white/40">localhost</span>
            </div>
            <div className="mt-1 text-xs text-white/40">Host/Health 3s · Cost 10s · Cron 10s</div>
          </div>
          <div>
            <Badge ok={!!health?.ok} text={health?.ok ? 'API OK' : 'API DOWN'} />
          </div>
        </div>

        {err ? <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">API Error: {err}</div> : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Left column: runtime + cost */}
          <div className="xl:col-span-4 space-y-4">
            <GlassCard title="Runtime health" icon={<Activity className="h-4 w-4" />}
              right={<span className="text-xs text-white/40">A: API RTT · B: gateway CPU/RSS</span>}
            >
              <RuntimeHealth />
            </GlassCard>

            <GlassCard title="Cost (CodeZ)" icon={<Wallet className="h-4 w-4" />}
              right={<span className="text-xs text-white/40">remaining &lt; $5 = red</span>}
            >
              <CodezCost />
            </GlassCard>
          </div>

          {/* Middle column: cron */}
          <div className="xl:col-span-4 space-y-4">
            <GlassCard title="Cron delivery (stats)" icon={<Database className="h-4 w-4" />}
              right={<Activity className="h-4 w-4 text-white/50" />}
            >
              <CronStats />
            </GlassCard>

            <GlassCard title="Cron runs (latest)" icon={<Database className="h-4 w-4" />}
              right={<span className="text-xs text-white/40">last 12</span>}
            >
              <CronRuns />
            </GlassCard>
          </div>

          {/* Right column: host */}
          <div className="xl:col-span-4 space-y-4">
            <GlassCard title="Host resources" icon={<Cpu className="h-4 w-4" />}
              right={<span className="text-xs text-white/40">{host?.hostname ?? '-'}</span>}
            >
              {host ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/40">cpu ~</div>
                    <div className="mt-1 text-lg font-semibold text-white/90">{host.cpuUsagePctApprox ?? '-'}%</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/40">mem</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">
                      {host.mem ? `${bytesToGiB(host.mem.used)} / ${bytesToGiB(host.mem.total)}` : '-'}
                    </div>
                    <div className="mt-1 text-xs text-white/50">{host.mem ? `${host.mem.percent}%` : '-'}</div>
                  </div>
                  <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <HardDrive className="h-3.5 w-3.5" />
                      disk
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white/90">
                      {host.disk ? `${bytesToGiB(host.disk.used)} / ${bytesToGiB(host.disk.total)}` : '-'}
                    </div>
                    <div className="mt-1 text-xs text-white/50">{host.disk ? `${host.disk.percent}%` : '-'}</div>
                  </div>
                </div>
              ) : (
                <div className="text-white/50">loading...</div>
              )}
            </GlassCard>

            <GlassCard title="Top processes (mem)" icon={<Cpu className="h-4 w-4" />}
              right={<span className="text-xs text-white/40">top 10</span>}
            >
              <TopProcesses sort="mem" />
            </GlassCard>

            <GlassCard title="Top processes (cpu)" icon={<Cpu className="h-4 w-4" />}
              right={<span className="text-xs text-white/40">top 10</span>}
            >
              <TopProcesses sort="cpu" />
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  )
}
