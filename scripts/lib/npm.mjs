/**
 * Lancer npm depuis un script, sur n'importe quelle plate-forme.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Sous Windows, npm s'appelle npm.cmd — et Node refuse de lancer un .cmd.      │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * `spawnSync('npm', …)` ne trouve rien sous Windows : le fichier s'appelle `npm.cmd`. Mais le
 * nommer ne suffit pas non plus — Node refuse de lancer un `.cmd` sans interpréteur, par protection
 * contre l'injection de commandes :
 *
 *     Error: spawnSync npm.cmd EINVAL
 *
 * `shell: true` lèverait l'interdit, au prix des ennuis de guillemets sur les chemins à espaces — et
 * « C:\\Program Files » en contient. On contourne par la racine : `npm.cmd` n'est qu'un lanceur
 * autour d'un fichier JavaScript, et ce fichier, Node sait l'exécuter directement. Pas
 * d'interpréteur, pas de guillemets, pas de différence entre les plates-formes.
 *
 * ── Pourquoi ce fichier existe ──
 *
 * Cette leçon a été payée deux fois. La première dans l'assemblage du serveur embarqué ; la seconde
 * en ajoutant la construction de l'application cliente au même endroit, où j'ai réécrit
 * `spawnSync('npm', …)` sans y penser. L'installateur a échoué en six millisecondes, chez le client,
 * sur une machine Windows que je n'ai pas. Une solution recopiée est une solution qu'on réapprend ;
 * mise en commun, elle ne se réapprend plus.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Le fichier JavaScript de npm, à côté du Node qui exécute ce script. */
export function fichierNpm() {
  const racineNode = dirname(process.execPath);
  const candidats = [
    // Windows : npm est installé à côté de node.exe.
    join(racineNode, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    // Unix : node est dans bin/, npm un niveau au-dessus.
    join(racineNode, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(racineNode, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const trouve = candidats.find((chemin) => existsSync(chemin));
  if (!trouve) throw new Error(`npm est introuvable à côté de ${process.execPath}.`);
  return trouve;
}

/**
 * Lance npm avec ces arguments. Lève une erreur qui dit ce qui s'est passé.
 *
 * `resultat.error` est renseigné quand le lancement lui-même échoue — et c'est le cas le plus
 * déroutant, parce que le code de sortie vaut alors `null`. Un outil qui annonce « a échoué (code
 * null) » fait perdre le temps qu'il devrait faire gagner : il faut dire *pourquoi*.
 */
export function lancerNpm(arguments_, options = {}) {
  const resultat = spawnSync(process.execPath, [fichierNpm(), ...arguments_], {
    stdio: 'inherit',
    ...options,
  });
  if (resultat.error) {
    throw new Error(`npm ${arguments_.join(' ')} n'a pas pu être lancé : ${resultat.error.message}`);
  }
  if (resultat.status !== 0) {
    throw new Error(`npm ${arguments_.join(' ')} a échoué (code ${resultat.status}).`);
  }
  return resultat;
}
