/**
 * Menu et stock.
 *
 * Le restaurant saisit lui-même son catalogue : catégories, produits, prix, options, disponibilités
 * et stock, sans développeur ni redéploiement (§ 2.8). C'est la condition pour que la plateforme
 * vive sans son concepteur.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, mediaUrl, staffApi, type Category, type Product } from '@savora/api-client';
import { IconPlus, IconTrash } from '../components/Icons';
import { Empty, ErrorState, Loading, Modal, Switch, Tag } from '../components/ui';
import { formatAmount } from '../lib/format';
import { queryClient, useManageMenu } from '../lib/queries';
import { useSession } from '../lib/session';
import { can } from '@savora/shared';

function invalidateMenu(): void {
  void queryClient.invalidateQueries({ queryKey: ['menu'] });
  void queryClient.invalidateQueries({ queryKey: ['setup'] });
}

export function MenuManage() {
  const user = useSession((state) => state.user);
  const { data, isLoading, isError, refetch } = useManageMenu();
  const [editing, setEditing] = useState<{ product?: Product; categoryId: string } | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="Le menu est indisponible." onRetry={() => void refetch()} />;

  const categories = data?.categories ?? [];
  const canWrite = user ? can(user.role, 'menu:write') : false;

  return (
    <div className="stack">
      <div className="row row--between row--wrap">
        <h2 className="section-title">
          {categories.length} catégorie{categories.length > 1 ? 's' : ''} ·{' '}
          {categories.reduce((sum, category) => sum + category.products.length, 0)} produits
        </h2>
        {canWrite && (
          <button type="button" className="btn btn--primary" onClick={() => setAddingCategory(true)}>
            <IconPlus />
            Nouvelle catégorie
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <Empty
          title="Le menu est vide"
          description="Créez une catégorie, puis ajoutez vos premiers produits."
          action={
            canWrite && (
              <button type="button" className="btn btn--primary" onClick={() => setAddingCategory(true)}>
                Créer une catégorie
              </button>
            )
          }
        />
      ) : (
        categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            canWrite={canWrite}
            onEdit={(product) => setEditing({ product, categoryId: category.id })}
            onAdd={() => setEditing({ categoryId: category.id })}
          />
        ))
      )}

      {addingCategory && <CategoryModal onClose={() => setAddingCategory(false)} />}
      {editing && (
        <ProductModal
          categoryId={editing.categoryId}
          product={editing.product}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CategorySection({
  category,
  canWrite,
  onEdit,
  onAdd,
}: {
  category: Category;
  canWrite: boolean;
  onEdit: (product: Product) => void;
  onAdd: () => void;
}) {
  return (
    <section className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="row row--between">
        <h3 className="section-title">
          {category.name} {!category.isActive && <Tag>Masquée</Tag>}
        </h3>
        {canWrite && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onAdd}>
            <IconPlus size={16} />
            Ajouter un produit
          </button>
        )}
      </div>

      {category.products.length === 0 ? (
        <p className="faint">Aucun produit dans cette catégorie.</p>
      ) : (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {category.products.map((product) => (
            <ProductRow key={product.id} product={product} canWrite={canWrite} onEdit={() => onEdit(product)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductRow({
  product,
  canWrite,
  onEdit,
}: {
  product: Product;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const [stock, setStock] = useState<string>(
    product.stock === null || product.stock === undefined ? '' : String(product.stock),
  );

  // Accessible à la cuisine : c'est elle qui sait ce qui manque, et elle ne peut pas toucher aux prix.
  const availability = useMutation({
    mutationFn: (body: { isAvailable?: boolean; stock?: number | null }) =>
      staffApi.setAvailability(product.id, body),
    onSuccess: invalidateMenu,
  });

  return (
    <div className="card row row--wrap" style={{ gap: 'var(--space-3)' }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ fontWeight: 700 }}>{product.name}</p>
        {product.description && <p className="faint">{product.description}</p>}
        <p className="price" style={{ marginTop: 4 }}>
          {formatAmount(product.price)}
        </p>
      </div>

      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <label className="field" style={{ width: 110 }}>
          <span className="field__label">Stock</span>
          <input
            className="input"
            type="number"
            min={0}
            value={stock}
            placeholder="illimité"
            aria-label={`Stock de ${product.name}`}
            onChange={(event) => setStock(event.target.value)}
            onBlur={() =>
              availability.mutate({ stock: stock.trim() === '' ? null : Number(stock) })
            }
          />
        </label>

        <div style={{ minWidth: 170 }}>
          <Switch
            checked={product.isAvailable}
            label={product.isAvailable ? 'Disponible' : 'Épuisé'}
            disabled={availability.isPending}
            onChange={(value) => availability.mutate({ isAvailable: value })}
          />
        </div>

        {canWrite && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={onEdit}>
            Modifier
          </button>
        )}
      </div>
    </div>
  );
}

function CategoryModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: () => staffApi.createCategory({ name: name.trim() }),
    onSuccess: () => {
      invalidateMenu();
      onClose();
    },
  });

  return (
    <Modal
      title="Nouvelle catégorie"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={name.trim().length < 2 || create.isPending}
          onClick={() => create.mutate()}
        >
          Créer
        </button>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="category-name">
          Nom
        </label>
        <input
          id="category-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Burgers, Boissons, Desserts…"
          autoFocus
        />
      </div>
    </Modal>
  );
}

interface DraftGroup {
  name: string;
  minChoices: number;
  maxChoices: number;
  items: { name: string; priceDelta: number }[];
}

function ProductModal({
  product,
  categoryId,
  categories,
  onClose,
}: {
  product?: Product;
  categoryId: string;
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [category, setCategory] = useState(product?.categoryId ?? categoryId);
  const [groups, setGroups] = useState<DraftGroup[]>([]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        categoryId: category,
        name: name.trim(),
        description: description.trim() || undefined,
        // Les montants sont des entiers de FCFA : jamais de virgule (ADR 003).
        price: Math.round(Number(price)),
        imageUrl: imageUrl.trim() || undefined,
        ...(product
          ? {}
          : {
              optionGroups: groups.map((group, index) => ({
                name: group.name,
                minChoices: group.minChoices,
                maxChoices: group.maxChoices,
                position: index,
                items: group.items.map((item, itemIndex) => ({
                  name: item.name,
                  priceDelta: item.priceDelta,
                  position: itemIndex,
                })),
              })),
            }),
      };
      return product ? staffApi.updateProduct(product.id, body) : staffApi.createProduct(body);
    },
    onSuccess: () => {
      invalidateMenu();
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => staffApi.deleteProduct(product!.id),
    onSuccess: () => {
      invalidateMenu();
      onClose();
    },
  });

  const priceValid = price.trim() !== '' && Number.isFinite(Number(price)) && Number(price) >= 0;

  return (
    <Modal
      title={product ? `Modifier ${product.name}` : 'Nouveau produit'}
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {product && (
            <button
              type="button"
              className="btn btn--danger"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Retirer « ${product.name} » du menu ?`)) remove.mutate();
              }}
            >
              <IconTrash size={16} />
              Retirer
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            style={{ flex: 1 }}
            disabled={name.trim().length < 2 || !priceValid || save.isPending}
            onClick={() => save.mutate()}
          >
            {product ? 'Enregistrer' : 'Créer le produit'}
          </button>
        </div>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="product-name">
            Nom
          </label>
          <input
            id="product-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="product-category">
            Catégorie
          </label>
          <select
            id="product-category"
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="product-price">
            Prix en FCFA
          </label>
          <input
            id="product-price"
            className="input"
            type="number"
            min={0}
            step={5}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="3500"
          />
          {!priceValid && price.trim() !== '' && <span className="field__error">Prix invalide.</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="product-description">
            Description
          </label>
          <textarea
            id="product-description"
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            placeholder="Steak haché, cheddar, salade, tomate, oignon, sauce maison."
          />
        </div>

        <PhotoField value={imageUrl} onChange={setImageUrl} />

        {/* Les options ne se définissent qu'à la création : les modifier après coup toucherait aux
            commandes passées qui les référencent. */}
        {!product && <OptionGroupsEditor groups={groups} setGroups={setGroups} />}

        {save.isError && <p className="field__error">L'enregistrement a échoué. Vérifiez les champs.</p>}
      </div>
    </Modal>
  );
}

