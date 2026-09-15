# 008 — Paiement Mobile Money déclaré, puis attesté

**Statut :** acceptée — Septembre 2026
**Complète l'ADR 007**, qu'elle ne remplace pas.

## Contexte

L'ADR 007 tenait le paiement Mobile Money pour suspendu à un contrat d'agrégateur, et le document de
déploiement en faisait une condition de mise en service. C'était une erreur d'analyse, et elle coûtait
cher : elle repoussait le seul moyen de paiement réellement utilisé par la clientèle visée.

Un agrégateur (CinetPay, Ligdicash) apporte une chose précise — la **confirmation automatique** qu'un
paiement a bien eu lieu. Il la facture : commission par transaction, dossier d'ouverture, délais, et une
dépendance à un tiers qui peut tomber en panne un vendredi soir. Or Orange Money et Moov Money
fonctionnent parfaitement sans lui. Ce qui manque alors n'est pas le paiement : c'est la preuve.

Le dépôt `resto-papou-service`, écrit précédemment sur ce même terrain, avait déjà tranché la question.
La solution y est reprise telle quelle, parce qu'elle est juste.

## Décision

Le paiement se fait par code USSD, et la preuve par attestation humaine. Une règle gouverne l'ensemble :

> **Celui qui paie ne confirme jamais son propre paiement.**

Le parcours a trois temps :

1. **Le client compose.** Le serveur construit le code USSD de l'opérateur, déjà rempli avec le numéro
   marchand du restaurant et le montant exact — `*144*10*76055792*3500#` pour Orange Money. L'application
   propose un lien composable ; le code reste affiché en clair si le clavier ne s'ouvre pas.
2. **Le client déclare.** Il recopie l'identifiant de transaction reçu par SMS. Le paiement passe à
   `DECLARED` : un état qui dit exactement ce qu'il est, une affirmation non vérifiée.
3. **Le restaurant atteste.** Il colle le SMS reçu sur **son propre téléphone**. Le logiciel y lit le
   montant et l'identifiant, désigne la commande correspondante, et l'employé atteste. Alors seulement
   le paiement devient `CONFIRMED`.

L'état `DECLARED` a été ajouté à `PaymentStatus` pour cela. Aucune route client ne peut produire
`CONFIRMED` — seule l'attestation, protégée par l'habilitation `payment:collect`, le peut.

## Justification

**Ce n'est pas une version dégradée.** Un agrégateur remplace l'employé par une machine ; il ne rend pas
le paiement plus sûr. Ici, la vérification est faite par la personne qui a le plus à perdre à se tromper,
sur la source la moins falsifiable qui soit : le SMS de l'opérateur, reçu sur le téléphone du marchand.
Un client peut inventer un identifiant ; il ne peut pas faire apparaître un SMS sur un téléphone qui
n'est pas le sien.

**Le coût réel est une poignée de secondes par commande**, au moment où l'employé regarde de toute façon
l'écran des nouvelles commandes. En échange : zéro commission, zéro contrat, zéro dépendance, et un
système qui fonctionne dès le premier jour. Pour un restaurant de Ouahigouya qui démarre, c'est le bon
arbitrage — et il reste le bon tant que le volume ne justifie pas de payer pour automatiser.

**Le rapprochement refuse de deviner.** L'identifiant de transaction prime sur le montant. Si deux
commandes portent la même somme et qu'aucun identifiant ne permet de trancher, le logiciel le dit et
laisse choisir. Attester au hasard déclarerait payée une commande qui ne l'est pas : le silence est
préférable à une réponse fausse.

**Le client n'est jamais trompé.** C'est la contrepartie indispensable. La page de paiement annonce, avant
même la déclaration, que la commande n'avancera qu'une fois le restaurant passé vérifier. Le suivi affiche
« en attente de vérification », puis la confirmation dès qu'elle tombe, poussée en temps réel. Laisser
croire à un paiement réglé alors que personne n'a rien constaté ferait repartir le client sans son repas —
c'est le pire service à lui rendre, et ce serait la seule vraie faiblesse de ce dispositif.

## Conséquences

- Mobile Money fonctionne **sans agrégateur** : le blocage annoncé au déploiement n'existe plus.
- Le restaurant renseigne lui-même ses numéros marchands (paramètres). Un moyen de paiement n'apparaît au
  client **que** si le numéro correspondant est réellement saisi : sans lui, le code USSD serait muet et
  le client croirait avoir payé dans le vide.
- Un paiement attesté porte son auteur, son horodatage et sa note : la trace est nominative.
- L'adaptateur `declared` devient le défaut (`PAYMENT_PROVIDER=declared`). Ses méthodes `verifyWebhook` et
  `verifyTransaction` répondent délibérément « invalide » : il n'y a pas d'automatisme à simuler.
- L'ADR 007 reste valable. Le jour où le volume justifie un agrégateur, il se branche en écrivant une
  classe, sans rien défaire de ce qui précède.
- Le lien composable encode le `#` (`%23`), faute de quoi le navigateur le prend pour une ancre et
  tronque le code — le client composerait un montant vide.

## Origine

Approche reprise de `resto-papou-service` (`src/paiements.ts`), écrit par Ange Stéphane Sawadogo.
La règle « celui qui paie ne confirme jamais son propre paiement » en vient directement.
