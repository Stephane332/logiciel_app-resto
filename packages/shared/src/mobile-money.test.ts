import { describe, expect, it } from 'vitest';
import {
  buildUssdCode,
  looksLikeTransactionId,
  matchSmsToPayment,
  readOperatorSms,
  USSD_TEMPLATES,
  ussdDialLink,
  UssdError,
  type PendingPayment,
} from './mobile-money.js';

describe('code USSD', () => {
  it('remplit le numéro du marchand et le montant', () => {
    expect(
      buildUssdCode({ template: USSD_TEMPLATES.ORANGE_MONEY, merchantNumber: '76055792', amount: 4000 }),
    ).toBe('*144*10*76055792*4000#');
  });

  it('nettoie un numéro saisi avec des espaces', () => {
    // Un numéro noté « 76 05 57 92 » dans les réglages produirait sinon un code
    // invalide, et l'échec serait silencieux : le clavier s'ouvrirait sur rien.
    expect(
      buildUssdCode({ template: USSD_TEMPLATES.ORANGE_MONEY, merchantNumber: '76 05 57 92', amount: 500 }),
    ).toBe('*144*10*76055792*500#');
  });

  it('retire l\'indicatif du pays, que l\'opérateur ne veut pas', () => {
    /*
     * Le reste du système range les numéros sous leur forme internationale. Le menu de l'opérateur,
     * lui, attend huit chiffres — et un restaurateur écrit volontiers son numéro avec l'indicatif.
     * Sans ce nettoyage le code devenait `*144*10*22666798031*…#` : il s'ouvrait sur le clavier,
     * l'opérateur le refusait, et le client croyait avoir payé.
     */
    for (const ecriture of ['+22666798031', '226 66 79 80 31', '0022666798031', '66798031']) {
      expect(
        buildUssdCode({ template: USSD_TEMPLATES.ORANGE_MONEY, merchantNumber: ecriture, amount: 250 }),
        ecriture,
      ).toBe('*144*10*66798031*250#');
    }
  });

  it('ne confond pas un numéro local commençant par 226 avec un indicatif', () => {
    // Un numéro à huit chiffres reste intact, même s'il commence par les mêmes chiffres que
    // l'indicatif : le retirer produirait un numéro de cinq chiffres et un code muet.
    expect(
      buildUssdCode({ template: USSD_TEMPLATES.ORANGE_MONEY, merchantNumber: '22612345', amount: 100 }),
    ).toBe('*144*10*22612345*100#');
  });

  it('gère le modèle Moov', () => {
    expect(
      buildUssdCode({ template: USSD_TEMPLATES.MOOV_MONEY, merchantNumber: '01020304', amount: 2500 }),
    ).toBe('*555*4*1*01020304*2500#');
  });

  it('refuse un numéro incomplet plutôt que de produire un code muet', () => {
    expect(() =>
      buildUssdCode({ template: USSD_TEMPLATES.ORANGE_MONEY, merchantNumber: '760', amount: 500 }),
    ).toThrow(UssdError);
  });

  it('refuse un modèle auquel il manque un emplacement', () => {
    expect(() =>
      buildUssdCode({ template: '*144*10*{NUM}#', merchantNumber: '76055792', amount: 500 }),
    ).toThrow(UssdError);
  });

  it('encode le dièse, sinon le navigateur le prend pour une ancre', () => {
    const link = ussdDialLink('*144*10*76055792*4000#');
    expect(link).toContain('%23');
    expect(link.startsWith('tel:')).toBe(true);
  });
});

describe('lecture du SMS de l\'opérateur', () => {
  // SMS réellement observé au Burkina Faso, Orange Money.
  const ORANGE =
    'Votre paiement de 500.00 FCFA, Frais: 4.3478 FCFA, Taxe: 0.6522 FCFA a ISSA OUEDRAOGO ' +
    'a ete effectue avec succes. Votre solde est de : 471.9 FCFA. Trans id: MP260902.0128.19397304.';

  it('retient le montant de l\'opération, pas les frais ni le solde', () => {
    expect(readOperatorSms(ORANGE).amount).toBe(500);
  });

  it('extrait l\'identifiant sans le point final de la phrase', () => {
    expect(readOperatorSms(ORANGE).transactionId).toBe('MP260902.0128.19397304');
  });

  it('lit un montant écrit avec séparateur de milliers', () => {
    expect(readOperatorSms('Vous avez recu 6 000 FCFA. Reference: ABC123456').amount).toBe(6000);
  });

  it('distingue les centimes du séparateur de milliers', () => {
    // « 500.00 » vaut 500 F ; « 6.000 » vaut 6 000 F. Confondre les deux, c'est
    // une erreur de facteur mille sur un rapprochement comptable.
    expect(readOperatorSms('Paiement de 500.00 FCFA. Trans id: AAA111222').amount).toBe(500);
    expect(readOperatorSms('Paiement de 6.000 FCFA. Trans id: AAA111222').amount).toBe(6000);
  });

  it('accepte les variantes d\'écriture de la devise', () => {
    expect(readOperatorSms('Montant 1500 XOF, reference XY987654').amount).toBe(1500);
    expect(readOperatorSms('Montant 1500 F CFA, reference XY987654').amount).toBe(1500);
  });

  it('ne rend rien plutôt que d\'inventer, sur un texte qui n\'est pas un SMS', () => {
    expect(readOperatorSms('bonjour, ma commande est prête ?')).toEqual({
      amount: null,
      transactionId: null,
    });
  });
});

