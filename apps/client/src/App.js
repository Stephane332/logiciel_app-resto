import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Routage.
 *
 * Chaque écran a une URL propre et partageable : un produit envoyé dans une story TikTok ou un
 * groupe WhatsApp doit ouvrir ce produit, pas l'accueil (§ 2.3 du cahier des charges).
 */
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { useRestaurant } from './lib/queries';
import { Home } from './screens/Home';
import { Menu } from './screens/Menu';
import { Product } from './screens/Product';
import { Cart } from './screens/Cart';
// Les écrans rarement ouverts au premier lancement sont chargés à la demande : le premier
// affichage sur 3G se paie en secondes d'attente.
const Checkout = lazy(() => import('./screens/Checkout').then((m) => ({ default: m.Checkout })));
const OrderTracking = lazy(() => import('./screens/OrderTracking').then((m) => ({ default: m.OrderTracking })));
const Orders = lazy(() => import('./screens/Orders').then((m) => ({ default: m.Orders })));
const Account = lazy(() => import('./screens/Account').then((m) => ({ default: m.Account })));
const Login = lazy(() => import('./screens/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./screens/Login').then((m) => ({ default: m.Register })));
const Favorites = lazy(() => import('./screens/Favorites').then((m) => ({ default: m.Favorites })));
const Loyalty = lazy(() => import('./screens/Loyalty').then((m) => ({ default: m.Loyalty })));
const Notifications = lazy(() => import('./screens/Notifications').then((m) => ({ default: m.Notifications })));
const Help = lazy(() => import('./screens/Help').then((m) => ({ default: m.Help })));
const TableEntry = lazy(() => import('./screens/TableEntry').then((m) => ({ default: m.TableEntry })));
const NotFound = lazy(() => import('./screens/NotFound').then((m) => ({ default: m.NotFound })));
/** Remet la page en haut à chaque navigation : sans cela, on arrive au milieu de l'écran suivant. */
function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => window.scrollTo(0, 0), [pathname]);
    return null;
}
/**
 * Applique les couleurs de la marque enregistrées en base.
 * C'est ce qui rend l'identité modifiable sans redéploiement (ADR 004).
 */
function BrandTheme() {
    const { data } = useRestaurant();
    useEffect(() => {
        if (!data)
            return;
        const root = document.documentElement;
        root.style.setProperty('--brand-primary', data.restaurant.primaryColor);
        root.style.setProperty('--brand-bg', data.restaurant.backgroundColor);
        root.style.setProperty('--bg', data.restaurant.backgroundColor);
        const themeColor = document.querySelector('meta[name="theme-color"]');
        themeColor?.setAttribute('content', data.restaurant.backgroundColor);
    }, [data]);
    return null;
}
export function App() {
    return (_jsxs(_Fragment, { children: [_jsx(ScrollToTop, {}), _jsx(BrandTheme, {}), _jsx(Suspense, { fallback: _jsx(Loading, {}), children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/menu", element: _jsx(Menu, {}) }), _jsx(Route, { path: "/menu/:categorySlug", element: _jsx(Menu, {}) }), _jsx(Route, { path: "/produit/:slug", element: _jsx(Product, {}) }), _jsx(Route, { path: "/panier", element: _jsx(Cart, {}) }), _jsx(Route, { path: "/commander", element: _jsx(Checkout, {}) }), _jsx(Route, { path: "/commande/:id", element: _jsx(OrderTracking, {}) }), _jsx(Route, { path: "/commandes", element: _jsx(Orders, {}) }), _jsx(Route, { path: "/compte", element: _jsx(Account, {}) }), _jsx(Route, { path: "/compte/connexion", element: _jsx(Login, {}) }), _jsx(Route, { path: "/compte/inscription", element: _jsx(Register, {}) }), _jsx(Route, { path: "/favoris", element: _jsx(Favorites, {}) }), _jsx(Route, { path: "/fidelite", element: _jsx(Loyalty, {}) }), _jsx(Route, { path: "/notifications", element: _jsx(Notifications, {}) }), _jsx(Route, { path: "/aide", element: _jsx(Help, {}) }), _jsx(Route, { path: "/t/:token", element: _jsx(TableEntry, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }) }) })] }));
}
//# sourceMappingURL=App.js.map