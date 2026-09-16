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

/**
 * Carte en vedette : l'image occupe toute la carte, le texte se pose dessus.
 *
 * Reléguer le nom et le prix sous une vignette revenait à donner autant de place à un rectangle
 * d'étiquette qu'au plat lui-même. Ici, l'image porte la carte et un dégradé sombre vient sous le
 * texte — juste sous le texte, pas sur toute l'image — pour que le nom reste lisible quelle que
 * soit la photo envoyée par le restaurant, y compris une photo claire prise en plein soleil.
 */
export function ProductCardCompact({ product }: { product: Product }) {
  const orderable = product.isOrderable !== false && product.isAvailable;

  return (
    <Link
      to={`/produit/${product.slug}`}
      className={`feature-card${orderable ? '' : ' feature-card--unavailable'}`}
    >
      <ProductImage src={product.imageUrl} alt={product.name} />
      <div className="feature-card__veil" />
      <div className="feature-card__body">
        <span className="feature-card__name">{product.name}</span>
        <span className="feature-card__price">{formatAmount(product.price)}</span>
      </div>
      {!orderable && (
        <span className="feature-card__badge">
          <Tag variant="danger">Épuisé</Tag>
        </span>
      )}
    </Link>
  );
}
