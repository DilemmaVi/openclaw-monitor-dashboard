import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function getDiskUsage(): Promise<{ total: number; used: number; avail: number; percent: number } | null> {
  try {
    const { stdout } = await execFileAsync('df', ['-k', '/'], { timeout: 3000, maxBuffer: 1024 * 1024 })
    const lines = stdout.trim().split(/\n/)
    if (lines.length < 2) return null
    const parts = lines[1].trim().split(/\s+/)
    // Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on
    const totalKb = Number(parts[1])
    const usedKb = Number(parts[2])
    const availKb = Number(parts[3])
    const cap = parts[4] // like '15%'
    const percent = Number(String(cap).replace('%', ''))
    return {
      total: totalKb * 1024,
      used: usedKb * 1024,
      avail: availKb * 1024,
      percent: Number.isFinite(percent) ? percent : Math.round((usedKb / totalKb) * 100)
    }
  } catch {
    return null
  }
}

export function getCpuUsagePct(): number {
  // crude: 1-min load / cpu count => pct-like
  const load1 = os.loadavg()[0] || 0
  const cpus = os.cpus()?.length || 1
  return Math.max(0, Math.min(100, (load1 / cpus) * 100))
}

export function getMemory(): { total: number; free: number; used: number; percent: number } {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  const percent = total ? (used / total) * 100 : 0
  return { total, free, used, percent }
}
