import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Fidélité.
 *
 * Remontée de la V2 à la V1 : dans une ville de cette taille, le chiffre d'affaires vient des
 * habitués (§ 2.4).
 */
import { Link } from 'react-router-dom';
import { IconStar } from '../components/Icons';
import { EmptyState, Header, Loading } from '../components/ui';
import { formatAmount, formatRelative } from '../lib/format';
import { useLoyalty, useRestaurant } from '../lib/queries';
import { useSession } from '../lib/session';
export function Loyalty() {
    const user = useSession((state) => state.user);
    const loyalty = useLoyalty(Boolean(user));
    const restaurant = useRestaurant();
    const config = restaurant.data?.restaurant.loyalty;
    if (!user) {
        return (_jsxs("div", { children: [_jsx(Header, { title: "Fid\u00E9lit\u00E9", back: true }), _jsx(EmptyState, { icon: _jsx(IconStar, { size: 28 }), title: "Cumulez des points", description: config
                        ? `Un point par tranche de ${formatAmount(config.amountPerPoint)} dépensée, convertible en remise.`
                        : 'Créez un compte pour profiter du programme de fidélité.', action: _jsx(Link, { to: "/compte/inscription", className: "btn btn--primary", children: "Cr\u00E9er un compte" }) })] }));
    }
    if (loyalty.isLoading)
        return _jsx(Loading, { rows: 2 });
    const balance = loyalty.data?.balance ?? 0;
    const transactions = loyalty.data?.transactions ?? [];
    const threshold = config?.minimumPoints ?? 0;
    const progress = threshold > 0 ? Math.min(100, Math.round((balance / threshold) * 100)) : 100;
    return (_jsxs("div", { children: [_jsx(Header, { title: "Fid\u00E9lit\u00E9", back: true }), _jsxs("div", { className: "container stack", children: [_jsxs("div", { className: "card", style: { textAlign: 'center' }, children: [_jsx("p", { className: "faint", children: "Votre solde" }), _jsx("p", { style: { fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--brand-primary)' }, children: balance }), _jsxs("p", { className: "faint", children: ["point", balance > 1 ? 's' : ''] }), threshold > 0 && balance < threshold && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                            height: 8,
                                            borderRadius: 'var(--radius-full)',
                                            background: 'var(--surface-3)',
                                            marginTop: 'var(--space-4)',
                                            overflow: 'hidden',
                                        }, role: "progressbar", "aria-valuenow": progress, "aria-valuemin": 0, "aria-valuemax": 100, children: _jsx("div", { style: { width: `${progress}%`, height: '100%', background: 'var(--brand-primary)' } }) }), _jsxs("p", { className: "faint", style: { marginTop: 'var(--space-2)' }, children: ["Encore ", threshold - balance, " points avant de pouvoir les utiliser."] })] })), threshold > 0 && balance >= threshold && (_jsx("p", { className: "tag tag--success", style: { marginTop: 'var(--space-3)' }, children: "Utilisables d\u00E8s votre prochaine commande" }))] }), config && (_jsx("div", { className: "banner", children: _jsxs("span", { children: ["Vous gagnez 1 point par tranche de ", formatAmount(config.amountPerPoint), ". Un point vaut", ' ', formatAmount(config.pointValue), " de remise, dans la limite de ", config.maxRedemptionPct, " % de la commande."] }) })), _jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "Historique" }), transactions.length === 0 ? (_jsx("p", { className: "subtitle", children: "Vos points appara\u00EEtront ici apr\u00E8s votre premi\u00E8re commande." })) : (transactions.map((transaction) => (_jsxs("div", { className: "card row row--between", children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: { fontWeight: 600 }, children: transaction.reason }), _jsx("p", { className: "faint", children: formatRelative(transaction.createdAt) })] }), _jsxs("span", { style: {
                                            fontWeight: 800,
                                            color: transaction.points > 0 ? 'var(--success)' : 'var(--text-muted)',
                                        }, children: [transaction.points > 0 ? '+' : '', transaction.points] })] }, transaction.id))))] })] })] }));
}
//# sourceMappingURL=Loyalty.js.map