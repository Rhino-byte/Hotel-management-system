"use client";

type Props = {
  text?: string;
};

export default function SavingOverlay({ text = "Saving" }: Props) {
  return (
    <div className="saving-overlay" role="status" aria-live="polite" aria-label="Saving">
      <div className="loading-wrap">
        <span className="loading-spinner loading-spinner-sm" />
        <p className="loading-text">
          {text}
          <span className="loading-dots" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}
