/** Aide : les questions qu'on se pose vraiment, et de quoi joindre un humain. */
import { formatBurkinaPhone, formatMinutes, WEEKDAY_LABELS } from '@savora/shared';
import { IconPhone } from '../components/Icons';
import { Header, Loading } from '../components/ui';
import { useRestaurant } from '../lib/queries';

const FAQ = [
  {
    question: 'Dois-je créer un compte pour commander ?',
    answer:
      'Non. Votre nom et votre numéro de téléphone suffisent. Le compte sert seulement à retrouver vos commandes et à cumuler des points.',
  },
  {
    question: 'Comment fonctionne le retrait ?',
    answer:
      'Vous commandez à l\'avance, vous recevez un code à cinq caractères, et vous le présentez au comptoir quand la commande est prête. Pas de file d\'attente.',
  },
  {
    question: 'Comment commander sur place ?',
    answer:
      'Scannez le QR Code posé sur votre table avec l\'appareil photo de votre téléphone. La commande est automatiquement rattachée à votre table.',
  },
  {
    question: 'Puis-je annuler ma commande ?',
    answer:
      'Oui, tant que le restaurant ne l\'a pas acceptée. Ensuite, appelez le restaurant : la préparation a peut-être déjà commencé.',
  },
  {
    question: 'Comment payer ?',
    answer:
      'En espèces à la livraison ou au comptoir, ou par Mobile Money depuis l\'application. Les moyens disponibles s\'affichent au moment de valider.',
  },
];

export function Help() {
  const { data, isLoading } = useRestaurant();
  if (isLoading) return <Loading rows={3} />;

  return (
    <div>
      <Header title="Aide" back />

      <div className="container stack">
        {data?.restaurant.phone && (
          <a href={`tel:${data.restaurant.phone}`} className="card row">
            <IconPhone size={20} style={{ color: 'var(--brand-primary)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700 }}>Appeler le restaurant</p>
              <p className="faint">{formatBurkinaPhone(data.restaurant.phone)}</p>
            </div>
          </a>
        )}

        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h2 className="section-title">Questions fréquentes</h2>
          {FAQ.map((entry) => (
            <details key={entry.question} className="card">
              <summary style={{ fontWeight: 600, cursor: 'pointer', minHeight: 32 }}>
                {entry.question}
              </summary>
              <p className="subtitle" style={{ marginTop: 'var(--space-2)' }}>
                {entry.answer}
              </p>
            </details>
          ))}
        </section>

        {(data?.openingHours.length ?? 0) > 0 && (
          <section className="stack" style={{ gap: 'var(--space-3)' }}>
            <h2 className="section-title">Horaires</h2>
            <div className="card stack" style={{ gap: 'var(--space-2)' }}>
              {data!.openingHours.map((hour) => (
                <div key={hour.weekday} className="row row--between">
                  <span>{WEEKDAY_LABELS[hour.weekday]}</span>
                  <span className={hour.closed ? 'muted' : ''}>
                    {hour.closed
                      ? 'Fermé'
                      : `${formatMinutes(hour.opensAt)} – ${formatMinutes(hour.closesAt)}`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {data?.restaurant.address && (
          <p className="faint" style={{ textAlign: 'center' }}>
            {data.restaurant.address}
          </p>
        )}
      </div>
    </div>
  );
}
