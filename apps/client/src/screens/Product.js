import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Détail produit et personnalisation.
 *
 * Les règles de choix — « une sauce obligatoire », « trois suppléments maximum » — sont celles que le
 * restaurant a définies. L'interface les applique pour guider ; le serveur les revérifie, car seule
 * sa parole compte.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconCheck, IconHeart, IconShare } from '../components/Icons';
import { ErrorState, Header, Loading, ProductImage, Stepper, Tag } from '../components/ui';
import { useProduct } from '../lib/queries';
import { useCart } from '../lib/cart';
import { useFavorites } from '../lib/favorites';
import { formatAmount } from '../lib/format';
export function Product() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, isError, refetch } = useProduct(slug);
    const add = useCart((state) => state.add);
    const favorites = useFavorites();
    const [selected, setSelected] = useState({});
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState('');
    const [showErrors, setShowErrors] = useState(false);
    const product = data?.product;
    const chosenOptions = useMemo(() => {
        if (!product)
            return [];
        return product.optionGroups.flatMap((group) => group.items.filter((item) => selected[group.id]?.includes(item.id)));
    }, [product, selected]);
    const unitPrice = (product?.price ?? 0) + chosenOptions.reduce((sum, option) => sum + option.priceDelta, 0);
    const missingGroups = useMemo(() => {
        if (!product)
            return [];
        return product.optionGroups.filter((group) => (selected[group.id]?.length ?? 0) < group.minChoices);
    }, [product, selected]);
    if (isLoading)
        return _jsx(Loading, { rows: 2 });
    if (isError || !product) {
        return _jsx(ErrorState, { message: "Ce produit est introuvable.", onRetry: () => void refetch() });
    }
    const orderable = product.isOrderable !== false && product.isAvailable;
    function toggle(groupId, itemId, maxChoices) {
        setSelected((current) => {
            const existing = current[groupId] ?? [];
            if (existing.includes(itemId)) {
                return { ...current, [groupId]: existing.filter((id) => id !== itemId) };
            }
            // Un groupe à choix unique remplace au lieu d'ajouter : c'est le comportement attendu d'un
            // bouton radio, et cela évite un message d'erreur inutile.
            if (maxChoices === 1) {
                return { ...current, [groupId]: [itemId] };
            }
            if (existing.length >= maxChoices)
                return current;
            return { ...current, [groupId]: [...existing, itemId] };
        });
    }
    function addToCart() {
        if (missingGroups.length > 0) {
            setShowErrors(true);
            document.getElementById(`group-${missingGroups[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        add(product, chosenOptions.map((option) => ({
            id: option.id,
            name: option.name,
            priceDelta: option.priceDelta,
        })), quantity, note.trim() || undefined);
        navigate('/panier');
    }
    async function share() {
        const url = window.location.href;
        const payload = { title: product.name, text: `${product.name} — ${formatAmount(product.price)}`, url };
        try {
            if (navigator.share)
                await navigator.share(payload);
            else
                await navigator.clipboard.writeText(url);
        }
        catch {
            // Partage annulé par l'utilisateur : rien à signaler.
        }
    }
    return (_jsxs("div", { children: [_jsx(Header, { title: product.name, back: true, actions: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "icon-button", "aria-label": favorites.has(product.slug) ? 'Retirer des favoris' : 'Ajouter aux favoris', "aria-pressed": favorites.has(product.slug), onClick: () => favorites.toggle(product.slug), children: _jsx(IconHeart, { filled: favorites.has(product.slug), className: favorites.has(product.slug) ? 'price' : undefined }) }), _jsx("button", { type: "button", className: "icon-button", "aria-label": "Partager", onClick: () => void share(), children: _jsx(IconShare, {}) })] }) }), _jsx("div", { className: "product-hero", children: _jsx(ProductImage, { src: product.imageUrl, alt: product.name }) }), _jsxs("div", { className: "container stack", style: { paddingTop: 'var(--space-4)' }, children: [_jsxs("div", { children: [_jsxs("div", { className: "row row--between", children: [_jsx("h2", { className: "title", children: product.name }), _jsx("span", { className: "price", style: { fontSize: 'var(--text-xl)' }, children: formatAmount(product.price) })] }), product.description && (_jsx("p", { className: "subtitle", style: { marginTop: 'var(--space-2)' }, children: product.description })), !orderable && (_jsx("div", { style: { marginTop: 'var(--space-3)' }, children: _jsx(Tag, { variant: "danger", children: "\u00C9puis\u00E9 pour le moment" }) }))] }), product.optionGroups.map((group) => {
                        const chosen = selected[group.id] ?? [];
                        const missing = showErrors && chosen.length < group.minChoices;
                        return (_jsxs("section", { id: `group-${group.id}`, className: "card stack", style: { gap: 'var(--space-2)' }, children: [_jsxs("div", { className: "row row--between", children: [_jsx("h3", { className: "section-title", children: group.name }), group.minChoices > 0 ? (_jsx(Tag, { variant: missing ? 'danger' : 'brand', children: "Obligatoire" })) : (_jsx("span", { className: "faint", children: group.maxChoices > 1 ? `${group.maxChoices} max.` : 'Facultatif' }))] }), missing && (_jsxs("p", { className: "field__error", children: ["Choisissez ", group.minChoices > 1 ? `${group.minChoices} options` : 'une option', "."] })), group.items.map((item) => {
                                    const isChosen = chosen.includes(item.id);
                                    const full = !isChosen && chosen.length >= group.maxChoices && group.maxChoices > 1;
                                    const disabled = !item.isAvailable || full;
                                    return (_jsxs("button", { type: "button", className: `option-row${disabled ? ' option-row--disabled' : ''}`, "aria-pressed": isChosen, disabled: disabled, onClick: () => toggle(group.id, item.id, group.maxChoices), children: [_jsx("span", { className: `option-row__mark${group.maxChoices > 1 ? ' option-row__mark--square' : ''}`, children: isChosen && _jsx(IconCheck, { size: 14 }) }), _jsx("span", { style: { flex: 1 }, children: item.name }), item.priceDelta > 0 && _jsxs("span", { className: "price", children: ["+", formatAmount(item.priceDelta)] }), !item.isAvailable && _jsx("span", { className: "faint", children: "\u00E9puis\u00E9" })] }, item.id));
                                })] }, group.id));
                    }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "note", children: "Une pr\u00E9cision pour la cuisine ?" }), _jsx("textarea", { id: "note", className: "input", value: note, onChange: (event) => setNote(event.target.value), maxLength: 200, placeholder: "Sans oignon, bien cuit\u2026" })] }), _jsxs("div", { className: "row row--between", children: [_jsx("span", { className: "section-title", children: "Quantit\u00E9" }), _jsx(Stepper, { value: quantity, onChange: setQuantity })] })] }), _jsx("div", { className: "action-bar", children: _jsx("button", { type: "button", className: "btn btn--primary btn--block", onClick: addToCart, disabled: !orderable, children: orderable ? (_jsxs(_Fragment, { children: ["Ajouter au panier", _jsx("span", { style: { opacity: 0.7 }, children: "\u00B7" }), formatAmount(unitPrice * quantity)] })) : ('Produit indisponible') }) })] }));
}
//# sourceMappingURL=Product.js.map