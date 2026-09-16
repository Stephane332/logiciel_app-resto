/** Briques d'interface communes : en-tête, états, image, étiquettes. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BurgerMark, IconBack, IconWifiOff } from './Icons';
import { mediaUrl } from '@barabite/api-client';
import { useOnlineStatus } from '../lib/network';

export function Header({
  title,
  back,
  actions,
}: {
  title: ReactNode;
  back?: boolean | (() => void);
  actions?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <header className="header">
      {back && (
        <button
          type="button"
          className="icon-button"
          aria-label="Revenir en arrière"
          onClick={() => (typeof back === 'function' ? back() : navigate(-1))}
        >
          <IconBack />
        </button>
      )}
      <h1 className="header__title">{title}</h1>
      {actions}
    </header>
  );
}

/**
 * Image de produit avec repli.
 * Le restaurant n'aura pas une photo pour chaque produit dès le premier jour : un badge sobre vaut
 * mieux qu'un carré vide ou une icône d'image cassée.
 */
export function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  // Les chemins en base sont relatifs et servis par l'API, qui vit ailleurs en production.
  src = mediaUrl(src);
  if (!src) {
    return (
      <div className="image-fallback">
        <BurgerMark className="muted" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <div>
        <p className="section-title">{title}</p>
        {description && <p className="subtitle" style={{ marginTop: 4 }}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack container" style={{ paddingTop: 16 }} aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ height: 104 }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<IconWifiOff size={28} />}
      title="Impossible de charger"
      description={message}
      action={
        onRetry && (
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Réessayer
          </button>
        )
      }
    />
  );
}

/** Bandeau hors ligne : un écran figé qui paraît normal est pire qu'une panne visible. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="offline-banner" role="status">
      <IconWifiOff />
      Hors ligne — le menu reste consultable
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

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Diminuer la quantité"
      >
        −
      </button>
      <span className="stepper__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Augmenter la quantité"
      >
        +
      </button>
    </div>
  );
}
