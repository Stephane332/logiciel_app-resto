/**
 * Empaquetage Android.
 *
 * L'APK embarque exactement la même application que la PWA : un seul code source, deux canaux de
 * diffusion (ADR 001). L'APK sert à ceux qui veulent une icône sur leur écran d'accueil et des
 * notifications fiables ; la PWA sert à tous les autres, notamment ceux qui scannent un QR de table.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.savora.client',
  appName: 'Savora',
  webDir: 'dist',

  android: {
    /*
     * L'application doit pouvoir parler à un serveur de restaurant.
     *
     * ┌──────────────────────────────────────────────────────────────────────────────┐
     * │  Le serveur d'un restaurant est un PC sur un réseau local. Il n'a pas de TLS. │
     * └──────────────────────────────────────────────────────────────────────────────┘
     *
     * L'APK affiche ses pages sous l'origine « https://app.savora.bf » — nécessaire pour que les
     * liens profonds d'un QR de table ouvrent l'application plutôt qu'un navigateur. Mais une page
     * en `https` ne peut pas appeler une adresse en clair, et `allowMixedContent: false` fermait le
     * verrou explicitement. L'APK ne pouvait donc joindre qu'un serveur en HTTPS — et il n'en
     * existe aucun tant qu'un restaurant n'a pas de domaine. Installée, ouverte, elle ne pouvait
     * strictement rien faire.
     *
     * Le contenu mixte est donc autorisé. Ce n'est pas une porte ouverte au hasard : les pages
     * viennent du paquet installé, jamais d'Internet, et la seule adresse appelée est celle que le
     * restaurateur a saisie lui-même. Le jour où son serveur aura une adresse sécurisée, cette
     * tolérance ne servira plus à rien — mais elle ne nuira pas davantage.
     */
    allowMixedContent: true,
    captureInput: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#07130F',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#07130F',
    },
  },

  server: {
    // Requis pour que les liens profonds du QR de table (https://<domaine>/t/<jeton>) ouvrent
    // l'application plutôt qu'un navigateur, quand elle est installée.
    androidScheme: 'https',
    hostname: process.env.CAPACITOR_HOSTNAME ?? 'app.savora.bf',
  },
};

export default config;
