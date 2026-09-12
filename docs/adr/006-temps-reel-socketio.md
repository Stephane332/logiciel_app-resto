# 006 — Temps réel par Socket.IO, avec repli

**Statut :** acceptée — Septembre 2026

## Contexte
Une commande doit apparaître en cuisine en moins de deux secondes. Le réseau de Ouahigouya est irrégulier
et l'électricité peut manquer.

## Décision
Socket.IO, avec salons `restaurant:{id}` et `order:{id}`, reconnexion automatique et **repli en
interrogation périodique** si le WebSocket tombe.

## Justification
Un WebSocket nu se contente d'échouer. Socket.IO gère la reconnexion, la file de messages et le repli en
transport HTTP — exactement les situations qui se produiront tous les jours sur place.

## Conséquences
- Le temps réel est un confort, jamais une dépendance : chaque écran critique sait aussi se recharger seul.
- Un bandeau « hors ligne » est affiché en cuisine, car un écran figé qui paraît normal est pire qu'une
  panne visible.
