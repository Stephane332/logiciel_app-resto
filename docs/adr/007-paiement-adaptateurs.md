# 007 — Paiement par adaptateurs, confirmation serveur

**Statut :** acceptée — Septembre 2026

## Contexte
Aucun agrégateur Mobile Money n'est contractualisé. Orange Money et Moov Money sont les moyens attendus ;
les agrégateurs candidats au Burkina Faso sont notamment CinetPay et Ligdicash.

## Décision
Une interface `PaymentProvider` avec trois implémentations en V1 : `cash`, `sandbox` (développement et
démonstration) et un emplacement pour l'agrégateur réel. Un paiement n'est confirmé **que** par le
serveur : webhook signé, puis vérification auprès de l'agrégateur.

## Justification
Attendre un contrat pour commencer à développer bloquerait le projet. Attendre le contrat pour *concevoir*
l'intégration produirait un branchement bâclé. L'interface permet de développer, démontrer et tester
aujourd'hui, et de brancher demain en écrivant une seule classe.

Ne jamais croire l'application cliente sur un paiement est une règle absolue : c'est le seul endroit du
système où un mensonge rapporte de l'argent.

## Conséquences
- Les webhooks sont limités en débit, signés et journalisés.
- Tout paiement porte une référence unique et laisse une trace vérifiable.
- Un remboursement est manuel en V1, mais toujours tracé.
