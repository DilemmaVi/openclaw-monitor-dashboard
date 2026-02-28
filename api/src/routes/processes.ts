import type { FastifyInstance } from 'fastify'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function parsePs(lines: string[]) {
  // ps -axo pid,pcpu,pmem,rss,etime,comm
  const out: any[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    // split into 6 columns: pid pcpu pmem rss etime comm
    const m = t.match(/^([0-9]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9]+)\s+([^\s]+)\s+(.*)$/)
    if (!m) continue
    out.push({
      pid: Number(m[1]),
      cpu: Number(m[2]),
      memPct: Number(m[3]),
      rssKb: Number(m[4]),
      etime: m[5],
      comm: m[6]
    })
  }
  return out
}

export async function registerProcessRoutes(app: FastifyInstance) {
  app.get('/api/host/processes', async (req) => {
    const top = Math.min(50, Math.max(1, Number((req.query as any)?.top ?? 10)))
    const sort = String((req.query as any)?.sort ?? 'mem') // mem|cpu

    // macOS ps supports -axo
    const { stdout } = await execFileAsync('ps', ['-axo', 'pid,pcpu,pmem,rss,etime,comm'], {
      timeout: 5000,
      maxBuffer: 3 * 1024 * 1024
    })

    const lines = stdout.split(/\n/).slice(1) // drop header
    let items = parsePs(lines)

    items = items.filter((x) => Number.isFinite(x.pid))

    if (sort === 'cpu') items.sort((a, b) => b.cpu - a.cpu)
    else items.sort((a, b) => b.rssKb - a.rssKb)

    return { ok: true, items: items.slice(0, top) }
  })
}
