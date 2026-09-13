/**
 * Commande : mode de réception, coordonnées, adresse, paiement.
 *
 * Deux partis pris de terrain :
 *   — commander n'exige pas de compte : un nom et un téléphone suffisent (§ 2.2) ;
 *   — l'adresse se saisit par secteur et point de repère, parce que c'est ainsi qu'on se repère à
 *     Ouahigouya, et non par numéro de rue (§ 10).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { isValidBurkinaPhone, type OrderType, type PaymentMethod } from '@barabite/shared';
import { IconBag, IconBike, IconCheck, IconQr } from '../components/Icons';
import { Header, Tag } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { cartTotals, useCart } from '../lib/cart';
import { formatAmount } from '../lib/format';
import { useAddresses, useRestaurant } from '../lib/queries';
import { useSession } from '../lib/session';
import { useRecentOrders } from '../lib/recent';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  MTN_MONEY: 'MTN Mobile Money',
  CARD: 'Carte bancaire',
};

export function Checkout() {
  const navigate = useNavigate();
  const { items, mode, setMode, table, clear } = useCart();
  const user = useSession((state) => state.user);
  const restaurant = useRestaurant();
  const addresses = useAddresses(Boolean(user));
  const rememberOrder = useRecentOrders((state) => state.remember);
  /**
   * Marque une commande déjà partie.
   * Sans ce drapeau, vider le panier après l'envoi déclencherait le garde-fou « panier vide » et
   * renverrait le client au panier au lieu du suivi de sa commande — elle existerait sans qu'il la
   * voie jamais.
   */
  const orderPlaced = useRef(false);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [zoneId, setZoneId] = useState<string>('');
  const [sector, setSector] = useState('');
  const [landmark, setLandmark] = useState('');
  const [details, setDetails] = useState('');
  const [addressId, setAddressId] = useState<string>('');
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const info = restaurant.data;
  const zones = info?.deliveryZones ?? [];
  const modes = info?.restaurant.modes;

  // Une table scannée impose le mode « sur place » : le client est physiquement assis.
  useEffect(() => {
    if (table) setMode('DINE_IN');
    else if (!mode && modes) {
      setMode(modes.delivery ? 'DELIVERY' : modes.pickup ? 'PICKUP' : 'DINE_IN');
    }
  }, [table, mode, modes, setMode]);

  useEffect(() => {
    if (items.length === 0 && !orderPlaced.current) navigate('/panier', { replace: true });
  }, [items.length, navigate]);

  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const deliveryFee = mode === 'DELIVERY' ? (selectedZone?.fee ?? 0) : 0;
  const totals = cartTotals(items, { deliveryFee });

  const goodsTotal = totals.subtotal;
  const belowMinimum =
    mode === 'DELIVERY' && selectedZone ? goodsTotal < selectedZone.minimumOrder : false;

  const submit = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        type: mode,
        channel: table ? 'QR_TABLE' : 'APP',
        paymentMethod: payment,
        expectedTotal: totals.total,
        lines: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          optionItemIds: item.options.map((option) => option.id),
          ...(item.note ? { note: item.note } : {}),
        })),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(user ? {} : { customerName: name.trim(), customerPhone: phone.trim() }),
        ...(table ? { tableToken: table.token } : {}),
      };

      if (mode === 'DELIVERY') {
        payload.deliveryZoneId = zoneId;
        if (addressId) payload.addressId = addressId;
        else
          payload.address = {
            sector: selectedZone?.name ?? sector,
            landmark: landmark.trim(),
            ...(details.trim() ? { details: details.trim() } : {}),
          };
      }

      return api.createOrder(payload);
    },
    onSuccess: ({ order }) => {
      orderPlaced.current = true;
      // Mémorisée localement : sans compte, c'est le seul moyen de retrouver sa commande après
      // avoir fermé l'application.
      rememberOrder({
        id: order.id,
        number: order.number,
        total: order.total,
        createdAt: order.createdAt,
        type: order.type,
        pickupCode: order.pickupCode,
      });
      clear();
      navigate(`/commande/${order.id}`, { replace: true });
    },
  });

  function validate(): boolean {
    const found: Record<string, string> = {};

    if (!user) {
      if (name.trim().length < 2) found.name = 'Indiquez votre nom.';
      if (!isValidBurkinaPhone(phone)) found.phone = 'Numéro burkinabè invalide (8 chiffres).';
    }
    if (mode === 'DELIVERY') {
      if (!addressId) {
        if (!zoneId) found.zone = 'Choisissez votre secteur.';
        if (landmark.trim().length < 3) found.landmark = 'Indiquez un point de repère.';
      }
      if (belowMinimum) {
        found.minimum = `Cette zone demande au moins ${formatAmount(selectedZone!.minimumOrder)} de commande.`;
      }
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  }

  const error = submit.error instanceof ApiError ? submit.error : null;

  if (items.length === 0) return null;

  return (
    <div>
      <Header title="Votre commande" back />

      <div className="container stack">
        {/* --- Mode de réception --- */}
        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h2 className="section-title">Comment souhaitez-vous recevoir ?</h2>

          {table ? (
            <div className="mode-card" aria-pressed="true">
              <IconQr size={20} />
              <span className="mode-card__title">Sur place — table {table.number}</span>
              <span className="faint">Service à votre table</span>
            </div>
          ) : (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {modes?.delivery && (
                <ModeOption
                  icon={<IconBike size={20} />}
                  title="Livraison"
                  hint="Livré à l'adresse indiquée"
                  active={mode === 'DELIVERY'}
                  onSelect={() => setMode('DELIVERY' as OrderType)}
                />
              )}
              {modes?.pickup && (
                <ModeOption
                  icon={<IconBag size={20} />}
                  title="Commander & récupérer"
                  hint={`Prêt en ${info?.restaurant.preparationMinutes ?? 20} min environ`}
                  active={mode === 'PICKUP'}
                  onSelect={() => setMode('PICKUP' as OrderType)}
                />
              )}
              {modes?.dineIn && (
                <ModeOption
                  icon={<IconQr size={20} />}
                  title="Sur place"
                  hint="Scannez le QR Code de votre table"
                  active={mode === 'DINE_IN'}
                  onSelect={() => setMode('DINE_IN' as OrderType)}
                />
              )}
            </div>
          )}
        </section>

        {/* --- Coordonnées --- */}
        {!user && (
          <section className="stack" style={{ gap: 'var(--space-3)' }}>
            <h2 className="section-title">Vos coordonnées</h2>
            <p className="faint" style={{ marginTop: -8 }}>
              Pas besoin de créer un compte : votre nom et votre numéro suffisent.
            </p>

            <div className="field">
              <label className="field__label" htmlFor="name">
                Nom
              </label>
              <input
                id="name"
                className={`input${errors.name ? ' input--error' : ''}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Votre nom"
              />
              {errors.name && <span className="field__error">{errors.name}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="phone">
                Téléphone
              </label>
              <input
                id="phone"
                className={`input${errors.phone ? ' input--error' : ''}`}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="70 12 34 56"
              />
              {errors.phone ? (
                <span className="field__error">{errors.phone}</span>
              ) : (
                <span className="field__hint">Le restaurant vous appellera si nécessaire.</span>
              )}
            </div>
          </section>
        )}

        {/* --- Adresse de livraison --- */}
        {mode === 'DELIVERY' && (
          <section className="stack" style={{ gap: 'var(--space-3)' }}>
            <h2 className="section-title">Où livrer ?</h2>

            {(addresses.data?.addresses.length ?? 0) > 0 && (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {addresses.data!.addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    className="option-row"
                    aria-pressed={addressId === address.id}
                    onClick={() => setAddressId(addressId === address.id ? '' : address.id)}
                  >
                    <span className="option-row__mark">
                      {addressId === address.id && <IconCheck size={14} />}
                    </span>
                    <span style={{ flex: 1 }}>
                      <strong>{address.label ?? address.sector}</strong>
                      <br />
                      <span className="faint">{address.landmark}</span>
                    </span>
                  </button>
                ))}
                <div className="divider" style={{ margin: 0 }} />
              </div>
            )}

            {!addressId && (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="zone">
                    Secteur
                  </label>
                  <select
                    id="zone"
                    className={`input${errors.zone ? ' input--error' : ''}`}
                    value={zoneId}
                    onChange={(event) => {
                      setZoneId(event.target.value);
                      const zone = zones.find((item) => item.id === event.target.value);
                      if (zone) setSector(zone.name);
                    }}
                  >
                    <option value="">Choisissez votre secteur…</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} — {formatAmount(zone.fee)} · {zone.estimatedMinutes} min
                      </option>
                    ))}
                  </select>
                  {errors.zone && <span className="field__error">{errors.zone}</span>}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="landmark">
                    Point de repère
                  </label>
                  <input
                    id="landmark"
                    className={`input${errors.landmark ? ' input--error' : ''}`}
                    value={landmark}
                    onChange={(event) => setLandmark(event.target.value)}
                    placeholder="Face à la pharmacie, près du château d'eau…"
                  />
                  {errors.landmark ? (
                    <span className="field__error">{errors.landmark}</span>
                  ) : (
                    <span className="field__hint">C'est ce qui permet au livreur de vous trouver.</span>
                  )}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="details">
                    Précisions (facultatif)
                  </label>
                  <input
                    id="details"
                    className="input"
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Portail vert, 2ᵉ maison à droite…"
                  />
                </div>
              </>
            )}

            {errors.minimum && <p className="field__error">{errors.minimum}</p>}
          </section>
        )}

        {/* --- Paiement --- */}
        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h2 className="section-title">Paiement</h2>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {availablePayments(mode, info).map((method) => (
              <button
                key={method}
                type="button"
                className="option-row"
                aria-pressed={payment === method}
                onClick={() => setPayment(method)}
              >
                <span className="option-row__mark">{payment === method && <IconCheck size={14} />}</span>
                <span style={{ flex: 1 }}>{PAYMENT_LABELS[method]}</span>
                {method === 'CASH' && (
                  <Tag>{mode === 'DELIVERY' ? 'à la livraison' : 'au comptoir'}</Tag>
                )}
              </button>
            ))}
          </div>
        </section>

        <div className="field">
          <label className="field__label" htmlFor="order-note">
            Un message pour le restaurant ?
          </label>
          <textarea
            id="order-note"
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Appelez-moi en arrivant…"
          />
        </div>

        {/* --- Récapitulatif --- */}
        <div className="card totals">
          <div className="totals__row">
            <span>
              Sous-total · {totals.itemCount} article{totals.itemCount > 1 ? 's' : ''}
            </span>
            <span>{formatAmount(totals.subtotal)}</span>
          </div>
          {mode === 'DELIVERY' && (
            <div className="totals__row">
              <span>Livraison{selectedZone ? ` · ${selectedZone.name}` : ''}</span>
              <span>{selectedZone ? formatAmount(deliveryFee) : '—'}</span>
            </div>
          )}
          <div className="totals__row totals__row--total">
            <span>Total</span>
            <span>{formatAmount(totals.total)}</span>
          </div>
        </div>

        {error && (
          <div className="banner banner--danger" role="alert">
            <span>{error.message}</span>
          </div>
        )}
      </div>

      <div className="action-bar">
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={submit.isPending || belowMinimum}
          onClick={() => {
            if (validate()) submit.mutate();
          }}
        >
          {submit.isPending ? 'Envoi en cours…' : `Valider · ${formatAmount(totals.total)}`}
        </button>
      </div>
    </div>
  );
}

/** Les moyens proposés dépendent du mode et de la politique du restaurant (§ 9.2). */
function availablePayments(
  mode: OrderType | null,
  info: { restaurant: { payment: { online: boolean; cashOnDelivery: boolean; cashOnPickup: boolean; cashOnDineIn: boolean } } } | undefined,
): PaymentMethod[] {
  const policy = info?.restaurant.payment;
  const methods: PaymentMethod[] = [];

  const cashAllowed =
    mode === 'DELIVERY'
      ? policy?.cashOnDelivery
      : mode === 'PICKUP'
        ? policy?.cashOnPickup
        : policy?.cashOnDineIn;

  if (cashAllowed !== false) methods.push('CASH');
  if (policy?.online !== false) methods.push('ORANGE_MONEY', 'MOOV_MONEY');

  return methods.length > 0 ? methods : ['CASH'];
}

function ModeOption({
  icon,
  title,
  hint,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="mode-card" aria-pressed={active} onClick={onSelect}>
      <span style={{ color: active ? 'var(--brand-primary)' : 'var(--text-muted)' }}>{icon}</span>
      <span className="mode-card__title">{title}</span>
      <span className="faint">{hint}</span>
    </button>
  );
}
