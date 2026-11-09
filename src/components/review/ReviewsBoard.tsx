// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The Reviews page's board view: a column per stage. Approvers can drag a
 * waiting card to Changes requested (asks what needs changing) or Scheduled (asks for a
 * time); everything else moves by itself as people work.
 */
import { toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { ReviewDialog } from './ReviewDialog.js'
import { sendReview } from './shared.js'

export type BoardCard = { id: number | string; title: string; meta: string; detail: string; href: string; movable: boolean }
export type BoardColumn = { key: string; label: string; cards: BoardCard[]; highlight?: boolean; dropTarget?: boolean }

const nextHour = () => {
  const d = new Date(Date.now() + 3_600_000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export const ReviewsBoard: React.FC<{ columns: BoardColumn[]; apiRoute: string; canMove: boolean }> = ({ columns, apiRoute, canMove }) => {
  const router = useRouter()
  const [dragging, setDragging] = useState<BoardCard | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [pending, setPending] = useState<{ card: BoardCard; to: 'sentBack' | 'scheduled' } | null>(null)
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(nextHour)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    const body = pending.to === 'sentBack' ? { status: 'sentBack', note } : { status: 'scheduled', publishAt: new Date(when).toISOString() }
    const error = await sendReview(apiRoute, 'PATCH', `/${pending.card.id}`, body)
    setBusy(false)
    if (error) return toast.error(error)
    toast.success(pending.to === 'sentBack' ? 'Changes requested. They have your note by email.' : 'Scheduled.')
    setPending(null)
    setNote('')
    router.refresh()
  }

  return (
    <>
      <div className="reviews-board">
        {columns.map((col) => {
          const accepts = canMove && col.dropTarget && dragging
          return (
            <section
              key={col.key}
              className={`reviews-board__col${col.highlight ? ' is-highlight' : ''}${accepts && over === col.key ? ' is-over' : ''}`}
              aria-label={col.label}
              onDragOver={(e) => {
                if (!accepts) return
                e.preventDefault()
                setOver(col.key)
              }}
              onDragLeave={() => setOver((k) => (k === col.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                if (!accepts || !dragging) return
                setPending({ card: dragging, to: col.key as 'sentBack' | 'scheduled' })
                setDragging(null)
              }}
            >
              <h2 className="reviews-board__head">
                {col.label}
                <span>{col.cards.length}</span>
              </h2>
              {col.cards.map((c) => (
                <a
                  key={c.id}
                  href={c.href}
                  className={`reviews-card${col.highlight ? ' is-highlight' : ''}`}
                  draggable={canMove && c.movable}
                  onDragStart={(e) => {
                    if (!(canMove && c.movable)) return e.preventDefault()
                    e.dataTransfer.effectAllowed = 'move'
                    setDragging(c)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                >
                  <b>{c.title}</b>
                  <small>{c.meta}</small>
                  <small>{c.detail}</small>
                </a>
              ))}
              {!col.cards.length && <p className="reviews-board__empty">Nothing here</p>}
            </section>
          )
        })}
      </div>
      {pending?.to === 'sentBack' && (
        <ReviewDialog
          title="Request changes"
          intro={`Say what needs changing on "${pending.card.title}". The author gets your note by email, and nothing goes live.`}
          confirm="Request changes"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        >
          <label className="review-dialog__label">
            What needs changing?
            <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          </label>
        </ReviewDialog>
      )}
      {pending?.to === 'scheduled' && (
        <ReviewDialog
          title="Schedule"
          intro={`"${pending.card.title}" goes live at this time, as last saved.`}
          confirm="Schedule"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        >
          <label className="review-dialog__label">
            Goes live on
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
        </ReviewDialog>
      )}
    </>
  )
}
