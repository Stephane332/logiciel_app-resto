/** Favoris — stockés sur l'appareil, disponibles sans compte. */
import { Link } from 'react-router-dom';
import { IconHeart } from '../components/Icons';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Header, Loading } from '../components/ui';
import { useFavorites } from '../lib/favorites';
import { useMenu } from '../lib/queries';

export function Favorites() {
  const slugs = useFavorites((state) => state.slugs);
  const menu = useMenu();

  if (menu.isLoading) return <Loading />;

  const products = (menu.data?.categories ?? [])
    .flatMap((category) => category.products)
    .filter((product) => slugs.includes(product.slug));

  return (
    <div>
      <Header title="Mes favoris" />

      {products.length === 0 ? (
        <EmptyState
          icon={<IconHeart size={28} />}
          title="Aucun favori"
          description="Touchez le cœur sur un produit pour le retrouver ici."
          action={
            <Link to="/menu" className="btn btn--primary">
              Parcourir le menu
            </Link>
          }
        />
      ) : (
        <div className="container stack">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
