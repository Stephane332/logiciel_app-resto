/**
 * Suivi de commande.
 *
 * L'écran que le client regarde le plus, et souvent le seul qu'il montre au personnel. Le numéro, le
 * code de retrait et l'étape en cours doivent se lire d'un coup d'œil, à bout de bras.
 */
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { isTerminal, statusLabel, trackingSteps, type OrderStatus } from '@barabite/shared';
import { IconBag, IconBike, IconCheck, IconClock, IconQr } from '../components/Icons';
import { ErrorState, Header, Loading, Tag } from '../components/ui';
import { api } from '../lib/api';
import { formatAmount, formatOrderNumber, formatRelative } from '../lib/format';
import { queryClient, useOrder, useRestaurant } from '../lib/queries';
import { useOrderRealtime } from '../lib/realtime';

export function OrderTracking() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useOrder(id);
  const restaurant = useRestaurant();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['order', id] });
  }, [id]);

  useOrderRealtime(id, refresh);

  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(id!, 'Annulée depuis l\'application'),
    onSuccess: refresh,
  });

  const pay = useMutation({
    mutationFn: () => api.simulatePayment(id!),
    onSuccess: refresh,
  });

  if (isLoading) return <Loading rows={3} />;
  if (isError || !data) {
    return <ErrorState message="Cette commande est introuvable." onRetry={() => void refetch()} />;
  }

  const order = data.order;
  const steps = trackingSteps(order.type);
  const currentIndex = steps.indexOf(order.status);
  const finished = isTerminal(order.status);
  const cancellable = order.status === 'PENDING';
  const payable =
    order.payment?.status !== 'CONFIRMED' && order.payment?.method !== 'CASH' && !finished;

  return (
    <div>
      <Header title={`Commande ${formatOrderNumber(order.number)}`} back />

      <div className="container stack">
        {/* Le code de retrait d'abord : c'est l'information qu'on cherche au comptoir. */}
        {order.pickupCode && !finished && (
          <div
            className="card"
            style={{ textAlign: 'center', background: 'var(--surface-2)', borderColor: 'var(--brand-primary)' }}
          >
            <p className="faint">Votre code de retrait</p>
            <p
              style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 800,
                letterSpacing: '0.18em',
                color: 'var(--brand-primary)',
                marginTop: 4,
              }}
            >
              {order.pickupCode}
            </p>
            <p className="faint" style={{ marginTop: 4 }}>
              À présenter au comptoir
            </p>
          </div>
        )}

        <div className="card stack" style={{ gap: 'var(--space-3)' }}>
          <div className="row row--between">
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              {order.type === 'DELIVERY' && <IconBike size={18} className="muted" />}
              {order.type === 'PICKUP' && <IconBag size={18} className="muted" />}
              {order.type === 'DINE_IN' && <IconQr size={18} className="muted" />}
              <span style={{ fontWeight: 700 }}>
                {order.type === 'DELIVERY' ? 'Livraison' : order.type === 'PICKUP' ? 'Retrait' : 'Sur place'}
                {order.table ? ` · Table ${order.table.number}` : ''}
              </span>
            </div>
            <Tag variant={statusVariant(order.status)}>{statusLabel(order.status)}</Tag>
          </div>

          <p className="faint">
            <IconClock size={14} style={{ display: 'inline', verticalAlign: -2 }} />{' '}
            Commande passée {formatRelative(order.createdAt)}
            {restaurant.data && !finished
              ? ` · prête en ${restaurant.data.restaurant.preparationMinutes} min environ`
              : ''}
          </p>

          {finished ? (
            <div className={`banner banner--${order.status === 'REJECTED' || order.status === 'CANCELLED' ? 'danger' : 'info'}`}>
              <span>
                {order.status === 'REJECTED'
                  ? "Le restaurant n'a pas pu accepter cette commande. Il vous contactera."
                  : order.status === 'CANCELLED'
                    ? 'Cette commande a été annulée.'
                    : 'Cette commande est terminée. Merci, et à bientôt !'}
              </span>
            </div>
          ) : (
            <div className="timeline">
              {steps.map((step, index) => {
                const done = currentIndex > index;
                const current = currentIndex === index;
                return (
                  <div
                    key={step}
                    className={`timeline__step${done ? ' timeline__step--done' : ''}${current ? ' timeline__step--current' : ''}`}
                  >
                    <div className="timeline__rail">
                      <span className="timeline__dot">{done && <IconCheck size={12} />}</span>
                      {index < steps.length - 1 && <span className="timeline__line" />}
                    </div>
                    <div className="timeline__body">
                      <p className="timeline__label" style={{ color: done || current ? 'var(--text)' : 'var(--text-faint)' }}>
                        {statusLabel(step)}
                      </p>
                      {current && <p className="faint">En cours…</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <section className="card stack" style={{ gap: 'var(--space-2)' }}>
          <h2 className="section-title">Détail</h2>
          {order.items.map((item) => (
            <div key={item.id} className="row row--between" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span>
                  <strong>{item.quantity}×</strong> {item.productName}
                </span>
                {item.options.length > 0 && (
                  <p className="faint">{item.options.map((option) => option.name).join(' · ')}</p>
                )}
              </div>
              <span className="price">{formatAmount(item.lineTotal)}</span>
            </div>
          ))}

          <div className="divider" style={{ marginBlock: 'var(--space-2)' }} />

          <div className="totals">
            <div className="totals__row">
              <span>Sous-total</span>
              <span>{formatAmount(order.subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="totals__row">
                <span>Livraison</span>
                <span>{formatAmount(order.deliveryFee)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="totals__row totals__row--discount">
                <span>Remise</span>
                <span>−{formatAmount(order.discount)}</span>
              </div>
            )}
            {order.loyaltyDiscount > 0 && (
              <div className="totals__row totals__row--discount">
                <span>Fidélité</span>
                <span>−{formatAmount(order.loyaltyDiscount)}</span>
              </div>
            )}
            <div className="totals__row totals__row--total">
              <span>Total</span>
              <span>{formatAmount(order.total)}</span>
            </div>
          </div>

          {order.delivery && (
            <p className="faint" style={{ marginTop: 'var(--space-2)' }}>
              Livraison · {order.delivery.sector} — {order.delivery.landmark}
            </p>
          )}
        </section>

        {payable && (
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={pay.isPending}
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? 'Paiement en cours…' : 'Payer maintenant'}
          </button>
        )}

        {cancellable && (
          <button
            type="button"
            className="btn btn--danger btn--block"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Annuler cette commande ?')) cancel.mutate();
            }}
          >
            Annuler la commande
          </button>
        )}

        {restaurant.data?.restaurant.phone && (
          <a href={`tel:${restaurant.data.restaurant.phone}`} className="btn btn--ghost btn--block">
            Appeler le restaurant
          </a>
        )}

        <Link to="/menu" className="btn btn--secondary btn--block">
          Commander autre chose
        </Link>
      </div>
    </div>
  );
}

function statusVariant(status: OrderStatus): 'success' | 'warning' | 'danger' | 'info' | 'brand' {
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'PAYMENT_FAILED' || status === 'EXPIRED') {
    return 'danger';
  }
  if (status === 'COMPLETED' || status === 'DELIVERED' || status === 'PICKED_UP' || status === 'SERVED') {
    return 'success';
  }
  if (status === 'READY') return 'brand';
  return 'info';
}
