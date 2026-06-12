import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ViewingRangeCheckboxGroup } from '../components/ViewingRangeCheckboxGroup'
import { FormGroup } from '../components/form/FormGroup'
import {
  FolderRegisterDialog,
  type FolderFileDraft
} from '../components/rag/FolderRegisterDialog'
import { RegisterDropZone } from '../components/rag/RegisterDropZone'
import {
  collectFilesFromDataTransfer,
  collectFilesFromFileList,
  titleFromFileName,
  type FolderFileEntry
} from '../lib/folder-files'
import { apiFetch, uploadStandaloneFile, type MasterItem } from '../lib/api'

type RegisterMode = 'file' | 'folder'

type FileFormValidation = {
  title?: string
  viewingRange?: string
  file?: string
}

function validateFileForm (input: {
  title: string
  viewingRangeIds: string[]
  file: File | null
}): FileFormValidation {
  const errors: FileFormValidation = {}
  if (!input.title.trim()) {
    errors.title = '表題を入力してください'
  }
  if (input.viewingRangeIds.length === 0) {
    errors.viewingRange = '閲覧範囲を1つ以上選択してください'
  }
  if (!input.file) {
    errors.file = 'ファイルを選択してください'
  }
  return errors
}

function entriesToDrafts (
  entries: FolderFileEntry[],
  folderName: string,
  defaultViewingRangeIds: string[]
): FolderFileDraft[] {
  const title = folderName.trim() || '参照資料'
  return entries.map((entry) => ({
    ...entry,
    title,
    viewingRangeIds: [...defaultViewingRangeIds]
  }))
}

