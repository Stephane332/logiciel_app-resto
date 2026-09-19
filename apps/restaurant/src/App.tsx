/**
 * Routage du logiciel restaurant.
 *
 * Chaque écran exige une permission. Le masquage dans la barre latérale est une politesse ; le refus
 * est prononcé par le serveur à chaque requête.
 */
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { can, homeFor, type Ability } from '@savora/shared';
import { Shell } from './components/Shell';
import { Loading } from './components/ui';
import { useSession } from './lib/session';
import { useRestaurant } from './lib/queries';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Orders } from './screens/Orders';

const Pos = lazy(() => import('./screens/Pos').then((m) => ({ default: m.Pos })));
const Kitchen = lazy(() => import('./screens/Kitchen').then((m) => ({ default: m.Kitchen })));
const Tables = lazy(() => import('./screens/Tables').then((m) => ({ default: m.Tables })));
const PaymentsToVerify = lazy(() => import('./screens/PaymentsToVerify').then((m) => ({ default: m.PaymentsToVerify })));
const MenuManage = lazy(() => import('./screens/MenuManage').then((m) => ({ default: m.MenuManage })));
const Stats = lazy(() => import('./screens/Stats').then((m) => ({ default: m.Stats })));
const Employees = lazy(() => import('./screens/Employees').then((m) => ({ default: m.Employees })));
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })));
const Commission = lazy(() => import('./screens/Commission').then((m) => ({ default: m.Commission })));
const Deliveries = lazy(() => import('./screens/Deliveries').then((m) => ({ default: m.Deliveries })));

/** Applique les couleurs enregistrées en base : la marque est une donnée (ADR 004). */
function BrandTheme() {
  const { data } = useRestaurant();
  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', data.restaurant.primaryColor);
    root.style.setProperty('--brand-ink', data.restaurant.backgroundColor);
  }, [data]);
  return null;
}

/**
 * Un écran interdit ne renvoie pas vers l'accueil, mais vers l'accueil **de ce rôle**.
 *
 * La nuance a une histoire : le tableau de bord n'était protégé par rien, et toutes les
 * redirections y menaient. La cuisine et le livreur y arrivaient donc — et y lisaient le chiffre
 * d'affaires du restaurant. Renvoyer vers `homeFor` évite aussi le pire cas : être expédié sur un
 * écran qui vous refuse à son tour.
 */
function RequireAbility({ ability, children }: { ability: Ability; children: React.ReactNode }) {
  const user = useSession((state) => state.user);
  if (!user) return <Navigate to="/connexion" replace />;
  if (!can(user.role, ability)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export function App() {
  const user = useSession((state) => state.user);

  if (!user) {
    return (
      <Routes>
        <Route path="/connexion" element={<Login />} />
        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <BrandTheme />
      <Suspense fallback={<div className="content"><Loading /></div>}>
        <Routes>
          <Route path="/connexion" element={<Navigate to={homeFor(user.role)} replace />} />
          <Route element={<Shell />}>
            <Route
              path="/"
              element={
                <RequireAbility ability="dashboard:read">
                  <Dashboard />
                </RequireAbility>
              }
            />
            <Route
              path="/livraisons"
              element={
                <RequireAbility ability="order:deliver">
                  <Deliveries />
                </RequireAbility>
              }
            />
            <Route
              path="/caisse"
              element={
                <RequireAbility ability="cashier:register">
                  <Pos />
                </RequireAbility>
              }
            />
            <Route
              path="/commandes"
              element={
                <RequireAbility ability="order:read:all">
                  <Orders />
                </RequireAbility>
              }
            />
            <Route
              path="/cuisine"
              element={
                <RequireAbility ability="order:prepare">
                  <Kitchen />
                </RequireAbility>
              }
            />
            <Route
              path="/paiements"
              element={
                <RequireAbility ability="payment:collect">
                  <PaymentsToVerify />
                </RequireAbility>
              }
            />
            <Route
              path="/commission"
              element={
                <RequireAbility ability="commission:read">
                  <Commission />
                </RequireAbility>
              }
            />
            <Route
              path="/tables"
              element={
                <RequireAbility ability="table:read">
                  <Tables />
                </RequireAbility>
              }
            />
            <Route
              path="/menu"
              element={
                <RequireAbility ability="menu:read">
                  <MenuManage />
                </RequireAbility>
              }
            />
            <Route
              path="/statistiques"
              element={
                <RequireAbility ability="stats:read">
                  <Stats />
                </RequireAbility>
              }
            />
            <Route
              path="/employes"
              element={
                <RequireAbility ability="employee:write">
                  <Employees />
                </RequireAbility>
              }
            />
            <Route
              path="/parametres"
              element={
                <RequireAbility ability="settings:write">
                  <Settings />
                </RequireAbility>
              }
            />
            <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
