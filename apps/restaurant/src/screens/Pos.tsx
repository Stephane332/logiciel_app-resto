/**
 * Caisse — commandes au comptoir et par téléphone.
 *
 * C'est l'ajout le plus important par rapport aux cahiers des charges d'origine, qui ne traitaient
 * que les commandes venues de l'application. Or dans un fast-food de Ouahigouya, l'essentiel des
 * commandes se prend au comptoir ou par téléphone. Sans cet écran :
 *   — la cuisine garderait son carnet papier en parallèle, donc deux systèmes et des oublis ;
 *   — le chiffre d'affaires du tableau de bord serait faux ;
 *   — les statistiques deviendraient inexploitables, donc ignorées (ADR 005).
 *
 * Contrainte de conception : saisir une commande en moins de trente secondes, debout, sous pression.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { computeCart, type OrderType, type PaymentMethod } from '@savora/shared';
import { ApiError, staffApi, type OptionGroup, type Product } from '@savora/api-client';
import { IconBag, IconBike, IconMinus, IconPlus, IconQr, IconSearch, IconTrash } from '../components/Icons';
import { Empty, ErrorState, Loading, Modal, Tag } from '../components/ui';
import { formatAmount, formatOrderNumber } from '../lib/format';
import { refreshOrders, useManageMenu, useTables } from '../lib/queries';

interface TicketLine {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  options: { id: string; name: string; priceDelta: number }[];
}

export function Pos() {
  const navigate = useNavigate();
  const menu = useManageMenu();
  const tables = useTables();

  const [lines, setLines] = useState<TicketLine[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<OrderType>('PICKUP');
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [lastOrder, setLastOrder] = useState<{ number: number; total: number } | null>(null);

  const categories = menu.data?.categories ?? [];

  const products = useMemo(() => {
    const query = search
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    const scope = category ? categories.filter((item) => item.slug === category) : categories;
    const all = scope.flatMap((item) => item.products);
    if (!query) return all;
    return all.filter((product) =>
      product.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .includes(query),
    );
  }, [categories, category, search]);

  const totals = computeCart({
    lines: lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      options: line.options,
    })),
  });

  const submit = useMutation({
    mutationFn: () =>
      staffApi.createOrder({
        type,
        // Le canal est déclaré ici : c'est lui qui rend le tableau de bord honnête.
        channel: 'COUNTER',
        paymentMethod: payment,
        expectedTotal: totals.total,
        lines: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          optionItemIds: line.options.map((option) => option.id),
        })),
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(type === 'DINE_IN' && tableId ? { tableToken: tableTokenFor(tableId) } : {}),
      }),
    onSuccess: ({ order }) => {
      setLastOrder({ number: order.dailyNumber, total: order.total });
      setLines([]);
      setCustomerName('');
      setCustomerPhone('');
      setTableId('');
      refreshOrders();
    },
  });

  /** Le jeton de table n'est pas exposé par l'API : on passe par l'URL du QR Code. */
  function tableTokenFor(id: string): string | undefined {
    const table = tables.data?.tables.find((item) => item.id === id);
    return table?.qrUrl.split('/t/')[1];
  }

  function addProduct(product: Product): void {
    // Un produit à choix obligatoire ouvre la fenêtre d'options ; les autres entrent directement
    // dans le ticket, en un seul geste.
    if (product.optionGroups.some((group) => group.minChoices > 0 || group.items.some((item) => item.priceDelta > 0))) {
      setConfiguring(product);
      return;
    }
    pushLine(product, []);
  }

  function pushLine(product: Product, options: { id: string; name: string; priceDelta: number }[]): void {
    const key = [product.id, ...options.map((option) => option.id).sort()].join('|');
    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line,
        );
      }
      return [
        ...current,
        { key, productId: product.id, name: product.name, unitPrice: product.price, quantity: 1, options },
      ];
    });
  }

  function setQuantity(key: string, quantity: number): void {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.key !== key)
        : current.map((line) => (line.key === key ? { ...line, quantity } : line)),
    );
  }

  if (menu.isLoading) return <Loading />;
  if (menu.isError) return <ErrorState message="Le menu est indisponible." onRetry={() => void menu.refetch()} />;

  const error = submit.error instanceof ApiError ? submit.error.message : null;
  const freeTables = tables.data?.tables.filter((table) => table.isActive) ?? [];

  return (
    <div className="pos">
      {/* --- Grille des produits --- */}
      <div className="stack">
        <div className="row row--wrap" style={{ gap: 'var(--space-3)' }}>
          <label className="row input" style={{ flex: 1, minWidth: 200, gap: 'var(--space-2)' }}>
            <IconSearch size={18} className="muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un produit…"
              aria-label="Rechercher un produit"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', minWidth: 0 }}
            />
          </label>
        </div>

        <div className="tabs">
          <button type="button" className="tab" aria-selected={category === null} onClick={() => setCategory(null)}>
            Tous
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tab"
              aria-selected={category === item.slug}
              onClick={() => setCategory(item.slug)}
            >
              {item.name}
            </button>
          ))}
        </div>

        {products.length === 0 ? (
          <Empty title="Aucun produit" description="Ajoutez des produits depuis l'écran Menu." />
        ) : (
          <div className="grid grid--products">
            {products.map((product) => {
              const orderable = product.isAvailable && (product.stock === null || product.stock === undefined || product.stock > 0);
              return (
                <button
                  key={product.id}
                  type="button"
                  className="pos-product"
                  disabled={!orderable}
                  onClick={() => addProduct(product)}
                >
                  <span className="pos-product__name">{product.name}</span>
                  <span className="price">{formatAmount(product.price)}</span>
                  {!orderable && <Tag variant="danger">Épuisé</Tag>}
                  {orderable && typeof product.stock === 'number' && product.stock <= 5 && (
                    <Tag variant="warning">Reste {product.stock}</Tag>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Ticket --- */}
      <div className="card pos-ticket">
        <div className="row row--between">
          <h2 className="section-title">Ticket</h2>
          {lines.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLines([])}>
              <IconTrash size={16} />
              Vider
            </button>
          )}
        </div>

        {lastOrder && lines.length === 0 && (
          <div className="banner banner--success">
            <div style={{ flex: 1 }}>
              Commande {formatOrderNumber(lastOrder.number)} envoyée en cuisine ·{' '}
              {formatAmount(lastOrder.total)}
            </div>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => navigate('/commandes')}>
              Voir
            </button>
          </div>
        )}

        <div className="pos-ticket__lines">
          {lines.length === 0 ? (
            <p className="faint">Touchez un produit pour l'ajouter.</p>
          ) : (
            lines.map((line) => (
              <div key={line.key} className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>{line.name}</p>
                  {line.options.length > 0 && (
                    <p className="faint">{line.options.map((option) => option.name).join(' · ')}</p>
                  )}
                  <p className="price">
                    {formatAmount(
                      (line.unitPrice + line.options.reduce((sum, option) => sum + option.priceDelta, 0)) *
                        line.quantity,
                    )}
                  </p>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setQuantity(line.key, line.quantity - 1)}
                    aria-label={`Retirer un ${line.name}`}
                  >
                    <IconMinus size={14} />
                  </button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{line.quantity}</span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setQuantity(line.key, line.quantity + 1)}
                    aria-label={`Ajouter un ${line.name}`}
                  >
                    <IconPlus size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="divider" />

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <ModeButton icon={<IconBag size={16} />} label="Emporter" active={type === 'PICKUP'} onClick={() => setType('PICKUP')} />
          <ModeButton icon={<IconQr size={16} />} label="Sur place" active={type === 'DINE_IN'} onClick={() => setType('DINE_IN')} />
          <ModeButton icon={<IconBike size={16} />} label="Livraison" active={type === 'DELIVERY'} onClick={() => setType('DELIVERY')} />
        </div>

        {type === 'DINE_IN' && (
          <select
            className="input"
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            aria-label="Table"
          >
            <option value="">Choisir une table…</option>
            {freeTables.map((table) => (
              <option key={table.id} value={table.id}>
                Table {table.number}
                {table.currentOrder ? ' (occupée)' : ''}
              </option>
            ))}
          </select>
        )}

        {/* Le client est facultatif : au comptoir, on ne demande pas son nom à quelqu'un qui paie
            et repart avec son sandwich. Il devient utile pour une commande par téléphone. */}
        <input
          className="input"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Nom du client (facultatif)"
          aria-label="Nom du client"
        />
        <input
          className="input"
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
          placeholder="Téléphone (facultatif)"
          inputMode="tel"
          aria-label="Téléphone du client"
        />

        <select
          className="input"
          value={payment}
          onChange={(event) => setPayment(event.target.value as PaymentMethod)}
          aria-label="Moyen de paiement"
        >
          <option value="CASH">Espèces</option>
          <option value="ORANGE_MONEY">Orange Money</option>
          <option value="MOOV_MONEY">Moov Money</option>
        </select>

        <div className="row row--between" style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>
          <span>Total</span>
          <span className="price" style={{ fontSize: 'var(--text-2xl)' }}>
            {formatAmount(totals.total)}
          </span>
        </div>

        {error && <p className="field__error">{error}</p>}

        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          disabled={lines.length === 0 || submit.isPending || (type === 'DINE_IN' && !tableId)}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? 'Envoi…' : 'Envoyer en cuisine'}
        </button>
      </div>

      {configuring && (
        <OptionsModal
          product={configuring}
          onClose={() => setConfiguring(null)}
          onConfirm={(options) => {
            pushLine(configuring, options);
            setConfiguring(null);
          }}
        />
      )}
    </div>
  );
}

function ModeButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn btn--sm ${active ? 'btn--primary' : 'btn--secondary'}`}
      style={{ flex: 1 }}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

/** Choix des options au comptoir : mêmes règles que côté client, revalidées par le serveur. */
function OptionsModal({
  product,
  onClose,
  onConfirm,
}: {
  product: Product;
  onClose: () => void;
  onConfirm: (options: { id: string; name: string; priceDelta: number }[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const chosen = product.optionGroups.flatMap((group) =>
    group.items.filter((item) => selected[group.id]?.includes(item.id)),
  );
  const missing = product.optionGroups.filter(
    (group) => (selected[group.id]?.length ?? 0) < group.minChoices,
  );

  function toggle(group: OptionGroup, itemId: string): void {
    setSelected((current) => {
      const existing = current[group.id] ?? [];
      if (existing.includes(itemId)) {
        return { ...current, [group.id]: existing.filter((id) => id !== itemId) };
      }
      if (group.maxChoices === 1) return { ...current, [group.id]: [itemId] };
      if (existing.length >= group.maxChoices) return current;
      return { ...current, [group.id]: [...existing, itemId] };
    });
  }

  return (
    <Modal
      title={product.name}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          disabled={missing.length > 0}
          onClick={() =>
            onConfirm(
              chosen.map((item) => ({ id: item.id, name: item.name, priceDelta: item.priceDelta })),
            )
          }
        >
          Ajouter ·{' '}
          {formatAmount(product.price + chosen.reduce((sum, item) => sum + item.priceDelta, 0))}
        </button>
      }
    >
      <div className="stack">
        {product.optionGroups.map((group) => (
          <section key={group.id} className="stack" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <h3 style={{ fontWeight: 700 }}>{group.name}</h3>
              {group.minChoices > 0 && <Tag variant="brand">Obligatoire</Tag>}
            </div>
            <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
              {group.items.map((item) => {
                const isChosen = selected[group.id]?.includes(item.id) ?? false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`btn btn--sm ${isChosen ? 'btn--primary' : 'btn--secondary'}`}
                    disabled={!item.isAvailable}
                    onClick={() => toggle(group, item.id)}
                  >
                    {item.name}
                    {item.priceDelta > 0 && ` +${formatAmount(item.priceDelta)}`}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
