/**
 * Historique.
 *
 * Deux sources : les commandes du compte, et celles mémorisées localement pour les clients qui ont
 * commandé sans s'inscrire. Aucun client ne doit perdre la trace de sa commande.
 */
import { Link } from 'react-router-dom';
import { isTerminal, statusLabel, type OrderStatus } from '@barabite/shared';
import { IconChevron, IconReceipt } from '../components/Icons';
import { EmptyState, Header, Loading, Tag } from '../components/ui';
import { formatAmount, formatOrderNumber, formatRelative } from '../lib/format';
import { useMyOrders } from '../lib/queries';
import { useRecentOrders } from '../lib/recent';
import { useSession } from '../lib/session';

export function Orders() {
  const user = useSession((state) => state.user);
  const remote = useMyOrders(Boolean(user));
  const local = useRecentOrders((state) => state.orders);

  if (user && remote.isLoading) return <Loading />;

  const orders = user ? (remote.data?.orders ?? []) : [];
  const showLocal = !user && local.length > 0;

  if (orders.length === 0 && !showLocal) {
    return (
      <div>
        <Header title="Mes commandes" />
        <EmptyState
          icon={<IconReceipt size={28} />}
          title="Aucune commande"
          description="Vos commandes apparaîtront ici, avec leur suivi."
          action={
            <Link to="/menu" className="btn btn--primary">
              Voir le menu
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <Header title="Mes commandes" />

      <div className="container stack">
        {!user && (
          <div className="banner banner--info">
            <span>
              Créez un compte pour retrouver toutes vos commandes et cumuler des points de fidélité.{' '}
              <Link to="/compte/inscription" style={{ textDecoration: 'underline' }}>
                S'inscrire
              </Link>
            </span>
          </div>
        )}

        {user
          ? orders.map((order) => (
              <Link key={order.id} to={`/commande/${order.id}`} className="card row row--between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 'var(--space-2)' }}>
                    <strong>{formatOrderNumber(order.number)}</strong>
                    <Tag variant={isTerminal(order.status as OrderStatus) ? 'default' : 'info'}>
                      {statusLabel(order.status as OrderStatus)}
                    </Tag>
                  </div>
                  <p className="faint">
                    {formatRelative(order.createdAt)} · {order.items.length} article
                    {order.items.length > 1 ? 's' : ''}
                  </p>
                  <p className="price" style={{ marginTop: 4 }}>
                    {formatAmount(order.total)}
                  </p>
                </div>
                <IconChevron className="muted" />
              </Link>
            ))
          : local.map((order) => (
              <Link key={order.id} to={`/commande/${order.id}`} className="card row row--between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 'var(--space-2)' }}>
                    <strong>{formatOrderNumber(order.number)}</strong>
                    {order.pickupCode && <Tag variant="brand">{order.pickupCode}</Tag>}
                  </div>
                  <p className="faint">{formatRelative(order.createdAt)}</p>
                  <p className="price" style={{ marginTop: 4 }}>
                    {formatAmount(order.total)}
                  </p>
                </div>
                <IconChevron className="muted" />
              </Link>
            ))}
      </div>
    </div>
  );
}
