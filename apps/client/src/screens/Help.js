import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Aide : les questions qu'on se pose vraiment, et de quoi joindre un humain. */
import { formatBurkinaPhone, formatMinutes, WEEKDAY_LABELS } from '@barabite/shared';
import { IconPhone } from '../components/Icons';
import { Header, Loading } from '../components/ui';
import { useRestaurant } from '../lib/queries';
const FAQ = [
    {
        question: 'Dois-je créer un compte pour commander ?',
        answer: 'Non. Votre nom et votre numéro de téléphone suffisent. Le compte sert seulement à retrouver vos commandes et à cumuler des points.',
    },
    {
        question: 'Comment fonctionne le retrait ?',
        answer: 'Vous commandez à l\'avance, vous recevez un code à cinq caractères, et vous le présentez au comptoir quand la commande est prête. Pas de file d\'attente.',
    },
    {
        question: 'Comment commander sur place ?',
        answer: 'Scannez le QR Code posé sur votre table avec l\'appareil photo de votre téléphone. La commande est automatiquement rattachée à votre table.',
    },
    {
        question: 'Puis-je annuler ma commande ?',
        answer: 'Oui, tant que le restaurant ne l\'a pas acceptée. Ensuite, appelez le restaurant : la préparation a peut-être déjà commencé.',
    },
    {
        question: 'Comment payer ?',
        answer: 'En espèces à la livraison ou au comptoir, ou par Mobile Money depuis l\'application. Les moyens disponibles s\'affichent au moment de valider.',
    },
];
export function Help() {
    const { data, isLoading } = useRestaurant();
    if (isLoading)
        return _jsx(Loading, { rows: 3 });
    return (_jsxs("div", { children: [_jsx(Header, { title: "Aide", back: true }), _jsxs("div", { className: "container stack", children: [data?.restaurant.phone && (_jsxs("a", { href: `tel:${data.restaurant.phone}`, className: "card row", children: [_jsx(IconPhone, { size: 20, style: { color: 'var(--brand-primary)' } }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { fontWeight: 700 }, children: "Appeler le restaurant" }), _jsx("p", { className: "faint", children: formatBurkinaPhone(data.restaurant.phone) })] })] })), _jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "Questions fr\u00E9quentes" }), FAQ.map((entry) => (_jsxs("details", { className: "card", children: [_jsx("summary", { style: { fontWeight: 600, cursor: 'pointer', minHeight: 32 }, children: entry.question }), _jsx("p", { className: "subtitle", style: { marginTop: 'var(--space-2)' }, children: entry.answer })] }, entry.question)))] }), (data?.openingHours.length ?? 0) > 0 && (_jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "Horaires" }), _jsx("div", { className: "card stack", style: { gap: 'var(--space-2)' }, children: data.openingHours.map((hour) => (_jsxs("div", { className: "row row--between", children: [_jsx("span", { children: WEEKDAY_LABELS[hour.weekday] }), _jsx("span", { className: hour.closed ? 'muted' : '', children: hour.closed
                                                ? 'Fermé'
                                                : `${formatMinutes(hour.opensAt)} – ${formatMinutes(hour.closesAt)}` })] }, hour.weekday))) })] })), data?.restaurant.address && (_jsx("p", { className: "faint", style: { textAlign: 'center' }, children: data.restaurant.address }))] })] }));
}
//# sourceMappingURL=Help.js.map