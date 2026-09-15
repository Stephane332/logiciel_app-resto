/**
 * Paiement Mobile Money — sans agrégateur.
 *
 *   Celui qui paie ne confirme jamais son propre paiement.
 *
 * Le client compose un code déjà rempli, puis recopie l'identifiant que
 * l'opérateur lui envoie par SMS. Cette page est très claire sur un point : la
 * déclaration ne vaut pas confirmation. Laisser croire au client que sa commande
 * est réglée alors que personne au restaurant n'a rien vu serait le pire service
 * à lui rendre — il partirait sans son repas (ADR 008).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { looksLikeTransactionId } from '@barabite/shared';
import { IconPhone } from '../components/Icons';
import { ErrorState, Header, Loading } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { formatAmount } from '../lib/format';
import { queryClient, useOrder } from '../lib/queries';

export function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useOrder(id);

  const [reference, setReference] = useState('');
  const [touched, setTouched] = useState(false);

  const initiate = useMutation({ mutationFn: () => api.initiatePayment(id!) });

  const declare = useMutation({
    mutationFn: () => api.declarePayment(id!, reference.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
      navigate(`/commande/${id}`, { replace: true });
    },
  });

  // On demande le code dès l'ouverture : le client vient pour payer, pas pour
  // appuyer sur un bouton de plus.
  const { mutate: start } = initiate;
  useEffect(() => {
    if (id) start();
  }, [id, start]);

  if (isLoading) return <Loading rows={2} />;
  if (isError || !data) {
    return <ErrorState message="Cette commande est introuvable." onRetry={() => void refetch()} />;
  }

  const order = data.order;
  const payload = initiate.data;
  const initError = initiate.error instanceof ApiError ? initiate.error : null;
  const declareError = declare.error instanceof ApiError ? declare.error : null;
  const referenceValid = looksLikeTransactionId(reference);

  return (
    <div>
      <Header title="Paiement" back />

      <div className="container stack">
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="faint">Montant à payer</p>
          <p className="price" style={{ fontSize: 'var(--text-3xl)', marginTop: 2 }}>
            {formatAmount(order.total)}
          </p>
          <p className="faint">Commande n° {String(order.number).padStart(3, '0')}</p>
        </div>

        {initError && (
          <div className="banner banner--danger" role="alert">
            <span>{initError.message}</span>
          </div>
        )}

        {payload?.ussdCode && (
          <>
            <section className="stack" style={{ gap: 'var(--space-3)' }}>
              <h2 className="section-title">1. Payez</h2>
              <p className="subtitle" style={{ marginTop: -8 }}>
                Le clavier s'ouvre déjà rempli : le numéro du restaurant et le montant y sont.
              </p>

              <a href={payload.dialLink} className="btn btn--primary btn--block">
                <IconPhone size={18} />
                Composer le code
              </a>

              <div className="card" style={{ textAlign: 'center' }}>
                <p className="faint">Si le clavier ne s'ouvre pas, composez vous-même</p>
                <p
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 700,
                    marginTop: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  {payload.ussdCode}
                </p>
              </div>
            </section>

            <section className="stack" style={{ gap: 'var(--space-3)' }}>
              <h2 className="section-title">2. Recopiez l'identifiant du SMS</h2>
              <p className="subtitle" style={{ marginTop: -8 }}>
                L'opérateur vous envoie un SMS avec un identifiant de transaction. Recopiez-le
                exactement : il permet au restaurant de retrouver votre paiement.
              </p>

              <div className="field">
                <label className="field__label" htmlFor="reference">
                  Identifiant de transaction
                </label>
                <input
                  id="reference"
                  className={`input${touched && reference && !referenceValid ? ' input--error' : ''}`}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="MP260902.0128.19397304"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                {touched && reference && !referenceValid ? (
                  <span className="field__error">
                    Recopiez l'identifiant tel qu'il apparaît dans le SMS.
                  </span>
                ) : (
                  <span className="field__hint">Tel qu'il apparaît dans votre SMS.</span>
                )}
              </div>

              {/* Dire la vérité au client : sa déclaration ne règle rien tant que le
                  restaurant n'a pas vu l'argent arriver. */}
              <div className="banner banner--info">
                <span>
                  Votre commande partira en préparation dès que le restaurant aura vérifié le
                  paiement sur son propre téléphone. Vous verrez la confirmation ici.
                </span>
              </div>

              {declareError && (
                <div className="banner banner--danger" role="alert">
                  <span>{declareError.message}</span>
                </div>
              )}
            </section>
          </>
        )}

        {payload && !payload.ussdCode && payload.instructions && (
          <div className="banner banner--info">
            <span>{payload.instructions}</span>
          </div>
        )}
      </div>

      {payload?.requiresDeclaration && (
        <div className="action-bar">
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={!referenceValid || declare.isPending}
            onClick={() => declare.mutate()}
          >
            {declare.isPending ? 'Envoi…' : "J'ai payé — envoyer l'identifiant"}
          </button>
        </div>
      )}
    </div>
  );
}
