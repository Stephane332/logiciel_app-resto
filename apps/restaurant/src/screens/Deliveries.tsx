/**
 * Ma tournée — l'écran du livreur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Un livreur roule. Cet écran doit se lire à l'arrêt, d'un coup d'œil.        │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le livreur n'a que deux gestes dans sa journée : « je pars » et « c'est remis ». Tout le reste est
 * de l'information dont il a besoin pour trouver le client et encaisser le bon montant : le secteur,
 * le point de repère — c'est ainsi qu'on se repère à Ouahigouya, pas par numéro de rue —, le
 * téléphone, et ce qu'il doit récupérer en espèces.
 *
 * Il ne voit que **ses** courses : le serveur filtre sur son identifiant (`GET /delivery/mine`), et
 * son rôle ne lui donne pas le droit de lire la file du restaurant. Ce n'est pas de la méfiance
 * envers l'équipe : un téléphone de livreur est celui qui circule le plus, se perd le plus, et se
 * prête le plus.
 */
import { useMutation } from '@tanstack/react-query';
import { staffApi, type Order } from '@savora/api-client';
import { formatAmount } from '@savora/shared';
import { IconClock } from '../components/Icons';
import { Empty, ErrorState, Loading, Tag } from '../components/ui';
import { formatOrderNumber, minutesSince } from '../lib/format';
import { refreshOrders, useMyDeliveries } from '../lib/queries';

export function Deliveries() {
  const { data, isLoading, isError, refetch } = useMyDeliveries();

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="Votre tournée est indisponible." onRetry={() => void refetch()} />;

  const courses = data?.orders ?? [];

  if (courses.length === 0) {
    return (
      <Empty
        title="Aucune course pour le moment"
        description="Les commandes qui vous sont confiées apparaîtront ici, sans que vous ayez à rafraîchir."
      />
    );
  }

  return (
    <div className="grid grid--orders">
      {courses.map((course) => (
        <Course key={course.id} order={course} />
      ))}
    </div>
  );
}

function Course({ order }: { order: Order }) {
  const depart = useMutation({ mutationFn: () => staffApi.depart(order.id), onSuccess: refreshOrders });
  const remise = useMutation({ mutationFn: () => staffApi.delivered(order.id), onSuccess: refreshOrders });

  const enRoute = order.status === 'OUT_FOR_DELIVERY';
  const especes = order.payments.some((p) => p.method === 'CASH' && p.status !== 'PAID');

  return (
    <article className={`order-card ${enRoute ? 'order-card--preparing' : ''}`}>
      <div className="row row--between">
        <span className="order-card__number" style={{ fontSize: 'var(--text-2xl)' }}>
          {formatOrderNumber(order.dailyNumber)}
        </span>
        <span className="timer">
          <IconClock size={16} style={{ display: 'inline', verticalAlign: -3 }} /> {minutesSince(order.createdAt)} min
        </span>
      </div>

      <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
        <Tag variant={enRoute ? 'brand' : 'warning'}>{enRoute ? 'En route' : 'À emporter'}</Tag>
        {order.deliveryZone && <Tag>{order.deliveryZone.name}</Tag>}
      </div>

      {/* L'adresse d'abord : c'est ce qu'il cherche en regardant l'écran. */}
      <div className="stack" style={{ gap: 'var(--space-1)' }}>
        <strong style={{ fontSize: 'var(--text-lg)' }}>
          {order.deliverySector ?? 'Secteur non précisé'}
        </strong>
        {order.deliveryLandmark && <p>{order.deliveryLandmark}</p>}
        {order.deliveryDetails && <p className="faint">{order.deliveryDetails}</p>}

        {/*
          * La position, quand le client l'a donnée.
          *
          * Un lien qui ouvre l'application de navigation du téléphone, et rien de plus : embarquer
          * une carte dans le logiciel coûterait des mégaoctets de données mobiles au livreur pour
          * refaire, en moins bien, ce que son téléphone fait déjà.
          *
          * La précision est dite en clair. Une position à trois cents mètres présentée comme exacte
          * est plus nuisible qu'une absence de position : le livreur y arrive, ne trouve personne, et
          * cesse de faire confiance au bouton.
          */}
        {order.deliveryLatitude != null && order.deliveryLongitude != null && (
          <div className="stack" style={{ gap: 2, marginTop: 'var(--space-2)' }}>
            <a
              className="btn btn--ghost"
              href={`https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir l'itinéraire
            </a>
            <span className="faint">
              {order.deliveryAccuracy != null && order.deliveryAccuracy > 50
                ? `Position à environ ${Math.round(order.deliveryAccuracy)} m près — fiez-vous au repère en arrivant.`
                : 'Position précise transmise par le client.'}
            </span>
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 'var(--space-1)' }}>
        <span className="faint">{order.customer?.name ?? order.customerName ?? 'Client'}</span>
        {/* Un numéro cliquable : le livreur appelle sans le recopier, gants ou pas. */}
        {(order.customer?.phone ?? order.customerPhone) && (
          <a className="btn btn--ghost" href={`tel:${order.customer?.phone ?? order.customerPhone}`}>
            Appeler {order.customer?.phone ?? order.customerPhone}
          </a>
        )}
      </div>

      <div className="order-card__items">
        {order.items.map((item) => (
          <div key={item.id} className="order-line">
            <span className="order-line__qty">{item.quantity}×</span>
            <span>{item.productName}</span>
          </div>
        ))}
      </div>

      {/* Le montant à encaisser, en grand : se tromper coûte de l'argent au restaurant. */}
      <div className="row row--between" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        <span>{especes ? 'À encaisser' : 'Déjà payé'}</span>
        <span>{especes ? formatAmount(order.total) : '—'}</span>
      </div>

      {order.note && <p className="faint">« {order.note} »</p>}

      {!enRoute ? (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={depart.isPending}
          onClick={() => depart.mutate()}
        >
          Je pars livrer
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={remise.isPending}
          onClick={() => remise.mutate()}
        >
          Commande remise
        </button>
      )}
    </article>
  );
}
