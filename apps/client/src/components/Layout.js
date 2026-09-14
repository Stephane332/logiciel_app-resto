import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export function Layout() {
    const location = useLocation();
    const items = useCart((state) => state.items);
    const count = cartItemCount(items);
    const hideNav = FULLSCREEN.some((path) => location.pathname.startsWith(path));
    return (_jsxs("div", { className: "app", children: [_jsx(OfflineBanner, {}), _jsx("main", { className: hideNav ? 'page page--flush' : 'page', children: _jsx(Outlet, {}) }), !hideNav && (_jsx("nav", { className: "bottom-nav", "aria-label": "Navigation principale", children: TABS.map((tab) => (_jsxs(NavLink, { to: tab.to, end: tab.end, className: "bottom-nav__item", children: [_jsxs("span", { style: { position: 'relative', display: 'grid', placeItems: 'center' }, children: [_jsx(tab.icon, {}), tab.to === '/panier' && count > 0 && (_jsx("span", { className: "badge-dot", style: { top: -6, right: -10 }, "aria-label": `${count} article${count > 1 ? 's' : ''}`, children: count > 9 ? '9+' : count }))] }), tab.label] }, tab.to))) }))] }));
}
//# sourceMappingURL=Layout.js.map