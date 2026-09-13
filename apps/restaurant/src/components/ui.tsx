/** Briques d'interface du logiciel restaurant. */
import type { ReactNode } from 'react';
import { IconWifiOff } from './Icons';

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat${accent ? ' stat--accent' : ''}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {hint && <p className="stat__hint">{hint}</p>}
    </div>
  );
}

export function Tag({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
}) {
  return <span className={`tag${variant === 'default' ? '' : ` tag--${variant}`}`}>{children}</span>;
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left' }}
    >
      <span>
        <span style={{ fontWeight: 600, display: 'block' }}>{label}</span>
        {hint && <span className="faint">{hint}</span>}
      </span>
      <span className="switch__track">
        <span className="switch__thumb" />
      </span>
    </button>
  );
}

export function Loading({ rows = 4, height = 110 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" aria-busy="true">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="section-title">{title}</p>
      {description && <p className="faint">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <IconWifiOff size={28} />
      <p className="section-title">Impossible de charger</p>
      <p className="faint">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Fenêtre modale : confirmation de refus, saisie d'un motif, édition d'un produit. */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-4)',
        zIndex: 100,
      }}
    >
      <div
        className="card"
        onClick={(event) => event.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '88dvh', overflowY: 'auto' }}
      >
        <div className="row row--between" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 className="section-title">{title}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Fermer">
            Fermer
          </button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 'var(--space-4)' }}>{footer}</div>}
      </div>
    </div>
  );
}
