import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Entrée par QR Code de table.
 *
 * La fonction la plus sensible du produit : un client assis scanne le code posé sur sa table avec
 * l'appareil photo de son téléphone, et le menu doit s'ouvrir **immédiatement**, sans installation,
 * sans compte, sans explication. C'est ce qui décide si les gens utilisent l'application ou
 * repartent chercher un serveur (ADR 001).
 */
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { IconQr } from '../components/Icons';
import { EmptyState, Loading } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useCart } from '../lib/cart';
import { useSession } from '../lib/session';
export function TableEntry() {
    const { token } = useParams();
    const navigate = useNavigate();
    const deviceId = useSession((state) => state.deviceId);
    const setTable = useCart((state) => state.setTable);
    const resolve = useMutation({
        mutationFn: () => api.resolveTable(token, deviceId),
        onSuccess: ({ table, session }) => {
            setTable({ token: token, number: table.number, expiresAt: session.expiresAt });
            navigate('/menu', { replace: true });
        },
    });
    const { mutate } = resolve;
    useEffect(() => {
        if (token)
            mutate();
    }, [token, mutate]);
    if (resolve.isError) {
        const error = resolve.error instanceof ApiError ? resolve.error : null;
        return (_jsx(EmptyState, { icon: _jsx(IconQr, { size: 28 }), title: "QR Code non valide", description: error?.isOffline
                ? 'Pas de connexion. Réessayez une fois le réseau revenu.'
                : (error?.message ?? 'Demandez au personnel de vérifier le code de la table.'), action: _jsxs("div", { className: "row", style: { gap: 'var(--space-2)' }, children: [_jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => resolve.mutate(), children: "R\u00E9essayer" }), _jsx(Link, { to: "/menu", className: "btn btn--primary", children: "Voir le menu" })] }) }));
    }
    return (_jsx("div", { style: { display: 'grid', placeItems: 'center', minHeight: '60dvh' }, children: _jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-state__icon", style: { color: 'var(--brand-primary)' }, children: _jsx(IconQr, { size: 28 }) }), _jsx("p", { className: "section-title", children: "Reconnaissance de votre table\u2026" }), _jsx(Loading, { rows: 0 })] }) }));
}
//# sourceMappingURL=TableEntry.js.map