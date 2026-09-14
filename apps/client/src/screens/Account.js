import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Compte : profil, accès rapides, et ce que le cahier des charges appelle « aide et support ». */
import { Link, useNavigate } from 'react-router-dom';
import { IconBell, IconChevron, IconHeart, IconHelp, IconLogout, IconPhone, IconStar, IconUser, } from '../components/Icons';
import { Header } from '../components/ui';
import { formatBurkinaPhone } from '@barabite/shared';
import { signOut, useSession } from '../lib/session';
import { useRestaurant } from '../lib/queries';
export function Account() {
    const navigate = useNavigate();
    const user = useSession((state) => state.user);
    const restaurant = useRestaurant();
    return (_jsxs("div", { children: [_jsx(Header, { title: "Mon compte" }), _jsxs("div", { className: "container stack", children: [user ? (_jsxs("div", { className: "card row", style: { gap: 'var(--space-3)' }, children: [_jsx("div", { className: "empty-state__icon", style: { width: 52, height: 52, background: 'var(--brand-primary)', color: 'var(--on-brand)' }, children: _jsx(IconUser, { size: 24 }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: { fontWeight: 700 }, children: user.name }), _jsx("p", { className: "faint", children: formatBurkinaPhone(user.phone) })] }), _jsxs(Link, { to: "/fidelite", className: "tag tag--brand", children: [user.loyaltyPoints, " pts"] })] })) : (_jsxs("div", { className: "card stack", children: [_jsx("p", { style: { fontWeight: 700 }, children: "Pas encore de compte ?" }), _jsx("p", { className: "subtitle", children: "Cr\u00E9ez-en un pour retrouver vos commandes et cumuler des points \u00E0 chaque achat." }), _jsxs("div", { className: "row", style: { gap: 'var(--space-2)' }, children: [_jsx(Link, { to: "/compte/inscription", className: "btn btn--primary", style: { flex: 1 }, children: "S'inscrire" }), _jsx(Link, { to: "/compte/connexion", className: "btn btn--ghost", style: { flex: 1 }, children: "Se connecter" })] })] })), _jsxs("nav", { className: "card card--flush", children: [_jsx(MenuRow, { to: "/favoris", icon: _jsx(IconHeart, { size: 20 }), label: "Mes favoris" }), _jsx(MenuRow, { to: "/fidelite", icon: _jsx(IconStar, { size: 20 }), label: "Fid\u00E9lit\u00E9" }), _jsx(MenuRow, { to: "/notifications", icon: _jsx(IconBell, { size: 20 }), label: "Notifications" }), _jsx(MenuRow, { to: "/aide", icon: _jsx(IconHelp, { size: 20 }), label: "Aide", last: true })] }), restaurant.data?.restaurant.phone && (_jsxs("a", { href: `tel:${restaurant.data.restaurant.phone}`, className: "card row", children: [_jsx(IconPhone, { size: 20, className: "muted" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { fontWeight: 600 }, children: "Appeler le restaurant" }), _jsx("p", { className: "faint", children: formatBurkinaPhone(restaurant.data.restaurant.phone) })] }), _jsx(IconChevron, { className: "muted" })] })), user && (_jsxs("button", { type: "button", className: "btn btn--ghost btn--block", onClick: async () => {
                            await signOut();
                            navigate('/', { replace: true });
                        }, children: [_jsx(IconLogout, { size: 18 }), "Se d\u00E9connecter"] })), _jsxs("p", { className: "faint", style: { textAlign: 'center' }, children: [restaurant.data?.restaurant.name, " \u00B7 ", restaurant.data?.restaurant.city] })] })] }));
}
function MenuRow({ to, icon, label, last, }) {
    return (_jsxs(Link, { to: to, className: "row", style: {
            padding: 'var(--space-4)',
            borderBottom: last ? 'none' : '1px solid var(--border)',
            minHeight: 'var(--tap-target)',
        }, children: [_jsx("span", { className: "muted", children: icon }), _jsx("span", { style: { flex: 1, fontWeight: 600 }, children: label }), _jsx(IconChevron, { className: "muted" })] }));
}
//# sourceMappingURL=Account.js.map