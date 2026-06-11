import type pg from 'pg'

/** 添付削除前に extraction / embedding 等のジョブ行を掃除する */
export async function deleteJobsForAttachment (
  executor: pg.Pool | pg.PoolClient,
  attachmentId: string
): Promise<void> {
  await executor.query(`DELETE FROM jobs WHERE attachment_id = $1`, [attachmentId])
  await executor.query(
    `DELETE FROM jobs WHERE payload_json->>'attachment_id' = $1`,
    [attachmentId]
  )
}

/** 単独ファイル削除前に payload 参照のジョブ行を掃除する */
export async function deleteJobsForStandaloneFile (
  executor: pg.Pool | pg.PoolClient,
  standaloneFileId: string
): Promise<void> {
  await executor.query(
    `DELETE FROM jobs WHERE payload_json->>'standalone_file_id' = $1`,
    [standaloneFileId]
  )
}
