/**
 * Commandes : la file complète, par étape.
 *
 * Un seul écran pour tout le cycle, avec des onglets, plutôt que cinq écrans séparés : en service,
 * on n'a pas le temps de chercher où se trouve une commande.
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { normalizePickupCode, REJECTION_REASONS, type RejectionReason } from '@barabite/shared';
import { staffApi, type Order } from '@barabite/api-client';
import { IconSearch } from '../components/Icons';
import { OrderCard } from '../components/OrderCard';
import { Empty, ErrorState, Loading, Modal } from '../components/ui';
import { refreshOrders, useActiveOrders } from '../lib/queries';

type TabKey = 'pending' | 'preparing' | 'ready' | 'delivery';

const REASON_LABELS: Record<RejectionReason, string> = {
  OUT_OF_STOCK: 'Produit épuisé',
  TOO_BUSY: 'Trop de commandes',
  CLOSED: 'Restaurant fermé',
  OUT_OF_DELIVERY_AREA: 'Hors zone de livraison',
  INVALID_ORDER: 'Commande incohérente',
  CUSTOMER_REQUEST: 'Demande du client',
  OTHER: 'Autre motif',
};

export function Orders() {
  const [tab, setTab] = useState<TabKey>('pending');
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [code, setCode] = useState('');
  const { data, isLoading, isError, refetch } = useActiveOrders();

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="La file des commandes est indisponible." onRetry={() => void refetch()} />;

  const orders = data?.orders ?? [];
  const groups: Record<TabKey, Order[]> = {
    pending: orders.filter((order) => order.status === 'PENDING'),
    preparing: orders.filter((order) => order.status === 'ACCEPTED' || order.status === 'PREPARING'),
    ready: orders.filter((order) => order.status === 'READY' && order.type !== 'DELIVERY'),
    delivery: orders.filter(
      (order) =>
        (order.status === 'READY' && order.type === 'DELIVERY') ||
        order.status === 'ASSIGNED' ||
        order.status === 'OUT_FOR_DELIVERY',
    ),
  };

  const normalized = normalizePickupCode(code);
  const visible = code.trim()
    ? orders.filter(
        (order) =>
          order.pickupCode === normalized || String(order.dailyNumber).includes(code.replace(/\D/g, '')),
      )
    : groups[tab];

  return (
    <div className="stack">
      <div className="row row--wrap" style={{ gap: 'var(--space-3)' }}>
        <div className="tabs" role="tablist" style={{ flex: 1 }}>
          <Tab id="pending" tab={tab} setTab={setTab} label="Nouvelles" count={groups.pending.length} />
          <Tab id="preparing" tab={tab} setTab={setTab} label="En préparation" count={groups.preparing.length} />
          <Tab id="ready" tab={tab} setTab={setTab} label="Prêtes" count={groups.ready.length} />
          <Tab id="delivery" tab={tab} setTab={setTab} label="À livrer" count={groups.delivery.length} />
        </div>

        <label className="row input" style={{ maxWidth: 260, gap: 'var(--space-2)' }}>
          <IconSearch size={18} className="muted" />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="N° ou code de retrait"
            aria-label="Rechercher par numéro ou code de retrait"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', minWidth: 0 }}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <Empty
          title={code.trim() ? 'Aucune commande trouvée' : 'Rien à traiter ici'}
          description={
            code.trim()
              ? 'Vérifiez le numéro ou le code de retrait.'
              : 'Les commandes apparaîtront dès leur arrivée.'
          }
        />
      ) : (
        <div className="grid grid--orders">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              actions={<OrderActions order={order} onReject={() => setRejecting(order)} />}
            />
          ))}
        </div>
      )}

      {rejecting && <RejectModal order={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function Tab({
  id,
  tab,
  setTab,
  label,
  count,
}: {
  id: TabKey;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  label: string;
  count: number;
}) {
  return (
    <button type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
      {label}
      {count > 0 && <span className="tab__count">{count}</span>}
    </button>
  );
}

function OrderActions({ order, onReject }: { order: Order; onReject: () => void }) {
  const [code, setCode] = useState('');

  const accept = useMutation({ mutationFn: () => staffApi.accept(order.id), onSuccess: refreshOrders });
  const prepare = useMutation({ mutationFn: () => staffApi.prepare(order.id), onSuccess: refreshOrders });
  const ready = useMutation({ mutationFn: () => staffApi.ready(order.id), onSuccess: refreshOrders });
  const serve = useMutation({ mutationFn: () => staffApi.serve(order.id), onSuccess: refreshOrders });
  const handover = useMutation({
    mutationFn: () => staffApi.handover(order.id, code || undefined),
    onSuccess: () => {
      setCode('');
      refreshOrders();
    },
  });
  const depart = useMutation({ mutationFn: () => staffApi.depart(order.id), onSuccess: refreshOrders });
  const delivered = useMutation({ mutationFn: () => staffApi.delivered(order.id), onSuccess: refreshOrders });

  const busy =
    accept.isPending || prepare.isPending || ready.isPending || handover.isPending || depart.isPending || delivered.isPending;

  switch (order.status) {
    case 'PENDING':
      return (
        <>
          <button type="button" className="btn btn--danger" disabled={busy} onClick={onReject}>
            Refuser
          </button>
          <button
            type="button"
            className="btn btn--success"
            style={{ flex: 1 }}
            disabled={busy}
            onClick={() => accept.mutate()}
          >
            Accepter
          </button>
        </>
      );

    case 'ACCEPTED':
      return (
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => prepare.mutate()}>
          Commencer la préparation
        </button>
      );

    case 'PREPARING':
      return (
        <button type="button" className="btn btn--success btn--block" disabled={busy} onClick={() => ready.mutate()}>
          Marquer comme prête
        </button>
      );

    case 'READY':
      if (order.type === 'DINE_IN') {
        return (
          <button type="button" className="btn btn--success btn--block" disabled={busy} onClick={() => serve.mutate()}>
            Servie à la table
          </button>
        );
      }
      if (order.type === 'DELIVERY') {
        return <AssignCourier orderId={order.id} />;
      }
      return (
        <div className="stack" style={{ gap: 'var(--space-2)', width: '100%' }}>
          {/* Le code est vérifié, pas seulement affiché : c'est ce qui empêche qu'une commande
              parte avec la mauvaise personne (critère A6). */}
          <input
            className="input"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code de retrait"
            aria-label="Code de retrait présenté par le client"
          />
          <button
            type="button"
            className="btn btn--success btn--block"
            disabled={busy}
            onClick={() => handover.mutate()}
          >
            Remettre au client
          </button>
          {handover.isError && <p className="field__error">Code incorrect.</p>}
        </div>
      );

    case 'ASSIGNED':
      return (
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => depart.mutate()}>
          Le livreur est parti
        </button>
      );

    case 'OUT_FOR_DELIVERY':
      return (
        <button type="button" className="btn btn--success btn--block" disabled={busy} onClick={() => delivered.mutate()}>
          Commande livrée
        </button>
      );

    default:
      return null;
  }
}

