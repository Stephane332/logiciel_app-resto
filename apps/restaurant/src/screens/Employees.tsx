/**
 * Employés et rôles.
 *
 * Distribuer des accès est une décision sensible : réservé à l'administrateur, journalisé côté
 * serveur, et impossible à retourner contre soi-même (l'API refuse qu'on modifie son propre rôle).
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ROLES, type Role } from '@savora/shared';
import { ApiError, staffApi, type Employee } from '@savora/api-client';
import { IconPlus } from '../components/Icons';
import { Empty, ErrorState, Loading, Modal, Switch, Tag } from '../components/ui';
import { roleLabel } from '../components/Shell';
import { queryClient, useEmployees } from '../lib/queries';
import { useSession } from '../lib/session';

const STAFF_ROLES = ROLES.filter((role) => role !== 'CLIENT');

const ROLE_HINTS: Record<string, string> = {
  KITCHEN: 'Voit et prépare les commandes. Ne peut pas modifier les prix.',
  CASHIER: 'Caisse, encaissement, remise au client, tables.',
  DELIVERY: 'Voit uniquement ses livraisons du jour.',
  MANAGER: 'Tout le service, plus le menu, les statistiques et les remboursements.',
  ADMIN: 'Accès complet, y compris les employés et l\'identité de la marque.',
};

export function Employees() {
  const { data, isLoading, isError, refetch } = useEmployees();
  const [adding, setAdding] = useState(false);
  const me = useSession((state) => state.user);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="La liste des employés est indisponible." onRetry={() => void refetch()} />;

  const employees = data?.employees ?? [];

  return (
    <div className="stack">
      <div className="row row--between">
        <h2 className="section-title">
          {employees.length} compte{employees.length > 1 ? 's' : ''}
        </h2>
        <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
          <IconPlus />
          Ajouter un employé
        </button>
      </div>

      {employees.length === 0 ? (
        <Empty title="Aucun employé" description="Créez les comptes de votre équipe pour leur donner accès." />
      ) : (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {employees.map((employee) => (
            <EmployeeRow key={employee.id} employee={employee} isSelf={employee.id === me?.id} />
          ))}
        </div>
      )}

      {adding && <EmployeeModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function EmployeeRow({ employee, isSelf }: { employee: Employee; isSelf: boolean }) {
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => staffApi.updateEmployee(employee.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  return (
    <div className="card row row--wrap" style={{ gap: 'var(--space-3)' }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ fontWeight: 700 }}>
          {employee.name} {isSelf && <Tag>vous</Tag>}
        </p>
        <p className="faint">{employee.phone}</p>
      </div>

      <select
        className="input"
        style={{ width: 170 }}
        value={employee.role}
        disabled={isSelf || update.isPending}
        aria-label={`Rôle de ${employee.name}`}
        onChange={(event) => update.mutate({ role: event.target.value as Role })}
      >
        {STAFF_ROLES.map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </select>

      <div style={{ minWidth: 150 }}>
        <Switch
          checked={employee.isActive}
          label={employee.isActive ? 'Actif' : 'Désactivé'}
          // Se désactiver soi-même est le meilleur moyen de se verrouiller dehors : l'API le
          // refuse, l'interface ne le propose même pas.
          disabled={isSelf || update.isPending}
          onChange={(value) => update.mutate({ isActive: value })}
        />
      </div>
    </div>
  );
}

function EmployeeModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('CASHIER');
  const [password, setPassword] = useState('');

  const create = useMutation({
    mutationFn: () => staffApi.createEmployee({ name: name.trim(), phone: phone.trim(), role, password }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
  });

  const error = create.error instanceof ApiError ? create.error.message : null;

  return (
    <Modal
      title="Nouvel employé"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={name.trim().length < 2 || phone.trim().length < 8 || password.length < 6 || create.isPending}
          onClick={() => create.mutate()}
        >
          Créer le compte
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="employee-name">
            Nom
          </label>
          <input
            id="employee-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="employee-phone">
            Téléphone
          </label>
          <input
            id="employee-phone"
            className="input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="70 12 34 56"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="employee-role">
            Rôle
          </label>
          <select
            id="employee-role"
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {STAFF_ROLES.map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </select>
          <span className="faint">{ROLE_HINTS[role]}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="employee-password">
            Mot de passe
          </label>
          <input
            id="employee-password"
            type="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <span className="faint">Six caractères minimum. À communiquer à l'employé.</span>
        </div>

        {error && <p className="field__error">{error}</p>}
      </div>
    </Modal>
  );
}
