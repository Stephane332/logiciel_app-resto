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

  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const product = data?.product;

  const chosenOptions = useMemo(() => {
    if (!product) return [];
    return product.optionGroups.flatMap((group) =>
      group.items.filter((item) => selected[group.id]?.includes(item.id)),
    );
  }, [product, selected]);

  const unitPrice = (product?.price ?? 0) + chosenOptions.reduce((sum, option) => sum + option.priceDelta, 0);

  const missingGroups = useMemo(() => {
    if (!product) return [];
    return product.optionGroups.filter(
      (group) => (selected[group.id]?.length ?? 0) < group.minChoices,
    );
  }, [product, selected]);

  if (isLoading) return <Loading rows={2} />;
  if (isError || !product) {
    return <ErrorState message="Ce produit est introuvable." onRetry={() => void refetch()} />;
  }

  const orderable = product.isOrderable !== false && product.isAvailable;

  function toggle(groupId: string, itemId: string, maxChoices: number): void {
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
      if (existing.length >= maxChoices) return current;

      return { ...current, [groupId]: [...existing, itemId] };
    });
  }

  function addToCart(): void {
    if (missingGroups.length > 0) {
      setShowErrors(true);
      document.getElementById(`group-${missingGroups[0]!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    add(
      product!,
      chosenOptions.map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      })),
      quantity,
      note.trim() || undefined,
    );
    navigate('/panier');
  }

  async function share(): Promise<void> {
    const url = window.location.href;
    const payload = { title: product!.name, text: `${product!.name} — ${formatAmount(product!.price)}`, url };
    try {
      if (navigator.share) await navigator.share(payload);
      else await navigator.clipboard.writeText(url);
    } catch {
      // Partage annulé par l'utilisateur : rien à signaler.
    }
  }

  return (
    <div>
      <Header
        title={product.name}
        back
        actions={
          <>
            <button
              type="button"
              className="icon-button"
              aria-label={favorites.has(product.slug) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={favorites.has(product.slug)}
              onClick={() => favorites.toggle(product.slug)}
            >
              <IconHeart
                filled={favorites.has(product.slug)}
                className={favorites.has(product.slug) ? 'price' : undefined}
              />
            </button>
            <button type="button" className="icon-button" aria-label="Partager" onClick={() => void share()}>
              <IconShare />
            </button>
          </>
        }
      />

      <div className="product-hero">
        <ProductImage src={product.imageUrl} alt={product.name} />
      </div>

      <div className="container stack" style={{ paddingTop: 'var(--space-4)' }}>
        <div>
          <div className="row row--between">
            <h2 className="title">{product.name}</h2>
            <span className="price" style={{ fontSize: 'var(--text-xl)' }}>
              {formatAmount(product.price)}
            </span>
          </div>
          {product.description && (
            <p className="subtitle" style={{ marginTop: 'var(--space-2)' }}>
              {product.description}
            </p>
          )}
          {!orderable && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Tag variant="danger">Épuisé pour le moment</Tag>
            </div>
          )}
        </div>

        {product.optionGroups.map((group) => {
          const chosen = selected[group.id] ?? [];
          const missing = showErrors && chosen.length < group.minChoices;

          return (
            <section key={group.id} id={`group-${group.id}`} className="card stack" style={{ gap: 'var(--space-2)' }}>
              <div className="row row--between">
                <h3 className="section-title">{group.name}</h3>
                {group.minChoices > 0 ? (
                  <Tag variant={missing ? 'danger' : 'brand'}>Obligatoire</Tag>
                ) : (
                  <span className="faint">
                    {group.maxChoices > 1 ? `${group.maxChoices} max.` : 'Facultatif'}
                  </span>
                )}
              </div>

              {missing && (
                <p className="field__error">
                  Choisissez {group.minChoices > 1 ? `${group.minChoices} options` : 'une option'}.
                </p>
              )}

              {group.items.map((item) => {
                const isChosen = chosen.includes(item.id);
                const full = !isChosen && chosen.length >= group.maxChoices && group.maxChoices > 1;
                const disabled = !item.isAvailable || full;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`option-row${disabled ? ' option-row--disabled' : ''}`}
                    aria-pressed={isChosen}
                    disabled={disabled}
                    onClick={() => toggle(group.id, item.id, group.maxChoices)}
                  >
                    <span
                      className={`option-row__mark${group.maxChoices > 1 ? ' option-row__mark--square' : ''}`}
                    >
                      {isChosen && <IconCheck size={14} />}
                    </span>
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {item.priceDelta > 0 && <span className="price">+{formatAmount(item.priceDelta)}</span>}
                    {!item.isAvailable && <span className="faint">épuisé</span>}
                  </button>
                );
              })}
            </section>
          );
        })}

        <div className="field">
          <label className="field__label" htmlFor="note">
            Une précision pour la cuisine ?
          </label>
          <textarea
            id="note"
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder="Sans oignon, bien cuit…"
          />
        </div>

        <div className="row row--between">
          <span className="section-title">Quantité</span>
          <Stepper value={quantity} onChange={setQuantity} />
        </div>
      </div>

      <div className="action-bar">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={addToCart}
          disabled={!orderable}
        >
          {orderable ? (
            <>
              Ajouter au panier
              <span style={{ opacity: 0.7 }}>·</span>
              {formatAmount(unitPrice * quantity)}
            </>
          ) : (
            'Produit indisponible'
          )}
        </button>
      </div>
    </div>
  );
}
