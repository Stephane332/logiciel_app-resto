/** Icônes du logiciel restaurant, dessinées à la main pour éviter toute dépendance. */
import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconDashboard = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
  </svg>
);

export const IconRegister = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M7 8V5h10v3M7 12h4M7 16h4M15 12h2v4h-2z" />
  </svg>
);

export const IconOrders = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21Z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);

export const IconKitchen = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 14h16a8 8 0 0 0-16 0Z" />
    <path d="M3 17h18M5 20h14" />
  </svg>
);

export const IconTable = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M3 9h18M6 9v10M18 9v10M12 4v5" />
  </svg>
);

export const IconMenuBook = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2Z" />
    <path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2Z" />
  </svg>
);

export const IconChart = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V7M16 16v-6" />
  </svg>
);

export const IconUsers = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19a6 6 0 0 1 12 0" />
    <path d="M16 6.5a3 3 0 0 1 0 5.5M17 19a6 6 0 0 0-2-4.4" />
  </svg>
);

export const IconSettings = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
  </svg>
);

export const IconBike = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="5.5" cy="17" r="3" />
    <circle cx="18.5" cy="17" r="3" />
    <path d="M8 17h6l-2-7-3-1m5 1h3l2 7" />
  </svg>
);

export const IconBag = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6 8h12l-1 12H7Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

export const IconCheck = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style} strokeWidth={3}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconClose = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconPlus = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 12h14" />
  </svg>
);

export const IconClock = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconSearch = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const IconLogout = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="M10 8 6 12l4 4M6 12h9" />
  </svg>
);

export const IconWifiOff = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="m3 3 18 18" />
    <path d="M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 4-2.4M19 12a10 10 0 0 0-7.5-2.9" />
    <path d="M12 19h.01" />
  </svg>
);

export const IconQr = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
    <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
  </svg>
);

export const IconRefresh = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 4v5h-5" />
  </svg>
);

export const IconTrash = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);

export const IconWallet = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
  </svg>
);

export const IconShare = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export const SavoraMark = ({ size = 32, className, style }: IconProps) => (
  /*
   * La marque Savora : une cuillère dont le manche trace le « S ».
   *
   * Un burger disait « ce logiciel sert des burgers » — or il en servira aussi des wraps, du riz
   * gras et du bissap, et il se vendra à d'autres restaurants que celui-ci. La cuillère, elle,
   * dit la table sans rien dire du menu.
   *
   * Dessinée en aplats : elle doit rester lisible à seize pixels dans une barre latérale, où un
   * dégradé ne serait plus qu'une tache.
   */
  <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style} aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="#14342A" />
    {/* Le cuilleron */}
    <ellipse cx="32" cy="22" rx="10.5" ry="12.5" fill="#D95C14" />
    <ellipse cx="32" cy="21" rx="6" ry="7.5" fill="#FBF8F3" fillOpacity="0.22" />
    {/* Le manche, courbé en S */}
    <path
      d="M32 34c0 6-7 6-7 11s7 5 7 10"
      stroke="#D95C14"
      strokeWidth="5.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

/** Ancien nom, conservé le temps que les appels migrent. */
export const BurgerMark = SavoraMark;
