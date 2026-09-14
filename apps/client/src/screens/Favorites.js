import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Favoris — stockés sur l'appareil, disponibles sans compte. */
import { Link } from 'react-router-dom';
import { IconHeart } from '../components/Icons';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Header, Loading } from '../components/ui';
import { useFavorites } from '../lib/favorites';
import { useMenu } from '../lib/queries';
export function Favorites() {
    const slugs = useFavorites((state) => state.slugs);
    const menu = useMenu();
    if (menu.isLoading)
        return _jsx(Loading, {});
    const products = (menu.data?.categories ?? [])
        .flatMap((category) => category.products)
        .filter((product) => slugs.includes(product.slug));
    return (_jsxs("div", { children: [_jsx(Header, { title: "Mes favoris" }), products.length === 0 ? (_jsx(EmptyState, { icon: _jsx(IconHeart, { size: 28 }), title: "Aucun favori", description: "Touchez le c\u0153ur sur un produit pour le retrouver ici.", action: _jsx(Link, { to: "/menu", className: "btn btn--primary", children: "Parcourir le menu" }) })) : (_jsx("div", { className: "container stack", children: products.map((product) => (_jsx(ProductCard, { product: product }, product.id))) }))] }));
}
//# sourceMappingURL=Favorites.js.map