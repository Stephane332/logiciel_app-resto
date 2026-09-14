import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { BurgerMark, IconBack, IconWifiOff } from './Icons';
import { useOnlineStatus } from '../lib/network';
export function Header({ title, back, actions, }) {
    const navigate = useNavigate();
    return (_jsxs("header", { className: "header", children: [back && (_jsx("button", { type: "button", className: "icon-button", "aria-label": "Revenir en arri\u00E8re", onClick: () => (typeof back === 'function' ? back() : navigate(-1)), children: _jsx(IconBack, {}) })), _jsx("h1", { className: "header__title", children: title }), actions] }));
}
/**
 * Image de produit avec repli.
 * Le restaurant n'aura pas une photo pour chaque produit dès le premier jour : un badge sobre vaut
 * mieux qu'un carré vide ou une icône d'image cassée.
 */
export function ProductImage({ src, alt }) {
    if (!src) {
        return (_jsx("div", { className: "image-fallback", children: _jsx(BurgerMark, { className: "muted" }) }));
    }
    return _jsx("img", { src: src, alt: alt, loading: "lazy", decoding: "async" });
}
export function EmptyState({ icon, title, description, action, }) {
    return (_jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-state__icon", children: icon }), _jsxs("div", { children: [_jsx("p", { className: "section-title", children: title }), description && _jsx("p", { className: "subtitle", style: { marginTop: 4 }, children: description })] }), action] }));
}
export function Loading({ rows = 4 }) {
    return (_jsxs("div", { className: "stack container", style: { paddingTop: 16 }, "aria-busy": "true", "aria-live": "polite", children: [_jsx("span", { className: "sr-only", children: "Chargement\u2026" }), Array.from({ length: rows }, (_, index) => (_jsx("div", { className: "skeleton", style: { height: 104 } }, index)))] }));
}
export function ErrorState({ message, onRetry }) {
    return (_jsx(EmptyState, { icon: _jsx(IconWifiOff, { size: 28 }), title: "Impossible de charger", description: message, action: onRetry && (_jsx("button", { type: "button", className: "btn btn--secondary", onClick: onRetry, children: "R\u00E9essayer" })) }));
}
/** Bandeau hors ligne : un écran figé qui paraît normal est pire qu'une panne visible. */
export function OfflineBanner() {
    const online = useOnlineStatus();
    if (online)
        return null;
    return (_jsxs("div", { className: "offline-banner", role: "status", children: [_jsx(IconWifiOff, {}), "Hors ligne \u2014 le menu reste consultable"] }));
}
export function Tag({ children, variant = 'default', }) {
    return _jsx("span", { className: `tag${variant === 'default' ? '' : ` tag--${variant}`}`, children: children });
}
export function Stepper({ value, onChange, min = 1, max = 99, }) {
    return (_jsxs("div", { className: "stepper", children: [_jsx("button", { type: "button", className: "stepper__btn", onClick: () => onChange(value - 1), disabled: value <= min, "aria-label": "Diminuer la quantit\u00E9", children: "\u2212" }), _jsx("span", { className: "stepper__value", "aria-live": "polite", children: value }), _jsx("button", { type: "button", className: "stepper__btn", onClick: () => onChange(value + 1), disabled: value >= max, "aria-label": "Augmenter la quantit\u00E9", children: "+" })] }));
}
//# sourceMappingURL=ui.js.map