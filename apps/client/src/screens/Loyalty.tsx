/**
 * Fidélité.
 *
 * Remontée de la V2 à la V1 : dans une ville de cette taille, le chiffre d'affaires vient des
 * habitués (§ 2.4).
 */
import { Link } from 'react-router-dom';
import { IconStar } from '../components/Icons';
import { EmptyState, Header, Loading } from '../components/ui';
import { formatAmount, formatRelative } from '../lib/format';
import { useLoyalty, useRestaurant } from '../lib/queries';
import { useSession } from '../lib/session';

export function Loyalty() {
  const user = useSession((state) => state.user);
  const loyalty = useLoyalty(Boolean(user));
  const restaurant = useRestaurant();

  const config = restaurant.data?.restaurant.loyalty;

  if (!user) {
    return (
      <div>
        <Header title="Fidélité" back />
        <EmptyState
          icon={<IconStar size={28} />}
          title="Cumulez des points"
          description={
            config
              ? `Un point par tranche de ${formatAmount(config.amountPerPoint)} dépensée, convertible en remise.`
              : 'Créez un compte pour profiter du programme de fidélité.'
          }
          action={
            <Link to="/compte/inscription" className="btn btn--primary">
              Créer un compte
            </Link>
          }
        />
      </div>
    );
  }

  if (loyalty.isLoading) return <Loading rows={2} />;

  const balance = loyalty.data?.balance ?? 0;
  const transactions = loyalty.data?.transactions ?? [];
  const threshold = config?.minimumPoints ?? 0;
  const progress = threshold > 0 ? Math.min(100, Math.round((balance / threshold) * 100)) : 100;

  return (
    <div>
      <Header title="Fidélité" back />

      <div className="container stack">
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="faint">Votre solde</p>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--brand-primary)' }}>
            {balance}
          </p>
          <p className="faint">point{balance > 1 ? 's' : ''}</p>

          {threshold > 0 && balance < threshold && (
            <>
              <div
                style={{
                  height: 8,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface-3)',
                  marginTop: 'var(--space-4)',
                  overflow: 'hidden',
                }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{ width: `${progress}%`, height: '100%', background: 'var(--brand-primary)' }}
                />
              </div>
              <p className="faint" style={{ marginTop: 'var(--space-2)' }}>
                Encore {threshold - balance} points avant de pouvoir les utiliser.
              </p>
            </>
          )}

          {threshold > 0 && balance >= threshold && (
            <p className="tag tag--success" style={{ marginTop: 'var(--space-3)' }}>
              Utilisables dès votre prochaine commande
            </p>
          )}
        </div>

        {config && (
          <div className="banner">
            <span>
              Vous gagnez 1 point par tranche de {formatAmount(config.amountPerPoint)}. Un point vaut{' '}
              {formatAmount(config.pointValue)} de remise, dans la limite de {config.maxRedemptionPct} % de
              la commande.
            </span>
          </div>
        )}

        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h2 className="section-title">Historique</h2>
          {transactions.length === 0 ? (
            <p className="subtitle">Vos points apparaîtront ici après votre première commande.</p>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="card row row--between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>{transaction.reason}</p>
                  <p className="faint">{formatRelative(transaction.createdAt)}</p>
                </div>
                <span
                  style={{
                    fontWeight: 800,
                    color: transaction.points > 0 ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {transaction.points > 0 ? '+' : ''}
                  {transaction.points}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
