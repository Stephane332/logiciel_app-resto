import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Notifications reçues. */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconBell } from '../components/Icons';
import { EmptyState, Header, Loading } from '../components/ui';
import { api } from '../lib/api';
import { formatRelative } from '../lib/format';
import { useNotifications } from '../lib/queries';
import { useSession } from '../lib/session';
export function Notifications() {
    const user = useSession((state) => state.user);
    const { data, isLoading } = useNotifications(Boolean(user));
    // Marquées comme lues à l'ouverture : un compteur qui ne redescend jamais finit ignoré.
    useEffect(() => {
        if (user && (data?.unread ?? 0) > 0)
            void api.markNotificationsRead().catch(() => undefined);
    }, [user, data?.unread]);
    if (!user) {
        return (_jsxs("div", { children: [_jsx(Header, { title: "Notifications", back: true }), _jsx(EmptyState, { icon: _jsx(IconBell, { size: 28 }), title: "Suivez vos commandes", description: "Connectez-vous pour \u00EAtre pr\u00E9venu \u00E0 chaque \u00E9tape de votre commande.", action: _jsx(Link, { to: "/compte/connexion", className: "btn btn--primary", children: "Se connecter" }) })] }));
    }
    if (isLoading)
        return _jsx(Loading, { rows: 3 });
    const notifications = data?.notifications ?? [];
    return (_jsxs("div", { children: [_jsx(Header, { title: "Notifications", back: true }), notifications.length === 0 ? (_jsx(EmptyState, { icon: _jsx(IconBell, { size: 28 }), title: "Rien pour le moment" })) : (_jsx("div", { className: "container stack", children: notifications.map((notification) => (_jsxs("article", { className: "card", style: {
                        borderColor: notification.readAt ? 'var(--border)' : 'var(--brand-primary)',
                    }, children: [_jsx("p", { style: { fontWeight: 700 }, children: notification.title }), _jsx("p", { className: "subtitle", style: { marginTop: 2 }, children: notification.body }), _jsx("p", { className: "faint", style: { marginTop: 'var(--space-2)' }, children: formatRelative(notification.createdAt) })] }, notification.id))) }))] }));
}
//# sourceMappingURL=Notifications.js.map