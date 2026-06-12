/** フォルダ D&D / directory input から File 一覧を収集する。 */

const SKIP_FILE_NAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini'
])

export type FolderFileEntry = {
  /** UI 行の安定キー */
  id: string
  file: File
  /** webkitRelativePath または D&D 走査時の相対パス */
  relativePath: string
}

function shouldSkipFile (file: File): boolean {
  const base = file.name.toLowerCase()
  if (SKIP_FILE_NAMES.has(base)) return true
  if (base.startsWith('.')) return true
  return false
}

/** ファイル名から拡張子を除いた表題候補を返す。 */
export function titleFromFileName (fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return fileName
  return fileName.slice(0, dot)
}

export function defaultTitleForFile (file: File, relativePath?: string): string {
  const path = relativePath ?? ('webkitRelativePath' in file ? (file as File & { webkitRelativePath?: string }).webkitRelativePath : '') ?? ''
  const segment = path ? path.split('/').pop() ?? file.name : file.name
  return titleFromFileName(segment)
}

export function collectFilesFromFileList (fileList: FileList | File[]): FolderFileEntry[] {
  const files = Array.from(fileList)
  const entries: FolderFileEntry[] = []
  let seq = 0
  for (const file of files) {
    if (shouldSkipFile(file)) continue
    const rel = ('webkitRelativePath' in file && (file as File & { webkitRelativePath?: string }).webkitRelativePath)
      ? (file as File & { webkitRelativePath: string }).webkitRelativePath
      : file.name
    entries.push({
      id: `f-${seq++}-${file.name}-${file.size}`,
      file,
      relativePath: rel
    })
  }
  return entries
}

async function readDirectoryEntry (dir: FileSystemDirectoryEntry, prefix: string): Promise<FolderFileEntry[]> {
  const reader = dir.createReader()
  const entries: FolderFileEntry[] = []
  let seq = 0

  const readBatch = (): Promise<FileSystemEntry[]> => new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject)
  })

  let batch = await readBatch()
  while (batch.length > 0) {
    for (const entry of batch) {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject)
        })
        if (shouldSkipFile(file)) continue
        const relativePath = prefix ? `${prefix}/${file.name}` : file.name
        entries.push({
          id: `d-${seq++}-${relativePath}-${file.size}`,
          file,
          relativePath
        })
      } else if (entry.isDirectory) {
        const sub = entry as FileSystemDirectoryEntry
        const subPrefix = prefix ? `${prefix}/${sub.name}` : sub.name
        entries.push(...await readDirectoryEntry(sub, subPrefix))
      }
    }
    batch = await readBatch()
  }
  return entries
}

/** DataTransfer からフォルダ／ファイルを再帰的に読み取る。 */
export async function collectFilesFromDataTransfer (dt: DataTransfer): Promise<FolderFileEntry[]> {
  const items = dt.items
  if (!items || items.length === 0) {
    return collectFilesFromFileList(dt.files)
  }

  const entries: FolderFileEntry[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.() ?? null
    if (!entry) {
      const file = item.getAsFile()
      if (file && !shouldSkipFile(file)) {
        entries.push({
          id: `x-${file.name}-${file.size}`,
          file,
          relativePath: file.name
        })
      }
      continue
    }
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject)
      })
      if (!shouldSkipFile(file)) {
        entries.push({
          id: `x-${file.name}-${file.size}`,
          file,
          relativePath: file.name
        })
      }
    } else if (entry.isDirectory) {
      entries.push(...await readDirectoryEntry(entry as FileSystemDirectoryEntry, entry.name))
    }
  }
  return entries
}

export function formatBytes (bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(unit === 0 ? 0 : 1) : value.toFixed(2)} ${units[unit]}`
}
