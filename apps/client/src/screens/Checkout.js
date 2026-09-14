import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Commande : mode de réception, coordonnées, adresse, paiement.
 *
 * Deux partis pris de terrain :
 *   — commander n'exige pas de compte : un nom et un téléphone suffisent (§ 2.2) ;
 *   — l'adresse se saisit par secteur et point de repère, parce que c'est ainsi qu'on se repère à
 *     Ouahigouya, et non par numéro de rue (§ 10).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { isValidBurkinaPhone } from '@barabite/shared';
import { IconBag, IconBike, IconCheck, IconQr } from '../components/Icons';
import { Header, Tag } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { cartTotals, useCart } from '../lib/cart';
import { formatAmount } from '../lib/format';
import { useAddresses, useRestaurant } from '../lib/queries';
import { useSession } from '../lib/session';
import { useRecentOrders } from '../lib/recent';
const PAYMENT_LABELS = {
    CASH: 'Espèces',
    ORANGE_MONEY: 'Orange Money',
    MOOV_MONEY: 'Moov Money',
    MTN_MONEY: 'MTN Mobile Money',
    CARD: 'Carte bancaire',
};
export function Checkout() {
    const navigate = useNavigate();
    const { items, mode, setMode, table, clear } = useCart();
    const user = useSession((state) => state.user);
    const restaurant = useRestaurant();
    const addresses = useAddresses(Boolean(user));
    const rememberOrder = useRecentOrders((state) => state.remember);
    /**
     * Marque une commande déjà partie.
     * Sans ce drapeau, vider le panier après l'envoi déclencherait le garde-fou « panier vide » et
     * renverrait le client au panier au lieu du suivi de sa commande — elle existerait sans qu'il la
     * voie jamais.
     */
    const orderPlaced = useRef(false);
    const [name, setName] = useState(user?.name ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [zoneId, setZoneId] = useState('');
    const [sector, setSector] = useState('');
    const [landmark, setLandmark] = useState('');
    const [details, setDetails] = useState('');
    const [addressId, setAddressId] = useState('');
    const [payment, setPayment] = useState('CASH');
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState({});
    const info = restaurant.data;
    const zones = info?.deliveryZones ?? [];
    const modes = info?.restaurant.modes;
    // Une table scannée impose le mode « sur place » : le client est physiquement assis.
    useEffect(() => {
        if (table)
            setMode('DINE_IN');
        else if (!mode && modes) {
            setMode(modes.delivery ? 'DELIVERY' : modes.pickup ? 'PICKUP' : 'DINE_IN');
        }
    }, [table, mode, modes, setMode]);
    useEffect(() => {
        if (items.length === 0 && !orderPlaced.current)
            navigate('/panier', { replace: true });
    }, [items.length, navigate]);
    const selectedZone = zones.find((zone) => zone.id === zoneId);
    const deliveryFee = mode === 'DELIVERY' ? (selectedZone?.fee ?? 0) : 0;
    const totals = cartTotals(items, { deliveryFee });
    const goodsTotal = totals.subtotal;
    const belowMinimum = mode === 'DELIVERY' && selectedZone ? goodsTotal < selectedZone.minimumOrder : false;
    const submit = useMutation({
        mutationFn: async () => {
            const payload = {
                type: mode,
                channel: table ? 'QR_TABLE' : 'APP',
                paymentMethod: payment,
                expectedTotal: totals.total,
                lines: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    optionItemIds: item.options.map((option) => option.id),
                    ...(item.note ? { note: item.note } : {}),
                })),
                ...(note.trim() ? { note: note.trim() } : {}),
                ...(user ? {} : { customerName: name.trim(), customerPhone: phone.trim() }),
                ...(table ? { tableToken: table.token } : {}),
            };
            if (mode === 'DELIVERY') {
                payload.deliveryZoneId = zoneId;
                if (addressId)
                    payload.addressId = addressId;
                else
                    payload.address = {
                        sector: selectedZone?.name ?? sector,
                        landmark: landmark.trim(),
                        ...(details.trim() ? { details: details.trim() } : {}),
                    };
            }
            return api.createOrder(payload);
        },
        onSuccess: ({ order }) => {
            orderPlaced.current = true;
            // Mémorisée localement : sans compte, c'est le seul moyen de retrouver sa commande après
            // avoir fermé l'application.
            rememberOrder({
                id: order.id,
                number: order.number,
                total: order.total,
                createdAt: order.createdAt,
                type: order.type,
                pickupCode: order.pickupCode,
            });
            clear();
            navigate(`/commande/${order.id}`, { replace: true });
        },
    });
    function validate() {
        const found = {};
        if (!user) {
            if (name.trim().length < 2)
                found.name = 'Indiquez votre nom.';
            if (!isValidBurkinaPhone(phone))
                found.phone = 'Numéro burkinabè invalide (8 chiffres).';
        }
        if (mode === 'DELIVERY') {
            if (!addressId) {
                if (!zoneId)
                    found.zone = 'Choisissez votre secteur.';
                if (landmark.trim().length < 3)
                    found.landmark = 'Indiquez un point de repère.';
            }
            if (belowMinimum) {
                found.minimum = `Cette zone demande au moins ${formatAmount(selectedZone.minimumOrder)} de commande.`;
            }
        }
        setErrors(found);
        return Object.keys(found).length === 0;
    }
    const error = submit.error instanceof ApiError ? submit.error : null;
    if (items.length === 0)
        return null;
    return (_jsxs("div", { children: [_jsx(Header, { title: "Votre commande", back: true }), _jsxs("div", { className: "container stack", children: [_jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "Comment souhaitez-vous recevoir ?" }), table ? (_jsxs("div", { className: "mode-card", "aria-pressed": "true", children: [_jsx(IconQr, { size: 20 }), _jsxs("span", { className: "mode-card__title", children: ["Sur place \u2014 table ", table.number] }), _jsx("span", { className: "faint", children: "Service \u00E0 votre table" })] })) : (_jsxs("div", { className: "stack", style: { gap: 'var(--space-2)' }, children: [modes?.delivery && (_jsx(ModeOption, { icon: _jsx(IconBike, { size: 20 }), title: "Livraison", hint: "Livr\u00E9 \u00E0 l'adresse indiqu\u00E9e", active: mode === 'DELIVERY', onSelect: () => setMode('DELIVERY') })), modes?.pickup && (_jsx(ModeOption, { icon: _jsx(IconBag, { size: 20 }), title: "Commander & r\u00E9cup\u00E9rer", hint: `Prêt en ${info?.restaurant.preparationMinutes ?? 20} min environ`, active: mode === 'PICKUP', onSelect: () => setMode('PICKUP') })), modes?.dineIn && (_jsx(ModeOption, { icon: _jsx(IconQr, { size: 20 }), title: "Sur place", hint: "Scannez le QR Code de votre table", active: mode === 'DINE_IN', onSelect: () => setMode('DINE_IN') }))] }))] }), !user && (_jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "Vos coordonn\u00E9es" }), _jsx("p", { className: "faint", style: { marginTop: -8 }, children: "Pas besoin de cr\u00E9er un compte : votre nom et votre num\u00E9ro suffisent." }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "name", children: "Nom" }), _jsx("input", { id: "name", className: `input${errors.name ? ' input--error' : ''}`, value: name, onChange: (event) => setName(event.target.value), autoComplete: "name", placeholder: "Votre nom" }), errors.name && _jsx("span", { className: "field__error", children: errors.name })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "phone", children: "T\u00E9l\u00E9phone" }), _jsx("input", { id: "phone", className: `input${errors.phone ? ' input--error' : ''}`, value: phone, onChange: (event) => setPhone(event.target.value), inputMode: "tel", autoComplete: "tel", placeholder: "70 12 34 56" }), errors.phone ? (_jsx("span", { className: "field__error", children: errors.phone })) : (_jsx("span", { className: "field__hint", children: "Le restaurant vous appellera si n\u00E9cessaire." }))] })] })), mode === 'DELIVERY' && (_jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "O\u00F9 livrer ?" }), (addresses.data?.addresses.length ?? 0) > 0 && (_jsxs("div", { className: "stack", style: { gap: 'var(--space-2)' }, children: [addresses.data.addresses.map((address) => (_jsxs("button", { type: "button", className: "option-row", "aria-pressed": addressId === address.id, onClick: () => setAddressId(addressId === address.id ? '' : address.id), children: [_jsx("span", { className: "option-row__mark", children: addressId === address.id && _jsx(IconCheck, { size: 14 }) }), _jsxs("span", { style: { flex: 1 }, children: [_jsx("strong", { children: address.label ?? address.sector }), _jsx("br", {}), _jsx("span", { className: "faint", children: address.landmark })] })] }, address.id))), _jsx("div", { className: "divider", style: { margin: 0 } })] })), !addressId && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "zone", children: "Secteur" }), _jsxs("select", { id: "zone", className: `input${errors.zone ? ' input--error' : ''}`, value: zoneId, onChange: (event) => {
                                                    setZoneId(event.target.value);
                                                    const zone = zones.find((item) => item.id === event.target.value);
                                                    if (zone)
                                                        setSector(zone.name);
                                                }, children: [_jsx("option", { value: "", children: "Choisissez votre secteur\u2026" }), zones.map((zone) => (_jsxs("option", { value: zone.id, children: [zone.name, " \u2014 ", formatAmount(zone.fee), " \u00B7 ", zone.estimatedMinutes, " min"] }, zone.id)))] }), errors.zone && _jsx("span", { className: "field__error", children: errors.zone })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "landmark", children: "Point de rep\u00E8re" }), _jsx("input", { id: "landmark", className: `input${errors.landmark ? ' input--error' : ''}`, value: landmark, onChange: (event) => setLandmark(event.target.value), placeholder: "Face \u00E0 la pharmacie, pr\u00E8s du ch\u00E2teau d'eau\u2026" }), errors.landmark ? (_jsx("span", { className: "field__error", children: errors.landmark })) : (_jsx("span", { className: "field__hint", children: "C'est ce qui permet au livreur de vous trouver." }))] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "details", children: "Pr\u00E9cisions (facultatif)" }), _jsx("input", { id: "details", className: "input", value: details, onChange: (event) => setDetails(event.target.value), placeholder: "Portail vert, 2\u1D49 maison \u00E0 droite\u2026" })] })] })), errors.minimum && _jsx("p", { className: "field__error", children: errors.minimum })] })), _jsxs("section", { className: "stack", style: { gap: 'var(--space-3)' }, children: [_jsx("h2", { className: "section-title", children: "Paiement" }), _jsx("div", { className: "stack", style: { gap: 'var(--space-2)' }, children: availablePayments(mode, info).map((method) => (_jsxs("button", { type: "button", className: "option-row", "aria-pressed": payment === method, onClick: () => setPayment(method), children: [_jsx("span", { className: "option-row__mark", children: payment === method && _jsx(IconCheck, { size: 14 }) }), _jsx("span", { style: { flex: 1 }, children: PAYMENT_LABELS[method] }), method === 'CASH' && (_jsx(Tag, { children: mode === 'DELIVERY' ? 'à la livraison' : 'au comptoir' }))] }, method))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "order-note", children: "Un message pour le restaurant ?" }), _jsx("textarea", { id: "order-note", className: "input", value: note, onChange: (event) => setNote(event.target.value), maxLength: 300, placeholder: "Appelez-moi en arrivant\u2026" })] }), _jsxs("div", { className: "card totals", children: [_jsxs("div", { className: "totals__row", children: [_jsxs("span", { children: ["Sous-total \u00B7 ", totals.itemCount, " article", totals.itemCount > 1 ? 's' : ''] }), _jsx("span", { children: formatAmount(totals.subtotal) })] }), mode === 'DELIVERY' && (_jsxs("div", { className: "totals__row", children: [_jsxs("span", { children: ["Livraison", selectedZone ? ` · ${selectedZone.name}` : ''] }), _jsx("span", { children: selectedZone ? formatAmount(deliveryFee) : '—' })] })), _jsxs("div", { className: "totals__row totals__row--total", children: [_jsx("span", { children: "Total" }), _jsx("span", { children: formatAmount(totals.total) })] })] }), error && (_jsx("div", { className: "banner banner--danger", role: "alert", children: _jsx("span", { children: error.message }) }))] }), _jsx("div", { className: "action-bar", children: _jsx("button", { type: "button", className: "btn btn--primary btn--block", disabled: submit.isPending || belowMinimum, onClick: () => {
                        if (validate())
                            submit.mutate();
                    }, children: submit.isPending ? 'Envoi en cours…' : `Valider · ${formatAmount(totals.total)}` }) })] }));
}
/** Les moyens proposés dépendent du mode et de la politique du restaurant (§ 9.2). */
function availablePayments(mode, info) {
    const policy = info?.restaurant.payment;
    const methods = [];
    const cashAllowed = mode === 'DELIVERY'
        ? policy?.cashOnDelivery
        : mode === 'PICKUP'
            ? policy?.cashOnPickup
            : policy?.cashOnDineIn;
    if (cashAllowed !== false)
        methods.push('CASH');
    if (policy?.online !== false)
        methods.push('ORANGE_MONEY', 'MOOV_MONEY');
    return methods.length > 0 ? methods : ['CASH'];
}
function ModeOption({ icon, title, hint, active, onSelect, }) {
    return (_jsxs("button", { type: "button", className: "mode-card", "aria-pressed": active, onClick: onSelect, children: [_jsx("span", { style: { color: active ? 'var(--brand-primary)' : 'var(--text-muted)' }, children: icon }), _jsx("span", { className: "mode-card__title", children: title }), _jsx("span", { className: "faint", children: hint })] }));
}
//# sourceMappingURL=Checkout.js.map