export const emptyCaseForm = {
  title: '',
  material_number: '',
  classification_number: '',
  summary: '',
  body_summary: '',
  body_article: '',
  body_assessment: '',
  body_reference: '',
  event_start_date: '',
  event_end_date: '',
  material_type_id: '',
  registering_department_id: '',
  category_id: '',
  region_id: '',
  source_id: '',
  registrant_id: '',
  information_request_id: '',
  handling_type_id: '',
  reliability_id: '',
  accuracy_id: '',
  rank_id: '',
  retention_policy_id: '',
  acquisition_location_id: '',
  action_taken: '',
  condition_notes: '',
  viewing_range_note: '',
  note_1: '',
  note_2: '',
  note_3: '',
  note_4: '',
  note_5: '',
  note_6: '',
  keyword_names_text: '',
  viewing_range_ids: [] as string[],
  condition_ids: [] as string[],
  collector_person_ids: [] as string[]
}

export type CaseFormState = typeof emptyCaseForm

export function isFormFieldEmpty (value: string | string[]): boolean {
  if (Array.isArray(value)) return value.length === 0
  return value.trim() === ''
}

export function caseFormToPayload (form: CaseFormState) {
  const nullIfEmpty = (v: string) => v || null
  return {
    title: form.title,
    material_number: nullIfEmpty(form.material_number),
    classification_number: nullIfEmpty(form.classification_number),
    summary: nullIfEmpty(form.summary),
    body_summary: nullIfEmpty(form.body_summary),
    body_article: nullIfEmpty(form.body_article),
    body_assessment: nullIfEmpty(form.body_assessment),
    body_reference: nullIfEmpty(form.body_reference),
    event_start_date: nullIfEmpty(form.event_start_date),
    event_end_date: nullIfEmpty(form.event_end_date),
    material_type_id: nullIfEmpty(form.material_type_id),
    registering_department_id: nullIfEmpty(form.registering_department_id),
    category_id: nullIfEmpty(form.category_id),
    region_id: nullIfEmpty(form.region_id),
    source_id: nullIfEmpty(form.source_id),
    registrant_id: nullIfEmpty(form.registrant_id),
    information_request_id: nullIfEmpty(form.information_request_id),
    handling_type_id: nullIfEmpty(form.handling_type_id),
    reliability_id: nullIfEmpty(form.reliability_id),
    accuracy_id: nullIfEmpty(form.accuracy_id),
    rank_id: nullIfEmpty(form.rank_id),
    retention_policy_id: nullIfEmpty(form.retention_policy_id),
    acquisition_location_id: nullIfEmpty(form.acquisition_location_id),
    action_taken: nullIfEmpty(form.action_taken),
    condition_notes: nullIfEmpty(form.condition_notes),
    viewing_range_note: nullIfEmpty(form.viewing_range_note),
    note_1: nullIfEmpty(form.note_1),
    note_2: nullIfEmpty(form.note_2),
    note_3: nullIfEmpty(form.note_3),
    note_4: nullIfEmpty(form.note_4),
    note_5: nullIfEmpty(form.note_5),
    note_6: nullIfEmpty(form.note_6),
    viewing_range_ids: form.viewing_range_ids,
    condition_ids: form.condition_ids,
    collector_person_ids: form.collector_person_ids,
    keyword_names: form.keyword_names_text
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

export function caseDetailToForm (c: Record<string, unknown>): CaseFormState {
  const keywords = c.keywords as Array<{ name: string }> | undefined
  const collectors = c.collectors as Array<{ id: string }> | undefined
  return {
    ...emptyCaseForm,
    title: (c.title as string) ?? '',
    material_number: (c.material_number as string) ?? '',
    classification_number: (c.classification_number as string) ?? '',
    summary: (c.summary as string) ?? '',
    body_summary: (c.body_summary as string) ?? '',
    body_article: (c.body_article as string) ?? '',
    body_assessment: (c.body_assessment as string) ?? '',
    body_reference: (c.body_reference as string) ?? '',
    event_start_date: (c.event_start_date as string)?.slice(0, 10) ?? '',
    event_end_date: (c.event_end_date as string)?.slice(0, 10) ?? '',
    material_type_id: (c.material_type_id as string) ?? '',
    registering_department_id: (c.registering_department_id as string) ?? '',
    category_id: (c.category_id as string) ?? '',
    region_id: (c.region_id as string) ?? '',
    source_id: (c.source_id as string) ?? '',
    registrant_id: (c.registrant_id as string) ?? '',
    information_request_id: (c.information_request_id as string) ?? '',
    handling_type_id: (c.handling_type_id as string) ?? '',
    reliability_id: (c.reliability_id as string) ?? '',
    accuracy_id: (c.accuracy_id as string) ?? '',
    rank_id: (c.rank_id as string) ?? '',
    retention_policy_id: (c.retention_policy_id as string) ?? '',
    acquisition_location_id: (c.acquisition_location_id as string) ?? '',
    action_taken: (c.action_taken as string) ?? '',
    condition_notes: (c.condition_notes as string) ?? '',
    viewing_range_note: (c.viewing_range_note as string) ?? '',
    note_1: (c.note_1 as string) ?? '',
    note_2: (c.note_2 as string) ?? '',
    note_3: (c.note_3 as string) ?? '',
    note_4: (c.note_4 as string) ?? '',
    note_5: (c.note_5 as string) ?? '',
    note_6: (c.note_6 as string) ?? '',
    keyword_names_text: keywords?.map((k) => k.name).join(', ') ?? '',
    viewing_range_ids: (c.viewing_ranges as Array<{ id: string }> | undefined)?.map((v) => v.id) ?? [],
    condition_ids: (c.conditions as Array<{ id: string }> | undefined)?.map((v) => v.id) ?? [],
    collector_person_ids: collectors?.map((p) => p.id) ?? []
  }
}
