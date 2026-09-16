/**
 * Tableau de bord.
 *
 * Il compte **tous les canaux** : application, comptoir, téléphone, QR de table. Un chiffre
 * d'affaires qui ignorerait le comptoir serait faux, donc inutile, donc ignoré — et le logiciel avec
 * lui (ADR 005).
 */
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { staffApi } from '@savora/api-client';
import { OrderCard } from '../components/OrderCard';
import { Empty, ErrorState, Loading, Stat, Tag } from '../components/ui';
import { channelLabel, formatAmount } from '../lib/format';
import {
  queryClient,
  refreshOrders,
  useActiveOrders,
  useManageMenu,
  useRestaurant,
  useSetupStatus,
  useTodayStats,
} from '../lib/queries';
import { useSession } from '../lib/session';

export function Dashboard() {
  const user = useSession((state) => state.user);
  const stats = useTodayStats();
  const orders = useActiveOrders();
  const restaurant = useRestaurant();
  const setup = useSetupStatus();
  const menu = useManageMenu();

  const toggleOpen = useMutation({
    mutationFn: (manuallyClosed: boolean) => staffApi.updateSettings({ manuallyClosed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant'] }),
  });

  if (stats.isLoading || orders.isLoading) return <Loading />;
  if (stats.isError) {
    return <ErrorState message="Les chiffres du jour sont indisponibles." onRetry={() => void stats.refetch()} />;
  }

  const today = stats.data!;
  const pending = (orders.data?.orders ?? []).filter((order) => order.status === 'PENDING');
  const open = restaurant.data?.state.open ?? false;
  const incomplete = setup.data?.steps.filter((step) => !step.done) ?? [];

  /*
   * Plats illustrés par un dessin du logiciel, faute de photo.
   *
   * Ce rappel existe parce que sans lui, personne ne remplacerait jamais ces visuels : ils sont
   * assez présentables pour qu'on les oublie, et le menu partirait en production avec des dessins
   * à la place des plats. Le gérant ne s'en apercevrait qu'en regardant son application comme un
   * client — c'est-à-dire trop tard.
   */
  const sansPhoto = (menu.data?.categories ?? [])
    .flatMap((category) => category.products)
    .filter((product) => product.imagePlaceholder).length;

  return (
    <div className="stack">
      {/* Configuration initiale : tant qu'il reste des étapes, le tableau de bord les rappelle.
          Un restaurant livré à lui-même doit savoir où il en est (§ 2.8). */}
      {incomplete.length > 0 && (
        <div className="banner banner--warning">
          <div style={{ flex: 1 }}>
            <strong>Configuration à terminer</strong>
            <p style={{ marginTop: 4 }}>
              {incomplete.map((step) => step.label).join(' · ')}
            </p>
          </div>
          <Link to="/parametres" className="btn btn--sm btn--secondary">
            Continuer
          </Link>
        </div>
      )}

      {sansPhoto > 0 && (
        <div className="banner banner--info">
          <div style={{ flex: 1 }}>
            <strong>
              {sansPhoto} plat{sansPhoto > 1 ? 's' : ''} sans votre photo
            </strong>
            <p style={{ marginTop: 4 }}>
              {sansPhoto > 1 ? 'Ils sont illustrés' : 'Il est illustré'} par un dessin du logiciel,
              pas par une photo de votre cuisine. Un plat photographié se commande nettement plus.
            </p>
          </div>
          <Link to="/menu" className="btn btn--sm btn--ghost">
            Ajouter mes photos
          </Link>
        </div>
      )}

      <div className="grid grid--stats">
        <Stat label="Commandes du jour" value={today.orderCount} hint={`${today.fulfilledCount} servies`} />
        <Stat label="Chiffre d'affaires" value={formatAmount(today.revenue)} accent />
        <Stat label="En préparation" value={today.preparing} />
        <Stat label="À récupérer" value={today.readyForPickup} hint={`${today.toDeliver} à livrer`} />
        <Stat label="Panier moyen" value={formatAmount(today.averageBasket)} />
      </div>

      <div className="card row row--between row--wrap">
        <div>
          <p style={{ fontWeight: 700 }}>{open ? 'Le restaurant accepte les commandes' : 'Prise de commande suspendue'}</p>
          <p className="faint">
            {open
              ? 'Les clients peuvent commander depuis l\'application et les QR Codes.'
              : 'Les clients voient le menu mais ne peuvent pas commander.'}
          </p>
        </div>
        {user && (user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <button
            type="button"
            className={`btn ${open ? 'btn--danger' : 'btn--success'}`}
            disabled={toggleOpen.isPending}
            onClick={() => toggleOpen.mutate(open)}
          >
            {open ? 'Suspendre les commandes' : 'Rouvrir les commandes'}
          </button>
        )}
      </div>

      <section className="stack">
        <div className="row row--between">
          <h2 className="section-title">
            Nouvelles commandes {pending.length > 0 && <Tag variant="brand">{pending.length}</Tag>}
          </h2>
          <Link to="/commandes" className="btn btn--ghost btn--sm">
            Voir toutes les commandes
          </Link>
        </div>

        {pending.length === 0 ? (
          <Empty title="Aucune commande en attente" description="Les nouvelles commandes s'afficheront ici avec une alerte sonore." />
        ) : (
          <div className="grid grid--orders">
            {pending.slice(0, 6).map((order) => (
              <OrderCard key={order.id} order={order} actions={<AcceptActions orderId={order.id} />} />
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">Répartition des commandes du jour</h2>
        <div className="card row row--wrap" style={{ gap: 'var(--space-4)' }}>
          {Object.entries(today.byChannel).length === 0 ? (
            <p className="faint">Aucune commande pour l'instant.</p>
          ) : (
            Object.entries(today.byChannel).map(([channel, count]) => (
              <div key={channel}>
                <p className="faint">{channelLabel(channel)}</p>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{count}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AcceptActions({ orderId }: { orderId: string }) {
  const accept = useMutation({ mutationFn: () => staffApi.accept(orderId), onSuccess: refreshOrders });

  return (
    <button
      type="button"
      className="btn btn--success btn--block"
      disabled={accept.isPending}
      onClick={() => accept.mutate()}
    >
      Accepter
    </button>
  );
}
