/**
 * Accueil.
 *
 * Doit répondre en trois secondes à trois questions : où suis-je, est-ce ouvert, qu'est-ce que je
 * mange. Tout le reste vient après.
 */
import { Link } from 'react-router-dom';
import { formatMinutes, WEEKDAY_LABELS } from '@savora/shared';
import { IconBag, IconBell, IconBike, IconClock, IconQr, IconSearch } from '../components/Icons';
import { ProductCard, ProductCardCompact } from '../components/ProductCard';
import { ErrorState, Loading, Tag } from '../components/ui';
import { useMenu, useRestaurant } from '../lib/queries';
import { useSession } from '../lib/session';
import { useCart } from '../lib/cart';

export function Home() {
  const restaurant = useRestaurant();
  const menu = useMenu();
  const user = useSession((state) => state.user);
  const table = useCart((state) => state.table);

  if (restaurant.isLoading || menu.isLoading) return <Loading rows={3} />;
  if (restaurant.isError || menu.isError) {
    return (
      <ErrorState
        message="Vérifiez votre connexion, puis réessayez."
        onRetry={() => {
          void restaurant.refetch();
          void menu.refetch();
        }}
      />
    );
  }

  const info = restaurant.data!;
  const categories = menu.data?.categories ?? [];
  const featured = categories.flatMap((category) => category.products).filter((p) => p.isFeatured);
  const popular = categories.flatMap((category) => category.products).slice(0, 6);
  const open = info.state.open;

  return (
    <div>
      <header className="header" style={{ borderBottom: 'none' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="faint" style={{ lineHeight: 1.2 }}>
            {user ? `Bonjour ${user.name.split(' ')[0]}` : 'Bienvenue chez'}
          </p>
          <p style={{ fontWeight: 800, fontSize: 'var(--text-lg)' }}>{info.restaurant.name}</p>
        </div>
        <Link to="/notifications" className="icon-button" aria-label="Notifications">
          <IconBell size={20} />
        </Link>
      </header>

      <div className="container stack">
        {/* L'état d'ouverture vient en premier : commander dans un restaurant fermé est la
            frustration la plus évitable qui soit. */}
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {open ? (
            <Tag variant="success">
              <IconClock size={14} /> Ouvert jusqu'à {formatMinutes(info.state.closesAt)}
            </Tag>
          ) : (
            <Tag variant="danger">
              <IconClock size={14} />
              {info.state.reason === 'MANUALLY_CLOSED'
                ? 'Fermé pour le moment'
                : info.state.nextOpening
                  ? `Fermé — ouvre ${WEEKDAY_LABELS[info.state.nextOpening.weekday]?.toLowerCase()} à ${formatMinutes(info.state.nextOpening.opensAt)}`
                  : 'Fermé'}
            </Tag>
          )}
          {info.restaurant.city && <Tag>{info.restaurant.city}</Tag>}
        </div>

        {table && (
          <div className="banner banner--info">
            <IconQr size={18} />
            <span>
              Vous commandez à la <strong>table {table.number}</strong>.
            </span>
          </div>
        )}

        <Link to="/menu" className="input row" style={{ color: 'var(--text-faint)' }}>
          <IconSearch size={20} />
          Rechercher un produit…
        </Link>

        {/* Les trois modes annoncés dès l'accueil : c'est la promesse du produit, pas une option
            cachée dans le tunnel de commande. */}
        <div className="mode-badges">
          {info.restaurant.modes.delivery && <ModeBadge icon={<IconBike size={20} />} label="Livraison" />}
          {info.restaurant.modes.pickup && <ModeBadge icon={<IconBag size={20} />} label="Retrait" />}
          {info.restaurant.modes.dineIn && <ModeBadge icon={<IconQr size={20} />} label="Sur place" />}
        </div>

        {featured.length > 0 && (
          <section className="stack" style={{ gap: 'var(--space-3)' }}>
            <div className="row row--between">
              <h2 className="section-title">Menu du moment</h2>
            </div>
            <div className="scroller">
              {featured.map((product) => (
                <ProductCardCompact key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <div className="row row--between">
            <h2 className="section-title">Nos catégories</h2>
            <Link to="/menu" className="faint">
              Tout voir
            </Link>
          </div>
          <div className="scroller" style={{ gap: 'var(--space-2)' }}>
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/menu/${category.slug}`}
                className="chip"
                style={{ flex: '0 0 auto' }}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h2 className="section-title">Nos meilleurs produits</h2>
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            {popular.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ModeBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="mode-badge">
      <span className="mode-badge__icon">{icon}</span>
      <span className="mode-badge__label">{label}</span>
    </div>
  );
}
