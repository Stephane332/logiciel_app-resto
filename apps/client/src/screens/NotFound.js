import { jsx as _jsx } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { IconSearch } from '../components/Icons';
import { EmptyState } from '../components/ui';
export function NotFound() {
    return (_jsx(EmptyState, { icon: _jsx(IconSearch, { size: 28 }), title: "Page introuvable", description: "Ce lien ne m\u00E8ne nulle part. Le menu, lui, est toujours l\u00E0.", action: _jsx(Link, { to: "/", className: "btn btn--primary", children: "Retour \u00E0 l'accueil" }) }));
}
//# sourceMappingURL=NotFound.js.map