function AssignCourier({ orderId }: { orderId: string }) {
  const [courierId, setCourierId] = useState('');
  const assign = useMutation({
    mutationFn: () => staffApi.assign(orderId, courierId),
    onSuccess: refreshOrders,
  });
  const couriers = useCouriers();

  if (couriers.length === 0) {
    return (
      <p className="banner banner--warning" style={{ width: '100%' }}>
        Aucun livreur enregistré. Ajoutez-en un dans « Employés ».
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-2)', width: '100%' }}>
      <select
        className="input"
        value={courierId}
        onChange={(event) => setCourierId(event.target.value)}
        aria-label="Livreur"
      >
        <option value="">Choisir un livreur…</option>
        {couriers.map((courier) => (
          <option key={courier.id} value={courier.id}>
            {courier.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={!courierId || assign.isPending}
        onClick={() => assign.mutate()}
      >
        Confier au livreur
      </button>
    </div>
  );
}

/**
 * Livreurs disponibles.
 *
 * La liste des employés n'est lisible que par l'administrateur : `retry: false` évite d'insister
 * quand un caissier consulte cet écran, et la liste vide déclenche alors un message explicite
 * plutôt qu'un sélecteur inerte.
 */
function useCouriers() {
  const { data } = useQuery({
    queryKey: ['employees'],
    queryFn: staffApi.employees,
    retry: false,
    staleTime: 5 * 60_000,
  });
  return (data?.employees ?? []).filter((employee) => employee.role === 'DELIVERY' && employee.isActive);
}

function RejectModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [reason, setReason] = useState<RejectionReason>('OUT_OF_STOCK');
  const [comment, setComment] = useState('');

  const reject = useMutation({
    mutationFn: () => staffApi.reject(order.id, { reason, comment: comment.trim() || undefined }),
    onSuccess: () => {
      refreshOrders();
      onClose();
    },
  });

  return (
    <Modal
      title={`Refuser la commande n° ${order.dailyNumber}`}
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--danger"
            style={{ flex: 1 }}
            disabled={reject.isPending}
            onClick={() => reject.mutate()}
          >
            Confirmer le refus
          </button>
        </div>
      }
    >
      <div className="stack">
        {/* Le motif est obligatoire : « refusée » sans raison est ingérable au support, et le client
            mérite de savoir pourquoi. */}
        <div className="field">
          <label className="field__label" htmlFor="reason">
            Motif
          </label>
          <select
            id="reason"
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value as RejectionReason)}
          >
            {REJECTION_REASONS.map((value) => (
              <option key={value} value={value}>
                {REASON_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="comment">
            Précision pour le client (facultatif)
          </label>
          <textarea
            id="comment"
            className="input"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={300}
            placeholder="Plus de pain jusqu'à 19h…"
          />
        </div>

        {reject.isError && <p className="field__error">Le refus n'a pas pu être enregistré.</p>}
      </div>
    </Modal>
  );
}
