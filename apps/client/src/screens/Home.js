import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Accueil.
 *
 * Doit répondre en trois secondes à trois questions : où suis-je, est-ce ouvert, qu'est-ce que je
 * mange. Tout le reste vient après.
 */
import { Link } from 'react-router-dom';
import { formatMinutes, WEEKDAY_LABELS } from '@barabite/shared';
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
    if (restaurant.isLoading || menu.isLoading)
        return _jsx(Loading, { rows: 3 });
    if (restaurant.isError || menu.isError) {
        return (_jsx(ErrorState, { message: "V\u00E9rifiez votre connexion, puis r\u00E9essayez.", onRetry: () => {
                void restaurant.refetch();
                void menu.refetch();
            } }));
    }
    const info = restaurant.data;
    const categories = menu.data?.categories ?? [];
    const featured = categories.flatMap((category) => category.products).filter((p) => p.isFeatured);
    const popular = categories.flatMap((category) => category.products).slice(0, 6);
    const open = info.state.open;
    return (_jsxs("div", { children: [_jsxs("header", { className: "header", style: { borderBottom: 'none' }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { className: "faint", style: { lineHeight: 1.2 }, children: user ? `Bonjour ${user.name.split(' ')[0]}` : 'Bienvenue chez' }), _jsx("p", { style: { fontWeight: 800, fontSize: 'var(--text-lg)' }, children: info.restaurant.name })] }), _jsx(Link, { to: "/notifications", className: "icon-button", "aria-label": "Notifications", children: _jsx(IconBell, { size: 20 }) })] }), _jsxs("div", { className: "container stack", children: [_jsxs("div", { className: "row", style: { gap: 'var(--space-2)', flexWrap: 'wrap' }, children: [open ? (_jsxs(Tag, { variant: "success", children: [_jsx(IconClock, { size: 14 }), " Ouvert jusqu'\u00E0 ", formatMinutes(info.state.closesAt)] })) : (_jsxs(Tag, { variant: "danger", children: [_jsx(IconClock, { size: 14 }), info.state.reason === 'MANUALLY_CLOSED'
                                        ? 'Fermé pour le moment'
                                        : info.state.nextOpening
                                            ? `Fermé — ouvre ${WEEKDAY_LABELS[info.state.nextOpening.weekday]?.toLowerCase()} à ${formatMinutes(info.state.nextOpening.opensAt)}`
                                            : 'Fermé'] })), info.restaurant.city && _jsx(Tag, { children: info.restaurant.city })] }), table && (_jsxs("div", { className: "banner banner--info", children: [_jsx(IconQr, { size: 18 }), _jsxs("span", { children: ["Vous commandez \u00E0 la ", _jsxs("strong", { children: ["table ", table.number] }), "."] })] })), _jsxs(Link, { to: "/menu", className: "input row", style: { color: 'var(--text-faint)' }, children: [_jsx(IconSearch, { size: 20 }), "Rechercher un produit\u2026"] }), _jsxs("div", { className: "mode-badges", children: [info.restaurant.modes.delivery && _jsx(ModeBadge, { icon: _jsx(IconBike, { size: 20 }), label: "Livraison" }), info.restaurant.modes.pickup && _jsx(ModeBadge, { icon: _jsx(IconBag, { size: 20 }), label: "Retrait" }), info.restaurant.modes.dineIn && _jsx(ModeBadge, { icon: _jsx(IconQr, { size: 20 }), label: "Sur place" })] }), featured.length > 0 && (_jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("div", { className: "row row--between", children: _jsx("h2", { className: "section-title", children: "Menu du moment" }) }), _jsx("div", { className: "scroller", children: featured.map((product) => (_jsx(ProductCardCompact, { product: product }, product.id))) })] })), _jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsxs("div", { className: "row row--between", children: [_jsx("h2", { className: "section-title", children: "Nos cat\u00E9gories" }), _jsx(Link, { to: "/menu", className: "faint", children: "Tout voir" })] }), _jsx("div", { className: "scroller", style: { gap: 'var(--space-2)' }, children: categories.map((category) => (_jsx(Link, { to: `/menu/${category.slug}`, className: "chip", style: { flex: '0 0 auto' }, children: category.name }, category.id))) })] }), _jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "Nos meilleurs produits" }), _jsx("div", { className: "stack", style: { gap: 'var(--space-3)' }, children: popular.map((product) => (_jsx(ProductCard, { product: product }, product.id))) })] })] })] }));
}
function ModeBadge({ icon, label }) {
    return (_jsxs("div", { className: "mode-badge", children: [_jsx("span", { className: "mode-badge__icon", children: icon }), _jsx("span", { className: "mode-badge__label", children: label })] }));
}
//# sourceMappingURL=Home.js.map