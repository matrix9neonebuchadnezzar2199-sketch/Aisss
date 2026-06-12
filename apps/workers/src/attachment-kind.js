/** API `attachment-kind.ts` と同じ判定（worker 単体で参照）。 */

export function detectAttachmentKind (fileName, contentType = '') {
  const lower = fileName.toLowerCase()
  const mime = (contentType ?? '').toLowerCase()

  if (mime.includes('pdf') || lower.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|tiff?)$/.test(lower)) return 'image'
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac)$/.test(lower)) return 'audio'
  if (mime.startsWith('text/') || /\.(txt|md|csv|log)$/.test(lower)) return 'text'
  if (/\.(sqlite|sqlite3|db)$/.test(lower) || mime.includes('sqlite') || mime.includes('x-sqlite3')) return 'sqlite'
  if (
    /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/.test(lower) ||
    mime.includes('officedocument') ||
    mime.includes('msword') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation')
  ) return 'office'
  return 'other'
}