function OptionGroupsEditor({
  groups,
  setGroups,
}: {
  groups: DraftGroup[];
  setGroups: (groups: DraftGroup[]) => void;
}) {
  return (
    <section className="stack" style={{ gap: 'var(--space-2)' }}>
      <div className="row row--between">
        <h3 style={{ fontWeight: 700 }}>Options et suppléments</h3>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() =>
            setGroups([...groups, { name: '', minChoices: 0, maxChoices: 1, items: [{ name: '', priceDelta: 0 }] }])
          }
        >
          <IconPlus size={16} />
          Groupe
        </button>
      </div>

      {groups.length === 0 && (
        <p className="faint">
          Par exemple : « Choisissez une sauce » (obligatoire, un choix) ou « Suppléments » (facultatif,
          plusieurs choix payants).
        </p>
      )}

      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="card stack" style={{ gap: 'var(--space-2)' }}>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <input
              className="input"
              value={group.name}
              placeholder="Nom du groupe"
              aria-label="Nom du groupe d'options"
              onChange={(event) =>
                setGroups(groups.map((item, index) => (index === groupIndex ? { ...item, name: event.target.value } : item)))
              }
            />
            <button
              type="button"
              className="btn btn--danger btn--sm"
              aria-label="Supprimer ce groupe"
              onClick={() => setGroups(groups.filter((_, index) => index !== groupIndex))}
            >
              <IconTrash size={16} />
            </button>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <label className="field" style={{ flex: 1 }}>
              <span className="field__label">Choix minimum</span>
              <input
                className="input"
                type="number"
                min={0}
                max={10}
                value={group.minChoices}
                onChange={(event) =>
                  setGroups(
                    groups.map((item, index) =>
                      index === groupIndex ? { ...item, minChoices: Number(event.target.value) } : item,
                    ),
                  )
                }
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="field__label">Choix maximum</span>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={group.maxChoices}
                onChange={(event) =>
                  setGroups(
                    groups.map((item, index) =>
                      index === groupIndex ? { ...item, maxChoices: Number(event.target.value) } : item,
                    ),
                  )
                }
              />
            </label>
          </div>

          {group.items.map((item, itemIndex) => (
            <div key={itemIndex} className="row" style={{ gap: 'var(--space-2)' }}>
              <input
                className="input"
                value={item.name}
                placeholder="Nom de l'option"
                aria-label="Nom de l'option"
                onChange={(event) =>
                  setGroups(
                    groups.map((groupItem, index) =>
                      index === groupIndex
                        ? {
                            ...groupItem,
                            items: groupItem.items.map((option, optionIndex) =>
                              optionIndex === itemIndex ? { ...option, name: event.target.value } : option,
                            ),
                          }
                        : groupItem,
                    ),
                  )
                }
              />
              <input
                className="input"
                type="number"
                min={0}
                step={5}
                style={{ width: 120 }}
                value={item.priceDelta}
                aria-label="Supplément en FCFA"
                onChange={(event) =>
                  setGroups(
                    groups.map((groupItem, index) =>
                      index === groupIndex
                        ? {
                            ...groupItem,
                            items: groupItem.items.map((option, optionIndex) =>
                              optionIndex === itemIndex
                                ? { ...option, priceDelta: Number(event.target.value) }
                                : option,
                            ),
                          }
                        : groupItem,
                    ),
                  )
                }
              />
            </div>
          ))}

          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              setGroups(
                groups.map((item, index) =>
                  index === groupIndex ? { ...item, items: [...item.items, { name: '', priceDelta: 0 }] } : item,
                ),
              )
            }
          >
            <IconPlus size={16} />
            Option
          </button>
        </div>
      ))}
    </section>
  );
}

