/**
 * Carte de commande.
 *
 * Lisible à un mètre : numéro énorme, minuteur visible, produits et options en clair. C'est la seule
 * chose qu'un cuisinier regarde, souvent en passant.
 */
import { statusLabel, type OrderStatus } from '@barabite/shared';
import type { Order } from '@barabite/api-client';
import { IconBag, IconBike, IconClock, IconQr } from './Icons';
import { Tag } from './ui';
import { channelLabel, formatAmount, formatOrderNumber, minutesSince, typeLabel } from '../lib/format';

/** Au-delà de ce délai depuis l'acceptation, la commande passe en alerte. */
const LATE_MINUTES = 25;

export function OrderCard({
  order,
  actions,
  compact,
}: {
  order: Order;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  const reference = order.acceptedAt ?? order.createdAt;
  const minutes = minutesSince(reference);
  const late = minutes >= LATE_MINUTES && !['READY', 'COMPLETED'].includes(order.status);

  const variant = late
    ? 'late'
    : order.status === 'PENDING'
      ? 'new'
      : order.status === 'READY'
        ? 'ready'
        : 'preparing';

  return (
    <article className={`order-card order-card--${variant}`}>
      <div className="row row--between">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <span className="order-card__number">{formatOrderNumber(order.dailyNumber)}</span>
          {order.type === 'DELIVERY' && <IconBike size={18} className="muted" />}
          {order.type === 'PICKUP' && <IconBag size={18} className="muted" />}
          {order.type === 'DINE_IN' && <IconQr size={18} className="muted" />}
        </div>
        <span className={`timer${late ? ' timer--late' : ''}`}>
          <IconClock size={14} style={{ display: 'inline', verticalAlign: -2 }} /> {minutes} min
        </span>
      </div>

      <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
        <Tag>{typeLabel(order.type)}</Tag>
        <Tag variant="info">{channelLabel(order.channel)}</Tag>
        {order.table && <Tag variant="brand">Table {order.table.number}</Tag>}
        {order.pickupCode && <Tag variant="brand">{order.pickupCode}</Tag>}
        {order.status !== 'PENDING' && <Tag>{statusLabel(order.status as OrderStatus)}</Tag>}
      </div>

      {(order.customerName || order.customer) && (
        <p className="faint">
          {order.customerName ?? order.customer?.name}
          {order.customerPhone || order.customer?.phone
            ? ` · ${order.customerPhone ?? order.customer?.phone}`
            : ''}
        </p>
      )}

      {!compact && (
        <div className="order-card__items">
          {order.items.map((item) => (
            <div key={item.id} className="order-line">
              <span className="order-line__qty">{item.quantity}×</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{item.productName}</span>
                {item.options.length > 0 && (
                  <p className="order-line__options">
                    {item.options.map((option) => option.name).join(' · ')}
                  </p>
                )}
                {item.note && <p className="order-line__options">« {item.note} »</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {order.deliverySector && (
        <p className="faint">
          Livraison · {order.deliverySector} — {order.deliveryLandmark}
        </p>
      )}

      {order.note && <p className="banner banner--info">« {order.note} »</p>}

      <div className="row row--between">
        <span className="price" style={{ fontSize: 'var(--text-lg)' }}>
          {formatAmount(order.total)}
        </span>
        <PaymentTag order={order} />
      </div>

      {actions && <div className="row" style={{ gap: 'var(--space-2)' }}>{actions}</div>}
    </article>
  );
}

function PaymentTag({ order }: { order: Order }) {
  const payment = order.payments[0];
  if (!payment) return null;

  if (payment.status === 'CONFIRMED') return <Tag variant="success">Payé</Tag>;
  if (payment.method === 'CASH') return <Tag variant="warning">Espèces à encaisser</Tag>;
  return <Tag variant="warning">Paiement en attente</Tag>;
}
