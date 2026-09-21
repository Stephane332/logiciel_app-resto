/**
 * Routage.
 *
 * Chaque écran a une URL propre et partageable : un produit envoyé dans une story TikTok ou un
 * groupe WhatsApp doit ouvrir ce produit, pas l'accueil (§ 2.3 du cahier des charges).
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Serveur } from './screens/Serveur';
import { serveurManquant, serveurEnregistreRepond } from './lib/server';
import { Loading } from './components/ui';
import { useRestaurant } from './lib/queries';
import { Home } from './screens/Home';
import { Menu } from './screens/Menu';
import { Product } from './screens/Product';
import { Cart } from './screens/Cart';

// Les écrans rarement ouverts au premier lancement sont chargés à la demande : le premier
// affichage sur 3G se paie en secondes d'attente.
const Checkout = lazy(() => import('./screens/Checkout').then((m) => ({ default: m.Checkout })));
const OrderTracking = lazy(() => import('./screens/OrderTracking').then((m) => ({ default: m.OrderTracking })));
const Payment = lazy(() => import('./screens/Payment').then((m) => ({ default: m.Payment })));
const Orders = lazy(() => import('./screens/Orders').then((m) => ({ default: m.Orders })));
const Account = lazy(() => import('./screens/Account').then((m) => ({ default: m.Account })));
const Login = lazy(() => import('./screens/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./screens/Login').then((m) => ({ default: m.Register })));
const Favorites = lazy(() => import('./screens/Favorites').then((m) => ({ default: m.Favorites })));
const Loyalty = lazy(() => import('./screens/Loyalty').then((m) => ({ default: m.Loyalty })));
const Notifications = lazy(() => import('./screens/Notifications').then((m) => ({ default: m.Notifications })));
const Help = lazy(() => import('./screens/Help').then((m) => ({ default: m.Help })));
const TableEntry = lazy(() => import('./screens/TableEntry').then((m) => ({ default: m.TableEntry })));
const NotFound = lazy(() => import('./screens/NotFound').then((m) => ({ default: m.NotFound })));

/** Remet la page en haut à chaque navigation : sans cela, on arrive au milieu de l'écran suivant. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

/**
 * Applique les couleurs de la marque enregistrées en base.
 * C'est ce qui rend l'identité modifiable sans redéploiement (ADR 004).
 */
function BrandTheme() {
  const { data } = useRestaurant();

  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    // Seules les deux couleurs de marque sont surchargées. Le fond, lui, reste le papier de
    // Savora : laisser un restaurant repeindre l'arrière-plan de l'application, c'est lui laisser
    // la possibilité de rendre son propre menu illisible — et le texte, les ombres et les états
    // sont accordés à ce papier, pas à une couleur arbitraire.
    root.style.setProperty('--brand-primary', data.restaurant.primaryColor);
    root.style.setProperty('--brand-ink', data.restaurant.backgroundColor);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', '#fbf8f3');
  }, [data]);

  return null;
}

export function App() {
  /*
   * Le serveur enregistré répond-il encore ?
   *
   * ┌──────────────────────────────────────────────────────────────────────────────┐
   * │  Une adresse fausse enregistrée une fois laissait l'application morte.        │
   * └──────────────────────────────────────────────────────────────────────────────┘
   *
   * L'écran de saisie ne s'affichait que faute d'adresse retenue. Une adresse enregistrée avant que
   * la vérification n'existe, un PC de caisse qui change d'adresse sur le réseau, un serveur
   * éteint : trois cas ordinaires où l'application chargeait dans le vide sans jamais reproposer la
   * question. Un écran blanc dont aucun rechargement ne sort.
   *
   * `null` pendant l'essai, et pendant ce temps on n'affiche rien de définitif : afficher l'accueil
   * puis le remplacer par l'écran de saisie donnerait un clignotement à chaque ouverture.
   */
  const [repond, setRepond] = useState<boolean | null | 'inutile'>(null);
  useEffect(() => {
    let vivant = true;
    void serveurEnregistreRepond().then((verdict) => {
      if (vivant) setRepond(verdict === null ? 'inutile' : verdict);
    });
    return () => {
      vivant = false;
    };
  }, []);

  /*
   * Application installée qui ne sait pas où est son serveur : on le demande avant tout le reste.
   * Charger l'accueil d'abord afficherait un menu vide et une erreur réseau — le symptôme, jamais
   * la cause. Ce cas n'existe pas sur le web ni dans un APK construit avec son adresse.
   */
  if (serveurManquant()) return <Serveur />;
  if (repond === null) return <Loading />;
  if (repond === false) return <Serveur injoignable />;

  return (
    <>
      <ScrollToTop />
      <BrandTheme />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/menu/:categorySlug" element={<Menu />} />
            <Route path="/produit/:slug" element={<Product />} />
            <Route path="/panier" element={<Cart />} />
            <Route path="/commander" element={<Checkout />} />
            <Route path="/commande/:id" element={<OrderTracking />} />
            <Route path="/commande/:id/paiement" element={<Payment />} />
            <Route path="/commandes" element={<Orders />} />
            <Route path="/compte" element={<Account />} />
            <Route path="/compte/connexion" element={<Login />} />
            <Route path="/compte/inscription" element={<Register />} />
            <Route path="/favoris" element={<Favorites />} />
            <Route path="/fidelite" element={<Loyalty />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/aide" element={<Help />} />
            <Route path="/t/:token" element={<TableEntry />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
