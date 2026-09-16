# 009 — Commission de la plateforme : accumulée, puis reversée

**Statut :** acceptée — Septembre 2026
**Dépend de l'[ADR 008](008-paiement-declare-atteste.md)**, dont elle est une conséquence directe.

## Contexte

Savora doit se financer. Le modèle retenu est un pourcentage sur les ventes que l'application
apporte — **1 %** — et non un abonnement. Le restaurant ne paie donc rien tant que le logiciel ne
lui rapporte rien, ce qui est le bon sens commercial face à un restaurateur qui n'a jamais utilisé
de logiciel de caisse.

La question posée était : **prélever à chaque transaction, ou totaliser et encaisser ensuite ?**

## Décision

**Accumuler, puis reverser à la fin de la période.** Chaque vente éligible inscrit une écriture ; à
l'échéance, le restaurant reverse le cumul par un simple transfert Mobile Money.

> **La plateforme ne touche jamais l'argent. Elle tient un compte, et le dit.**

### Ce n'est pas un choix de confort

Le prélèvement à la transaction est **techniquement impossible** ici, et il faut le dire clairement
plutôt que de laisser croire à un arbitrage. Le client paie le restaurant **directement**, de son
téléphone au numéro marchand, par code USSD (ADR 008). Il n'existe aucun intermédiaire dans le flux
d'argent — c'est justement ce qui permet de se passer d'un agrégateur et de ses commissions.
Personne, pas même la plateforme, ne peut donc prélever au passage : **il n'y a pas de passage.**

Trois raisons de fond confirment que c'est aussi le bon choix :

- **Les espèces existent.** Une part des commandes se règle en liquide, à la remise. Aucun
  prélèvement automatique n'atteindra jamais cet argent-là.
- **Les micro-transferts sont absurdes.** 1 % d'une commande de 3 500 F vaut 35 F. Envoyer 35 F par
  Mobile Money coûte, en frais et en gestes, plus que la somme transférée.
- **Les remboursements existent.** Une vente annulée après prélèvement obligerait à rembourser une
  commission déjà encaissée. Une écriture, elle, se contre-passe.

### Assiette

| | Dans l'assiette | Motif |
|---|---|---|
| Produits vendus | **oui** | c'est la vente que l'application a apportée |
| Frais de livraison | non | ils traversent la caisse pour aller au livreur ; les commissionner reviendrait à prélever sur l'argent d'un tiers |
| Remises commerciales et fidélité | non | de l'argent jamais encaissé ; facturer dessus serait indéfendable le jour où le restaurateur refait le calcul |
| Ventes au comptoir et par téléphone | non | voir ci-dessous |

### Pourquoi le comptoir n'est jamais facturé

La tentation serait de facturer aussi les ventes saisies à la caisse — le logiciel les traite, après
tout. Ce serait une faute, et pas seulement envers le restaurant.

Le jour où saisir une vente au comptoir coûte de l'argent, **l'équipe cesse de les saisir.** Le
chiffre d'affaires devient faux, les statistiques deviennent fausses, le stock dérive, et le
logiciel perd exactement ce qui faisait sa valeur. Le guide d'exploitation demande de tout saisir,
« même les commandes payées en espèces sans discussion » : une commission sur le comptoir
contredirait cette consigne et la ferait perdre.

On ne taxe pas quelqu'un qui saisit ses propres données. La commission rémunère ce que
l'application apporte : **une commande qu'un client a passée seul, depuis son téléphone.**

### Le reversement

Le restaurant transfère au numéro de la plateforme par le code USSD d'envoi d'argent
(`*144*2*1*{NUM}*{MONTANT}#` chez Orange Burkina), puis recopie l'identifiant de son SMS. La
plateforme constate le virement sur son propre téléphone et solde le relevé.

C'est la règle de l'ADR 008, appliquée en sens inverse, et elle ne change pas de sens parce qu'elle
joue cette fois en faveur du restaurant : **celui qui paie ne confirme jamais son propre paiement.**

