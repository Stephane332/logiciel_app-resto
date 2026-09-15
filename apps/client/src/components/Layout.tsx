/** Coquille de l'application : contenu, bandeau réseau et navigation basse à cinq onglets. */
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { IconCart, IconHome, IconMenu, IconReceipt, IconUser } from './Icons';
import { OfflineBanner } from './ui';
import { cartItemCount, useCart } from '../lib/cart';

const TABS = [
  { to: '/', label: 'Accueil', icon: IconHome, end: true },
  { to: '/menu', label: 'Menu', icon: IconMenu, end: false },
  { to: '/panier', label: 'Panier', icon: IconCart, end: false },
  { to: '/commandes', label: 'Commandes', icon: IconReceipt, end: false },
  { to: '/compte', label: 'Compte', icon: IconUser, end: false },
];

/** Écrans en plein écran : la navigation basse y volerait de la place et de l'attention. */
const FULLSCREEN = ['/commander', '/produit/', '/t/', '/compte/connexion', '/compte/inscription'];
const FULLSCREEN_SUFFIX = ['/paiement'];

export function Layout() {
  const location = useLocation();
  const items = useCart((state) => state.items);
  const count = cartItemCount(items);

  const hideNav =
    FULLSCREEN.some((path) => location.pathname.startsWith(path)) ||
    FULLSCREEN_SUFFIX.some((suffix) => location.pathname.endsWith(suffix));

  return (
    <div className="app">
      <OfflineBanner />
      <main className={hideNav ? 'page page--flush' : 'page'}>
        <Outlet />
      </main>

      {!hideNav && (
        <nav className="bottom-nav" aria-label="Navigation principale">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className="bottom-nav__item">
              <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                <tab.icon />
                {tab.to === '/panier' && count > 0 && (
                  <span
                    className="badge-dot"
                    style={{ top: -6, right: -10 }}
                    aria-label={`${count} article${count > 1 ? 's' : ''}`}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </span>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
