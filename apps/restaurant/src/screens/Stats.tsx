/**
 * Statistiques.
 *
 * Trois principes, tirés de l'usage réel plutôt que de l'envie de faire joli :
 *   — tous les canaux comptent, comptoir inclus, sinon les chiffres mentent (ADR 005) ;
 *   — chaque graphique ne porte **qu'une seule série**, donc une seule teinte : aucune légende à
 *     déchiffrer, et le titre suffit à nommer la donnée ;
 *   — les axes partent de zéro, car un axe tronqué exagère les variations.
 *
 * Le graphique le plus utile n'est pas le chiffre d'affaires — c'est la répartition horaire : c'est
 * elle qui dit combien de personnes mettre en cuisine, et quand.
 */
import { useState } from 'react';
import { ErrorState, Loading, Stat } from '../components/ui';
import { channelLabel, formatAmount, typeLabel } from '../lib/format';
import { useRangeStats, useTopProducts } from '../lib/queries';

const RANGES = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '3 mois' },
];

export function Stats() {
  const [days, setDays] = useState(7);
  const range = useRangeStats(days);
  const top = useTopProducts(days);

  if (range.isLoading) return <Loading />;
  if (range.isError) {
    return <ErrorState message="Les statistiques sont indisponibles." onRetry={() => void range.refetch()} />;
  }

  const data = range.data!;

  return (
    <div className="stack">
      {/* Les filtres tiennent sur une seule ligne, au-dessus des graphiques. */}
      <div className="tabs" role="tablist" aria-label="Période">
        {RANGES.map((option) => (
          <button
            key={option.days}
            type="button"
            role="tab"
            className="tab"
            aria-selected={days === option.days}
            onClick={() => setDays(option.days)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid--stats">
        <Stat label="Chiffre d'affaires" value={formatAmount(data.revenue)} accent />
        <Stat label="Commandes servies" value={data.fulfilledCount} hint={`${data.orderCount} reçues`} />
        <Stat label="Panier moyen" value={formatAmount(data.averageBasket)} />
        <Stat
          label="Commandes refusées"
          value={data.rejected}
          hint={data.orderCount > 0 ? `${Math.round((data.rejected / data.orderCount) * 100)} % du total` : undefined}
        />
      </div>

      <BarChart
        title="Évolution des ventes"
        caption="Chiffre d'affaires par jour"
        bars={data.daily.map((day) => ({
          key: day.date,
          value: day.revenue,
          label: shortDate(day.date),
          tooltip: `${longDate(day.date)} · ${formatAmount(day.revenue)} · ${day.orders} commande${day.orders > 1 ? 's' : ''}`,
        }))}
        format={formatAmount}
      />

      <BarChart
        title="Heures de pointe"
        caption="Commandes par heure — c'est ce graphique qui dit quand renforcer l'équipe"
        bars={data.hourly.map((slot) => ({
          key: String(slot.hour),
          value: slot.orders,
          label: `${slot.hour}h`,
          tooltip: `${slot.hour}h — ${slot.orders} commande${slot.orders > 1 ? 's' : ''}`,
        }))}
        format={(value) => String(value)}
        // Une heure sur trois : au-delà, les étiquettes se chevauchent sur une tablette.
        labelEvery={3}
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Breakdown
          title="Par canal de commande"
          entries={Object.entries(data.byChannel).map(([key, count]) => ({ label: channelLabel(key), count }))}
        />
        <Breakdown
          title="Par mode de réception"
          entries={Object.entries(data.byType).map(([key, count]) => ({ label: typeLabel(key), count }))}
        />
      </div>

      <section className="card stack">
        <h2 className="section-title">Produits les plus vendus</h2>
        {top.isLoading ? (
          <Loading rows={3} height={28} />
        ) : (top.data?.products.length ?? 0) === 0 ? (
          <p className="faint">Aucune vente sur la période.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <caption className="sr-only">Produits les plus vendus sur la période</caption>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 8 }} className="field__label">
                  Produit
                </th>
                <th style={{ textAlign: 'right', paddingBottom: 8 }} className="field__label">
                  Quantité
                </th>
                <th style={{ textAlign: 'right', paddingBottom: 8 }} className="field__label">
                  Chiffre d'affaires
                </th>
              </tr>
            </thead>
            <tbody>
              {top.data!.products.map((product) => (
                <tr key={product.name}>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>{product.name}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{product.quantity}</td>
                  <td style={{ textAlign: 'right' }} className="price">
                    {formatAmount(product.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

interface Bar {
  key: string;
  value: number;
  label: string;
  tooltip: string;
}

/**
 * Histogramme à série unique.
 *
 * Écrit à la main plutôt qu'importé : une bibliothèque de graphiques pèse plus lourd que toute
 * l'application cliente, pour deux histogrammes. Les barres partent de zéro, sont arrondies en haut
 * seulement, et chaque barre est atteignable au clavier avec son libellé complet.
 */
function BarChart({
  title,
  caption,
  bars,
  format,
  labelEvery = 1,
}: {
  title: string;
  caption: string;
  bars: Bar[];
  format: (value: number) => string;
  labelEvery?: number;
}) {
  const [hovered, setHovered] = useState<Bar | null>(null);
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const hasData = bars.some((bar) => bar.value > 0);

  return (
    <section className="card stack" style={{ gap: 'var(--space-3)' }}>
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="faint">{caption}</p>
      </div>

      {!hasData ? (
        <p className="faint">Aucune donnée sur la période.</p>
      ) : (
        <>
          {/* Le survol affiche la valeur exacte : inutile d'imprimer un nombre sur chaque barre. */}
          <p className="faint" style={{ minHeight: 20 }} aria-live="polite">
            {hovered ? hovered.tooltip : `Maximum : ${format(max)}`}
          </p>

          <div className="bars" role="group" aria-label={title}>
            {bars.map((bar, index) => (
              <div key={bar.key} className="bars__col">
                <span className="bars__track">
                  <button
                    type="button"
                    className="bars__bar"
                    style={{ height: `${(bar.value / max) * 100}%` }}
                    aria-label={bar.tooltip}
                    onMouseEnter={() => setHovered(bar)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(bar)}
                    onBlur={() => setHovered(null)}
                  />
                </span>
                <span className="bars__label">{index % labelEvery === 0 ? bar.label : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Répartition simple : une teinte, des libellés directs, pas de camembert. */
function Breakdown({ title, entries }: { title: string; entries: { label: string; count: number }[] }) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className="card stack" style={{ gap: 'var(--space-3)' }}>
      <h2 className="section-title">{title}</h2>
      {entries.length === 0 ? (
        <p className="faint">Aucune commande sur la période.</p>
      ) : (
        entries
          .sort((a, b) => b.count - a.count)
          .map((entry) => (
            <div key={entry.label} className="stack" style={{ gap: 4 }}>
              <div className="row row--between">
                <span style={{ fontWeight: 600 }}>{entry.label}</span>
                <span className="faint">
                  {entry.count} · {total > 0 ? Math.round((entry.count / total) * 100) : 0} %
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${total > 0 ? (entry.count / total) * 100 : 0}%`,
                    height: '100%',
                    background: 'var(--brand-primary)',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))
      )}
    </section>
  );
}

function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
}

function longDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}