## Justification

**Le taux est en points de base, entiers** — 100 pdb = 1 %. Un taux en flottant multiplié par un
montant produirait des francs à virgule, ce que le système interdit partout ailleurs (ADR 003). Les
points de base permettent en outre d'écrire 0,5 % ou 1,25 % sans quitter les entiers.

**Le taux est recopié sur chaque écriture**, jamais seulement référencé. Changer le taux du contrat
ne doit pas réécrire ce qui a déjà été facturé : une écriture est un fait passé.

**Tout est visible par le restaurant.** Ce n'est pas une politesse, c'est la condition de survie du
modèle : une commission qu'on ne peut ni voir, ni recouper, ni contester détruit la relation à la
première fin de mois où le restaurateur fait ses comptes. L'écran affiche donc le taux, l'assiette,
le détail commande par commande, et dit explicitement **ce qui n'est pas facturé**. Le restaurateur
refera le calcul à la main au moins une fois ; il doit tomber sur le même nombre.

**Le client ne voit jamais rien.** Il paie le prix affiché. Ce que le restaurant doit à la
plateforme relève du contrat entre eux et ne le regarde pas — un test le vérifie explicitement.

## Conséquences

- Une commande n'est facturée **qu'une fois**, garanti par une contrainte d'unicité sur `orderId` et
  non par une simple lecture préalable. Une commande de livraison passe par `DELIVERED` puis
  `COMPLETED` : sans la contrainte, deux requêtes simultanées suffiraient à doubler la facture, le
  jour où le restaurant est chargé, c'est-à-dire le jour où cela se remarque le moins.
- L'inscription se fait **hors transaction** : une écriture comptable de la plateforme n'a pas à
  pouvoir faire échouer la remise d'une commande à un client. La contrepartie est qu'elle peut
  échouer — un rattrapage la reconstitue, puisqu'elle se déduit entièrement de l'état des commandes.
- Une vente remboursée se **contre-passe**, elle ne s'efface pas : un relevé qu'on ne peut plus
  recouper avec l'historique ne vaut rien précisément le jour où il sert.
- La période en cours ne peut pas être arrêtée : figer un total auquel des ventes vont encore
  s'ajouter produirait une facture invérifiable.
- La commission est réservée à la direction (`commission:read`). Ni la cuisine, ni la caisse, ni le
  livreur n'y ont accès : c'est une affaire de contrat, pas de service.
- Le numéro de reversement est une configuration (`PLATFORM_MOMO_NUMBER`). En production, un
  démarrage sans ce numéro est refusé : le restaurant verrait une somme due sans savoir où
  l'envoyer.
- Le PIN n'entre **jamais** dans un code USSD construit par le logiciel. Certains codes d'opérateur
  l'acceptent en ligne — le retrait chez un agent s'écrit `*144*2*3*Agent*Montant*PIN#`. Un code
  construit par le logiciel finit dans un lien `tel:`, donc dans l'historique du navigateur et dans
  les captures d'écran envoyées au support. Un garde-fou refuse tout modèle en contenant un.

## Réserve sur les codes opérateur

Le code de **transfert** est établi : Orange Burkina documente le parcours `*144#` → 2 → 1 → numéro
→ montant → PIN.

Le code de **paiement marchand** utilisé par défaut (`*144*10*{NUM}*{MONTANT}#`) **n'a pas pu être
vérifié** : les pages d'Orange Burkina ne documentent pas de raccourci composé par le client, et
mentionnent une collecte par `#144#`, QR Code, page hébergée ou API. Ce code doit donc être
confirmé par un essai réel avant la mise en service. C'est sans conséquence sur l'architecture :
chaque modèle USSD est un réglage, jamais une valeur écrite en dur, et la substitution se fait par
nom de marqueur — un code dont l'ordre des paramètres diffère reste correct.