describe('rapprochement SMS / paiement', () => {
  const pending: PendingPayment[] = [
    { id: 'a', amount: 4000, declaredReference: 'MP260902.0128.19397304', createdAt: '2026-09-02T10:00:00Z' },
    { id: 'b', amount: 2500, declaredReference: null, createdAt: '2026-09-02T10:05:00Z' },
    { id: 'c', amount: 2500, declaredReference: 'AUTRE999', createdAt: '2026-09-02T10:06:00Z' },
  ];

  it('reconnaît par identifiant, même quand le montant ne correspond pas', () => {
    // L'identifiant prime : deux transactions ne portent jamais le même numéro.
    const result = matchSmsToPayment('Paiement de 999 FCFA. Trans id: MP260902.0128.19397304.', pending);
    expect(result.kind).toBe('MATCHED');
    if (result.kind === 'MATCHED') {
      expect(result.payment.id).toBe('a');
      expect(result.byReference).toBe(true);
    }
  });

  it('reconnaît par montant quand il est le seul à correspondre', () => {
    const result = matchSmsToPayment('Vous avez recu 4 000 FCFA de AMINATA.', pending);
    expect(result.kind).toBe('MATCHED');
    if (result.kind === 'MATCHED') {
      expect(result.payment.id).toBe('a');
      expect(result.byReference).toBe(false);
    }
  });

  it('refuse de choisir quand deux paiements portent le même montant', () => {
    // Attester au hasard reviendrait à déclarer payée une commande qui ne l'est pas.
    const result = matchSmsToPayment('Vous avez recu 2 500 FCFA.', pending);
    expect(result.kind).toBe('AMBIGUOUS');
    if (result.kind === 'AMBIGUOUS') expect(result.candidates).toHaveLength(2);
  });

  it('ne rapproche rien quand aucun montant ne correspond', () => {
    const result = matchSmsToPayment('Vous avez recu 7 777 FCFA.', pending);
    expect(result.kind).toBe('NO_MATCH');
  });

  it('signale un texte illisible au lieu de deviner', () => {
    expect(matchSmsToPayment('coucou', pending).kind).toBe('UNREADABLE');
  });

  it('ne rapproche rien sur une file vide', () => {
    expect(matchSmsToPayment('Paiement de 500 FCFA. Trans id: ABC123456.', []).kind).toBe('NO_MATCH');
  });
});

describe('identifiant déclaré par le client', () => {
  it('accepte les formats réellement rencontrés', () => {
    expect(looksLikeTransactionId('MP260902.0128.19397304')).toBe(true);
    expect(looksLikeTransactionId('PP123456789')).toBe(true);
    expect(looksLikeTransactionId('CI 250902 1234')).toBe(true);
  });

  it('refuse ce qui est manifestement trop court ou fantaisiste', () => {
    expect(looksLikeTransactionId('12')).toBe(false);
    expect(looksLikeTransactionId('<script>')).toBe(false);
    expect(looksLikeTransactionId('')).toBe(false);
  });
});

describe('modèle de transfert et code secret', () => {
  it('construit un transfert de personne à personne, numéro puis montant', () => {
    // Vérifié auprès d'Orange Burkina : *144# → 2 → 1 → numéro → montant → PIN.
    expect(
      buildUssdCode({
        template: USSD_TEMPLATES.ORANGE_MONEY_TRANSFER,
        merchantNumber: '66798031',
        amount: 2500,
      }),
    ).toBe('*144*2*1*66798031*2500#');
  });

  it('substitue par nom et non par position : un modèle inversé reste correct', () => {
    expect(
      buildUssdCode({ template: '*999*{MONTANT}*{NUM}#', merchantNumber: '70000000', amount: 500 }),
    ).toBe('*999*500*70000000#');
  });

  it('refuse un modèle qui embarquerait le code secret', () => {
    // Le retrait chez un agent s'écrit *144*2*3*Agent*Montant*PIN# : cette forme ne doit jamais
    // entrer ici. Un code construit par le logiciel finit dans un lien tel:, donc dans
    // l'historique du navigateur et dans les captures d'écran.
    expect(() =>
      buildUssdCode({
        template: '*144*2*3*{NUM}*{MONTANT}*{PIN}#',
        merchantNumber: '70000000',
        amount: 500,
      }),
    ).toThrow(UssdError);
  });
});
