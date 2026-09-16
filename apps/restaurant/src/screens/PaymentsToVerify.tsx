/**
 * Paiements à vérifier.
 *
 *   Celui qui paie ne confirme jamais son propre paiement.
 *
 * Le client a déclaré avoir payé et recopié l'identifiant de son SMS. Cet écran
 * sert à comparer cette déclaration avec **le SMS reçu sur le téléphone du
 * marchand**, puis à attester. Tant que personne n'a attesté, la commande n'est
 * pas payée (ADR 008).
 *
 * Deux façons de travailler, selon l'affluence :
 *   — coller le SMS reçu : le logiciel désigne la commande correspondante ;
 *   — comparer à l'œil et attester ligne par ligne.
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { staffApi, type PaymentToVerify, type SmsReadResult } from '@savora/api-client';
import { IconCheck, IconClose, IconSearch } from '../components/Icons';
import { Empty, ErrorState, Loading, Tag } from '../components/ui';
import { formatAmount, formatOrderNumber, formatTime } from '../lib/format';
import { queryClient } from '../lib/queries';

const METHOD_LABEL: Record<string, string> = {
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  MTN_MONEY: 'MTN Mobile Money',
  CARD: 'Carte bancaire',
  CASH: 'Espèces',
};

function refresh(): void {
  void queryClient.invalidateQueries({ queryKey: ['payments', 'to-verify'] });
  void queryClient.invalidateQueries({ queryKey: ['orders'] });
}

export function PaymentsToVerify() {
  const [sms, setSms] = useState('');
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['payments', 'to-verify'],
    queryFn: staffApi.paymentsToVerify,
    refetchInterval: 30_000,
  });

  const read = useMutation({
    mutationFn: () => staffApi.readSms(sms),
    onSuccess: (result: SmsReadResult) => {
      setHighlighted(result.kind === 'MATCHED' ? result.payment.id : null);
    },
  });

  if (list.isLoading) return <Loading />;
  if (list.isError) {
    return <ErrorState message="La file des paiements est indisponible." onRetry={() => void list.refetch()} />;
  }

  const payments = list.data?.payments ?? [];
  const result = read.data;

  return (
    <div className="stack">
      {/* Coller le SMS : c'est la règle, automatisée. La source reste le message reçu
          par le marchand, jamais la parole du payeur. */}
      <section className="card stack">
        <div>
          <h2 className="section-title">Coller le SMS de l'opérateur</h2>
          <p className="faint">
            Collez ici le message reçu sur le téléphone du restaurant. Le logiciel y lit le montant
            et l'identifiant, et désigne la commande correspondante.
          </p>
        </div>

        <textarea
          className="input"
          value={sms}
          onChange={(event) => setSms(event.target.value)}
          placeholder="Votre paiement de 4000.00 FCFA … Trans id: MP260902.0128.19397304."
          aria-label="SMS de l'opérateur"
        />

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={sms.trim().length < 5 || read.isPending}
            onClick={() => read.mutate()}
          >
            <IconSearch size={18} />
            Retrouver la commande
          </button>
          {sms && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSms('');
                read.reset();
                setHighlighted(null);
              }}
            >
              Effacer
            </button>
          )}
        </div>

        {result && <SmsOutcome result={result} />}
      </section>

      <section className="stack">
        <h2 className="section-title">
          {payments.length} paiement{payments.length > 1 ? 's' : ''} à vérifier
        </h2>

        {payments.length === 0 ? (
          <Empty
            title="Rien à vérifier"
            description="Les paiements déclarés par les clients apparaîtront ici, en attente de votre attestation."
          />
        ) : (
          <div className="grid grid--orders">
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} highlighted={highlighted === payment.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SmsOutcome({ result }: { result: SmsReadResult }) {
  if (result.kind === 'UNREADABLE') {
    return (
      <div className="banner banner--warning">
        Ce texte ne ressemble pas à un SMS d'opérateur : ni montant, ni identifiant lisible.
      </div>
    );
  }

  if (result.kind === 'NO_MATCH') {
    return (
      <div className="banner banner--warning">
        Aucun paiement en attente ne correspond
        {result.amount !== null ? ` à ${formatAmount(result.amount)}` : ''}. Vérifiez que le client a
        bien déclaré son paiement dans l'application.
      </div>
    );
  }

  if (result.kind === 'AMBIGUOUS') {
    // Le logiciel refuse de choisir : attester au hasard déclarerait payée une
    // commande qui ne l'est pas.
    return (
      <div className="banner banner--warning">
        {result.candidates.length} commandes portent le montant de {formatAmount(result.amount)}.
        L'identifiant ne permet pas de trancher : comparez à la main avant d'attester.
      </div>
    );
  }

  return (
    <div className="banner banner--success">
      Commande {formatOrderNumber(result.payment.order.dailyNumber)} —{' '}
      {formatAmount(result.payment.amount)}.{' '}
      {result.byReference
        ? "Reconnue par l'identifiant de transaction."
        : 'Reconnue par le montant : vérifiez le nom du payeur avant d\'attester.'}
    </div>
  );
}

function PaymentRow({ payment, highlighted }: { payment: PaymentToVerify; highlighted: boolean }) {
  const [note, setNote] = useState('');

  const attest = useMutation({
    mutationFn: (received: boolean) => staffApi.attestPayment(payment.id, received, note.trim() || undefined),
    onSuccess: refresh,
  });

  const customer = payment.order.customerName ?? payment.order.customer?.name ?? 'Client';
  const phone = payment.order.customerPhone ?? payment.order.customer?.phone;

  return (
    <article
      className="card stack"
      style={{
        gap: 'var(--space-3)',
        borderColor: highlighted ? 'var(--brand-primary)' : undefined,
        borderWidth: highlighted ? 2 : 1,
      }}
    >
      <div className="row row--between">
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>
          {formatOrderNumber(payment.order.dailyNumber)}
        </span>
        <span className="price" style={{ fontSize: 'var(--text-lg)' }}>
          {formatAmount(payment.amount)}
        </span>
      </div>

      <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
        <Tag variant="warning">{METHOD_LABEL[payment.method] ?? payment.method}</Tag>
        {payment.declaredAt && <Tag>déclaré à {formatTime(payment.declaredAt)}</Tag>}
      </div>

      <div>
        <p style={{ fontWeight: 600 }}>{customer}</p>
        {phone && <p className="faint">{phone}</p>}
      </div>

      <div>
        <p className="faint">Identifiant déclaré par le client</p>
        <p
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            wordBreak: 'break-all',
            marginTop: 2,
          }}
        >
          {payment.declaredReference ?? '—'}
        </p>
      </div>

      <div className="banner banner--info">
        Comparez avec le SMS reçu sur le téléphone du restaurant avant d'attester.
      </div>

      <input
        className="input"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Note (facultatif) : « SMS reçu à 12h04 »"
        aria-label="Note d'attestation"
      />

      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <button
          type="button"
          className="btn btn--danger"
          style={{ flex: 1 }}
          disabled={attest.isPending}
          onClick={() => {
            if (window.confirm(`Aucun paiement constaté pour la commande ${formatOrderNumber(payment.order.dailyNumber)} ?`)) {
              attest.mutate(false);
            }
          }}
        >
          <IconClose size={16} />
          Rien vu
        </button>
        <button
          type="button"
          className="btn btn--success"
          style={{ flex: 1 }}
          disabled={attest.isPending}
          onClick={() => attest.mutate(true)}
        >
          <IconCheck size={16} />
          Paiement reçu
        </button>
      </div>

      {attest.isError && <p className="field__error">L'attestation n'a pas pu être enregistrée.</p>}
    </article>
  );
}
