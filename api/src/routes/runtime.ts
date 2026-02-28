import type { FastifyInstance } from 'fastify'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function timedFetch(url: string, timeoutMs: number) {
  const t0 = Date.now()
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    const ms = Date.now() - t0
    const ok = res.ok
    // drain minimal
    await res.text()
    return { url, ok, status: res.status, ms }
  } catch (e: any) {
    const ms = Date.now() - t0
    return { url, ok: false, status: 0, ms, error: e?.message ?? String(e) }
  } finally {
    clearTimeout(to)
  }
}

async function getGatewayProcess() {
  // Find openclaw-gateway process line and parse basic metrics.
  // ps columns: pid pcpu pmem rss etime comm
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid,pcpu,pmem,rss,etime,comm'], {
    timeout: 5000,
    maxBuffer: 3 * 1024 * 1024
  })
  const lines = stdout.split(/\n/).slice(1)
  for (const line of lines) {
    if (!line.includes('openclaw-gateway')) continue
    const t = line.trim()
    const m = t.match(/^([0-9]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9]+)\s+([^\s]+)\s+(.*)$/)
    if (!m) continue
    return {
      pid: Number(m[1]),
      cpu: Number(m[2]),
      memPct: Number(m[3]),
      rssKb: Number(m[4]),
      etime: m[5],
      comm: m[6]
    }
  }
  return null
}

export async function registerRuntimeRoutes(app: FastifyInstance) {
  // in-memory ring buffer for last N API checks
  const history: any[] = []
  const push = (x: any) => {
    history.push(x)
    while (history.length > 300) history.shift()
  }

  app.get('/api/runtime/health', async () => {
    const base = 'http://127.0.0.1:4318'
    const endpoints = ['/api/health', '/api/cost/codez', '/api/cron/runs']

    const checks = [] as any[]
    for (const p of endpoints) {
      const r = await timedFetch(base + p, 8000)
      checks.push(r)
    }

    const ts = new Date().toISOString()
    const rec = { ts, checks }
    push(rec)

    const okCount = checks.filter((c) => c.ok).length
    const gateway = await getGatewayProcess()

    return {
      ok: okCount === checks.length,
      ts,
      checks,
      history_tail: history.slice(-60),
      gateway
    }
  })

  app.get('/api/runtime/gateway_status', async () => {
    try {
      const { stdout } = await execFileAsync('openclaw', ['gateway', 'status'], {
        timeout: 5000,
        maxBuffer: 1024 * 1024
      })
      return { ok: true, stdout: stdout.trim() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) }
    }
  })
}
