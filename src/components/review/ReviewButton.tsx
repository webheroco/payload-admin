// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Replaces Payload's Publish button on everything that goes through review
 * (approvals.ts).
 *
 *  - Editors: "Submit for review", or the state of their request.
 *  - Approvers: Payload's own Publish, plus Schedule, plus Send back when
 *    someone else's change is waiting.
 *
 * The server enforces the same rules; this only shows the right buttons.
 */
import { Button, PublishButton, toast, useConfig, useDocumentInfo, useForm, useFormModified, useLocale } from '@payloadcms/ui'
import React, { useState } from 'react'

import { ReviewDialog } from './ReviewDialog.js'
import { announceReviewChange, formatWhen, personName, sendReview, useReviewTarget, type ApproverProps } from './shared.js'

/** datetime-local value for an hour from now, on the hour. */
const nextHour = () => {
  const d = new Date(Date.now() + 3_600_000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export const ReviewButton: React.FC<ApproverProps> = ({ approverRoles, roleField }) => {
  const { api, target, ready, open, latest, user, approver } = useReviewTarget({ approverRoles, roleField })
  const modified = useFormModified()
  const { submit: submitForm } = useForm()
  const { id, collectionSlug, globalSlug } = useDocumentInfo()
  const { code: locale } = useLocale()
  const {
    config: {
      routes: { api: apiRoute },
    },
  } = useConfig()
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<null | 'sendBack' | 'schedule'>(null)
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(nextHour)

  const run = async (method: 'POST' | 'PATCH', path: string, body: Record<string, unknown>, done: string) => {
    setBusy(true)
    const error = await sendReview(api, method, path, body)
    setBusy(false)
    if (error) return toast.error(error)
    setDialog(null)
    setNote('')
    toast.success(done)
    announceReviewChange()
  }

  /** Saves unsaved changes as a draft first, so the approver sees exactly what is on screen. */
  const saveDraft = async () => {
    const search = `?locale=${locale}&depth=0&fallback-locale=null&draft=true`
    const action = collectionSlug ? `${apiRoute}/${collectionSlug}/${id}${search}` : `${apiRoute}/globals/${globalSlug}${search}`
    const result = (await submitForm({ action, method: collectionSlug ? 'PATCH' : 'POST', overrides: { _status: 'draft' }, skipValidation: true, disableSuccessStatus: true })) as { res?: Response } | undefined
    return Boolean(result?.res?.ok)
  }

  const submit = async () => {
    if (modified) {
      setBusy(true)
      const saved = await saveDraft()
      if (!saved) {
        setBusy(false)
        return toast.error('Your changes could not be saved, so nothing was submitted. Try again.')
      }
    }
    await run('POST', '', { ...target }, 'Submitted. The approvers have been emailed.')
  }

  const schedule = () => {
    const publishAt = new Date(when).toISOString()
    return open
      ? run('PATCH', `/${open.id}`, { status: 'scheduled', publishAt }, `Scheduled for ${formatWhen(publishAt)}.`)
      : run('POST', '', { ...target, status: 'scheduled', publishAt }, `Scheduled for ${formatWhen(publishAt)}.`)
  }

  /**
   * The review's state as one short line before the buttons (a pre-header,
   * not a banner): who asked and when, or who sent it back. The full
   * message or note is in its tip and on the Reviews page.
   */
  const stateLine = (() => {
    if (!latest) return null
    if (latest.status === 'sentBack') {
      const note = latest.note ? `“${latest.note}”` : ''
      return { text: `Sent back by ${personName(latest.reviewedBy, 'an approver')}`, tip: note, tone: 'back' }
    }
    if (latest.status === 'waiting') {
      const mine = (typeof latest.submittedBy === 'object' ? latest.submittedBy?.id : latest.submittedBy) === user?.id
      return { text: `${mine ? 'Submitted' : `From ${personName(latest.submittedBy)}`}, ${formatWhen(latest.createdAt)}`, tip: latest.message ? `“${latest.message}”` : '', tone: 'waiting' }
    }
    if (latest.status === 'scheduled') return { text: `Goes live ${formatWhen(latest.publishAt)}`, tip: '', tone: 'scheduled' }
    return null
  })()
  const line = stateLine && (
    <span className={`review-actions__note is-${stateLine.tone}`} data-tip={stateLine.tip || undefined} tabIndex={stateLine.tip ? 0 : undefined}>
      {stateLine.text}
    </span>
  )

  const someoneElses = open && open.status === 'waiting' && (typeof open.submittedBy === 'object' ? open.submittedBy?.id : open.submittedBy) !== user?.id

  if (approver) {
    return (
      <div className="review-actions">
        {line}
        {someoneElses && (
          <Button buttonStyle="secondary" size="medium" className="review-actions__back" disabled={busy} onClick={() => setDialog('sendBack')}>
            Send back
          </Button>
        )}
        <Button buttonStyle="secondary" size="medium" disabled={busy || !ready} onClick={() => setDialog('schedule')}>
          Schedule
        </Button>
        <PublishButton />
        {dialog === 'sendBack' && open && (
          <ReviewDialog
            title="Send back to the author"
            intro={`Say what needs changing. ${personName(open.submittedBy)} gets your note by email, and nothing goes live.`}
            confirm="Send back"
            busy={busy}
            onCancel={() => setDialog(null)}
            onConfirm={() => run('PATCH', `/${open.id}`, { status: 'sentBack', note }, 'Sent back with your note.')}
          >
            <label className="review-dialog__label">
              Note to the author
              <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </label>
          </ReviewDialog>
        )}
        {dialog === 'schedule' && (
          <ReviewDialog
            title="Schedule"
            intro="The latest saved version goes live at this time. If an editor changes it before then, it comes back to you for another look."
            confirm="Schedule"
            busy={busy}
            onCancel={() => setDialog(null)}
            onConfirm={schedule}
          >
            <label className="review-dialog__label">
              Goes live on
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
          </ReviewDialog>
        )}
      </div>
    )
  }

  if (open?.status === 'waiting') {
    return (
      <div className="review-actions">
        {line}
        <Button buttonStyle="primary" size="medium" disabled>
          Waiting for review
        </Button>
      </div>
    )
  }
  if (open?.status === 'scheduled') {
    return (
      <div className="review-actions">
        <Button buttonStyle="primary" size="medium" disabled>
          Approved for {formatWhen(open.publishAt)}
        </Button>
      </div>
    )
  }
  return (
    <div className="review-actions">
      {line}
      <Button buttonStyle="primary" size="medium" disabled={busy || !ready} onClick={submit}>
        Submit for review
      </Button>
    </div>
  )
}
