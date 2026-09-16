/**
 * Icônes.
 *
 * Dessinées à la main plutôt qu'importées d'une bibliothèque : une vingtaine d'icônes pèsent ici
 * quelques centaines d'octets, là où un paquet complet en coûterait des dizaines de kilo-octets —
 * sur des données mobiles comptées, cela se voit.
 */
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

export const IconHome = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
  </svg>
);

export const IconMenu = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);

export const IconCart = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.5L20 8H6" />
    <circle cx="10" cy="20" r="1.3" />
    <circle cx="17" cy="20" r="1.3" />
  </svg>
);

export const IconReceipt = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21Z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);

export const IconUser = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const IconSearch = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const IconBack = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);

export const IconCheck = ({ size = 16, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style} strokeWidth={3}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconPlus = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 12h14" />
  </svg>
);

export const IconHeart = ({ size = 22, className, style, filled }: IconProps & { filled?: boolean }) => (
  <svg {...base(size)} className={className} style={style} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
  </svg>
);

export const IconBell = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
    <path d="M10.5 18a1.8 1.8 0 0 0 3 0" />
  </svg>
);

export const IconBike = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="5.5" cy="17" r="3" />
    <circle cx="18.5" cy="17" r="3" />
    <path d="M8 17h6l-2-7-3-1m5 1h3l2 7" />
  </svg>
);

export const IconBag = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6 8h12l-1 12H7Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

export const IconTable = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M3 9h18M6 9v10M18 9v10M12 4v5" />
  </svg>
);

export const IconQr = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
    <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
  </svg>
);

export const IconClock = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconStar = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8Z" />
  </svg>
);

export const IconTrash = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);

export const IconPhone = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 4h4l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4Z" />
  </svg>
);

export const IconHelp = ({ size = 22, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.7 9.4a2.4 2.4 0 0 1 4.6.8c0 1.6-2.3 1.9-2.3 3.3" />
    <path d="M12 17h.01" />
  </svg>
);

export const IconWifiOff = ({ size = 18, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="m3 3 18 18" />
    <path d="M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 4-2.4M19 12a10 10 0 0 0-7.5-2.9" />
    <path d="M12 19h.01" />
  </svg>
);

export const IconChevron = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const IconLogout = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="M10 8 6 12l4 4M6 12h9" />
  </svg>
);

export const IconShare = ({ size = 20, className, style }: IconProps) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </svg>
);

/** Badge produit, repris du logo : sert de remplacement quand une photo manque. */
export const SavoraMark = ({ size = 64, className, style }: IconProps) => (
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
