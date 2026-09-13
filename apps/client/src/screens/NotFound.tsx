import { Link } from 'react-router-dom';
import { IconSearch } from '../components/Icons';
import { EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <EmptyState
      icon={<IconSearch size={28} />}
      title="Page introuvable"
      description="Ce lien ne mène nulle part. Le menu, lui, est toujours là."
      action={
        <Link to="/" className="btn btn--primary">
          Retour à l'accueil
        </Link>
      }
    />
  );
}
