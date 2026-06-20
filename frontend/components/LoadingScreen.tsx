"use client";

type Props = {
  text?: string;
};

export default function LoadingScreen({ text = "Loading" }: Props) {
  return (
    <main className="page page-center">
      <div className="loading-wrap" role="status" aria-live="polite" aria-label="Loading">
        <span className="loading-spinner" />
        <p className="loading-text">
          {text}
          <span className="loading-dots" aria-hidden="true" />
        </p>
      </div>
    </main>
  );
}
