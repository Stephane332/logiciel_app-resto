/**
 * Connexion et inscription.
 *
 * Volontairement en retrait dans le parcours : commander ne l'exige pas. Un compte sert à retrouver
 * son historique et à cumuler des points, pas à franchir un péage avant de manger (§ 2.2).
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { isValidBurkinaPhone } from '@barabite/shared';
import { Header } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session';

export function Login() {
  const navigate = useNavigate();
  const setSession = useSession((state) => state.setSession);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api.login({ phone, password }),
    onSuccess: (session) => {
      setSession(session);
      navigate('/compte', { replace: true });
    },
  });

  const error = login.error instanceof ApiError ? login.error.message : null;

  return (
    <div>
      <Header title="Connexion" back />

      <form
        className="container stack"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          login.mutate();
        }}
      >
        <p className="subtitle">Retrouvez vos commandes, vos adresses et vos points de fidélité.</p>

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
            autoComplete="tel"
            placeholder="70 12 34 56"
            required
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
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={login.isPending}>
          {login.isPending ? 'Connexion…' : 'Se connecter'}
        </button>

        <Link to="/compte/inscription" className="btn btn--ghost btn--block">
          Créer un compte
        </Link>
      </form>
    </div>
  );
}

export function Register() {
  const navigate = useNavigate();
  const setSession = useSession((state) => state.setSession);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const register = useMutation({
    mutationFn: () => api.register({ name, phone, password }),
    onSuccess: (session) => {
      setSession(session);
      navigate('/compte', { replace: true });
    },
  });

  function validate(): boolean {
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = 'Indiquez votre nom.';
    if (!isValidBurkinaPhone(phone)) found.phone = 'Numéro burkinabè invalide (8 chiffres).';
    if (password.length < 6) found.password = 'Au moins 6 caractères.';
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  const error = register.error instanceof ApiError ? register.error.message : null;

  return (
    <div>
      <Header title="Créer un compte" back />

      <form
        className="container stack"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (validate()) register.mutate();
        }}
      >
        <p className="subtitle">
          Vos commandes passées sans compte seront rattachées automatiquement à ce numéro.
        </p>

        <div className="field">
          <label className="field__label" htmlFor="name">
            Nom complet
          </label>
          <input
            id="name"
            className={`input${errors.name ? ' input--error' : ''}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
          {errors.name && <span className="field__error">{errors.name}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="phone">
            Téléphone
          </label>
          <input
            id="phone"
            className={`input${errors.phone ? ' input--error' : ''}`}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="70 12 34 56"
          />
          {errors.phone && <span className="field__error">{errors.phone}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            className={`input${errors.password ? ' input--error' : ''}`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          {errors.password && <span className="field__error">{errors.password}</span>}
        </div>

        {error && (
          <div className="banner banner--danger" role="alert">
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={register.isPending}>
          {register.isPending ? 'Création…' : "S'inscrire"}
        </button>

        <Link to="/compte/connexion" className="btn btn--ghost btn--block">
          J'ai déjà un compte
        </Link>
      </form>
    </div>
  );
}
