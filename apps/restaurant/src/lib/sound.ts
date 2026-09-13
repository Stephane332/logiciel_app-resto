/**
 * Alerte sonore des nouvelles commandes.
 *
 * Synthétisée plutôt que chargée depuis un fichier : aucun octet à télécharger, aucune dépendance,
 * et le son fonctionne même quand le réseau est tombé — précisément le moment où le personnel doit
 * rester prévenu.
 *
 * Les navigateurs bloquent l'audio tant que l'utilisateur n'a pas interagi avec la page : le premier
 * clic de la session débloque le contexte, ce qui suffit en pratique puisqu'on se connecte d'abord.
 */
let context: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Deux notes montantes : assez distinctes pour percer le bruit d'une cuisine. */
export function playNewOrderChime(): void {
  const audio = ensureContext();
  if (!audio) return;

  const now = audio.currentTime;
  for (const [index, frequency] of [880, 1320].entries()) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const start = now + index * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  }
}

export function unlockSound(): void {
  ensureContext();
}
