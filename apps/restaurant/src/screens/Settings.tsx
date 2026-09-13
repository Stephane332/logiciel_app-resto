/**
 * Paramètres.
 *
 * Tout ce que le restaurant peut changer lui-même, sans développeur : identité de la marque,
 * horaires, modes de commande, moyens de paiement, zones de livraison, fidélité (ADR 004).
 *
 * L'assistant de configuration initiale vit ici aussi : tant qu'une étape manque, le tableau de bord
 * la rappelle. Un restaurant livré à lui-même doit savoir où il en est.
 */
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { formatMinutes, WEEKDAY_LABELS } from '@barabite/shared';
import { staffApi, type DeliveryZone, type OpeningHour } from '@barabite/api-client';
import { IconCheck, IconPlus, IconTrash } from '../components/Icons';
import { ErrorState, Loading, Modal, Switch, Tag } from '../components/ui';
import { formatAmount } from '../lib/format';
import { queryClient, useRestaurant, useSetupStatus, useZones } from '../lib/queries';

export function Settings() {
  const restaurant = useRestaurant();
  const setup = useSetupStatus();

  if (restaurant.isLoading) return <Loading />;
  if (restaurant.isError) {
    return <ErrorState message="Les paramètres sont indisponibles." onRetry={() => void restaurant.refetch()} />;
  }

  const info = restaurant.data!;

  return (
    <div className="stack">
      {setup.data && setup.data.completed < setup.data.total && (
        <section className="card stack">
          <div className="row row--between">
            <h2 className="section-title">Configuration initiale</h2>
            <Tag variant="brand">
              {setup.data.completed} / {setup.data.total}
            </Tag>
          </div>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {setup.data.steps.map((step) => (
              <div key={step.key} className="row" style={{ gap: 'var(--space-2)' }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: step.done ? 'var(--success)' : 'var(--surface-3)',
                    color: step.done ? '#04170c' : 'var(--text-faint)',
                    flex: '0 0 auto',
                  }}
                >
                  {step.done && <IconCheck size={12} />}
                </span>
                <span className={step.done ? 'muted' : ''}>{step.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <BrandSection info={info} />
      <ServiceSection info={info} />
      <HoursSection hours={info.openingHours} />
      <ZonesSection />
      <LoyaltySection info={info} />
    </div>
  );
}

type Info = NonNullable<ReturnType<typeof useRestaurant>['data']>;

function invalidate(): void {
  void queryClient.invalidateQueries({ queryKey: ['restaurant'] });
  void queryClient.invalidateQueries({ queryKey: ['setup'] });
}

function BrandSection({ info }: { info: Info }) {
  const [name, setName] = useState(info.restaurant.name);
  const [tagline, setTagline] = useState(info.restaurant.tagline ?? '');
  const [phone, setPhone] = useState(info.restaurant.phone ?? '');
  const [address, setAddress] = useState(info.restaurant.address ?? '');
  const [primaryColor, setPrimaryColor] = useState(info.restaurant.primaryColor);
  const [logoUrl, setLogoUrl] = useState(info.restaurant.logoUrl ?? '');

  const save = useMutation({
    mutationFn: () =>
      staffApi.updateBrand({
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        primaryColor,
        logoUrl: logoUrl.trim() || undefined,
      }),
    onSuccess: invalidate,
  });

  return (
    <section className="card stack">
      <h2 className="section-title">Identité</h2>
      <p className="faint" style={{ marginTop: -8 }}>
        Ce que voient vos clients dans l'application. Les changements sont immédiats, sans
        réinstallation.
      </p>

      <div className="field">
        <label className="field__label" htmlFor="brand-name">
          Nom du restaurant
        </label>
        <input id="brand-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="brand-tagline">
          Signature
        </label>
        <input
          id="brand-tagline"
          className="input"
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
          placeholder="Bon goût. Sans attente."
        />
      </div>

      <div className="row row--wrap" style={{ gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label className="field__label" htmlFor="brand-phone">
            Téléphone
          </label>
          <input
            id="brand-phone"
            className="input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label className="field__label" htmlFor="brand-color">
            Couleur principale
          </label>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <input
              id="brand-color"
              type="color"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              style={{ width: 52, height: 48, border: 'none', background: 'none', padding: 0, borderRadius: 8 }}
              aria-label="Couleur principale"
            />
            <input
              className="input"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="brand-address">
          Adresse
        </label>
        <input
          id="brand-address"
          className="input"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="brand-logo">
          Adresse du logo
        </label>
        <input
          id="brand-logo"
          className="input"
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="https://…"
        />
      </div>

      <button type="button" className="btn btn--primary" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isSuccess && !save.isPending ? 'Enregistré' : 'Enregistrer'}
      </button>
    </section>
  );
}

function ServiceSection({ info }: { info: Info }) {
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => staffApi.updateSettings(body),
    onSuccess: invalidate,
  });

  const modes = info.restaurant.modes;
  const payment = info.restaurant.payment;

  return (
    <section className="card stack">
      <h2 className="section-title">Service</h2>

      {/* Chaque mode a son propre interrupteur : on peut suspendre la livraison un soir d'orage
          sans fermer le restaurant (§ 10). */}
      <Switch
        checked={modes.delivery}
        label="Livraison"
        hint="Les clients peuvent se faire livrer"
        onChange={(value) => update.mutate({ deliveryEnabled: value })}
      />
      <Switch
        checked={modes.pickup}
        label="Commander & récupérer"
        hint="Commande à l'avance, retrait au comptoir avec un code"
        onChange={(value) => update.mutate({ pickupEnabled: value })}
      />
      <Switch
        checked={modes.dineIn}
        label="Sur place"
        hint="Commande par QR Code de table"
        onChange={(value) => update.mutate({ dineInEnabled: value })}
      />

      <div className="divider" />

      <h3 style={{ fontWeight: 700 }}>Moyens de paiement</h3>
      <Switch
        checked={payment.online}
        label="Paiement en ligne"
        hint="Mobile Money depuis l'application"
        onChange={(value) => update.mutate({ onlinePayment: value })}
      />
      <Switch
        checked={payment.cashOnDelivery}
        label="Espèces à la livraison"
        onChange={(value) => update.mutate({ cashOnDelivery: value })}
      />
      <Switch
        checked={payment.cashOnPickup}
        label="Espèces au comptoir"
        onChange={(value) => update.mutate({ cashOnPickup: value })}
      />
      <Switch
        checked={payment.cashOnDineIn}
        label="Espèces sur place"
        onChange={(value) => update.mutate({ cashOnDineIn: value })}
      />

      <div className="divider" />

      <div className="field" style={{ maxWidth: 220 }}>
        <label className="field__label" htmlFor="prep-minutes">
          Délai de préparation annoncé
        </label>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <input
            id="prep-minutes"
            type="number"
            className="input"
            min={1}
            max={180}
            defaultValue={info.restaurant.preparationMinutes}
            onBlur={(event) => update.mutate({ preparationMinutes: Number(event.target.value) })}
          />
          <span className="muted">min</span>
        </div>
      </div>
    </section>
  );
}

function HoursSection({ hours }: { hours: OpeningHour[] }) {
  const [draft, setDraft] = useState<OpeningHour[]>([]);

  useEffect(() => {
    // Sept jours toujours présents, même ceux que le restaurant n'a jamais renseignés.
    setDraft(
      Array.from({ length: 7 }, (_, weekday) => {
        const existing = hours.find((hour) => hour.weekday === weekday);
        return existing ?? { weekday, opensAt: 10 * 60, closesAt: 22 * 60, closed: false };
      }),
    );
  }, [hours]);

  const save = useMutation({
    mutationFn: () => staffApi.updateHours(draft),
    onSuccess: invalidate,
  });

  function update(weekday: number, patch: Partial<OpeningHour>): void {
    setDraft((current) => current.map((hour) => (hour.weekday === weekday ? { ...hour, ...patch } : hour)));
  }

  return (
    <section className="card stack">
      <h2 className="section-title">Horaires</h2>
      <p className="faint" style={{ marginTop: -8 }}>
        Hors de ces plages, la prise de commande est bloquée et les clients voient la prochaine
        ouverture.
      </p>

      {draft.map((hour) => (
        <div key={hour.weekday} className="row row--wrap" style={{ gap: 'var(--space-3)' }}>
          <span style={{ width: 90, fontWeight: 600 }}>{WEEKDAY_LABELS[hour.weekday]}</span>

          <label className="row" style={{ gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              checked={!hour.closed}
              onChange={(event) => update(hour.weekday, { closed: !event.target.checked })}
              style={{ width: 20, height: 20 }}
            />
            <span className="faint">Ouvert</span>
          </label>

          <input
            type="time"
            className="input"
            style={{ width: 130 }}
            disabled={hour.closed}
            value={formatMinutes(hour.opensAt)}
            aria-label={`Heure d'ouverture le ${WEEKDAY_LABELS[hour.weekday]}`}
            onChange={(event) => update(hour.weekday, { opensAt: toMinutes(event.target.value) })}
          />
          <span className="muted">→</span>
          <input
            type="time"
            className="input"
            style={{ width: 130 }}
            disabled={hour.closed}
            value={formatMinutes(hour.closesAt)}
            aria-label={`Heure de fermeture le ${WEEKDAY_LABELS[hour.weekday]}`}
            onChange={(event) => update(hour.weekday, { closesAt: toMinutes(event.target.value) })}
          />
        </div>
      ))}

      <p className="faint">
        Une fermeture avant l'ouverture signifie « le lendemain » — pour un service qui se termine
        après minuit.
      </p>

      <button type="button" className="btn btn--primary" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isSuccess && !save.isPending ? 'Enregistré' : 'Enregistrer les horaires'}
      </button>
    </section>
  );
}

function ZonesSection() {
  const zones = useZones();
  const [adding, setAdding] = useState(false);

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => staffApi.updateZone(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });

  return (
    <section className="card stack">
      <div className="row row--between">
        <h2 className="section-title">Zones de livraison</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}>
          <IconPlus size={16} />
          Ajouter
        </button>
      </div>
      <p className="faint" style={{ marginTop: -8 }}>
        Forfait par secteur. Ouahigouya n'ayant pas d'adressage postal exploitable, un calcul au
        kilomètre produirait des frais faux.
      </p>

      {zones.isLoading ? (
        <Loading rows={2} height={56} />
      ) : (zones.data?.zones.length ?? 0) === 0 ? (
        <p className="faint">Aucune zone. Ajoutez les secteurs que vous livrez réellement.</p>
      ) : (
        zones.data!.zones.map((zone) => <ZoneRow key={zone.id} zone={zone} onToggle={(value) => update.mutate({ id: zone.id, body: { isActive: value } })} />)
      )}

      {adding && <ZoneModal onClose={() => setAdding(false)} />}
    </section>
  );
}

function ZoneRow({ zone, onToggle }: { zone: DeliveryZone; onToggle: (value: boolean) => void }) {
  const remove = useMutation({
    mutationFn: () => staffApi.deleteZone(zone.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });

  return (
    <div className="row row--wrap" style={{ gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ fontWeight: 600 }}>{zone.name}</p>
        <p className="faint">
          {formatAmount(zone.fee)} · minimum {formatAmount(zone.minimumOrder)} · {zone.estimatedMinutes} min
        </p>
      </div>
      <div style={{ minWidth: 130 }}>
        <Switch checked={zone.isActive} label={zone.isActive ? 'Desservie' : 'Suspendue'} onChange={onToggle} />
      </div>
      <button
        type="button"
        className="btn btn--danger btn--sm"
        aria-label={`Supprimer ${zone.name}`}
        onClick={() => {
          if (window.confirm(`Supprimer la zone « ${zone.name} » ?`)) remove.mutate();
        }}
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function ZoneModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [fee, setFee] = useState('500');
  const [minimumOrder, setMinimumOrder] = useState('2000');
  const [estimatedMinutes, setEstimatedMinutes] = useState('25');

  const create = useMutation({
    mutationFn: () =>
      staffApi.createZone({
        name: name.trim(),
        fee: Math.round(Number(fee)),
        minimumOrder: Math.round(Number(minimumOrder)),
        estimatedMinutes: Math.round(Number(estimatedMinutes)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['zones'] });
      void queryClient.invalidateQueries({ queryKey: ['setup'] });
      onClose();
    },
  });

  return (
    <Modal
      title="Nouvelle zone de livraison"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={name.trim().length < 2 || create.isPending}
          onClick={() => create.mutate()}
        >
          Ajouter la zone
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="zone-name">
            Nom du secteur
          </label>
          <input
            id="zone-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Secteur 3"
            autoFocus
          />
          <span className="faint">
            Le nom doit correspondre au secteur que les clients choisiront dans l'application.
          </span>
        </div>
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label" htmlFor="zone-fee">
              Frais (FCFA)
            </label>
            <input id="zone-fee" type="number" className="input" min={0} step={5} value={fee} onChange={(event) => setFee(event.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label" htmlFor="zone-min">
              Minimum (FCFA)
            </label>
            <input
              id="zone-min"
              type="number"
              className="input"
              min={0}
              step={5}
              value={minimumOrder}
              onChange={(event) => setMinimumOrder(event.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label" htmlFor="zone-time">
              Délai (min)
            </label>
            <input
              id="zone-time"
              type="number"
              className="input"
              min={1}
              value={estimatedMinutes}
              onChange={(event) => setEstimatedMinutes(event.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function LoyaltySection({ info }: { info: Info }) {
  const loyalty = info.restaurant.loyalty;
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => staffApi.updateSettings(body),
    onSuccess: invalidate,
  });

  return (
    <section className="card stack">
      <h2 className="section-title">Fidélité</h2>
      <Switch
        checked={Boolean(loyalty)}
        label="Programme de points"
        hint="Dans une ville de cette taille, le chiffre d'affaires vient des habitués."
        onChange={(value) => update.mutate({ loyaltyEnabled: value })}
      />

      {loyalty && (
        <div className="row row--wrap" style={{ gap: 'var(--space-3)' }}>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label className="field__label" htmlFor="loyalty-rate">
              Francs pour un point
            </label>
            <input
              id="loyalty-rate"
              type="number"
              className="input"
              min={1}
              defaultValue={loyalty.amountPerPoint}
              onBlur={(event) => update.mutate({ loyaltyAmountPerPoint: Number(event.target.value) })}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label className="field__label" htmlFor="loyalty-threshold">
              Palier d'utilisation
            </label>
            <input
              id="loyalty-threshold"
              type="number"
              className="input"
              min={0}
              defaultValue={loyalty.minimumPoints}
              onBlur={(event) => update.mutate({ loyaltyMinimumPoints: Number(event.target.value) })}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label className="field__label" htmlFor="loyalty-cap">
              Part maximale remisée (%)
            </label>
            <input
              id="loyalty-cap"
              type="number"
              className="input"
              min={1}
              max={100}
              defaultValue={loyalty.maxRedemptionPct}
              onBlur={(event) => update.mutate({ loyaltyMaxRedemptionPct: Number(event.target.value) })}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}
