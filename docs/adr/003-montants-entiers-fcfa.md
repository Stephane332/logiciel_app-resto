# 003 — Montants en entiers de FCFA

**Statut :** acceptée — Septembre 2026

## Contexte
Le franc CFA n'a pas de sous-unité en circulation courante. Les cahiers des charges antérieurs ne
précisaient pas la représentation des montants.

## Décision
Tout montant est un **entier de francs CFA**, en base, dans l'API et dans les interfaces. Aucun flottant
n'est utilisé pour un montant, nulle part.

## Justification
`0.1 + 0.2 !== 0.3` en virgule flottante. Appliqué à une caisse, cela produit des écarts de centimes qui,
sur un ticket comptable, deviennent des écarts inexplicables. Le problème disparaît en entiers — et le
FCFA s'y prête naturellement, contrairement à l'euro ou au dollar.

## Conséquences
- Les remises fractionnaires sont arrondies à l'entier inférieur, au bénéfice du client.
- Les prix affichés le sont au multiple de 5 F le plus proche, l'unité réellement manipulée au comptoir.
- Un test automatisé vérifie qu'aucun montant flottant ne circule (critère A13).
