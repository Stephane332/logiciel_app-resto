/**
 * Coquille du logiciel : barre latérale, barre supérieure, temps réel.
 *
 * C'est ici que se branche l'alerte des nouvelles commandes — sonore et visuelle — et le bandeau
 * qui prévient quand la connexion tombe.
 */
import { useCallback, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { can } from '@barabite/shared';
import {
  BurgerMark,
  IconChart,
  IconDashboard,
  IconKitchen,
  IconLogout,
  IconMenuBook,
  IconOrders,
  IconRegister,
  IconSettings,
  IconTable,
  IconUsers,
  IconWifiOff,
} from './Icons';
import { refreshOrders, useActiveOrders, useRestaurant } from '../lib/queries';
import { useRestaurantRealtime } from '../lib/realtime';
import { signOut, useSession } from '../lib/session';
import { playNewOrderChime, unlockSound } from '../lib/sound';
import type { Ability } from '@barabite/shared';

interface NavEntry {
  to: string;
  label: string;
  icon: typeof IconDashboard;
  ability: Ability;
  badge?: 'pending';
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Tableau de bord', icon: IconDashboard, ability: 'order:read:all' },
  { to: '/caisse', label: 'Caisse', icon: IconRegister, ability: 'cashier:register' },
  { to: '/commandes', label: 'Commandes', icon: IconOrders, ability: 'order:read:all', badge: 'pending' },
  { to: '/cuisine', label: 'Cuisine', icon: IconKitchen, ability: 'order:prepare' },
  { to: '/tables', label: 'Tables', icon: IconTable, ability: 'table:read' },
  { to: '/menu', label: 'Menu', icon: IconMenuBook, ability: 'menu:read' },
  { to: '/statistiques', label: 'Statistiques', icon: IconChart, ability: 'stats:read' },
  { to: '/employes', label: 'Employés', icon: IconUsers, ability: 'employee:write' },
  { to: '/parametres', label: 'Paramètres', icon: IconSettings, ability: 'settings:write' },
];

const TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/caisse': 'Caisse',
  '/commandes': 'Commandes',
  '/cuisine': 'Cuisine',
  '/tables': 'Tables',
  '/menu': 'Menu et stock',
  '/statistiques': 'Statistiques',
  '/employes': 'Employés',
  '/parametres': 'Paramètres',
};

export function Shell() {
  const user = useSession((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const restaurant = useRestaurant();
  const orders = useActiveOrders();

  const pending = (orders.data?.orders ?? []).filter((order) => order.status === 'PENDING').length;
  // Référence plutôt qu'état : on compare sans provoquer de rendu supplémentaire.
  const previousPending = useRef(pending);

  const onEvent = useCallback((event: string) => {
    refreshOrders();
    if (event === 'order:created') playNewOrderChime();
  }, []);

  const { connected } = useRestaurantRealtime(onEvent);

  // Filet de sécurité : si le temps réel a manqué l'événement, l'augmentation du compteur suffit
  // à déclencher l'alerte. Une commande qui arrive en silence est une commande oubliée.
  useEffect(() => {
    if (pending > previousPending.current) playNewOrderChime();
    previousPending.current = pending;
  }, [pending]);

  // Les navigateurs bloquent le son tant que l'utilisateur n'a pas interagi : le premier clic suffit.
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  if (!user) return null;

  const visible = NAV.filter((entry) => can(user.role, entry.ability));
  const title = TITLES[location.pathname] ?? 'Espace Restaurant';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <BurgerMark size={36} />
          <div>
            <p className="sidebar__name">{restaurant.data?.restaurant.name ?? 'Restaurant'}</p>
            <p className="faint" style={{ fontSize: 11 }}>
              Espace Restaurant
            </p>
          </div>
        </div>

        <nav style={{ display: 'contents' }}>
          {visible.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.to === '/'}
              className="nav-item"
              style={{ position: 'relative' }}
            >
              <entry.icon />
              <span>{entry.label}</span>
              {entry.badge === 'pending' && pending > 0 && (
                <span className="nav-item__badge">{pending}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer" style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
          <div className="divider" style={{ marginBottom: 'var(--space-3)' }} />
          <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user.name}</p>
          <p className="faint" style={{ marginBottom: 'var(--space-2)' }}>
            {roleLabel(user.role)}
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--sm btn--block"
            onClick={async () => {
              await signOut();
              navigate('/connexion', { replace: true });
            }}
          >
            <IconLogout />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="main">
        {!connected && (
          <div className="offline-bar" role="status">
            <IconWifiOff />
            Connexion perdue — les nouvelles commandes peuvent tarder à s'afficher
          </div>
        )}

        <header className="topbar">
          <h1 className="topbar__title">{title}</h1>
          <span style={{ flex: 1 }} />
          {restaurant.data && (
            <span className={`tag tag--${restaurant.data.state.open ? 'success' : 'danger'}`}>
              {restaurant.data.state.open ? 'Ouvert' : 'Fermé'}
            </span>
          )}
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Gérant',
  CASHIER: 'Caisse',
  KITCHEN: 'Cuisine',
  DELIVERY: 'Livreur',
  CLIENT: 'Client',
};

export const roleLabel = (role: string): string => ROLE_LABELS[role] ?? role;
