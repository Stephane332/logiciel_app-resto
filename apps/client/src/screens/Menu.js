import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Menu complet : catégories, recherche, et tous les produits. */
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconSearch } from '../components/Icons';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, ErrorState, Header, Loading } from '../components/ui';
import { useMenu } from '../lib/queries';
/** Recherche insensible aux accents : « frites » doit trouver « Frites », et « cafe » trouver « Café ». */
function normalize(value) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}
export function Menu() {
    const { categorySlug } = useParams();
    const [search, setSearch] = useState('');
    const [active, setActive] = useState(categorySlug ?? null);
    const menu = useMenu();
    const categories = menu.data?.categories ?? [];
    const results = useMemo(() => {
        const query = normalize(search.trim());
        const scope = active ? categories.filter((category) => category.slug === active) : categories;
        if (!query)
            return scope;
        return scope
            .map((category) => ({
            ...category,
            products: category.products.filter((product) => normalize(product.name).includes(query) ||
                normalize(product.description ?? '').includes(query)),
        }))
            .filter((category) => category.products.length > 0);
    }, [categories, active, search]);
    if (menu.isLoading)
        return _jsx(Loading, {});
    if (menu.isError)
        return _jsx(ErrorState, { message: "Le menu n'a pas pu \u00EAtre charg\u00E9.", onRetry: () => void menu.refetch() });
    const total = results.reduce((sum, category) => sum + category.products.length, 0);
    return (_jsxs("div", { children: [_jsx(Header, { title: "Menu" }), _jsx("div", { className: "container", style: { paddingTop: 'var(--space-3)' }, children: _jsxs("label", { className: "row input", style: { gap: 'var(--space-2)' }, children: [_jsx(IconSearch, { size: 20, className: "muted" }), _jsx("input", { type: "search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Rechercher un produit\u2026", "aria-label": "Rechercher un produit", style: { flex: 1, background: 'none', border: 'none', outline: 'none', minWidth: 0 } })] }) }), _jsxs("div", { className: "chips", role: "group", "aria-label": "Filtrer par cat\u00E9gorie", children: [_jsx("button", { type: "button", className: "chip", "aria-pressed": active === null, onClick: () => setActive(null), children: "Tous" }), categories.map((category) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": active === category.slug, onClick: () => setActive(active === category.slug ? null : category.slug), children: category.name }, category.id)))] }), _jsx("div", { className: "container stack", style: { paddingTop: 'var(--space-3)' }, children: total === 0 ? (_jsx(EmptyState, { icon: _jsx(IconSearch, { size: 28 }), title: "Aucun r\u00E9sultat", description: search ? `Rien ne correspond à « ${search} ».` : 'Cette catégorie est vide pour le moment.' })) : (results.map((category) => (_jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: category.name }), category.products.map((product) => (_jsx(ProductCard, { product: product }, product.id)))] }, category.id)))) })] }));
}
//# sourceMappingURL=Menu.js.map