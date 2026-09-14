/** Briques d'interface communes : en-tête, états, image, étiquettes. */
import type { ReactNode } from 'react';
export declare function Header({ title, back, actions, }: {
    title: ReactNode;
    back?: boolean | (() => void);
    actions?: ReactNode;
}): import("react").JSX.Element;
/**
 * Image de produit avec repli.
 * Le restaurant n'aura pas une photo pour chaque produit dès le premier jour : un badge sobre vaut
 * mieux qu'un carré vide ou une icône d'image cassée.
 */
export declare function ProductImage({ src, alt }: {
    src: string | null;
    alt: string;
}): import("react").JSX.Element;
export declare function EmptyState({ icon, title, description, action, }: {
    icon: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}): import("react").JSX.Element;
export declare function Loading({ rows }: {
    rows?: number;
}): import("react").JSX.Element;
export declare function ErrorState({ message, onRetry }: {
    message: string;
    onRetry?: () => void;
}): import("react").JSX.Element;
/** Bandeau hors ligne : un écran figé qui paraît normal est pire qu'une panne visible. */
export declare function OfflineBanner(): import("react").JSX.Element | null;
export declare function Tag({ children, variant, }: {
    children: ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
}): import("react").JSX.Element;
export declare function Stepper({ value, onChange, min, max, }: {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}): import("react").JSX.Element;
//# sourceMappingURL=ui.d.ts.map