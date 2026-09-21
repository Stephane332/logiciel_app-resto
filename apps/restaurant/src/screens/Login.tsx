/** Connexion du personnel. */
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, staffApi } from '@savora/api-client';
import { BurgerMark } from '../components/Icons';
import { useSession } from '../lib/session';
import { unlockSound } from '../lib/sound';

export function Login() {
  const setSession = useSession((state) => state.setSession);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => staffApi.login({ phone, password }),
    onSuccess: (session) => {
      if (session.user.role === 'CLIENT') {
        throw new ApiError(403, 'NOT_STAFF', 'Ce compte est un compte client.');
      }
      // La connexion est la première interaction de la session : c'est le moment de débloquer
      // l'audio, pour que l'alerte des nouvelles commandes fonctionne dès la première.
      unlockSound();
      setSession(session);
    },
  });

  const error = login.error instanceof ApiError ? login.error.message : null;

  return (
    <div className="login">
      <form
        className="login__card"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          login.mutate();
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center', gap: 'var(--space-3)' }}>
          <BurgerMark size={56} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 800, fontSize: 'var(--text-xl)' }}>Espace Restaurant</p>
            <p className="faint">Connectez-vous pour accéder aux commandes.</p>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="phone">
            Téléphone
          </label>
          <input
            id="phone"
            className="input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="username"
            placeholder="70 00 00 01"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="banner banner--danger" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={login.isPending}>
          {login.isPending ? 'Connexion…' : 'Se connecter'}
        </button>

        <ChangerDeServeur />
      </form>
    </div>
  );
}

/**
 * Le retour en arrière, quand le logiciel vise le mauvais serveur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une adresse enregistrée une fois l'était pour toujours.                      │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Les réglages vivent à côté des données, et un désinstalleur n'y touche pas — c'est ce qui
 * protège la base du restaurant lors d'une mise à jour. Mais il n'existait aucun moyen de revenir
 * sur l'adresse : réinstaller une version plus récente repartait sur l'ancienne, et un PC de caisse
 * qui change d'adresse sur le réseau laissait toute l'équipe devant un écran qui ne répond plus.
 * Le canal existait déjà côté application Windows ; rien ne l'appelait jamais.
 *
 * Le lien n'apparaît que dans l'application installée — sur le web, la question n'a pas de sens :
 * l'interface et son serveur partagent le domaine.
 */
function ChangerDeServeur() {
  const pont = (window as { savora?: { changerServeur?: () => void } }).savora;
  if (!pont?.changerServeur) return null;

  return (
    <button
      type="button"
      className="btn btn--ghost btn--block"
      style={{ marginTop: 'var(--space-2)' }}
      onClick={() => pont.changerServeur?.()}
    >
      Ce n'est pas le bon serveur — changer l'adresse
    </button>
  );
}
