/** Notifications reçues. */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconBell } from '../components/Icons';
import { EmptyState, Header, Loading } from '../components/ui';
import { api } from '../lib/api';
import { formatRelative } from '../lib/format';
import { useNotifications } from '../lib/queries';
import { useSession } from '../lib/session';

export function Notifications() {
  const user = useSession((state) => state.user);
  const { data, isLoading } = useNotifications(Boolean(user));

  // Marquées comme lues à l'ouverture : un compteur qui ne redescend jamais finit ignoré.
  useEffect(() => {
    if (user && (data?.unread ?? 0) > 0) void api.markNotificationsRead().catch(() => undefined);
  }, [user, data?.unread]);

  if (!user) {
    return (
      <div>
        <Header title="Notifications" back />
        <EmptyState
          icon={<IconBell size={28} />}
          title="Suivez vos commandes"
          description="Connectez-vous pour être prévenu à chaque étape de votre commande."
          action={
            <Link to="/compte/connexion" className="btn btn--primary">
              Se connecter
            </Link>
          }
        />
      </div>
    );
  }

  if (isLoading) return <Loading rows={3} />;

  const notifications = data?.notifications ?? [];

  return (
    <div>
      <Header title="Notifications" back />

      {notifications.length === 0 ? (
        <EmptyState icon={<IconBell size={28} />} title="Rien pour le moment" />
      ) : (
        <div className="container stack">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className="card"
              style={{
                borderColor: notification.readAt ? 'var(--border)' : 'var(--brand-primary)',
              }}
            >
              <p style={{ fontWeight: 700 }}>{notification.title}</p>
              <p className="subtitle" style={{ marginTop: 2 }}>
                {notification.body}
              </p>
              <p className="faint" style={{ marginTop: 'var(--space-2)' }}>
                {formatRelative(notification.createdAt)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
