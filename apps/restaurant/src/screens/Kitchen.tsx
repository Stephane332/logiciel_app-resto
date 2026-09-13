/**
 * Écran cuisine.
 *
 * Pensé pour être lu à un mètre, sur une tablette accrochée au mur, par quelqu'un qui a les mains
 * occupées : gros caractères, un seul bouton par commande, minuteur visible. Aucune information qui
 * ne serve pas à préparer le plat.
 */
import { useMutation } from '@tanstack/react-query';
import { staffApi, type Order } from '@barabite/api-client';
import { IconClock } from '../components/Icons';
import { Empty, ErrorState, Loading, Tag } from '../components/ui';
import { formatOrderNumber, minutesSince, typeLabel } from '../lib/format';
import { refreshOrders, useActiveOrders } from '../lib/queries';

/** Au-delà, la commande passe en alerte : le client attend depuis trop longtemps. */
const LATE_MINUTES = 25;

export function Kitchen() {
  const { data, isLoading, isError, refetch } = useActiveOrders();

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="La file de cuisine est indisponible." onRetry={() => void refetch()} />;

  const queue = (data?.orders ?? [])
    .filter((order) => order.status === 'ACCEPTED' || order.status === 'PREPARING')
    // La plus ancienne d'abord : c'est le client qui attend le plus.
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (queue.length === 0) {
    return <Empty title="Rien à préparer" description="Les commandes acceptées apparaîtront ici." />;
  }

  return (
    <div className="grid grid--orders">
      {queue.map((order) => (
        <KitchenTicket key={order.id} order={order} />
      ))}
    </div>
  );
}

function KitchenTicket({ order }: { order: Order }) {
  const minutes = minutesSince(order.acceptedAt ?? order.createdAt);
  const late = minutes >= LATE_MINUTES;

  const prepare = useMutation({ mutationFn: () => staffApi.prepare(order.id), onSuccess: refreshOrders });
  const ready = useMutation({ mutationFn: () => staffApi.ready(order.id), onSuccess: refreshOrders });

  return (
    <article className={`order-card ${late ? 'order-card--late' : 'order-card--preparing'}`}>
      <div className="row row--between">
        <span className="order-card__number" style={{ fontSize: 'var(--text-2xl)' }}>
          {formatOrderNumber(order.dailyNumber)}
        </span>
        <span className={`timer${late ? ' timer--late' : ''}`} style={{ fontSize: 'var(--text-lg)' }}>
          <IconClock size={16} style={{ display: 'inline', verticalAlign: -3 }} /> {minutes} min
        </span>
      </div>

      <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
        <Tag>{typeLabel(order.type)}</Tag>
        {order.table && <Tag variant="brand">Table {order.table.number}</Tag>}
        {order.status === 'ACCEPTED' && <Tag variant="warning">Pas encore commencée</Tag>}
      </div>

      <div className="order-card__items">
        {order.items.map((item) => (
          <div key={item.id} className="order-line">
            <span className="order-line__qty" style={{ fontSize: 'var(--text-lg)' }}>
              {item.quantity}×
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{item.productName}</span>
              {item.options.length > 0 && (
                <p className="order-line__options">{item.options.map((option) => option.name).join(' · ')}</p>
              )}
              {/* Une consigne du client doit sauter aux yeux : c'est elle qu'on oublie. */}
              {item.note && (
                <p className="banner banner--warning" style={{ marginTop: 4, padding: '4px 10px' }}>
                  {item.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {order.note && <p className="banner banner--warning">« {order.note} »</p>}

      {order.status === 'ACCEPTED' ? (
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          disabled={prepare.isPending}
          onClick={() => prepare.mutate()}
        >
          Commencer
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--success btn--lg btn--block"
          disabled={ready.isPending}
          onClick={() => ready.mutate()}
        >
          Commande prête
        </button>
      )}
    </article>
  );
}
