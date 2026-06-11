import type pg from 'pg'
import { detectAttachmentKind } from '../lib/attachment-kind.js'

export type RagStorageCategoryId = 'case_text' | 'office' | 'pdf' | 'audio' | 'image'

export type RagStorageCategory = {
  id: RagStorageCategoryId
  label: string
  bytes: number
  file_count: number
  chunk_count: number
  indexed_bytes: number
}

export type RagStorageBreakdown = {
  total_bytes: number
  total_files: number
  total_chunks: number
  categories: RagStorageCategory[]
}

const CATEGORY_ORDER: RagStorageCategoryId[] = [
  'case_text',
  'office',
  'pdf',
  'audio',
  'image'
]

const CATEGORY_LABELS: Record<RagStorageCategoryId, string> = {
  case_text: 'ケース文章',
  office: 'OFFICE関連',
  pdf: 'PDF',
  audio: '音声（テキスト化）',
  image: '画像（人物・風景）'
}

/** metadata_json.source_type → dashboard category */
export function categoryFromSourceType (sourceType: string | null | undefined): RagStorageCategoryId | null {
  switch (sourceType) {
    case 'case_body': return 'case_text'
    case 'office_parse': return 'office'
    case 'pdf_parse': return 'pdf'
    case 'asr': return 'audio'
    case 'ocr': return 'image'
    default: return null
  }
}

/** attachments.attachment_kind → dashboard category (text/other は対象外) */
export function categoryFromAttachmentKind (kind: string | null | undefined): RagStorageCategoryId | null {
  switch (kind) {
    case 'office': return 'office'
    case 'pdf': return 'pdf'
    case 'audio': return 'audio'
    case 'image': return 'image'
    default: return null
  }
}

function createEmptyBucket (): Record<RagStorageCategoryId, RagStorageCategory> {
  return Object.fromEntries(
    CATEGORY_ORDER.map((id) => [
      id,
      {
        id,
        label: CATEGORY_LABELS[id],
        bytes: 0,
        file_count: 0,
        chunk_count: 0,
        indexed_bytes: 0
      }
    ])
  ) as Record<RagStorageCategoryId, RagStorageCategory>
}

export async function getRagStorageBreakdown (pool: pg.Pool): Promise<RagStorageBreakdown> {
  const buckets = createEmptyBucket()

  const [caseTextRow, attachmentRows, standaloneRows, chunkRows] = await Promise.all([
    pool.query<{ byte_count: string; case_count: string }>(
      `SELECT
         COALESCE(SUM(
           octet_length(COALESCE(body_summary, '')) +
           octet_length(COALESCE(body_article, '')) +
           octet_length(COALESCE(body_assessment, '')) +
           octet_length(COALESCE(body_reference, ''))
         ), 0)::text AS byte_count,
         COUNT(*) FILTER (WHERE
           COALESCE(body_summary, '') <> '' OR
           COALESCE(body_article, '') <> '' OR
           COALESCE(body_assessment, '') <> '' OR
           COALESCE(body_reference, '') <> ''
         )::text AS case_count
       FROM cases
       WHERE deleted_at IS NULL`
    ),
    pool.query<{ attachment_kind: string; file_count: string; byte_count: string }>(
      `SELECT
         a.attachment_kind,
         COUNT(*)::text AS file_count,
         COALESCE(SUM(a.file_size), 0)::text AS byte_count
       FROM attachments a
       JOIN cases c ON c.id = a.case_id AND c.deleted_at IS NULL
       GROUP BY a.attachment_kind`
    ),
    pool.query<{ file_name: string; content_type: string | null; file_size: string | null }>(
      `SELECT file_name, content_type, file_size::text
       FROM standalone_files
       WHERE deleted_at IS NULL`
    ),
    pool.query<{ source_type: string | null; chunk_count: string; indexed_bytes: string }>(
      `SELECT
         rc.metadata_json->>'source_type' AS source_type,
         COUNT(*)::text AS chunk_count,
         COALESCE(SUM(octet_length(rc.chunk_text)), 0)::text AS indexed_bytes
       FROM rag_chunks rc
       GROUP BY rc.metadata_json->>'source_type'`
    )
  ])

  const caseBucket = buckets.case_text
  caseBucket.bytes = Number(caseTextRow.rows[0]?.byte_count ?? 0)
  caseBucket.file_count = Number(caseTextRow.rows[0]?.case_count ?? 0)

  for (const row of attachmentRows.rows) {
    const category = categoryFromAttachmentKind(row.attachment_kind)
    if (!category) continue
    const bucket = buckets[category]
    bucket.bytes += Number(row.byte_count ?? 0)
    bucket.file_count += Number(row.file_count ?? 0)
  }

  for (const row of standaloneRows.rows) {
    const kind = detectAttachmentKind(row.file_name, row.content_type ?? '')
    const category = categoryFromAttachmentKind(kind)
    if (!category) continue
    const bucket = buckets[category]
    bucket.bytes += Number(row.file_size ?? 0)
    bucket.file_count += 1
  }

  for (const row of chunkRows.rows) {
    const category = categoryFromSourceType(row.source_type)
    if (!category) continue
    const bucket = buckets[category]
    bucket.chunk_count += Number(row.chunk_count ?? 0)
    bucket.indexed_bytes += Number(row.indexed_bytes ?? 0)
  }

  const categories = CATEGORY_ORDER.map((id) => buckets[id])
  const total_bytes = categories.reduce((sum, c) => sum + c.bytes, 0)
  const total_files = categories.reduce((sum, c) => sum + c.file_count, 0)
  const total_chunks = categories.reduce((sum, c) => sum + c.chunk_count, 0)

  return { total_bytes, total_files, total_chunks, categories }
}
