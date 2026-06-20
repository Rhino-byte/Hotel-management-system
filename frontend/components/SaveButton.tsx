"use client";

type Props = {
  saving?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
  savingLabel?: string;
  className?: string;
  type?: "button" | "submit";
};

export default function SaveButton({
  saving = false,
  disabled = false,
  onClick,
  label = "Save",
  savingLabel = "Saving",
  className = "btn btn-sm",
  type = "button",
}: Props) {
  return (
    <button
      type={type}
      className={className}
      disabled={disabled || saving}
      onClick={onClick}
    >
      {saving ? (
        <span className="btn-saving">
          <span className="loading-spinner loading-spinner-xs" aria-hidden="true" />
          {savingLabel}
          <span className="loading-dots" aria-hidden="true" />
        </span>
      ) : (
        label
      )}
    </button>
  );
}
