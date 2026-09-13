import { Link } from 'react-router-dom';
import type { Product } from '../lib/api';
import { formatAmount } from '../lib/format';
import { ProductImage, Tag } from './ui';

export function ProductCard({ product }: { product: Product }) {
  const orderable = product.isOrderable !== false && product.isAvailable;

  return (
    <Link
      to={`/produit/${product.slug}`}
      className={`product-card${orderable ? '' : ' product-card--unavailable'}`}
    >
      <div className="product-card__media">
        <ProductImage src={product.imageUrl} alt={product.name} />
      </div>
      <div className="product-card__body">
        <span className="product-card__name">{product.name}</span>
        {product.description && <span className="product-card__desc">{product.description}</span>}
        <div className="row row--between" style={{ marginTop: 'auto' }}>
          <span className="price">{formatAmount(product.price)}</span>
          {!orderable && <Tag variant="danger">Épuisé</Tag>}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardCompact({ product }: { product: Product }) {
  const orderable = product.isOrderable !== false && product.isAvailable;

  return (
    <Link
      to={`/produit/${product.slug}`}
      className="card card--flush"
      style={{ width: 168, flex: '0 0 auto', opacity: orderable ? 1 : 0.5 }}
    >
      <div style={{ aspectRatio: '4 / 3', background: 'var(--surface-2)' }}>
        <ProductImage src={product.imageUrl} alt={product.name} />
      </div>
      <div style={{ padding: 'var(--space-3)' }}>
        <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{product.name}</p>
        <p className="price" style={{ marginTop: 4 }}>
          {formatAmount(product.price)}
        </p>
      </div>
    </Link>
  );
}
