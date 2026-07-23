export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact ? (
        <span>
          <strong>Threads Content Engine</strong>
          <small>Research and approval studio</small>
        </span>
      ) : null}
    </div>
  );
}
