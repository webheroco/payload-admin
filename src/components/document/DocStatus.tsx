// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Document status (admin.components.edit.Status). One small pill says what
 * the website shows, in the editor's words; an undo icon beside it drops
 * unpublished edits; the dates sit in an "i" note. On a site with languages it
 * also shows how much is translated (TranslationStatus). The document controls
 * share the top bar with the breadcrumb (../header/HeaderRow).
 */
import {
  ConfirmationModal,
  toast,
  useConfig,
  useDocumentInfo,
  useForm,
  useLocale,
  useModal,
} from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React, { useCallback } from 'react'

import { TranslationStatus } from '../i18n/TranslationStatus.js'
import { formatWhen, personName, useReviewTarget } from '../review/shared.js'
import { Icon } from '../nav/icons.js'

const when = (value: unknown) => {
  if (typeof value !== 'string') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** `help`: how saving works here (webheroAdmin `saveHelp`), shown in the "i" note. */
export const DocStatus: React.FC<{ help?: string }> = ({ help }) => {
  const {
    id,
    collectionSlug,
    docPermissions,
    globalSlug,
    hasPublishedDoc,
    incrementVersionCount,
    savedDocumentData,
    setMostRecentVersionIsAutosaved,
    setUnpublishedVersionCount,
    unpublishedVersionCount,
  } = useDocumentInfo()
  const { config } = useConfig()
  const { reset } = useForm()
  const { code: locale } = useLocale()
  const { toggleModal } = useModal()
  const modalSlug = `undo-changes-${id ?? globalSlug}`

  const changed = hasPublishedDoc && unpublishedVersionCount > 0

  // With approvals on, the request's state is part of the same group.
  const approvals = config.collections.some((c) => c.slug === 'reviews')
  const { latest, user } = useReviewTarget({}, approvals)
  const mine = latest && (typeof latest.submittedBy === 'object' ? latest.submittedBy?.id : latest.submittedBy) === user?.id
  const quote = (text?: string | null) => (text ? `: “${text}”` : '')
  const review =
    latest?.status === 'waiting'
      ? { cls: 'waiting', label: 'Waiting for approval', tip: `${mine ? 'You' : personName(latest.submittedBy)} asked on ${formatWhen(latest.createdAt)}${quote(latest.message)}` }
      : latest?.status === 'sentBack'
        ? { cls: 'back', label: 'Changes requested', tip: `${personName(latest.reviewedBy, 'An approver')}, ${formatWhen(latest.reviewedAt)}${quote(latest.note)}` }
        : latest?.status === 'scheduled'
          ? { cls: 'scheduled', label: `Goes live ${formatWhen(latest.publishAt)}`, tip: `Approved by ${personName(latest.reviewedBy, 'an approver')}` }
          : null

  /** Same as Payload's "Revert to published": save the live version over the draft. */
  const undo = useCallback(async () => {
    const path: `/${string}` = collectionSlug ? `/${collectionSlug}/${id}` : `/globals/${globalSlug}`
    const url = formatAdminURL({ apiRoute: config.routes.api, path: `${path}?locale=${locale}&fallback-locale=null&depth=0` })
    const live = await fetch(url, { credentials: 'include' }).then((r) => r.json())
    const res = await fetch(url, {
      method: collectionSlug ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(live),
    })
    if (!res.ok) {
      toast.error('The changes could not be undone. Try again.')
      return
    }
    const json = await res.json()
    await reset(collectionSlug ? json.doc : json.result)
    incrementVersionCount()
    setMostRecentVersionIsAutosaved(false)
    setUnpublishedVersionCount(0)
    toast.success('Changes undone. The page matches the website again.')
  }, [collectionSlug, config.routes.api, globalSlug, id, incrementVersionCount, locale, reset, setMostRecentVersionIsAutosaved, setUnpublishedVersionCount])

  const modal = changed && docPermissions?.update

  // One outlined group, the same height and corners as the buttons beside it:
  // status | translations | dates.
  return (
    <>
      <div className="cms-status">
        <span className="cms-status__part">
          {!hasPublishedDoc ? (
            <span className="cms-pill" data-tip="Not on the website yet">
              Draft
            </span>
          ) : changed ? (
            <span className="cms-pill cms-pill--changes" data-tip="Saved. The website shows the last published version until you publish.">
              Unpublished changes
            </span>
          ) : (
            <span className="cms-pill cms-pill--live" data-tip="The website shows this version">
              Published
            </span>
          )}
          {modal && (
            <button
              type="button"
              className="cms-icon-button is-small"
              aria-label="Undo changes"
              data-tip="Undo changes"
              onClick={() => toggleModal(modalSlug)}
            >
              <Icon name="undo" size={16} />
            </button>
          )}
        </span>
        {review ? (
          <span className="cms-status__part">
            <span className={`cms-pill cms-pill--${review.cls} cms-pill--long-tip`} data-tip={review.tip} tabIndex={0}>
              {review.label}
            </span>
          </span>
        ) : null}
        <TranslationStatus />
        <span className="cms-info cms-status__info" tabIndex={0} aria-label="Dates and saving">
          <Icon name="info" size={16} />
          <span className="cms-info__note" role="tooltip">
            <dl>
              <dt>Last changed</dt>
              <dd>{when(savedDocumentData?.updatedAt)}</dd>
              <dt>Created</dt>
              <dd>{when(savedDocumentData?.createdAt)}</dd>
            </dl>
            {help ? <p className="cms-status__help">{help}</p> : null}
          </span>
        </span>
      </div>
      {modal && (
        <ConfirmationModal
          heading="Undo your changes?"
          body="The page goes back to what the website shows now. Your unpublished changes are kept in Versions."
          confirmLabel="Undo changes"
          confirmingLabel="Undoing…"
          modalSlug={modalSlug}
          onConfirm={undo}
        />
      )}
    </>
  )
}
