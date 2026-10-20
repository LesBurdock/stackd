'use client'

import Button from './button'

export default function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Not yet',
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40">
      <div
        className="w-full max-w-md rounded-t-2xl bg-white px-5 pt-3 pb-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="primary" onClick={onConfirm} disabled={busy} className="w-full">
            {busy ? 'Working…' : confirmLabel}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm text-muted hover:text-ink transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
