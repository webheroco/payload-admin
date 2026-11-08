// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The line at the top of a document about its review: waiting, approved
 * for later, or sent back with the approver's note. Nothing once it is
 * published. A UI field, so it stores nothing (approvals.ts).
 */
import React from 'react'

import { formatWhen, personName, useReviewTarget, type ApproverProps } from './shared.js'

export const ReviewBanner: React.FC<ApproverProps> = ({ approverRoles, roleField }) => {
  const { latest } = useReviewTarget({ approverRoles, roleField })
  if (!latest || latest.status === 'published' || latest.status === 'replaced') return null

  if (latest.status === 'sentBack') {
    return (
      <div className="review-banner review-banner--back" role="status">
        <strong>
          Sent back by {personName(latest.reviewedBy, 'an approver')}, {formatWhen(latest.reviewedAt)}
        </strong>
        <span>&ldquo;{latest.note}&rdquo;</span>
        <span className="review-banner__hint">Make the changes, then submit it for review again.</span>
      </div>
    )
  }
  if (latest.status === 'scheduled') {
    return (
      <div className="review-banner" role="status">
        <strong>Approved. Goes live {formatWhen(latest.publishAt)}</strong>
        <span className="review-banner__hint">Changing it now sends it back for another look.</span>
      </div>
    )
  }
  return (
    <div className="review-banner" role="status">
      <strong>
        Waiting for review. Submitted by {personName(latest.submittedBy)}, {formatWhen(latest.createdAt)}
      </strong>
      {latest.message && <span>&ldquo;{latest.message}&rdquo;</span>}
    </div>
  )
}
