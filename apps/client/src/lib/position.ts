/**
 * La position du client, quand il accepte de la donner.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  La position aide le livreur à s'approcher. Le point de repère lui dit        │
 * │  où frapper. Les deux, pas l'un ou l'autre.                                  │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Ouahigouya n'a pas d'adressage postal exploitable : personne n'a de numéro de rue. Un bouton qui
 * envoie la position réelle fait donc gagner du temps à chaque livraison — mais il ne remplace pas
 * le repère, et c'est un point de conception, pas une précaution.
 *
 * Un GPS de téléphone se trompe couramment de trente à cinquante mètres — davantage sous un arbre,
 * entre deux murs, ou quand il n'a que le réseau mobile pour se situer. Cinquante mètres à
 * Ouahigouya, ce sont trois concessions. Un livreur envoyé sur un point sans repère sonnerait chez
 * le voisin et appellerait le client : on aurait remplacé une phrase par un appel.
 *
 * La précision voyage donc avec la position, et l'interface la traduit en mots plutôt qu'en mètres :
 * une position à deux kilomètres près est pire qu'une absence de position, parce qu'on lui fait
 * confiance.
 */

export interface Position {
  latitude: number;
  longitude: number;
  /** Rayon d'incertitude annoncé par le téléphone, en mètres. */
  accuracy: number;
}

export type EtatPosition =
  | { etat: 'inactif' }
  | { etat: 'recherche' }
  | { etat: 'obtenue'; position: Position }
  | { etat: 'refusee' }
  | { etat: 'indisponible'; message: string };

/** Au-delà, la position ne vaut pas la confiance qu'on lui accorderait. */
export const PRECISION_INUTILISABLE = 500;

/** Ce qu'on affiche au client, en français, sans lui parler de mètres. */
export function qualite(accuracy: number): 'bonne' | 'approximative' | 'insuffisante' {
  if (accuracy <= 50) return 'bonne';
  if (accuracy <= PRECISION_INUTILISABLE) return 'approximative';
  return 'insuffisante';
}

export function estDisponible(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Demande la position au téléphone.
 *
 * `enableHighAccuracy` allume le GPS plutôt que de se contenter du réseau : il faut quelques
 * secondes de plus, et c'est précisément ce qu'on veut ici — une position approximative obtenue
 * instantanément n'aiderait personne à trouver une porte.
 */
export function demanderPosition(): Promise<EtatPosition> {
  if (!estDisponible()) {
    return Promise.resolve({
      etat: 'indisponible',
      message: "Votre téléphone ne permet pas de partager sa position.",
    });
  }

  return new Promise((resoudre) => {
    navigator.geolocation.getCurrentPosition(
      (releve) =>
        resoudre({
          etat: 'obtenue',
          position: {
            latitude: releve.coords.latitude,
            longitude: releve.coords.longitude,
            accuracy: releve.coords.accuracy,
          },
        }),
      (erreur) => {
        // Le refus se distingue de la panne : on ne redemande pas la même chose dans les deux cas.
        if (erreur.code === erreur.PERMISSION_DENIED) {
          resoudre({ etat: 'refusee' });
          return;
        }
        resoudre({
          etat: 'indisponible',
          message:
            erreur.code === erreur.TIMEOUT
              ? "La position met trop de temps à venir. Décrivez plutôt un point de repère."
              : "Position introuvable pour l'instant. Décrivez plutôt un point de repère.",
        });
      },
      {
        enableHighAccuracy: true,
        // Quinze secondes : au-delà, le client a déjà renoncé et tapé son repère.
        timeout: 15_000,
        // Une position d'il y a une minute est encore la bonne : inutile de rallumer le GPS.
        maximumAge: 60_000,
      },
    );
  });
}
