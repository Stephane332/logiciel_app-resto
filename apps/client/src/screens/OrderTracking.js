import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Suivi de commande.
 *
 * L'écran que le client regarde le plus, et souvent le seul qu'il montre au personnel. Le numéro, le
 * code de retrait et l'étape en cours doivent se lire d'un coup d'œil, à bout de bras.
 */
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { isTerminal, statusLabel, trackingSteps } from '@barabite/shared';
import { IconBag, IconBike, IconCheck, IconClock, IconQr } from '../components/Icons';
import { ErrorState, Header, Loading, Tag } from '../components/ui';
import { api } from '../lib/api';
import { formatAmount, formatOrderNumber, formatRelative } from '../lib/format';
import { queryClient, useOrder, useRestaurant } from '../lib/queries';
import { useOrderRealtime } from '../lib/realtime';
export function OrderTracking() {
    const { id } = useParams();
    const { data, isLoading, isError, refetch } = useOrder(id);
    const restaurant = useRestaurant();
    const refresh = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: ['order', id] });
    }, [id]);
    useOrderRealtime(id, refresh);
    const cancel = useMutation({
        mutationFn: () => api.cancelOrder(id, 'Annulée depuis l\'application'),
        onSuccess: refresh,
    });
    const pay = useMutation({
        mutationFn: () => api.simulatePayment(id),
        onSuccess: refresh,
    });
    if (isLoading)
        return _jsx(Loading, { rows: 3 });
    if (isError || !data) {
        return _jsx(ErrorState, { message: "Cette commande est introuvable.", onRetry: () => void refetch() });
    }
    const order = data.order;
    const steps = trackingSteps(order.type);
    const currentIndex = steps.indexOf(order.status);
    const finished = isTerminal(order.status);
    const cancellable = order.status === 'PENDING';
    const payable = order.payment?.status !== 'CONFIRMED' && order.payment?.method !== 'CASH' && !finished;
    return (_jsxs("div", { children: [_jsx(Header, { title: `Commande ${formatOrderNumber(order.number)}`, back: true }), _jsxs("div", { className: "container stack", children: [order.pickupCode && !finished && (_jsxs("div", { className: "card", style: { textAlign: 'center', background: 'var(--surface-2)', borderColor: 'var(--brand-primary)' }, children: [_jsx("p", { className: "faint", children: "Votre code de retrait" }), _jsx("p", { style: {
                                    fontSize: 'var(--text-3xl)',
                                    fontWeight: 800,
                                    letterSpacing: '0.18em',
                                    color: 'var(--brand-primary)',
                                    marginTop: 4,
                                }, children: order.pickupCode }), _jsx("p", { className: "faint", style: { marginTop: 4 }, children: "\u00C0 pr\u00E9senter au comptoir" })] })), _jsxs("div", { className: "card stack", style: { gap: 'var(--space-3)' }, children: [_jsxs("div", { className: "row row--between", children: [_jsxs("div", { className: "row", style: { gap: 'var(--space-2)' }, children: [order.type === 'DELIVERY' && _jsx(IconBike, { size: 18, className: "muted" }), order.type === 'PICKUP' && _jsx(IconBag, { size: 18, className: "muted" }), order.type === 'DINE_IN' && _jsx(IconQr, { size: 18, className: "muted" }), _jsxs("span", { style: { fontWeight: 700 }, children: [order.type === 'DELIVERY' ? 'Livraison' : order.type === 'PICKUP' ? 'Retrait' : 'Sur place', order.table ? ` · Table ${order.table.number}` : ''] })] }), _jsx(Tag, { variant: statusVariant(order.status), children: statusLabel(order.status) })] }), _jsxs("p", { className: "faint", children: [_jsx(IconClock, { size: 14, style: { display: 'inline', verticalAlign: -2 } }), ' ', "Commande pass\u00E9e ", formatRelative(order.createdAt), restaurant.data && !finished
                                        ? ` · prête en ${restaurant.data.restaurant.preparationMinutes} min environ`
                                        : ''] }), finished ? (_jsx("div", { className: `banner banner--${order.status === 'REJECTED' || order.status === 'CANCELLED' ? 'danger' : 'info'}`, children: _jsx("span", { children: order.status === 'REJECTED'
                                        ? "Le restaurant n'a pas pu accepter cette commande. Il vous contactera."
                                        : order.status === 'CANCELLED'
                                            ? 'Cette commande a été annulée.'
                                            : 'Cette commande est terminée. Merci, et à bientôt !' }) })) : (_jsx("div", { className: "timeline", children: steps.map((step, index) => {
                                    const done = currentIndex > index;
                                    const current = currentIndex === index;
                                    return (_jsxs("div", { className: `timeline__step${done ? ' timeline__step--done' : ''}${current ? ' timeline__step--current' : ''}`, children: [_jsxs("div", { className: "timeline__rail", children: [_jsx("span", { className: "timeline__dot", children: done && _jsx(IconCheck, { size: 12 }) }), index < steps.length - 1 && _jsx("span", { className: "timeline__line" })] }), _jsxs("div", { className: "timeline__body", children: [_jsx("p", { className: "timeline__label", style: { color: done || current ? 'var(--text)' : 'var(--text-faint)' }, children: statusLabel(step) }), current && _jsx("p", { className: "faint", children: "En cours\u2026" })] })] }, step));
                                }) }))] }), _jsxs("section", { className: "card stack", style: { gap: 'var(--space-2)' }, children: [_jsx("h2", { className: "section-title", children: "D\u00E9tail" }), order.items.map((item) => (_jsxs("div", { className: "row row--between", style: { alignItems: 'flex-start' }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("span", { children: [_jsxs("strong", { children: [item.quantity, "\u00D7"] }), " ", item.productName] }), item.options.length > 0 && (_jsx("p", { className: "faint", children: item.options.map((option) => option.name).join(' · ') }))] }), _jsx("span", { className: "price", children: formatAmount(item.lineTotal) })] }, item.id))), _jsx("div", { className: "divider", style: { marginBlock: 'var(--space-2)' } }), _jsxs("div", { className: "totals", children: [_jsxs("div", { className: "totals__row", children: [_jsx("span", { children: "Sous-total" }), _jsx("span", { children: formatAmount(order.subtotal) })] }), order.deliveryFee > 0 && (_jsxs("div", { className: "totals__row", children: [_jsx("span", { children: "Livraison" }), _jsx("span", { children: formatAmount(order.deliveryFee) })] })), order.discount > 0 && (_jsxs("div", { className: "totals__row totals__row--discount", children: [_jsx("span", { children: "Remise" }), _jsxs("span", { children: ["\u2212", formatAmount(order.discount)] })] })), order.loyaltyDiscount > 0 && (_jsxs("div", { className: "totals__row totals__row--discount", children: [_jsx("span", { children: "Fid\u00E9lit\u00E9" }), _jsxs("span", { children: ["\u2212", formatAmount(order.loyaltyDiscount)] })] })), _jsxs("div", { className: "totals__row totals__row--total", children: [_jsx("span", { children: "Total" }), _jsx("span", { children: formatAmount(order.total) })] })] }), order.delivery && (_jsxs("p", { className: "faint", style: { marginTop: 'var(--space-2)' }, children: ["Livraison \u00B7 ", order.delivery.sector, " \u2014 ", order.delivery.landmark] }))] }), payable && (_jsx("button", { type: "button", className: "btn btn--primary btn--block", disabled: pay.isPending, onClick: () => pay.mutate(), children: pay.isPending ? 'Paiement en cours…' : 'Payer maintenant' })), cancellable && (_jsx("button", { type: "button", className: "btn btn--danger btn--block", disabled: cancel.isPending, onClick: () => {
                            if (window.confirm('Annuler cette commande ?'))
                                cancel.mutate();
                        }, children: "Annuler la commande" })), restaurant.data?.restaurant.phone && (_jsx("a", { href: `tel:${restaurant.data.restaurant.phone}`, className: "btn btn--ghost btn--block", children: "Appeler le restaurant" })), _jsx(Link, { to: "/menu", className: "btn btn--secondary btn--block", children: "Commander autre chose" })] })] }));
}
function statusVariant(status) {
    if (status === 'REJECTED' || status === 'CANCELLED' || status === 'PAYMENT_FAILED' || status === 'EXPIRED') {
        return 'danger';
    }
    if (status === 'COMPLETED' || status === 'DELIVERED' || status === 'PICKED_UP' || status === 'SERVED') {
        return 'success';
    }
    if (status === 'READY')
        return 'brand';
    return 'info';
}
//# sourceMappingURL=OrderTracking.js.map