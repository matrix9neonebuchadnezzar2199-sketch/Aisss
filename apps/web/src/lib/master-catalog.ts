/** 各画面の select / チェックボックス候補として参照するマスタ定義 */

export type MasterFieldDef = {
  /** GET /api/masters/{key} */
  key: string
  /** フォーム上のラベル */
  label: string
}

export type MasterPageDef = {
  id: string
  title: string
  /** 折りたたみ状態の localStorage キー */
  storageKey: string
  fields: MasterFieldDef[]
}

/**
 * ケース（事象）登録・検索で共通のマスタ項目。
 * 登録フォームと検索フィルタは同一候補を参照する — 片方だけ増減させない。
 *
 * `viewing-ranges` は参照資料登録・RAG 管理・ユーザー・グループ管理でも同一データを参照する。
 */
export const CASE_MASTER_FIELDS: MasterFieldDef[] = [
  { key: 'material-types', label: '資料区分' },
  { key: 'categories', label: '分類' },
  { key: 'regions', label: '地域' },
  { key: 'sources', label: '資料源' },
  { key: 'departments', label: '登録部署' },
  { key: 'persons', label: '資料登録者 / 情報収集者' },
  { key: 'acquisition-locations', label: '情報入手場所' },
  { key: 'information-requests', label: '対応情報要求' },
  { key: 'handling-types', label: '取扱区分' },
  { key: 'reliability-levels', label: '信頼性' },
  { key: 'accuracy-levels', label: '正確性' },
  { key: 'rank-levels', label: 'ランク' },
  { key: 'retention-policies', label: '保存期間' },
  { key: 'viewing-ranges', label: '閲覧範囲' },
  { key: 'conditions', label: '条件' }
]

/** ケース画面が `/api/masters/*` から取得する key 一覧 */
export function caseMasterKeys (): string[] {
  return CASE_MASTER_FIELDS.map((field) => field.key)
}

/** マスタ管理 UI のセクション（閲覧範囲はケース項目に含め、他画面用の重複セクションは持たない） */
export const MASTER_PAGES: MasterPageDef[] = [
  {
    id: 'case',
    title: 'ケース（事象）登録・検索',
    storageKey: 'aisss-masters-page-case-collapsed',
    fields: CASE_MASTER_FIELDS
  }
]

/** 全画面で参照されるユニークなマスタ key */
export function collectMasterKeys (): string[] {
  return caseMasterKeys()
}
