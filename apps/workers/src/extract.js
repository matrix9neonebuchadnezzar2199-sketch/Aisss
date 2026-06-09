import { createRequire } from 'node:module'
import mammoth from 'mammoth'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

function sourceTypeForKind (kind) {
  switch (kind) {
    case 'pdf': return 'pdf_parse'
    case 'office': return 'office_parse'
    case 'image': return 'ocr'
    case 'audio': return 'asr'
    case 'text': return 'manual_text'
    default: return 'manual_text'
  }
}

export async function extractText (attachment, buffer) {
  const kind = attachment.attachment_kind
  const fileName = attachment.file_name.toLowerCase()

  if (kind === 'pdf' || fileName.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer)
    return {
      text: parsed.text?.trim() ?? '',
      engine: 'pdf-parse',
      sourceType: 'pdf_parse',
      metadata: { pages: parsed.numpages }
    }
  }

  if (kind === 'text' || /\.(txt|md|csv|log)$/.test(fileName)) {
    return {
      text: buffer.toString('utf8').trim(),
      engine: 'utf8',
      sourceType: 'manual_text',
      metadata: {}
    }
  }

  if (kind === 'office' && fileName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    return {
      text: result.value?.trim() ?? '',
      engine: 'mammoth',
      sourceType: 'office_parse',
      metadata: { format: 'docx' }
    }
  }

  if (kind === 'office') {
    return {
      text: '',
      engine: 'stub',
      sourceType: 'office_parse',
      metadata: {},
      error: `Office parser not implemented for ${fileName}. Convert to PDF or DOCX for M3.`
    }
  }

  if (kind === 'image') {
    return {
      text: '',
      engine: 'ocr-stub',
      sourceType: 'ocr',
      metadata: {},
      error: 'OCR engine not configured in M3 worker. Add Tesseract or external OCR service.'
    }
  }

  if (kind === 'audio') {
    return {
      text: '',
      engine: 'asr-stub',
      sourceType: 'asr',
      metadata: {},
      error: 'ASR engine not configured in M3 worker. Upload a manual transcript as .txt.'
    }
  }

  return {
    text: '',
    engine: 'unknown',
    sourceType: 'manual_text',
    metadata: {},
    error: `Unsupported attachment kind: ${kind}`
  }
}

export { sourceTypeForKind }
