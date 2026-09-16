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
      </form>
    </div>
  );
}
