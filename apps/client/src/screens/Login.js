import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Connexion et inscription.
 *
 * Volontairement en retrait dans le parcours : commander ne l'exige pas. Un compte sert à retrouver
 * son historique et à cumuler des points, pas à franchir un péage avant de manger (§ 2.2).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { isValidBurkinaPhone } from '@barabite/shared';
import { Header } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session';
export function Login() {
    const navigate = useNavigate();
    const setSession = useSession((state) => state.setSession);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const login = useMutation({
        mutationFn: () => api.login({ phone, password }),
        onSuccess: (session) => {
            setSession(session);
            navigate('/compte', { replace: true });
        },
    });
    const error = login.error instanceof ApiError ? login.error.message : null;
    return (_jsxs("div", { children: [_jsx(Header, { title: "Connexion", back: true }), _jsxs("form", { className: "container stack", onSubmit: (event) => {
                    event.preventDefault();
                    login.mutate();
                }, children: [_jsx("p", { className: "subtitle", children: "Retrouvez vos commandes, vos adresses et vos points de fid\u00E9lit\u00E9." }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "phone", children: "T\u00E9l\u00E9phone" }), _jsx("input", { id: "phone", className: "input", value: phone, onChange: (event) => setPhone(event.target.value), inputMode: "tel", autoComplete: "tel", placeholder: "70 12 34 56", required: true })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "password", children: "Mot de passe" }), _jsx("input", { id: "password", type: "password", className: "input", value: password, onChange: (event) => setPassword(event.target.value), autoComplete: "current-password", required: true })] }), error && (_jsx("div", { className: "banner banner--danger", role: "alert", children: _jsx("span", { children: error }) })), _jsx("button", { type: "submit", className: "btn btn--primary btn--block", disabled: login.isPending, children: login.isPending ? 'Connexion…' : 'Se connecter' }), _jsx(Link, { to: "/compte/inscription", className: "btn btn--ghost btn--block", children: "Cr\u00E9er un compte" })] })] }));
}
export function Register() {
    const navigate = useNavigate();
    const setSession = useSession((state) => state.setSession);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});
    const register = useMutation({
        mutationFn: () => api.register({ name, phone, password }),
        onSuccess: (session) => {
            setSession(session);
            navigate('/compte', { replace: true });
        },
    });
    function validate() {
        const found = {};
        if (name.trim().length < 2)
            found.name = 'Indiquez votre nom.';
        if (!isValidBurkinaPhone(phone))
            found.phone = 'Numéro burkinabè invalide (8 chiffres).';
        if (password.length < 6)
            found.password = 'Au moins 6 caractères.';
        setErrors(found);
        return Object.keys(found).length === 0;
    }
    const error = register.error instanceof ApiError ? register.error.message : null;
    return (_jsxs("div", { children: [_jsx(Header, { title: "Cr\u00E9er un compte", back: true }), _jsxs("form", { className: "container stack", onSubmit: (event) => {
                    event.preventDefault();
                    if (validate())
                        register.mutate();
                }, children: [_jsx("p", { className: "subtitle", children: "Vos commandes pass\u00E9es sans compte seront rattach\u00E9es automatiquement \u00E0 ce num\u00E9ro." }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "name", children: "Nom complet" }), _jsx("input", { id: "name", className: `input${errors.name ? ' input--error' : ''}`, value: name, onChange: (event) => setName(event.target.value), autoComplete: "name" }), errors.name && _jsx("span", { className: "field__error", children: errors.name })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "phone", children: "T\u00E9l\u00E9phone" }), _jsx("input", { id: "phone", className: `input${errors.phone ? ' input--error' : ''}`, value: phone, onChange: (event) => setPhone(event.target.value), inputMode: "tel", autoComplete: "tel", placeholder: "70 12 34 56" }), errors.phone && _jsx("span", { className: "field__error", children: errors.phone })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field__label", htmlFor: "password", children: "Mot de passe" }), _jsx("input", { id: "password", type: "password", className: `input${errors.password ? ' input--error' : ''}`, value: password, onChange: (event) => setPassword(event.target.value), autoComplete: "new-password" }), errors.password && _jsx("span", { className: "field__error", children: errors.password })] }), error && (_jsx("div", { className: "banner banner--danger", role: "alert", children: _jsx("span", { children: error }) })), _jsx("button", { type: "submit", className: "btn btn--primary btn--block", disabled: register.isPending, children: register.isPending ? 'Création…' : "S'inscrire" }), _jsx(Link, { to: "/compte/connexion", className: "btn btn--ghost btn--block", children: "J'ai d\u00E9j\u00E0 un compte" })] })] }));
}
//# sourceMappingURL=Login.js.map