export function StandaloneFilePage () {
  const navigate = useNavigate()
  const [mode, setMode] = useState<RegisterMode>('file')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [viewingRangeIds, setViewingRangeIds] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [viewingRanges, setViewingRanges] = useState<MasterItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fileValidation, setFileValidation] = useState<FileFormValidation>({})
  const [loading, setLoading] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderLabel, setFolderLabel] = useState('')
  const [folderDrafts, setFolderDrafts] = useState<FolderFileDraft[]>([])
  const [folderEnableRag, setFolderEnableRag] = useState(true)
  const [folderProgress, setFolderProgress] = useState<{ done: number; total: number } | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void apiFetch<{ items: MasterItem[] }>('/api/masters/viewing-ranges')
      .then((d) => setViewingRanges(d.items))
      .catch((e: Error) => setError(e.message))
  }, [])

  function openFolderDrafts (label: string, entries: FolderFileEntry[]) {
    if (entries.length === 0) {
      setError('フォルダ内に登録可能なファイルがありません')
      return
    }
    setError(null)
    setFolderLabel(label)
    setFolderDrafts(entriesToDrafts(entries, label, viewingRangeIds))
    setFolderDialogOpen(true)
  }

  async function onFolderDropFromTransfer (dt: DataTransfer) {
    const entries = await collectFilesFromDataTransfer(dt)
    const root = entries[0]?.relativePath.split('/')[0] ?? 'ドロップフォルダ'
    openFolderDrafts(root, entries)
  }

  async function onFolderInputChange (list: FileList | null) {
    if (!list || list.length === 0) return
    const entries = collectFilesFromFileList(list)
    const first = list[0] as File & { webkitRelativePath?: string }
    const root = first.webkitRelativePath?.split('/')[0] ?? '選択フォルダ'
    openFolderDrafts(root, entries)
    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  async function onSubmitFile () {
    const validation = validateFileForm({ title, viewingRangeIds, file })
    if (Object.keys(validation).length > 0) {
      setFileValidation(validation)
      setError('未入力または未選択の項目があります。赤字の項目を確認してください。')
      return
    }
    setFileValidation({})
    const pickedFile = file
    if (!pickedFile) return
    setLoading(true)
    setError(null)
    try {
      const result = await uploadStandaloneFile({
        title: title.trim(),
        viewingRangeIds,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        file: pickedFile
      })
      navigate('/rag', { state: { extractingFileIds: [result.id] } })
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録失敗')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmitFolder () {
    if (folderDrafts.length === 0) return
    setLoading(true)
    setFolderProgress({ done: 0, total: folderDrafts.length })
    setError(null)
    const failures: string[] = []
    const uploadedIds: string[] = []
    try {
      for (let i = 0; i < folderDrafts.length; i++) {
        const row = folderDrafts[i]
        try {
          const result = await uploadStandaloneFile({
            title: row.title.trim(),
            viewingRangeIds: row.viewingRangeIds,
            tags: [],
            file: row.file,
            ragEnabled: folderEnableRag
          })
          uploadedIds.push(result.id)
        } catch (e) {
          failures.push(`${row.relativePath}: ${e instanceof Error ? e.message : '登録失敗'}`)
        }
        setFolderProgress({ done: i + 1, total: folderDrafts.length })
      }
      if (failures.length === folderDrafts.length) {
        setError(failures.join('\n'))
        return
      }
      if (failures.length > 0) {
        setError(`一部失敗 (${failures.length} 件):\n${failures.slice(0, 5).join('\n')}${failures.length > 5 ? '\n…' : ''}`)
      }
      setFolderDialogOpen(false)
      navigate('/rag', { state: { extractingFileIds: uploadedIds } })
    } finally {
      setLoading(false)
      setFolderProgress(null)
    }
  }

  return (
    <section className="view active" id="view-standalone-file">
      <div className="panel register-panel">
        <div className="panel-header">
          <div className="panel-header-title-row">
            <h2>参照資料登録</h2>
            <Link className="btn btn-sm" to="/rag">← RAG 管理</Link>
          </div>
          <div className="label-row">
            <span className="label label-default">単独 / フォルダ</span>
          </div>
        </div>
        <div className="panel-body">
          <p className="rag-register-note">
            ケースに紐づけない参照資料を登録します。ファイル単独またはフォルダ一括で登録でき、
            登録後は抽出ジョブが走り RAG 管理で状態を確認できます。
          </p>

          <div className="register-mode-tabs" role="tablist" aria-label="登録方式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'file'}
              className={`register-mode-tab register-mode-tab--file${mode === 'file' ? ' active' : ''}`}
              onClick={() => setMode('file')}
            >
              ファイル単独
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'folder'}
              className={`register-mode-tab register-mode-tab--folder${mode === 'folder' ? ' active' : ''}`}
              onClick={() => setMode('folder')}
            >
              フォルダ登録
            </button>
          </div>

          {error && !folderDialogOpen && <p className="error">{error}</p>}

          {mode === 'file' && (
            <>
              <div className="form-section">
                <h3>基本情報</h3>
                <div className="form-grid">
                  <FormGroup label="細部 / 表題" required wide empty={Boolean(fileValidation.title)}>
                    <input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value)
                        if (fileValidation.title) {
                          setFileValidation((v) => ({ ...v, title: undefined }))
                        }
                      }}
                      placeholder="資料の表題"
                    />
                    {fileValidation.title && <p className="field-error">{fileValidation.title}</p>}
                  </FormGroup>
                  <FormGroup label="タグ（カンマ区切り）" wide>
                    <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="参考, 条例" />
                  </FormGroup>
                </div>
              </div>

              <div className="form-section">
                <h3>取扱・閲覧</h3>
                <FormGroup label="閲覧範囲" required wide empty={Boolean(fileValidation.viewingRange)}>
                  <ViewingRangeCheckboxGroup
                    options={viewingRanges}
                    value={viewingRangeIds}
                    onChange={(ids) => {
                      setViewingRangeIds(ids)
                      if (fileValidation.viewingRange && ids.length > 0) {
                        setFileValidation((v) => ({ ...v, viewingRange: undefined }))
                      }
                    }}
                    disabled={loading}
                  />
                  {fileValidation.viewingRange && (
                    <p className="field-error">{fileValidation.viewingRange}</p>
                  )}
                </FormGroup>
              </div>

              <div className={`form-section register-file-section${fileValidation.file ? ' register-file-section-invalid' : ''}`}>
                <h3>ファイル</h3>
                <RegisterDropZone
                  variant="file"
                  disabled={loading}
                  selectedFile={file}
                  inputRef={fileInputRef}
                  onFiles={(files) => {
                    const picked = files[0] ?? null
                    setFile(picked)
                    if (picked) {
                      setTitle(titleFromFileName(picked.name))
                      if (fileValidation.file) {
                        setFileValidation((v) => ({ ...v, file: undefined }))
                      }
                    }
                  }}
                />
                {fileValidation.file && <p className="field-error">{fileValidation.file}</p>}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={() => void onSubmitFile()} disabled={loading}>
                  {loading ? '登録中…' : '登録する'}
                </button>
              </div>
            </>
          )}

          {mode === 'folder' && (
            <div className="form-section register-folder-section">
              <h3>フォルダ</h3>
              <p className="register-folder-lead">
                フォルダを選択またはドロップすると、ファイル一覧と閲覧範囲を設定する画面が開きます。
              </p>
              <RegisterDropZone
                variant="folder"
                disabled={loading}
                inputRef={folderInputRef}
                inputProps={{
                  multiple: true,
                  // @ts-expect-error webkitdirectory is non-standard but supported in Chromium
                  webkitdirectory: '',
                  directory: ''
                }}
                onBrowseClick={() => folderInputRef.current?.click()}
                onFiles={(files) => void onFolderInputChange(files)}
                onDropEvent={async (e) => {
                  try {
                    await onFolderDropFromTransfer(e.dataTransfer)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'フォルダの読み込みに失敗しました')
                  }
                }}
              />
              <div className="register-default-vr">
                <FormGroup label="既定閲覧範囲（フォルダ登録ダイアログの初期値・任意）" wide>
                  <ViewingRangeCheckboxGroup
                    options={viewingRanges}
                    value={viewingRangeIds}
                    onChange={setViewingRangeIds}
                    disabled={loading}
                  />
                </FormGroup>
              </div>
            </div>
          )}
        </div>
      </div>

      <FolderRegisterDialog
        open={folderDialogOpen}
        folderLabel={folderLabel}
        drafts={folderDrafts}
        viewingRanges={viewingRanges}
        enableRag={folderEnableRag}
        pending={loading}
        progress={folderProgress}
        error={folderDialogOpen ? error : null}
        onChangeDrafts={setFolderDrafts}
        onEnableRagChange={setFolderEnableRag}
        onCancel={() => {
          if (loading) return
          setFolderDialogOpen(false)
          setError(null)
        }}
        onConfirm={() => void onSubmitFolder()}
      />
    </section>
  )
}
