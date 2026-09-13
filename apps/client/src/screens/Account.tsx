/** Compte : profil, accès rapides, et ce que le cahier des charges appelle « aide et support ». */
import { Link, useNavigate } from 'react-router-dom';
import {
  IconBell,
  IconChevron,
  IconHeart,
  IconHelp,
  IconLogout,
  IconPhone,
  IconStar,
  IconUser,
} from '../components/Icons';
import { Header } from '../components/ui';
import { formatBurkinaPhone } from '@barabite/shared';
import { signOut, useSession } from '../lib/session';
import { useRestaurant } from '../lib/queries';

export function Account() {
  const navigate = useNavigate();
  const user = useSession((state) => state.user);
  const restaurant = useRestaurant();

  return (
    <div>
      <Header title="Mon compte" />

      <div className="container stack">
        {user ? (
          <div className="card row" style={{ gap: 'var(--space-3)' }}>
            <div
              className="empty-state__icon"
              style={{ width: 52, height: 52, background: 'var(--brand-primary)', color: 'var(--on-brand)' }}
            >
              <IconUser size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700 }}>{user.name}</p>
              <p className="faint">{formatBurkinaPhone(user.phone)}</p>
            </div>
            <Link to="/fidelite" className="tag tag--brand">
              {user.loyaltyPoints} pts
            </Link>
          </div>
        ) : (
          <div className="card stack">
            <p style={{ fontWeight: 700 }}>Pas encore de compte ?</p>
            <p className="subtitle">
              Créez-en un pour retrouver vos commandes et cumuler des points à chaque achat.
            </p>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <Link to="/compte/inscription" className="btn btn--primary" style={{ flex: 1 }}>
                S'inscrire
              </Link>
              <Link to="/compte/connexion" className="btn btn--ghost" style={{ flex: 1 }}>
                Se connecter
              </Link>
            </div>
          </div>
        )}

        <nav className="card card--flush">
          <MenuRow to="/favoris" icon={<IconHeart size={20} />} label="Mes favoris" />
          <MenuRow to="/fidelite" icon={<IconStar size={20} />} label="Fidélité" />
          <MenuRow to="/notifications" icon={<IconBell size={20} />} label="Notifications" />
          <MenuRow to="/aide" icon={<IconHelp size={20} />} label="Aide" last />
        </nav>

        {restaurant.data?.restaurant.phone && (
          <a href={`tel:${restaurant.data.restaurant.phone}`} className="card row">
            <IconPhone size={20} className="muted" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600 }}>Appeler le restaurant</p>
              <p className="faint">{formatBurkinaPhone(restaurant.data.restaurant.phone)}</p>
            </div>
            <IconChevron className="muted" />
          </a>
        )}

        {user && (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={async () => {
              await signOut();
              navigate('/', { replace: true });
            }}
          >
            <IconLogout size={18} />
            Se déconnecter
          </button>
        )}

        <p className="faint" style={{ textAlign: 'center' }}>
          {restaurant.data?.restaurant.name} · {restaurant.data?.restaurant.city}
        </p>
      </div>
    </div>
  );
}

function MenuRow({
  to,
  icon,
  label,
  last,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  last?: boolean;
}) {
  return (
    <Link
      to={to}
      className="row"
      style={{
        padding: 'var(--space-4)',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        minHeight: 'var(--tap-target)',
      }}
    >
      <span className="muted">{icon}</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <IconChevron className="muted" />
    </Link>
  );
}
