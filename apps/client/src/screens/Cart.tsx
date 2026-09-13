/** Panier : modifier, supprimer, voir le détail du total, passer à la commande. */
import { Link, useNavigate } from 'react-router-dom';
import { IconCart, IconQr, IconTrash } from '../components/Icons';
import { EmptyState, Header, ProductImage, Stepper } from '../components/ui';
import { cartTotals, itemUnitPrice, useCart } from '../lib/cart';
import { formatAmount } from '../lib/format';
import { useRestaurant } from '../lib/queries';

export function Cart() {
  const navigate = useNavigate();
  const { items, setQuantity, remove, clear, table } = useCart();
  const restaurant = useRestaurant();

  const totals = cartTotals(items);
  const open = restaurant.data?.state.open ?? true;

  if (items.length === 0) {
    return (
      <div>
        <Header title="Panier" />
        <EmptyState
          icon={<IconCart size={28} />}
          title="Votre panier est vide"
          description="Parcourez le menu et ajoutez ce qui vous fait envie."
          action={
            <Link to="/menu" className="btn btn--primary">
              Voir le menu
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Panier"
        actions={
          <button
            type="button"
            className="icon-button"
            aria-label="Vider le panier"
            onClick={() => {
              if (window.confirm('Vider le panier ?')) clear();
            }}
          >
            <IconTrash />
          </button>
        }
      />

      <div className="container stack">
        {table && (
          <div className="banner banner--info">
            <IconQr size={18} />
            <span>
              Commande pour la <strong>table {table.number}</strong>.
            </span>
          </div>
        )}

        {!open && (
          <div className="banner banner--warning">
            <span>
              Le restaurant est fermé pour le moment. Votre panier est conservé jusqu'à la
              réouverture.
            </span>
          </div>
        )}

        {items.map((item) => (
          <article key={item.key} className="card row" style={{ alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <div className="product-card__media" style={{ width: 64, height: 64, minWidth: 64 }}>
              <ProductImage src={item.imageUrl} alt={item.name} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 700 }}>{item.name}</span>
                <button
                  type="button"
                  className="icon-button"
                  style={{ width: 32, height: 32, minWidth: 32 }}
                  aria-label={`Retirer ${item.name}`}
                  onClick={() => remove(item.key)}
                >
                  <IconTrash size={16} />
                </button>
              </div>

              {item.options.length > 0 && (
                <p className="faint">{item.options.map((option) => option.name).join(' · ')}</p>
              )}
              {item.note && <p className="faint">« {item.note} »</p>}

              <div className="row row--between" style={{ marginTop: 'var(--space-3)' }}>
                <span className="price">{formatAmount(itemUnitPrice(item) * item.quantity)}</span>
                <Stepper
                  value={item.quantity}
                  min={0}
                  onChange={(quantity) => setQuantity(item.key, quantity)}
                />
              </div>
            </div>
          </article>
        ))}

        <div className="card totals">
          <div className="totals__row">
            <span>Sous-total</span>
            <span>{formatAmount(totals.subtotal)}</span>
          </div>
          <div className="totals__row">
            <span>Livraison</span>
            <span className="muted">calculée à l'étape suivante</span>
          </div>
          <div className="totals__row totals__row--total">
            <span>Total</span>
            <span>{formatAmount(totals.total)}</span>
          </div>
        </div>

        <Link to="/menu" className="btn btn--ghost btn--block">
          Ajouter d'autres produits
        </Link>
      </div>

      <div className="action-bar">
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!open}
          onClick={() => navigate('/commander')}
        >
          {open ? (
            <>
              Commander
              <span style={{ opacity: 0.7 }}>·</span>
              {formatAmount(totals.total)}
            </>
          ) : (
            'Restaurant fermé'
          )}
        </button>
      </div>
    </div>
  );
}
