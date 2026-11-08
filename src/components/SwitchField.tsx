"use client";

/**
 * Every on/off setting renders as a labelled switch
 * instead of a bare checkbox. Wired to every checkbox field by the
 * webheroAdmin plugin; the stored value is still a plain boolean, so no
 * migration. Styles: .cms-switch* in custom.css.
 */
import { FieldDescription, FieldLabel, useField } from "@payloadcms/ui";
import type { CheckboxFieldClientComponent } from "payload";

export const SwitchField: CheckboxFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue } = useField<boolean>({ path });
  const on = Boolean(value);
  const disabled = Boolean(readOnly || field.admin?.readOnly);
  const id = `switch-${path.replace(/\W+/g, "-")}`;

  return (
    <div className="field-type cms-switch-field">
      <div className="cms-switch-field__row">
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={on}
          disabled={disabled}
          className={`cms-switch${on ? " cms-switch--on" : ""}`}
          onClick={() => setValue(!on)}
        >
          <span className="cms-switch__thumb" aria-hidden="true" />
        </button>
        <FieldLabel htmlFor={id} label={field.label} path={path} required={field.required} />
      </div>
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  );
};
