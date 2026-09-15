# Décisions d'architecture

Chaque fichier consigne une décision structurante : son contexte, l'arbitrage retenu et ses conséquences.
Une décision inscrite ici n'est pas rediscutée en cours de développement — elle est révisée par une
nouvelle décision qui la remplace explicitement.

| # | Décision | Statut |
|---|---|---|
| [001](001-pwa-avant-natif.md) | PWA d'abord, APK ensuite, natif jamais obligatoire | Acceptée |
| [002](002-typescript-partout.md) | TypeScript sur toute la plateforme, règles métier partagées | Acceptée |
| [003](003-montants-entiers-fcfa.md) | Montants en entiers de FCFA | Acceptée |
| [004](004-marque-en-base.md) | Marque et catalogue en base, jamais dans le code | Acceptée |
| [005](005-caisse-multicanal.md) | Le logiciel encaisse tous les canaux de commande | Acceptée |
| [006](006-temps-reel-socketio.md) | Temps réel par Socket.IO avec repli | Acceptée |
| [007](007-paiement-adaptateurs.md) | Paiement par adaptateurs, confirmation serveur | Acceptée |
| [008](008-paiement-declare-atteste.md) | Paiement Mobile Money déclaré par le client, attesté par le restaurant | Acceptée |