/**
 * Photo du produit : prise à l'instant, ou choisie dans la galerie.
 *
 * `capture="environment"` fait ouvrir l'appareil photo arrière directement sur un téléphone. C'est
 * le geste attendu — le gérant est devant son plat, pas devant un ordinateur avec un dossier
 * d'images bien rangé.
 *
 * Le serveur redimensionne et compresse ce qu'il reçoit : une photo de 6 Mo devient 80 Ko. Il ne
 * faut donc surtout pas décourager l'envoi d'un cliché lourd — c'est ce qui sort qui doit être
 * léger, pas ce qui entre.
 */
function PhotoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => staffApi.uploadImage(file),
    onSuccess: (image) => {
      onChange(image.url);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "L'envoi a échoué. Réessayez."),
  });

  return (
    <div className="field">
      <span className="field__label">Photo du plat</span>

      {value ? (
        <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <img
            src={mediaUrl(value) ?? value}
            alt=""
            style={{
              width: 96,
              height: 96,
              objectFit: 'cover',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-2)',
            }}
          />
          <div className="stack" style={{ gap: 'var(--space-2)', flex: 1 }}>
            <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>
              Remplacer la photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate(file);
                }}
              />
            </label>
            <button type="button" className="btn btn--ghost" onClick={() => onChange('')}>
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <label className="btn btn--ghost btn--block" style={{ cursor: 'pointer' }}>
          {upload.isPending ? 'Envoi de la photo…' : 'Prendre ou choisir une photo'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
      )}

      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        <span className="faint">
          Facultatif, mais un plat sans photo se commande beaucoup moins. La photo est allégée
          automatiquement pour vos clients.
        </span>
      )}
    </div>
  );
}
