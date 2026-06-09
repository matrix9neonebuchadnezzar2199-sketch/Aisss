export const EXCEL_TEMPLATE_VERSION = 'aisss-cases-v1'

export const TEMPLATE_HEADERS = [
  'case_uuid',
  'display_id',
  'title',
  'material_number',
  'summary',
  'body_summary',
  'body_article',
  'body_assessment',
  'body_reference',
  'event_start_date',
  'event_end_date',
  'material_type',
  'registering_department',
  'category',
  'region',
  'source',
  'handling_type',
  'reliability',
  'accuracy',
  'rank',
  'viewing_ranges',
  'conditions',
  'classification_number',
  'keyword1',
  'keyword2',
  'keyword3',
  'keyword4',
  'keyword5',
  'keyword6',
  'note1',
  'note2',
  'note3',
  'note4',
  'note5',
  'note6',
  'action_taken',
  'condition_notes',
  'viewing_range_note'
] as const

export type ExcelRow = Record<string, string | number | boolean | null | undefined>

export type RowIssue = {
  level: 'error' | 'warning'
  code: string
  message: string
}

export type ValidatedExcelRow = {
  row_number: number
  raw: ExcelRow
  parsed: Record<string, unknown> | null
  errors: RowIssue[]
  warnings: RowIssue[]
  valid: boolean
}
