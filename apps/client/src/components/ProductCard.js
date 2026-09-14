import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { formatAmount } from '../lib/format';
import { ProductImage, Tag } from './ui';
export function ProductCard({ product }) {
    const orderable = product.isOrderable !== false && product.isAvailable;
    return (_jsxs(Link, { to: `/produit/${product.slug}`, className: `product-card${orderable ? '' : ' product-card--unavailable'}`, children: [_jsx("div", { className: "product-card__media", children: _jsx(ProductImage, { src: product.imageUrl, alt: product.name }) }), _jsxs("div", { className: "product-card__body", children: [_jsx("span", { className: "product-card__name", children: product.name }), product.description && _jsx("span", { className: "product-card__desc", children: product.description }), _jsxs("div", { className: "row row--between", style: { marginTop: 'auto' }, children: [_jsx("span", { className: "price", children: formatAmount(product.price) }), !orderable && _jsx(Tag, { variant: "danger", children: "\u00C9puis\u00E9" })] })] })] }));
}
export function ProductCardCompact({ product }) {
    const orderable = product.isOrderable !== false && product.isAvailable;
    return (_jsxs(Link, { to: `/produit/${product.slug}`, className: "card card--flush", style: { width: 168, flex: '0 0 auto', opacity: orderable ? 1 : 0.5 }, children: [_jsx("div", { style: { aspectRatio: '4 / 3', background: 'var(--surface-2)' }, children: _jsx(ProductImage, { src: product.imageUrl, alt: product.name }) }), _jsxs("div", { style: { padding: 'var(--space-3)' }, children: [_jsx("p", { style: { fontWeight: 700, fontSize: 'var(--text-sm)' }, children: product.name }), _jsx("p", { className: "price", style: { marginTop: 4 }, children: formatAmount(product.price) })] })] }));
}
//# sourceMappingURL=ProductCard.js.map