import { createRequire } from 'node:module'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { analyzeSQLiteBuffer } from './zeusdb.js'
import { loadConfig } from './config.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

function sourceTypeForKind (kind) {
  switch (kind) {
    case 'pdf': return 'pdf_parse'
    case 'office': return 'office_parse'
    case 'image': return 'ocr'
    case 'audio': return 'asr'
    case 'sqlite': return 'sqlite_forensic'
    case 'text': return 'manual_text'
    default: return 'manual_text'
  }
}

function extractSpreadsheetText (buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const parts = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet).trim()
    if (csv) parts.push(`## ${sheetName}\n${csv}`)
  }
  return parts.join('\n\n').trim()
}

export async function extractText (attachment, buffer, deps = {}) {
  const kind = attachment.attachment_kind
  const fileName = attachment.file_name.toLowerCase()

  if (kind === 'sqlite' || /\.(sqlite|sqlite3|db)$/.test(fileName)) {
    try {
      if (deps.analyzeSQLite) {
        return await deps.analyzeSQLite(buffer, attachment.file_name, deps.config ?? {})
      }
      const config = deps.config ?? loadConfig()
      return await analyzeSQLiteBuffer(buffer, attachment.file_name, config)
    } catch (error) {
      return {
        text: '',
        engine: 'zeus-db',
        sourceType: 'sqlite_forensic',
        metadata: {},
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

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

  if (kind === 'office' && /\.(xlsx|xls)$/.test(fileName)) {
    const text = extractSpreadsheetText(buffer)
    return {
      text,
      engine: 'xlsx',
      sourceType: 'office_parse',
      metadata: { format: fileName.endsWith('.xls') ? 'xls' : 'xlsx', sheets: text ? undefined : 0 },
      ...(text ? {} : { error: 'Spreadsheet has no extractable cell text.' })
    }
  }

  if (kind === 'office') {
    return {
      text: '',
      engine: 'stub',
      sourceType: 'office_parse',
      metadata: { format: fileName.split('.').pop() },
      error: `Office parser not implemented for ${fileName}. Use PDF, DOCX, or XLSX; for PPTX convert to PDF.`
    }
  }

  if (kind === 'image') {
    return {
      text: '',
      engine: 'transcript-first',
      sourceType: 'ocr',
      metadata: {},
      error: 'OCR は未設定です。画像の内容は .txt 形式の文字起こしを添付してください（transcript-first）。'
    }
  }

  if (kind === 'audio') {
    return {
      text: '',
      engine: 'transcript-first',
      sourceType: 'asr',
      metadata: {},
      error: 'ASR は未設定です。音声の内容は .txt 形式の文字起こしを添付してください（transcript-first）。'
    }
  }

  return {
    text: buffer.toString('utf8').trim(),
    engine: 'fallback-utf8',
    sourceType: sourceTypeForKind(kind),
    metadata: {}
  }
}
