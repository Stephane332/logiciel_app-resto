/**
 * Tables et QR Codes.
 *
 * Le jeton d'une table n'est jamais affiché en clair : seule l'URL du QR l'est, et elle sert à
 * l'imprimer. Le régénérer invalide immédiatement le code déjà collé sur la table (§ 8).
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { staffApi, type RestaurantTable } from '@savora/api-client';
import { IconPlus, IconQr, IconRefresh } from '../components/Icons';
import { Empty, ErrorState, Loading, Modal, Tag } from '../components/ui';
import { formatAmount, formatOrderNumber } from '../lib/format';
import { queryClient, useTables } from '../lib/queries';

const STATUS_LABELS: Record<string, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Occupée',
  PREPARING: 'En préparation',
  TO_SERVE: 'À servir',
  SERVED: 'Servie',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'info' | 'brand'> = {
  FREE: 'default',
  OCCUPIED: 'warning',
  PREPARING: 'info',
  TO_SERVE: 'brand',
  SERVED: 'success',
};

export function Tables() {
  const { data, isLoading, isError, refetch } = useTables();
  const [adding, setAdding] = useState(false);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="Les tables sont indisponibles." onRetry={() => void refetch()} />;

  const tables = data?.tables ?? [];

  return (
    <div className="stack">
      <div className="row row--between">
        <h2 className="section-title">{tables.length} table{tables.length > 1 ? 's' : ''}</h2>
        <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
          <IconPlus />
          Ajouter une table
        </button>
      </div>

      {tables.length === 0 ? (
        <Empty
          title="Aucune table"
          description="Créez vos tables pour générer leurs QR Codes et permettre la commande sur place."
        />
      ) : (
        <div className="grid grid--tables">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              className={`table-tile table-tile--${table.status}`}
              onClick={() => setQrTable(table)}
            >
              <span className="table-tile__number">Table {table.number}</span>
              <Tag variant={STATUS_VARIANTS[table.status] ?? 'default'}>
                {STATUS_LABELS[table.status] ?? table.status}
              </Tag>
              {table.currentOrder && (
                <span className="faint">
                  {formatOrderNumber(table.currentOrder.dailyNumber)} ·{' '}
                  {formatAmount(table.currentOrder.total)}
                </span>
              )}
              {!table.isActive && <Tag variant="default">Désactivée</Tag>}
            </button>
          ))}
        </div>
      )}

      {adding && <AddTableModal onClose={() => setAdding(false)} />}
      {qrTable && <QrModal table={qrTable} onClose={() => setQrTable(null)} />}
    </div>
  );
}

function AddTableModal({ onClose }: { onClose: () => void }) {
  const [number, setNumber] = useState('');
  const [capacity, setCapacity] = useState(4);

  const create = useMutation({
    mutationFn: () => staffApi.createTable({ number: number.trim(), capacity }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tables'] });
      void queryClient.invalidateQueries({ queryKey: ['setup'] });
      onClose();
    },
  });

  return (
    <Modal
      title="Nouvelle table"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!number.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Créer la table
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="number">
            Numéro
          </label>
          <input
            id="number"
            className="input"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="08"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="capacity">
            Places
          </label>
          <input
            id="capacity"
            type="number"
            className="input"
            value={capacity}
            min={1}
            max={30}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </div>
        {create.isError && <p className="field__error">Ce numéro de table existe peut-être déjà.</p>}
      </div>
    </Modal>
  );
}

function QrModal({ table, onClose }: { table: RestaurantTable; onClose: () => void }) {
  const [url, setUrl] = useState(table.qrUrl);
  const [warning, setWarning] = useState<string | null>(null);

  const regenerate = useMutation({
    mutationFn: () => staffApi.regenerateQr(table.id),
    onSuccess: (result) => {
      setUrl(result.qrUrl);
      setWarning(result.message);
      void queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });

  /**
   * QR Code dessiné par l'API publique de Google Charts.
   * Choix assumé : générer un QR Code côté client demanderait une bibliothèque de ~20 Ko pour un
   * écran consulté deux fois par an. L'URL encodée ne contient rien de secret au-delà du jeton
   * lui-même, qui est de toute façon imprimé et collé sur la table.
   */
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(url)}`;

  return (
    <Modal title={`QR Code — Table ${table.number}`} onClose={onClose}>
      <div className="stack" style={{ alignItems: 'center' }}>
        <img
          src={qrImage}
          alt={`QR Code de la table ${table.number}`}
          width={320}
          height={320}
          style={{ background: '#fff', borderRadius: 'var(--radius)', padding: 8 }}
        />

        <p className="faint" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
          {url}
        </p>

        {warning && <div className="banner banner--warning">{warning}</div>}

        <div className="row" style={{ gap: 'var(--space-2)', width: '100%' }}>
          <button type="button" className="btn btn--secondary" style={{ flex: 1 }} onClick={() => window.print()}>
            <IconQr />
            Imprimer
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ flex: 1 }}
            disabled={regenerate.isPending}
            onClick={() => {
              if (window.confirm('Régénérer le QR Code ? L\'ancien, déjà imprimé, cessera de fonctionner.')) {
                regenerate.mutate();
              }
            }}
          >
            <IconRefresh />
            Régénérer
          </button>
        </div>
      </div>
    </Modal>
  );
}
