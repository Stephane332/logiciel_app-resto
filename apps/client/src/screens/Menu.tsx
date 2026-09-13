/** Menu complet : catégories, recherche, et tous les produits. */
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconSearch } from '../components/Icons';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, ErrorState, Header, Loading } from '../components/ui';
import { useMenu } from '../lib/queries';

/** Recherche insensible aux accents : « frites » doit trouver « Frites », et « cafe » trouver « Café ». */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function Menu() {
  const { categorySlug } = useParams();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string | null>(categorySlug ?? null);
  const menu = useMenu();

  const categories = menu.data?.categories ?? [];

  const results = useMemo(() => {
    const query = normalize(search.trim());
    const scope = active ? categories.filter((category) => category.slug === active) : categories;

    if (!query) return scope;

    return scope
      .map((category) => ({
        ...category,
        products: category.products.filter(
          (product) =>
            normalize(product.name).includes(query) ||
            normalize(product.description ?? '').includes(query),
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [categories, active, search]);

  if (menu.isLoading) return <Loading />;
  if (menu.isError) return <ErrorState message="Le menu n'a pas pu être chargé." onRetry={() => void menu.refetch()} />;

  const total = results.reduce((sum, category) => sum + category.products.length, 0);

  return (
    <div>
      <Header title="Menu" />

      <div className="container" style={{ paddingTop: 'var(--space-3)' }}>
        <label className="row input" style={{ gap: 'var(--space-2)' }}>
          <IconSearch size={20} className="muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un produit…"
            aria-label="Rechercher un produit"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', minWidth: 0 }}
          />
        </label>
      </div>

      <div className="chips" role="group" aria-label="Filtrer par catégorie">
        <button
          type="button"
          className="chip"
          aria-pressed={active === null}
          onClick={() => setActive(null)}
        >
          Tous
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="chip"
            aria-pressed={active === category.slug}
            onClick={() => setActive(active === category.slug ? null : category.slug)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="container stack" style={{ paddingTop: 'var(--space-3)' }}>
        {total === 0 ? (
          <EmptyState
            icon={<IconSearch size={28} />}
            title="Aucun résultat"
            description={
              search ? `Rien ne correspond à « ${search} ».` : 'Cette catégorie est vide pour le moment.'
            }
          />
        ) : (
          results.map((category) => (
            <section key={category.id} className="stack" style={{ gap: 'var(--space-3)' }}>
              <h2 className="section-title">{category.name}</h2>
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
