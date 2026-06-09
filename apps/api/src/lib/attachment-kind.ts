export type AttachmentKind = 'office' | 'pdf' | 'image' | 'audio' | 'text' | 'other'

export function detectAttachmentKind (
  fileName: string,
  contentType: string
): AttachmentKind {
  const lower = fileName.toLowerCase()
  const mime = contentType.toLowerCase()

  if (mime.includes('pdf') || lower.endsWith('.pdf')) return 'pdf'
  if (
    mime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|tiff?)$/.test(lower)
  ) return 'image'
  if (
    mime.startsWith('audio/') ||
    /\.(mp3|wav|m4a|ogg|flac)$/.test(lower)
  ) return 'audio'
  if (
    mime.startsWith('text/') ||
    /\.(txt|md|csv|log)$/.test(lower)
  ) return 'text'
  if (
    /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/.test(lower) ||
    mime.includes('officedocument') ||
    mime.includes('msword') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation')
  ) return 'office'
  return 'other'
}

export function sourceTypeForKind (kind: AttachmentKind): string {
  switch (kind) {
    case 'pdf': return 'pdf_parse'
    case 'office': return 'office_parse'
    case 'image': return 'ocr'
    case 'audio': return 'asr'
    case 'text': return 'manual_text'
    default: return 'manual_text'
  }
}
