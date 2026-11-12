// @webheroco/payload-admin. The rules behind it: client-payload references/mcp.md.
'use client'

import { useStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { Icon } from '../nav/icons.js'

export const ClaudeSetupClient: React.FC<{ address: string; connections?: string; termsUrl?: string }> = ({
  address,
  connections,
  termsUrl,
}) => {
  const { setStepNav } = useStepNav()
  useEffect(() => setStepNav([{ label: 'Use with Claude' }]), [setStepNav])
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the address is selectable text beside the button.
    }
  }

  return (
    <div className="cms-guide cms-claude">
      <p className="cms-guide__intro">
        Ask Claude for changes to the website in plain words. Its edits arrive here as drafts, and nothing goes live until
        you publish it.
      </p>

      <section className="cms-guide__group" aria-labelledby="claude-address">
        <h2 id="claude-address" className="cms-guide__heading">
          Your website’s address for Claude
        </h2>
        <div className="cms-claude__address">
          <code>{address}</code>
          <button type="button" className="cms-claude__copy" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={16} />
            <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </section>

      <section className="cms-guide__group" aria-labelledby="claude-steps">
        <h2 id="claude-steps" className="cms-guide__heading">
          Set it up once
        </h2>
        <div className="cms-guide__sections">
          <article className="cms-guide__section">
            <header>
              <span className="cms-guide__icon">
                <Icon name="chat" size={20} />
              </span>
              <h3>Add your website to Claude</h3>
            </header>
            <ol>
              <li>In Claude, open Customize, then Connectors. Click + and choose “Add custom connector”.</li>
              <li>Give it your website’s name, paste the address above, and leave Advanced settings empty.</li>
              <li>Click Connect. This admin’s sign-in opens: sign in as you normally do.</li>
              <li>Read what Claude will be allowed to do, tick that you accept, and click Allow.</li>
            </ol>
          </article>
          <article className="cms-guide__section">
            <header>
              <span className="cms-guide__icon">
                <Icon name="users" size={20} />
              </span>
              <h3>On a Claude Team or Enterprise plan</h3>
            </header>
            <ol>
              <li>An Owner adds the connector once, under Organization settings, then Connectors, with the same address.</li>
              <li>Each person then clicks Connect and signs in with their own login here, so changes show under their name.</li>
            </ol>
          </article>
        </div>
      </section>

      <section className="cms-guide__group" aria-labelledby="claude-use">
        <h2 id="claude-use" className="cms-guide__heading">
          Using it
        </h2>
        <div className="cms-guide__sections">
          <article className="cms-guide__section">
            <header>
              <span className="cms-guide__icon">
                <Icon name="file" size={20} />
              </span>
              <h3>Ask for a change</h3>
            </header>
            <ol>
              <li>Ask in your own words, for example “Change our Saturday opening hours to 10am to 4pm”.</li>
              <li>Claude saves its changes as drafts. Open the page here, check it in the preview, and publish.</li>
              <li>Claude can read and edit content, and can’t delete anything.</li>
            </ol>
          </article>
          <article className="cms-guide__section">
            <header>
              <span className="cms-guide__icon">
                <Icon name="check" size={20} />
              </span>
              <h3>Before you connect</h3>
            </header>
            <ol>
              <li>Your Claude plan, its limits and its costs are between you and Anthropic.</li>
              <li>Changes made through Claude count as your own. It can make mistakes, so check each draft before you publish.</li>
              <li>Putting right something changed through Claude is paid work, not covered by a support plan.</li>
            </ol>
            {termsUrl && (
              <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="cms-guide__action">
                Read the full terms
                <Icon name="external" size={14} />
              </a>
            )}
          </article>
          {connections && (
            <article className="cms-guide__section">
              <header>
                <span className="cms-guide__icon">
                  <Icon name="settings" size={20} />
                </span>
                <h3>Disconnect</h3>
              </header>
              <ol>
                <li>AI connections lists every app connected to the website and who connected it.</li>
                <li>Delete one to disconnect it straight away. You can connect again at any time.</li>
              </ol>
              <Link href={connections} prefetch={false} className="cms-guide__action">
                Open AI connections
                <Icon name="expand" size={14} />
              </Link>
            </article>
          )}
        </div>
      </section>
    </div>
  )
}
