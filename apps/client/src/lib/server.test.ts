/**
 * L'adresse du serveur : la seule chose que l'application demande jamais.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Une adresse mal normalisée donne une application vide, sans message.         │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Tout ce qui n'était pas préfixé partait en `https://`. L'exemple affiché sous le champ —
 * « 192.168.1.12:4000 » — devenait donc une adresse TLS vers un serveur qui n'écoute qu'en clair :
 * tous les appels échouaient, et l'écran restait blanc. C'est le premier défaut rencontré par la
 * première personne qui a essayé l'application publiée.
 */
import { describe, it, expect } from 'vitest';
import { normaliser } from './server';

describe("l'adresse du serveur", () => {
  it('envoie une adresse de réseau local en clair, pas en TLS', () => {
    // Un PC de caisse n'a pas de certificat : le viser en « https » ne peut aboutir nulle part.
    expect(normaliser('192.168.1.12:4000')).toBe('http://192.168.1.12:4000');
    expect(normaliser('10.0.0.5:4000')).toBe('http://10.0.0.5:4000');
    expect(normaliser('127.0.0.1:4000')).toBe('http://127.0.0.1:4000');
  });

  it('traite un nom de machine sans point comme une machine du réseau local', () => {
    // « caisse », « serveur-cuisine » : un nom que seul le réseau du restaurant résout.
    expect(normaliser('caisse:4000')).toBe('http://caisse:4000');
    expect(normaliser('serveur-cuisine')).toBe('http://serveur-cuisine');
  });

  it('envoie un vrai nom de domaine en TLS', () => {
    expect(normaliser('monresto.bf')).toBe('https://monresto.bf');
    expect(normaliser('chez-awa.tondomaine.bf')).toBe('https://chez-awa.tondomaine.bf');
  });

  it('respecte le protocole quand il est écrit', () => {
    // Celui qui prend la peine de l'écrire sait ce qu'il fait : on ne le corrige pas.
    expect(normaliser('http://monresto.bf')).toBe('http://monresto.bf');
    expect(normaliser('https://192.168.1.12:4000')).toBe('https://192.168.1.12:4000');
  });

  it('refuse ce qui ne peut pas être une adresse', () => {
    expect(normaliser('')).toBe('');
    expect(normaliser('   ')).toBe('');
    expect(normaliser('http://')).toBe('');
  });

  it('laisse tomber ce qui suit le nom de machine', () => {
    // Une adresse de serveur est une origine, pas un chemin : le reste n'a rien à faire en mémoire.
    expect(normaliser('monresto.bf/menu?x=1')).toBe('https://monresto.bf');
  });
});
