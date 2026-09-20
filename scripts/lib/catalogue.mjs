/**
 * Garantit qu'il y a des plats à commander.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Le jeu de démarrage ne contient aucun plat, et c'est voulu.                  │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Le catalogue appartient au restaurant : c'est lui qui saisit ses plats, ses prix et ses photos.
 * Livrer un logiciel prérempli de « Double Cheese » obligerait chaque restaurateur à commencer par
 * effacer le travail de quelqu'un d'autre.
 *
 * Conséquence pour les vérifications : sur une base fraîchement amorcée, il n'y a rien à mettre au
 * panier, et une suite qui suppose un catalogue échoue sur une absence de données au lieu de dire
 * quelque chose sur le logiciel. Ce module saisit donc deux plats **par l'API du gérant**, comme le
 * ferait un restaurateur — et ne touche à rien si le catalogue existe déjà.
 *
 * Les prix sont des entiers de francs CFA (ADR 003) : jamais de décimales, jamais de flottants.
 */

/** Saisit deux plats si le catalogue est vide. Renvoie le nombre de plats disponibles. */
export async function garantirCatalogue(api, { telephone = '+22670000001', motDePasse = 'savora2026' } = {}) {
  const lire = async () => (await fetch(`${api}/menu`)).json();

  let menu = await lire();
  let plats = menu.categories.flatMap((c) => c.products);
  if (plats.length > 0) return plats.length;

  const connexion = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: telephone, password: motDePasse }),
  });
  if (!connexion.ok) {
    throw new Error(
      `Impossible de se connecter pour saisir le catalogue (HTTP ${connexion.status}). ` +
        "La base est-elle amorcée ? npm run db:seed",
    );
  }
  const { accessToken } = await connexion.json();
  const entetes = { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` };

  const { category } = await (
    await fetch(`${api}/menu/categories`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({ name: 'Burgers', position: 0 }),
    })
  ).json();

  for (const [name, price] of [
    ['Double Cheese', 3500],
    ['Chicken Burger', 2800],
  ]) {
    const reponse = await fetch(`${api}/menu/products`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({ categoryId: category.id, name, price, position: 0 }),
    });
    if (!reponse.ok) throw new Error(`Saisie de « ${name} » refusée : HTTP ${reponse.status}`);
  }

  menu = await lire();
  plats = menu.categories.flatMap((c) => c.products);
  if (plats.length === 0) throw new Error("Le catalogue reste vide après saisie : l'API a-t-elle changé ?");
  return plats.length;
}
