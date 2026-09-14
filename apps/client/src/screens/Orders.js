import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Historique.
 *
 * Deux sources : les commandes du compte, et celles mémorisées localement pour les clients qui ont
 * commandé sans s'inscrire. Aucun client ne doit perdre la trace de sa commande.
 */
import { Link } from 'react-router-dom';
import { isTerminal, statusLabel } from '@barabite/shared';
import { IconChevron, IconReceipt } from '../components/Icons';
import { EmptyState, Header, Loading, Tag } from '../components/ui';
import { formatAmount, formatOrderNumber, formatRelative } from '../lib/format';
import { useMyOrders } from '../lib/queries';
import { useRecentOrders } from '../lib/recent';
import { useSession } from '../lib/session';
export function Orders() {
    const user = useSession((state) => state.user);
    const remote = useMyOrders(Boolean(user));
    const local = useRecentOrders((state) => state.orders);
    if (user && remote.isLoading)
        return _jsx(Loading, {});
    const orders = user ? (remote.data?.orders ?? []) : [];
    const showLocal = !user && local.length > 0;
    if (orders.length === 0 && !showLocal) {
        return (_jsxs("div", { children: [_jsx(Header, { title: "Mes commandes" }), _jsx(EmptyState, { icon: _jsx(IconReceipt, { size: 28 }), title: "Aucune commande", description: "Vos commandes appara\u00EEtront ici, avec leur suivi.", action: _jsx(Link, { to: "/menu", className: "btn btn--primary", children: "Voir le menu" }) })] }));
    }
    return (_jsxs("div", { children: [_jsx(Header, { title: "Mes commandes" }), _jsxs("div", { className: "container stack", children: [!user && (_jsx("div", { className: "banner banner--info", children: _jsxs("span", { children: ["Cr\u00E9ez un compte pour retrouver toutes vos commandes et cumuler des points de fid\u00E9lit\u00E9.", ' ', _jsx(Link, { to: "/compte/inscription", style: { textDecoration: 'underline' }, children: "S'inscrire" })] }) })), user
                        ? orders.map((order) => (_jsxs(Link, { to: `/commande/${order.id}`, className: "card row row--between", children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { className: "row", style: { gap: 'var(--space-2)' }, children: [_jsx("strong", { children: formatOrderNumber(order.number) }), _jsx(Tag, { variant: isTerminal(order.status) ? 'default' : 'info', children: statusLabel(order.status) })] }), _jsxs("p", { className: "faint", children: [formatRelative(order.createdAt), " \u00B7 ", order.items.length, " article", order.items.length > 1 ? 's' : ''] }), _jsx("p", { className: "price", style: { marginTop: 4 }, children: formatAmount(order.total) })] }), _jsx(IconChevron, { className: "muted" })] }, order.id)))
                        : local.map((order) => (_jsxs(Link, { to: `/commande/${order.id}`, className: "card row row--between", children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { className: "row", style: { gap: 'var(--space-2)' }, children: [_jsx("strong", { children: formatOrderNumber(order.number) }), order.pickupCode && _jsx(Tag, { variant: "brand", children: order.pickupCode })] }), _jsx("p", { className: "faint", children: formatRelative(order.createdAt) }), _jsx("p", { className: "price", style: { marginTop: 4 }, children: formatAmount(order.total) })] }), _jsx(IconChevron, { className: "muted" })] }, order.id)))] })] }));
}
//# sourceMappingURL=Orders.js.map