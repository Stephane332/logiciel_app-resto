/**
 * Lance la plateforme entière et dit comment l'atteindre depuis un téléphone.
 *
 * Écrit parce qu'un projet qu'on ne peut pas essayer n'existe pas vraiment. Trois serveurs à
 * démarrer, une adresse réseau à retrouver, un port à deviner : à chaque étape on peut s'arrêter,
 * et c'est ce qui était arrivé — ni l'APK, ni l'exe, ni la PWA n'avaient jamais été essayés.
 *
 * Une commande, et l'écran affiche exactement ce qu'il faut taper sur le téléphone.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

/** Adresse de cette machine sur le réseau local — celle que le téléphone doit viser. */
function adresseLocale() {
  for (const cartes of Object.values(networkInterfaces())) {
    for (const carte of cartes ?? []) {
      if (carte.family === 'IPv4' && !carte.internal) return carte.address;
    }
  }
  return null;
}

const ip = adresseLocale();
const services = [
  ['API', 'dev', 4000],
  ['Application cliente', 'dev:client', 5173],
  ['Logiciel restaurant', 'dev:restaurant', 5174],
];

for (const [, script] of services) {
  spawn('npm', ['run', script], { stdio: 'inherit', shell: false });
}

setTimeout(() => {
  const l = (t) => console.log(t);
  l('');
  l('══════════════════════════════════════════════════════════════');
  l('  Savora tourne.');
  l('══════════════════════════════════════════════════════════════');
  l('');
  l('  Sur cet ordinateur');
  services.forEach(([nom, , port]) => l(`    ${nom.padEnd(22)} http://localhost:${port}`));
  l('');

  if (ip) {
    l('  Depuis un téléphone sur le même réseau Wi-Fi');
    l(`    Application cliente    http://${ip}:5173`);
    l(`    Logiciel restaurant    http://${ip}:5174`);
    l('');
    l('  Pour un APK à connecter à ce serveur, saisissez au premier lancement :');
    l(`    ${ip}:4000`);
    l('');
    l('  À savoir : Android ne propose « Installer » que sur une adresse sécurisée.');
    l('  Sur ce réseau local, la PWA s\'utilise dans le navigateur mais ne s\'installe');
    l('  pas — il faut un domaine en HTTPS pour cela.');
  } else {
    l('  Aucune adresse réseau détectée : cette machine est isolée.');
    l('  Un téléphone ne pourra pas l\'atteindre.');
  }

  l('');
  l('  Connexion au logiciel   70 00 00 01   ·   mot de passe   savora2026');
  l('  Le catalogue est vide : Menu → Ajouter un plat.');
  l('');
  l('══════════════════════════════════════════════════════════════');
}, 9000);
