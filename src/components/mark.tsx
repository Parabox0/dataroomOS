/** Dataroom OS's mark: three blocks stacked on a wide base. */
export function Mark({ className = "mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="6" y="3" width="8" height="5" rx="1" fill="currentColor" opacity="0.38" />
      <rect x="4" y="9" width="12" height="3.5" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="2" y="13.5" width="16" height="3.5" rx="1" fill="currentColor" />
    </svg>
  );
}
