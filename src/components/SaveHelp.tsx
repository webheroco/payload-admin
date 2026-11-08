"use client";

/**
 * One line at the top of an edit view saying how
 * saving works there. Added by the webheroAdmin plugin as a `ui` field with
 * the text from SAVE_HELP_TEXT. Styles: .cms-save-help.
 */
export function SaveHelp({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="cms-save-help" role="note">
      {text}
    </p>
  );
}
