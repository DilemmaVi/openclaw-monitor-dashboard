import fs from 'node:fs/promises'

export async function computeFilesSignature(filePaths: string[]) {
  let maxMtimeMs = 0
  let sumMtimeMs = 0
  let sumSize = 0
  let missing = 0

  for (const p of filePaths) {
    try {
      const st = await fs.stat(p)
      const m = Math.max(0, Number(st.mtimeMs))
      const s = Math.max(0, Number(st.size))
      if (Number.isFinite(m)) {
        if (m > maxMtimeMs) maxMtimeMs = m
        sumMtimeMs += m
      }
      if (Number.isFinite(s)) sumSize += s
    } catch {
      missing++
    }
  }

  const key = `${filePaths.length}|${missing}|${Math.round(maxMtimeMs)}|${Math.round(sumMtimeMs)}|${Math.round(sumSize)}`
  return { key, maxMtimeMs, sumMtimeMs, sumSize, missing }
}
