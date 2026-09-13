/**
 * Empaquetage Android.
 *
 * L'APK embarque exactement la même application que la PWA : un seul code source, deux canaux de
 * diffusion (ADR 001). L'APK sert à ceux qui veulent une icône sur leur écran d'accueil et des
 * notifications fiables ; la PWA sert à tous les autres, notamment ceux qui scannent un QR de table.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'bf.barabite.client',
  appName: 'BaraBite',
  webDir: 'dist',

  android: {
    // Le contenu vient du paquet, pas d'un serveur distant : l'application démarre même sans réseau.
    allowMixedContent: false,
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
    hostname: process.env.CAPACITOR_HOSTNAME ?? 'app.barabite.bf',
  },
};

export default config;
