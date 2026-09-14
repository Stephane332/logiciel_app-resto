import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Panier : modifier, supprimer, voir le détail du total, passer à la commande. */
import { Link, useNavigate } from 'react-router-dom';
import { IconCart, IconQr, IconTrash } from '../components/Icons';
import { EmptyState, Header, ProductImage, Stepper } from '../components/ui';
import { cartTotals, itemUnitPrice, useCart } from '../lib/cart';
import { formatAmount } from '../lib/format';
import { useRestaurant } from '../lib/queries';
export function Cart() {
    const navigate = useNavigate();
    const { items, setQuantity, remove, clear, table } = useCart();
    const restaurant = useRestaurant();
    const totals = cartTotals(items);
    const open = restaurant.data?.state.open ?? true;
    if (items.length === 0) {
        return (_jsxs("div", { children: [_jsx(Header, { title: "Panier" }), _jsx(EmptyState, { icon: _jsx(IconCart, { size: 28 }), title: "Votre panier est vide", description: "Parcourez le menu et ajoutez ce qui vous fait envie.", action: _jsx(Link, { to: "/menu", className: "btn btn--primary", children: "Voir le menu" }) })] }));
    }
    return (_jsxs("div", { children: [_jsx(Header, { title: "Panier", actions: _jsx("button", { type: "button", className: "icon-button", "aria-label": "Vider le panier", onClick: () => {
                        if (window.confirm('Vider le panier ?'))
                            clear();
                    }, children: _jsx(IconTrash, {}) }) }), _jsxs("div", { className: "container stack", children: [table && (_jsxs("div", { className: "banner banner--info", children: [_jsx(IconQr, { size: 18 }), _jsxs("span", { children: ["Commande pour la ", _jsxs("strong", { children: ["table ", table.number] }), "."] })] })), !open && (_jsx("div", { className: "banner banner--warning", children: _jsx("span", { children: "Le restaurant est ferm\u00E9 pour le moment. Votre panier est conserv\u00E9 jusqu'\u00E0 la r\u00E9ouverture." }) })), items.map((item) => (_jsxs("article", { className: "card row", style: { alignItems: 'flex-start', gap: 'var(--space-3)' }, children: [_jsx("div", { className: "product-card__media", style: { width: 64, height: 64, minWidth: 64 }, children: _jsx(ProductImage, { src: item.imageUrl, alt: item.name }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { className: "row row--between", style: { alignItems: 'flex-start' }, children: [_jsx("span", { style: { fontWeight: 700 }, children: item.name }), _jsx("button", { type: "button", className: "icon-button", style: { width: 32, height: 32, minWidth: 32 }, "aria-label": `Retirer ${item.name}`, onClick: () => remove(item.key), children: _jsx(IconTrash, { size: 16 }) })] }), item.options.length > 0 && (_jsx("p", { className: "faint", children: item.options.map((option) => option.name).join(' · ') })), item.note && _jsxs("p", { className: "faint", children: ["\u00AB ", item.note, " \u00BB"] }), _jsxs("div", { className: "row row--between", style: { marginTop: 'var(--space-3)' }, children: [_jsx("span", { className: "price", children: formatAmount(itemUnitPrice(item) * item.quantity) }), _jsx(Stepper, { value: item.quantity, min: 0, onChange: (quantity) => setQuantity(item.key, quantity) })] })] })] }, item.key))), _jsxs("div", { className: "card totals", children: [_jsxs("div", { className: "totals__row", children: [_jsx("span", { children: "Sous-total" }), _jsx("span", { children: formatAmount(totals.subtotal) })] }), _jsxs("div", { className: "totals__row", children: [_jsx("span", { children: "Livraison" }), _jsx("span", { className: "muted", children: "calcul\u00E9e \u00E0 l'\u00E9tape suivante" })] }), _jsxs("div", { className: "totals__row totals__row--total", children: [_jsx("span", { children: "Total" }), _jsx("span", { children: formatAmount(totals.total) })] })] }), _jsx(Link, { to: "/menu", className: "btn btn--ghost btn--block", children: "Ajouter d'autres produits" })] }), _jsx("div", { className: "action-bar", children: _jsx("button", { type: "button", className: "btn btn--primary btn--block", disabled: !open, onClick: () => navigate('/commander'), children: open ? (_jsxs(_Fragment, { children: ["Commander", _jsx("span", { style: { opacity: 0.7 }, children: "\u00B7" }), formatAmount(totals.total)] })) : ('Restaurant fermé') }) })] }));
}
//# sourceMappingURL=Cart.js.map