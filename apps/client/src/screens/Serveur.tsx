/**
 * Premier écran de l'application installée, lorsqu'elle ne sait pas encore où est son serveur.
 *
 * Il n'apparaît jamais à un client : dans un APK construit avec l'adresse de son restaurant, il ne
 * se déclenche pas, et sur le web l'adresse relative suffit toujours. Il n'existe que pour une
 * situation précise et temporaire — un APK construit avant qu'un domaine n'existe, qu'on veut
 * pouvoir essayer dès maintenant contre un serveur de test.
 *
 * C'est précisément la différence entre un APK qu'on peut installer et regarder vide, et un APK
 * qu'on peut essayer.
 */
import { useState } from 'react';
import { SavoraMark } from '../components/Icons';
import { enregistrerServeur } from '../lib/server';

export function Serveur() {
  const [adresse, setAdresse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  function valider() {
    if (!enregistrerServeur(adresse)) {
      setErreur('Adresse invalide. Exemple : 192.168.1.12:4000');
      return;
    }
    // Rechargement plutôt que navigation : toute l'application lit l'adresse au démarrage, et la
    // relire proprement vaut mieux que la propager à la main dans chaque module.
    window.location.reload();
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-5)',
        background: 'var(--brand-ink)',
      }}
    >
      <main className="card stack" style={{ width: '100%', maxWidth: 420, gap: 'var(--space-5)' }}>
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <SavoraMark size={48} />
          <div>
            <strong style={{ fontSize: 'var(--text-lg)' }}>Savora</strong>
            <p className="faint">Première mise en route</p>
          </div>
        </div>

        <div>
          <h1 className="title" style={{ fontSize: 'var(--text-xl)' }}>
            À quelle adresse se trouve le restaurant&nbsp;?
          </h1>
          <p className="subtitle" style={{ marginTop: 'var(--space-2)' }}>
            Vous ne la saisirez qu'une fois. L'application s'en souviendra.
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="serveur">
            Adresse du serveur
          </label>
          <input
            id="serveur"
            className={`input${erreur ? ' input--error' : ''}`}
            value={adresse}
            onChange={(event) => {
              setAdresse(event.target.value);
              setErreur(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') valider();
            }}
            placeholder="192.168.1.12:4000"
            autoComplete="off"
            autoCapitalize="none"
            autoFocus
          />
          {erreur ? (
            <span className="field__error">{erreur}</span>
          ) : (
            <span className="field__hint">
              Inutile d'écrire « https:// ». Pour un essai sur le même réseau, l'adresse de
              l'ordinateur qui fait tourner le serveur suffit.
            </span>
          )}
        </div>

        <button type="button" className="btn btn--primary btn--block" onClick={valider}>
          Se connecter
        </button>
      </main>
    </div>
  );
}
