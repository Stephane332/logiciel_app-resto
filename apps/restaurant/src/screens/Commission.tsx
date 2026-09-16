/**
 * Commission de la plateforme.
 *
 * Cet écran existe pour une raison simple : une commission qu'on ne peut ni voir, ni recouper, ni
 * contester détruit la relation à la première fin de mois où le restaurateur fait ses comptes. Tout
 * y est donc montré — le taux, l'assiette, le détail commande par commande, et de quoi refaire le
 * calcul à la main. Il le fera au moins une fois, et il doit tomber sur le même nombre.
 *
 * Ce qui n'est pas facturé est dit aussi clairement que ce qui l'est : les ventes au comptoir, les
 * frais de livraison et les remises n'entrent pas dans l'assiette (ADR 009).
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatRate, looksLikeTransactionId } from '@savora/shared';
import { staffApi, type CommissionSettlement } from '@savora/api-client';
import { IconCheck, IconWallet } from '../components/Icons';
import { Empty, ErrorState, Loading, Tag } from '../components/ui';
import { formatAmount, formatOrderNumber } from '../lib/format';
import { queryClient } from '../lib/queries';

const PERIOD_LABEL: Record<string, string> = {
  DAILY: 'chaque jour',
  WEEKLY: 'chaque semaine',
  MONTHLY: 'chaque mois',
};

const CHANNEL_LABEL: Record<string, string> = {
  APP: 'Application',
  QR_TABLE: 'QR de table',
  COUNTER: 'Comptoir',
  PHONE: 'Téléphone',
};

function refresh(): void {
  void queryClient.invalidateQueries({ queryKey: ['commission'] });
}

export function Commission() {
  const summary = useQuery({ queryKey: ['commission', 'summary'], queryFn: staffApi.commissionSummary });
  const entries = useQuery({ queryKey: ['commission', 'entries'], queryFn: () => staffApi.commissionEntries() });
  const settlements = useQuery({
    queryKey: ['commission', 'settlements'],
    queryFn: staffApi.commissionSettlements,
  });

  if (summary.isLoading) return <Loading />;
  if (summary.isError || !summary.data) {
    return <ErrorState message="Le relevé de commission est indisponible." onRetry={() => void summary.refetch()} />;
  }

  const data = summary.data;
  const unpaid = (settlements.data?.settlements ?? []).filter((s) => s.status !== 'PAID' && s.status !== 'OPEN');

  return (
    <div className="stack">
      {!data.enabled && (
        <div className="banner banner--info">
          La commission est désactivée sur ce compte : rien n'est facturé.
        </div>
      )}

      {/* --- Encours --- */}
      <section className="card stack">
        <div className="row row--between">
          <div>
            <h2 className="section-title">Période en cours — {data.periodLabel}</h2>
            <p className="faint">
              {formatRate(data.rateBps)} sur les ventes passées par l'application, reversé{' '}
              {PERIOD_LABEL[data.period]}.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="price" style={{ fontSize: 'var(--text-3xl)' }}>{formatAmount(data.dueThisPeriod)}</p>
            <p className="faint">
              {data.entryCount} vente{data.entryCount > 1 ? 's' : ''} concernée{data.entryCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Dire ce qui n'est pas facturé vaut mieux que de laisser le doute s'installer. */}
        <div className="banner banner--info">
          <span>
            Facturé sur : {data.billableChannels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')}. Les ventes
            au comptoir, les frais de livraison et les remises n'entrent pas dans le calcul.
          </span>
        </div>
      </section>

      {/* --- Ce qui reste à reverser --- */}
      {data.outstanding > 0 && (
        <section className="stack">
          <h2 className="section-title">À reverser — {formatAmount(data.outstanding)}</h2>
          {unpaid.map((settlement) => (
            <SettlementCard key={settlement.id} settlement={settlement} platform={data.platform} />
          ))}
        </section>
      )}

      {/* --- Détail vérifiable --- */}
      <section className="stack">
        <h2 className="section-title">Détail, commande par commande</h2>
        <p className="faint" style={{ marginTop: -8 }}>
          Chaque ligne porte son assiette et son taux : le calcul se refait à la main.
        </p>

        {entries.isLoading ? (
          <Loading />
        ) : (entries.data?.entries.length ?? 0) === 0 ? (
          <Empty
            title="Aucune commission"
            description="Les ventes passées par l'application apparaîtront ici, une ligne par commande."
          />
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
              <caption className="sr-only">Commission due, commande par commande</caption>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 8 }} className="field__label">Commande</th>
                  <th style={{ textAlign: 'left', paddingBottom: 8 }} className="field__label">Canal</th>
                  <th style={{ textAlign: 'right', paddingBottom: 8 }} className="field__label">Assiette</th>
                  <th style={{ textAlign: 'right', paddingBottom: 8 }} className="field__label">Taux</th>
                  <th style={{ textAlign: 'right', paddingBottom: 8 }} className="field__label">Commission</th>
                </tr>
              </thead>
              <tbody>
                {entries.data!.entries.map((entry) => (
                  <tr key={entry.id} style={entry.reversed ? { opacity: 0.55 } : undefined}>
                    <td style={{ padding: '6px 0', fontWeight: 600 }}>
                      {formatOrderNumber(entry.order.dailyNumber)}{' '}
                      {entry.reversed && <Tag variant="warning">annulée</Tag>}
                    </td>
                    <td className="faint">{CHANNEL_LABEL[entry.order.channel] ?? entry.order.channel}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatAmount(entry.base)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="faint">{formatRate(entry.rateBps)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }} className="price">
                      {entry.reversed ? `− ${formatAmount(entry.amount)}` : formatAmount(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Historique --- */}
      {(settlements.data?.settlements.length ?? 0) > 0 && (
        <section className="stack">
          <h2 className="section-title">Relevés passés</h2>
          <div className="grid grid--orders">
            {settlements.data!.settlements.map((settlement) => (
              <SettlementCard key={settlement.id} settlement={settlement} platform={data.platform} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SettlementCard({
  settlement,
  platform,
}: {
  settlement: CommissionSettlement;
  platform: { name: string; momoNumber: string | null; operator: string };
}) {
  const [reference, setReference] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const transfer = useQuery({
    queryKey: ['commission', 'transfer', settlement.id],
    queryFn: () => staffApi.commissionTransfer(settlement.id),
    enabled: showTransfer,
  });

  const declare = useMutation({
    mutationFn: () => staffApi.declareCommissionPaid(settlement.id, reference.trim()),
    onSuccess: refresh,
  });

  const paid = settlement.status === 'PAID';
  const declared = settlement.status === 'DECLARED';

  return (
    <article className="card stack">
      <div className="row row--between">
        <span style={{ fontWeight: 700 }}>{settlement.periodLabel}</span>
        <span className="price" style={{ fontSize: 'var(--text-lg)' }}>{formatAmount(settlement.amount)}</span>
      </div>

      <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
        {paid && <Tag variant="success"><IconCheck size={12} /> Reversé</Tag>}
        {declared && <Tag variant="warning">En attente de vérification</Tag>}
        {settlement.status === 'CLOSED' && <Tag>À reverser</Tag>}
        <Tag>{settlement.entryCount} vente{settlement.entryCount > 1 ? 's' : ''}</Tag>
      </div>

      {!paid && !declared && (
        <>
          {!showTransfer ? (
            <button type="button" className="btn btn--primary" onClick={() => setShowTransfer(true)}>
              <IconWallet size={16} />
              Reverser à {platform.name}
            </button>
          ) : transfer.isLoading ? (
            <Loading rows={1} />
          ) : transfer.isError || !transfer.data ? (
            <div className="banner banner--warning">
              Le numéro de reversement n'est pas configuré. Contactez {platform.name}.
            </div>
          ) : (
            <div className="stack">
              <a href={transfer.data.dialLink} className="btn btn--primary">
                Composer le code de transfert
              </a>
              <div className="card" style={{ textAlign: 'center' }}>
                <p className="faint">Si le clavier ne s'ouvre pas, composez vous-même</p>
                <p
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontWeight: 700,
                    fontSize: 'var(--text-lg)',
                    marginTop: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  {transfer.data.ussdCode}
                </p>
                <p className="faint">
                  {transfer.data.recipient.name} — {transfer.data.recipient.number}
                </p>
              </div>

              <div className="field">
                <label className="field__label" htmlFor={`ref-${settlement.id}`}>
                  Identifiant du SMS de transfert
                </label>
                <input
                  id={`ref-${settlement.id}`}
                  className="input"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="MP260930.1402.19397304"
                  autoComplete="off"
                />
              </div>

              {/* La règle ne change pas de sens parce qu'elle joue cette fois en faveur du
                  restaurant : celui qui paie ne confirme jamais son propre paiement. */}
              <div className="banner banner--info">
                <span>
                  {platform.name} vérifiera le virement sur son propre téléphone avant de solder ce
                  relevé.
                </span>
              </div>

              <button
                type="button"
                className="btn btn--success"
                disabled={!looksLikeTransactionId(reference) || declare.isPending}
                onClick={() => declare.mutate()}
              >
                {declare.isPending ? 'Envoi…' : "J'ai reversé — envoyer l'identifiant"}
              </button>
            </div>
          )}
        </>
      )}

      {declared && settlement.declaredReference && (
        <p className="faint" style={{ fontFamily: 'ui-monospace, monospace' }}>
          {settlement.declaredReference}
        </p>
      )}
    </article>
  );
}
