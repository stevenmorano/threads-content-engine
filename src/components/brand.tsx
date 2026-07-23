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
          <strong>Signal Loom</strong>
          <small>Threads research studio</small>
        </span>
      ) : null}
    </div>
  );
}
