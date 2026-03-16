# Guide Complet d'Intégration Stripe - Marketplace My-Order
## Application Client - Claude Code (Opus 4.5)

> **Version** : 2.0 - Guide définitif avec contexte projet complet
> **Date** : Janvier 2025
> **Stack** : Next.js 15.5.7, React 19, Prisma, Supabase, Stripe SDK 19.3.0

---

## 🎯 OBJECTIF DE LA MISSION

Refactoriser complètement le système de paiement de l'application Client pour :
1. **Supprimer tout le code legacy Hipay**
2. **Implémenter Stripe Payment Element** avec surcharging
3. **Utiliser Separate Charges and Transfers** pour les virements fournisseurs
4. **Conserver et améliorer le système d'encours**
5. **Mettre en place des webhooks robustes**
6. **Gérer proprement les remboursements**

---

## 📁 STRUCTURE DU PROJET

```
my-order/
├── client/                    ← APPLICATION ACTUELLE (tu travailles ici)
│   ├── app/
│   │   ├── api/stripe/        ← Routes API Stripe à refactoriser
│   │   ├── checkout/          ← Pages checkout
│   │   ├── paiement/          ← Page paiement des encours
│   │   └── components/checkout/
│   ├── lib/
│   └── prisma/schema.prisma
│
└── fournisseurs/              ← AUTRE REPO (ne pas toucher)
    └── (gestion comptes Connect)
```

---

## 📊 SCHÉMA DE DONNÉES EXISTANT

### Modèles Prisma clés (déjà en place)

```prisma
// ============================================
// UTILISATEURS & PROFILS
// ============================================

model Profile {
  id                        String   @id
  userType                  UserType // ADMIN, DISTRIBUTOR, EMPLOYEE, CUSTOMER
  businessType              BusinessType // PROFESSIONAL, DISTRIBUTOR
  
  // STRIPE (à utiliser)
  stripeCustomerId          String?  @unique  // Pour les clients
  stripeConnectedAccountId  String?  @unique  // Pour les fournisseurs (distributors)
  stripeAccountStatus       String?           // État du compte Connect
  
  // LEGACY HIPAY (à ignorer/supprimer)
  hipayAccountId            String?  @unique  // ❌ LEGACY
  
  // Relations
  customerOrders            Order[]  @relation("CustomerOrders")
  distributorOrders         Order[]  @relation("DistributorOrders")
  asCustomerSettings        CustomerDistributorSettings[] @relation("CustomerSettings")
  asDistributorSettings     CustomerDistributorSettings[] @relation("DistributorSettings")
  marketplaceTransfers      MarketplaceTransfer[]
}

// ============================================
// SYSTÈME D'ENCOURS (CRÉDIT PAR FOURNISSEUR)
// ============================================

model CustomerDistributorSettings {
  id            String   @id
  customerId    String   // Le client
  distributorId String   // Le fournisseur
  
  creditLimit   Decimal  @default(0)  // Limite d'encours accordée (en euros)
  paymentTerms  Int      @default(0)  // Délai de paiement en jours (ex: 30)
  discountRate  Decimal?              // Taux de remise accordé
  isActive      Boolean  @default(true)
  
  customer      Profile  @relation("CustomerSettings")
  distributor   Profile  @relation("DistributorSettings")
  
  @@unique([customerId, distributorId])
}

// ============================================
// COMMANDES
// ============================================

model Order {
  id                      String        @id
  orderNumber             String        @unique
  customerId              String
  distributorId           String        // UN fournisseur par commande
  
  // Montants
  subtotal                Decimal
  taxAmount               Decimal       @default(0)
  shippingAmount          Decimal       @default(0)
  discountAmount          Decimal       @default(0)
  totalAmount             Decimal
  surchargeAmount         Decimal?      @default(0)  // ← Déjà prévu!
  surchargeRate           Decimal?      @default(0)  // ← Déjà prévu!
  
  // Statuts
  status                  OrderStatus   @default(READY)
  paymentStatus           PaymentStatus @default(PENDING)
  paymentMethod           String?       // 'CARD', 'SEPA', 'BANK_TRANSFER', 'ENCOURS'
  
  // Stripe
  stripePaymentIntentId   String?
  stripeCheckoutSessionId String?       @unique
  stripePaymentLinkId     String?       @unique
  stripePaymentLinkUrl    String?
  
  // LEGACY HIPAY (à ignorer)
  hipayOrderId            String?       @unique  // ❌ LEGACY
  hipayTransactionRef     String?       @unique  // ❌ LEGACY
  hipayAuthCode           String?                // ❌ LEGACY
  hipayStatus             String?                // ❌ LEGACY
  hipayForwardUrl         String?                // ❌ LEGACY
  
  // Dates
  dueDate                 DateTime?     // Date limite paiement (pour encours)
  createdAt               DateTime      @default(now())
  
  // Relations
  customer                Profile       @relation("CustomerOrders")
  distributor             Profile       @relation("DistributorOrders")
  items                   OrderItem[]
  payments                Payment[]
  marketplaceTransfers    MarketplaceTransfer[]
}

// ============================================
// PAIEMENTS
// ============================================

model Payment {
  id                    String        @id
  orderId               String
  paymentMethodId       String
  amount                Decimal
  currency              String        @default("EUR")
  status                PaymentStatus
  
  // Stripe
  stripeChargeId        String?
  stripePaymentIntentId String?
  stripePaymentMethod   String?
  
  // LEGACY HIPAY (à ignorer)
  hipayTransactionRef   String?  // ❌ LEGACY
  hipayAuthCode         String?  // ❌ LEGACY
  hipayCardBrand        String?  // ❌ LEGACY
  hipayMaskedPan        String?  // ❌ LEGACY
  hipayPaymentProduct   String?  // ❌ LEGACY
  
  // Paiement manuel (virement reçu manuellement)
  isManual              Boolean  @default(false)
  notes                 String?
  proofUrl              String?
  
  order                 Order    @relation(...)
}

// ============================================
// VIREMENTS VERS FOURNISSEURS
// ============================================

model MarketplaceTransfer {
  id                       String         @id
  orderId                  String
  distributorId            String
  
  // Montants
  grossAmount              Decimal        // Montant brut
  commissionRate           Decimal        // Taux commission (0.04 = 4%)
  commissionAmount         Decimal        // Montant commission
  netAmount                Decimal        // Montant net versé au fournisseur
  
  // Stripe
  stripeTransferId         String?
  stripeConnectedAccountId String?
  
  // LEGACY HIPAY (à ignorer)
  hipayTransferId          String?  // ❌ LEGACY
  hipayAccountId           String?  // ❌ LEGACY
  
  status                   TransferStatus @default(PENDING)
  errorMessage             String?
  metadata                 Json?
  
  order                    Order    @relation(...)
  distributor              Profile  @relation(...)
}

// ============================================
// ENUMS
// ============================================

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  READY
  COLLECTED
  CANCELLED
  PAYMENT_INITIATED
  PAYMENT_AUTHORIZED
  EN_ATTENTE_VALIDATION
}

enum PaymentStatus {
  PENDING
  PARTIAL
  PAID
  REFUNDED
  FAILED
  AUTHORIZED
  CAPTURED
  REFUSED
}

enum TransferStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

## 🔄 LOGIQUE MÉTIER DU SYSTÈME D'ENCOURS

### Principe fondamental

L'**encours** est une ligne de crédit que chaque fournisseur peut accorder individuellement à chaque client. Ce n'est PAS de l'argent réel, c'est une autorisation de paiement différé.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTÈME D'ENCOURS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FOURNISSEUR A ──────► CLIENT X                                │
│  creditLimit: 10 000€                                          │
│  paymentTerms: 30 jours                                        │
│                                                                 │
│  FOURNISSEUR B ──────► CLIENT X                                │
│  creditLimit: 20 000€                                          │
│  paymentTerms: 45 jours                                        │
│                                                                 │
│  FOURNISSEUR A ──────► CLIENT Y                                │
│  creditLimit: 5 000€                                           │
│  paymentTerms: 15 jours                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Calcul de l'encours disponible

```typescript
// lib/encours.ts

interface EncoursStatus {
  creditLimit: number;       // Limite accordée par le fournisseur
  usedAmount: number;        // Montant utilisé (commandes non payées)
  availableAmount: number;   // Montant disponible
  paymentTerms: number;      // Délai de paiement en jours
  pendingOrders: Order[];    // Commandes à payer
  overdueOrders: Order[];    // Commandes en retard
}

/**
 * Calcule l'encours disponible pour un client chez un fournisseur spécifique
 */
async function getEncoursStatus(
  customerId: string, 
  distributorId: string
): Promise<EncoursStatus | null> {
  
  // 1. Récupérer les paramètres d'encours
  const settings = await prisma.customerDistributorSettings.findUnique({
    where: {
      customerId_distributorId: { customerId, distributorId }
    }
  });
  
  if (!settings || !settings.isActive || settings.creditLimit <= 0) {
    return null; // Pas d'encours disponible
  }
  
  // 2. Calculer le montant utilisé (commandes ENCOURS non payées)
  const pendingOrders = await prisma.order.findMany({
    where: {
      customerId,
      distributorId,
      paymentMethod: 'ENCOURS',
      paymentStatus: { in: ['PENDING', 'PARTIAL'] },
    },
    orderBy: { dueDate: 'asc' },
  });
  
  const usedAmount = pendingOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount), 
    0
  );
  
  const now = new Date();
  const overdueOrders = pendingOrders.filter(
    order => order.dueDate && order.dueDate < now
  );
  
  return {
    creditLimit: Number(settings.creditLimit),
    usedAmount,
    availableAmount: Math.max(0, Number(settings.creditLimit) - usedAmount),
    paymentTerms: settings.paymentTerms,
    pendingOrders,
    overdueOrders,
  };
}

/**
 * Vérifie si un client peut utiliser l'encours pour une commande
 */
async function canUseEncours(
  customerId: string,
  distributorId: string,
  orderAmount: number
): Promise<{ canUse: boolean; reason?: string; availableAmount?: number }> {
  
  const status = await getEncoursStatus(customerId, distributorId);
  
  if (!status) {
    return { canUse: false, reason: 'Encours non disponible pour ce fournisseur' };
  }
  
  if (status.overdueOrders.length > 0) {
    return { 
      canUse: false, 
      reason: 'Vous avez des paiements en retard. Régularisez-les avant d\'utiliser l\'encours.',
      availableAmount: 0,
    };
  }
  
  if (orderAmount > status.availableAmount) {
    return { 
      canUse: false, 
      reason: `Montant supérieur à l'encours disponible (${status.availableAmount}€)`,
      availableAmount: status.availableAmount,
    };
  }
  
  return { canUse: true, availableAmount: status.availableAmount };
}
```

### Flow de paiement avec choix Encours/CB

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CHECKOUT MULTI-FOURNISSEURS                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Panier: 3 produits de 2 fournisseurs différents                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ FOURNISSEUR A - Total: 500€                                     │   │
│  │ ○ Carte bancaire (+2.5% = 512.50€)                              │   │
│  │ ● Encours (disponible: 8 000€)  ← CLIENT CHOISIT ENCOURS        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ FOURNISSEUR B - Total: 1 200€                                   │   │
│  │ ● Carte bancaire (+2.5% = 1 230€) ← CLIENT CHOISIT CB           │   │
│  │ ○ Encours (disponible: 0€ - limite atteinte)                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  RÉSULTAT:                                                              │
│  - Commande Fournisseur A: paymentMethod='ENCOURS', pas de Stripe      │
│  - Commande Fournisseur B: paymentMethod='CARD', paiement Stripe       │
│  - Montant Stripe total: 1 230€ (seulement fournisseur B)              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cas possibles au checkout

| Fournisseur A | Fournisseur B | Action Stripe |
|---------------|---------------|---------------|
| ENCOURS | ENCOURS | Aucun paiement Stripe - 2 commandes créées |
| ENCOURS | CARD | Paiement Stripe = montant B uniquement |
| CARD | ENCOURS | Paiement Stripe = montant A uniquement |
| CARD | CARD | Paiement Stripe = montant A + B combiné |

---

## 💳 RÈGLES DE FRAIS DE PAIEMENT

### Tableau des frais

| Méthode | Type de frais | Montant | Note |
|---------|---------------|---------|------|
| Carte bancaire (crédit) | Surcharge | 2.5% | Toujours |
| Carte bancaire (débit particulier) | Aucun | 0% | Réglementation UE |
| Carte bancaire (débit PRO/entreprise) | Surcharge | 2.5% | Autorisé sur cartes business |
| PayPal | Surcharge | 2.5% | Proposé avec option carte |
| Klarna | Surcharge | 2.5% | Proposé avec option carte |
| Revolut Pay | Surcharge | 2.5% | Proposé avec option carte |
| SEPA Direct Debit | Aucun | 0€ | Frais Stripe absorbés par la plateforme |
| Virement bancaire | Aucun | 0€ | Frais Stripe absorbés par la plateforme |
| Encours | Aucun | 0€ | Pas de paiement Stripe |

### Politique de frais de la plateforme

- **Cartes bancaires / Wallets** : Surcharge de 2.5% facturée au client
- **SEPA / Virement** : Aucun frais pour le client, la plateforme absorbe les frais Stripe
- **Encours** : Pas de paiement immédiat, donc pas de frais

### Réglementation surcharging UE (Important)

Le règlement UE 2015/751 **interdit** le surcharging sur les cartes de paiement des **particuliers**, mais l'**autorise** sur les cartes **professionnelles/entreprises** (corporate cards).

**Règle à appliquer :**
- Carte **crédit** → Surcharge 2.5% ✅
- Carte **débit particulier** → Pas de surcharge ❌
- Carte **débit PRO/entreprise** → Surcharge 2.5% ✅

**Détection dans Stripe :**
Stripe fournit plusieurs informations sur la carte via le Confirmation Token :
- `card.funding` : `credit`, `debit`, `prepaid`
- `card.brand` : `visa`, `mastercard`, `amex`...
- `card.country` : pays d'émission

⚠️ **Limitation** : Stripe ne fournit pas toujours directement l'information "carte pro vs particulier". 

**Solutions possibles :**
1. **Approche sécurisée** : Ne pas surcharger les cartes débit par défaut (évite les litiges)
2. **Approche business B2B** : Puisque ta marketplace est B2B (clients = professionnels), tu peux considérer que toutes les cartes sont professionnelles et appliquer la surcharge
3. **Approche déclarative** : Demander au client de confirmer qu'il utilise une carte professionnelle

**Recommandation pour ta marketplace B2B** : Puisque tes clients sont des `PROFESSIONAL` ou `DISTRIBUTOR` (pas des particuliers), tu peux appliquer la surcharge sur toutes les cartes (crédit ET débit).

### Important

- **AUCUNE commission marketplace** (style 15%) n'est prélevée sur ces paiements
- Les commissions par paliers (4% → 1%) sont pour les **transfers vers fournisseurs**, pas pour le client

---

## 📈 COMMISSIONS PAR PALIERS (MENSUELLES)

Les commissions sont calculées sur le **volume mensuel** (MTD) de chaque fournisseur.

### Paliers

| Volume mensuel du fournisseur | Taux de commission |
|-------------------------------|-------------------|
| 0 - 100 000 € | 4% |
| 100 000 - 300 000 € | 3% |
| 300 000 - 500 000 € | 2% |
| 500 000 - 1 000 000 € | 1.5% |
| > 1 000 000 € | 1% |

### Implémentation

```typescript
// lib/commissions.ts

interface CommissionTier {
  threshold: number;  // en centimes
  rate: number;
  name: string;
}

export const COMMISSION_TIERS: CommissionTier[] = [
  { threshold: 0, rate: 0.04, name: 'Starter' },
  { threshold: 10_000_000, rate: 0.03, name: 'Growth' },
  { threshold: 30_000_000, rate: 0.02, name: 'Scale' },
  { threshold: 50_000_000, rate: 0.015, name: 'Pro' },
  { threshold: 100_000_000, rate: 0.01, name: 'Enterprise' },
];

export function calculateCommission(
  orderAmount: number, // en centimes
  vendorMTDVolume: number // volume mensuel en centimes
): { commissionAmount: number; vendorPayout: number; rate: number; tierName: string } {
  
  let currentTier = COMMISSION_TIERS[0];
  for (const tier of COMMISSION_TIERS) {
    if (vendorMTDVolume >= tier.threshold) {
      currentTier = tier;
    }
  }
  
  const commissionAmount = Math.round(orderAmount * currentTier.rate);
  const vendorPayout = orderAmount - commissionAmount;
  
  return {
    commissionAmount,
    vendorPayout,
    rate: currentTier.rate,
    tierName: currentTier.name,
  };
}

/**
 * Récupère le volume mensuel d'un fournisseur
 */
export async function getVendorMTDVolume(distributorId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const result = await prisma.marketplaceTransfer.aggregate({
    where: {
      distributorId,
      status: 'COMPLETED',
      createdAt: { gte: startOfMonth },
    },
    _sum: { grossAmount: true },
  });
  
  // Convertir en centimes
  return Math.round(Number(result._sum.grossAmount || 0) * 100);
}
```

---

## 🔧 IMPLÉMENTATION STRIPE

### 1. Configuration de base

```typescript
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15',
  typescript: true,
});

// Types
export interface VendorAllocation {
  distributorId: string;
  stripeConnectedAccountId: string;
  amount: number; // en centimes
}

export interface PaymentConfig {
  orderId: string;
  baseAmount: number; // en centimes (avant surcharge)
  paymentMethodType: string;
  vendorAllocations: VendorAllocation[];
}
```

### 2. Elements Provider

```typescript
// components/checkout/CheckoutProvider.tsx
'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Props {
  children: React.ReactNode;
  amount: number; // en centimes
}

export function CheckoutProvider({ children, amount }: Props) {
  const options: StripeElementsOptions = {
    mode: 'payment',
    amount,
    currency: 'eur',
    paymentMethodCreation: 'manual', // CRITIQUE pour surcharging
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0070f3',
        fontFamily: 'system-ui, sans-serif',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
```

### 3. Formulaire de paiement avec surcharging

```typescript
// components/checkout/StripePaymentForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

interface CardInfo {
  brand: string | null;   // visa, mastercard, amex...
  last4: string | null;
  funding: string | null; // credit, debit, prepaid
  country: string | null;
}

interface Props {
  baseAmount: number;
  orderId: string;
  vendorAllocations: VendorAllocation[];
  onSuccess: () => void;
  onError: (error: string) => void;
}

const SURCHARGE_RATE = 0.025; // 2.5%

export function StripePaymentForm({ baseAmount, orderId, vendorAllocations, onSuccess, onError }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [paymentMethodType, setPaymentMethodType] = useState('');
  const [loading, setLoading] = useState(false);
  const [fees, setFees] = useState({ surcharge: 0, total: baseAmount });

  // Calculer les frais en fonction du type sélectionné
  useEffect(() => {
    const surchargeTypes = ['card', 'paypal', 'klarna', 'revolut_pay'];
    // SEPA et virement : 0€ de frais (absorbés par la plateforme)
    
    let surcharge = 0;
    
    if (surchargeTypes.includes(paymentMethodType)) {
      surcharge = Math.round(baseAmount * SURCHARGE_RATE);
    }
    
    setFees({
      surcharge,
      total: baseAmount + surcharge,
    });
  }, [paymentMethodType, baseAmount]);

  // Écouter les changements du Payment Element
  useEffect(() => {
    if (!elements) return;
    const paymentElement = elements.getElement('payment');
    if (!paymentElement) return;

    const handleChange = (event: any) => {
      setPaymentMethodType(event.value?.type || '');
    };

    paymentElement.on('change', handleChange);
    return () => paymentElement.off('change', handleChange);
  }, [elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    try {
      // 1. Valider le formulaire
      const { error: submitError } = await elements.submit();
      if (submitError) {
        onError(submitError.message || 'Erreur de validation');
        return;
      }

      // 2. Créer le Confirmation Token (permet d'inspecter la carte côté serveur)
      const { error: tokenError, confirmationToken } = await stripe.createConfirmationToken({
        elements,
        params: {
          return_url: `${window.location.origin}/checkout/success?order_id=${orderId}`,
        },
      });

      if (tokenError || !confirmationToken) {
        onError(tokenError?.message || 'Erreur token');
        return;
      }

      // 3. Envoyer au serveur pour créer le PaymentIntent avec le bon montant
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationTokenId: confirmationToken.id,
          baseAmount,
          orderId,
          vendorAllocations,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        onError(data.error || 'Erreur serveur');
        return;
      }

      // 4. Confirmer le paiement
      const { error: confirmError } = await stripe.confirmPayment({
        clientSecret: data.clientSecret,
        confirmParams: {
          confirmation_token: confirmationToken.id,
          return_url: `${window.location.origin}/checkout/success?order_id=${orderId}`,
        },
      });

      if (confirmError) {
        onError(confirmError.message || 'Erreur de confirmation');
      }
      // Si pas d'erreur, le client est redirigé vers return_url

    } catch (err: any) {
      onError(err.message || 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card', 'sepa_debit'],
        }}
      />

      {/* Récapitulatif des frais */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{(baseAmount / 100).toFixed(2)} €</span>
        </div>
        
        {fees.surcharge > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Frais carte (2.5%)</span>
            <span>+{(fees.surcharge / 100).toFixed(2)} €</span>
          </div>
        )}
        
        {/* SEPA et virement : pas de frais affichés (absorbés par la plateforme) */}
        
        <div className="flex justify-between font-bold border-t pt-2">
          <span>Total</span>
          <span>{(fees.total / 100).toFixed(2)} €</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Traitement...' : `Payer ${(fees.total / 100).toFixed(2)} €`}
      </button>
    </form>
  );
}
```

### 4. Route API création PaymentIntent

```typescript
// app/api/stripe/create-payment-intent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

const SURCHARGE_RATE = 0.025;
const SURCHARGE_METHODS = ['card', 'paypal', 'klarna', 'revolut_pay'];
// SEPA et virement : 0€ de frais pour le client (absorbés par la plateforme)

export async function POST(request: NextRequest) {
  try {
    const { confirmationTokenId, baseAmount, orderId, vendorAllocations } = await request.json();

    // Récupérer le token pour inspecter le moyen de paiement
    const token = await stripe.confirmationTokens.retrieve(confirmationTokenId);
    const paymentMethodType = token.payment_method_preview?.type || 'unknown';
    
    // Extraire les infos de carte si applicable
    const cardPreview = token.payment_method_preview?.card;
    const cardInfo = cardPreview ? {
      brand: cardPreview.brand,
      last4: cardPreview.last4,
      funding: cardPreview.funding,  // credit, debit, prepaid
      country: cardPreview.country,
    } : null;
    
    // Calculer les frais (surcharge uniquement, pas de frais fixes)
    let surcharge = 0;
    
    if (SURCHARGE_METHODS.includes(paymentMethodType)) {
      // MARKETPLACE B2B : Tous les clients sont des professionnels
      // Donc on applique la surcharge sur TOUTES les cartes (crédit ET débit)
      // La réglementation UE autorise le surcharging sur les cartes professionnelles
      surcharge = Math.round(baseAmount * SURCHARGE_RATE);
      
      // Note: Si tu veux être plus restrictif, décommente le code ci-dessous
      // pour ne pas surcharger les cartes débit particuliers :
      // if (paymentMethodType === 'card' && cardInfo?.funding === 'debit') {
      //   surcharge = 0; // Pas de surcharge sur cartes débit particuliers
      // }
    }
    
    // SEPA et virement : pas de frais additionnels, la plateforme absorbe les frais Stripe
    
    const finalAmount = baseAmount + surcharge;

    // Créer le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      transfer_group: `ORDER_${orderId}`,
      metadata: {
        order_id: orderId,
        base_amount: baseAmount.toString(),
        surcharge_amount: surcharge.toString(),
        payment_method_type: paymentMethodType,
        card_brand: cardInfo?.brand || '',
        card_last4: cardInfo?.last4 || '',
        card_funding: cardInfo?.funding || '',
        vendor_allocations: JSON.stringify(vendorAllocations),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      finalAmount,
      surcharge,
      cardInfo,
    });

  } catch (error: any) {
    console.error('Erreur PaymentIntent:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 5. Webhook principal

```typescript
// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { processVendorTransfers } from '@/lib/transfers';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Signature webhook invalide:', err.message);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  // Idempotence
  const existing = await prisma.stripeEvent.findUnique({
    where: { eventId: event.id },
  });
  if (existing?.status === 'COMPLETED') {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await prisma.stripeEvent.upsert({
    where: { eventId: event.id },
    create: { eventId: event.id, eventType: event.type, status: 'PROCESSING' },
    update: { status: 'PROCESSING' },
  });

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
        
      case 'charge.succeeded':
        // C'est ICI qu'on déclenche les transfers
        await handleChargeSucceeded(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;
        
      case 'transfer.created':
      case 'transfer.failed':
      case 'transfer.reversed':
        await handleTransferEvent(event.type, event.data.object);
        break;
    }

    await prisma.stripeEvent.update({
      where: { eventId: event.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Erreur webhook:', error);
    await prisma.stripeEvent.update({
      where: { eventId: event.id },
      data: { status: 'FAILED', error: error.message },
    });
    return NextResponse.json({ error: 'Erreur traitement' }, { status: 500 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  // Mettre à jour le statut de paiement
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'PAID',
      stripePaymentIntentId: paymentIntent.id,
      surchargeAmount: parseInt(paymentIntent.metadata.surcharge_amount || '0') / 100,
    },
  });
}

async function handleChargeSucceeded(charge: any) {
  const orderId = charge.metadata?.order_id;
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.transfersProcessed) return;

  // Parser les allocations
  const allocations = JSON.parse(charge.metadata?.vendor_allocations || '[]');
  if (allocations.length === 0) return;

  // Créer les transfers vers les fournisseurs
  await processVendorTransfers(orderId, charge.id, allocations);
}

// ... autres handlers
```

### 6. Service de transfers

```typescript
// lib/transfers.ts
import { stripe } from './stripe';
import { prisma } from './prisma';
import { calculateCommission, getVendorMTDVolume } from './commissions';

export async function processVendorTransfers(
  orderId: string,
  chargeId: string,
  allocations: { distributorId: string; stripeConnectedAccountId: string; amount: number }[]
) {
  const transferGroup = `ORDER_${orderId}`;

  for (const allocation of allocations) {
    try {
      // Récupérer le volume mensuel
      const mtdVolume = await getVendorMTDVolume(allocation.distributorId);
      
      // Calculer la commission
      const { commissionAmount, vendorPayout, rate, tierName } = 
        calculateCommission(allocation.amount, mtdVolume);

      // Vérifier le compte
      const account = await stripe.accounts.retrieve(allocation.stripeConnectedAccountId);
      if (account.capabilities?.transfers !== 'active') {
        throw new Error('Compte non prêt pour les transfers');
      }

      // Créer le transfer
      const transfer = await stripe.transfers.create({
        amount: vendorPayout,
        currency: 'eur',
        destination: allocation.stripeConnectedAccountId,
        transfer_group: transferGroup,
        source_transaction: chargeId,
        metadata: {
          order_id: orderId,
          distributor_id: allocation.distributorId,
          gross_amount: allocation.amount.toString(),
          commission_amount: commissionAmount.toString(),
          commission_rate: rate.toString(),
          commission_tier: tierName,
        },
      });

      // Enregistrer en DB
      await prisma.marketplaceTransfer.create({
        data: {
          orderId,
          distributorId: allocation.distributorId,
          stripeTransferId: transfer.id,
          stripeConnectedAccountId: allocation.stripeConnectedAccountId,
          grossAmount: allocation.amount / 100,
          commissionRate: rate,
          commissionAmount: commissionAmount / 100,
          netAmount: vendorPayout / 100,
          status: 'COMPLETED',
        },
      });

    } catch (error: any) {
      console.error(`Transfer échoué pour ${allocation.distributorId}:`, error);
      
      await prisma.marketplaceTransfer.create({
        data: {
          orderId,
          distributorId: allocation.distributorId,
          stripeConnectedAccountId: allocation.stripeConnectedAccountId,
          grossAmount: allocation.amount / 100,
          commissionRate: 0,
          commissionAmount: 0,
          netAmount: 0,
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
    }
  }

  // Marquer la commande comme traitée
  await prisma.order.update({
    where: { id: orderId },
    data: { transfersProcessed: true },
  });
}
```

---

## 📄 PAGE PAIEMENT DES ENCOURS

Cette page permet aux clients de régler leurs commandes passées avec l'encours.

```typescript
// app/paiement/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckoutProvider } from '@/components/checkout/CheckoutProvider';
import { StripePaymentForm } from '@/components/checkout/StripePaymentForm';

interface PendingOrder {
  id: string;
  orderNumber: string;
  distributorId: string;
  distributorName: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate: string;
  isOverdue: boolean;
}

export default function PaiementPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const fetchPendingOrders = async () => {
    const res = await fetch('/api/encours/pending-orders');
    const data = await res.json();
    setOrders(data.orders);
    setLoading(false);
  };

  const selectedOrders = orders.filter(o => selectedIds.includes(o.id));
  const totalToPay = selectedOrders.reduce((sum, o) => sum + o.remainingAmount, 0);

  // Construire les allocations par fournisseur
  const vendorAllocations = selectedOrders.reduce((acc, order) => {
    const existing = acc.find(a => a.distributorId === order.distributorId);
    if (existing) {
      existing.amount += Math.round(order.remainingAmount * 100);
    } else {
      acc.push({
        distributorId: order.distributorId,
        stripeConnectedAccountId: '', // À récupérer
        amount: Math.round(order.remainingAmount * 100),
      });
    }
    return acc;
  }, [] as any[]);

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Paiement des encours</h1>

      {orders.length === 0 ? (
        <p className="text-gray-600">Aucun encours à régler.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Liste des commandes */}
          <div className="space-y-4">
            <h2 className="font-semibold">Commandes en attente</h2>
            
            {orders.map(order => (
              <div
                key={order.id}
                onClick={() => {
                  setSelectedIds(prev =>
                    prev.includes(order.id)
                      ? prev.filter(id => id !== order.id)
                      : [...prev, order.id]
                  );
                }}
                className={`p-4 border rounded-lg cursor-pointer ${
                  selectedIds.includes(order.id) ? 'border-blue-500 bg-blue-50' : ''
                } ${order.isOverdue ? 'border-red-300' : ''}`}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{order.distributorName}</p>
                    <p className="text-sm text-gray-500">#{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">
                      Échéance: {new Date(order.dueDate).toLocaleDateString()}
                      {order.isOverdue && <span className="text-red-600 ml-2">EN RETARD</span>}
                    </p>
                  </div>
                  <p className="font-bold">{order.remainingAmount.toFixed(2)} €</p>
                </div>
              </div>
            ))}

            <div className="p-4 bg-gray-100 rounded-lg">
              <div className="flex justify-between font-bold">
                <span>Total sélectionné</span>
                <span>{totalToPay.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Formulaire de paiement */}
          <div>
            {selectedIds.length > 0 && totalToPay > 0 && (
              <CheckoutProvider amount={Math.round(totalToPay * 100)}>
                <StripePaymentForm
                  baseAmount={Math.round(totalToPay * 100)}
                  orderId={`ENCOURS_${Date.now()}`}
                  vendorAllocations={vendorAllocations}
                  onSuccess={() => {
                    fetchPendingOrders();
                    setSelectedIds([]);
                  }}
                  onError={(err) => alert(err)}
                />
              </CheckoutProvider>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 🗑️ FICHIERS ET CODE À SUPPRIMER

### Champs Prisma à ignorer (ne pas utiliser)

```
Profile:
- hipayAccountId

Order:
- hipayOrderId
- hipayTransactionRef
- hipayAuthCode
- hipayStatus
- hipayForwardUrl

Payment:
- hipayTransactionRef
- hipayAuthCode
- hipayCardBrand
- hipayMaskedPan
- hipayPaymentProduct

MarketplaceTransfer:
- hipayTransferId
- hipayAccountId
```

### Fichiers/dossiers potentiellement legacy à vérifier

```
app/api/stripe/
├── simulate-webhook/     ← Probablement test, à vérifier
├── test-webhook/         ← Probablement test, à vérifier
└── (tout fichier mentionnant Hipay)

Chercher dans tout le code:
- "hipay" (insensible à la casse)
- Imports ou références à des SDK Hipay
- URLs vers api.hipay.com
```

---

## ✅ CHECKLIST DE MIGRATION

### Phase 1: Nettoyage
- [ ] Identifier tous les fichiers contenant du code Hipay
- [ ] Créer une branche de nettoyage
- [ ] Supprimer les imports et dépendances Hipay du package.json
- [ ] Supprimer les fichiers API Hipay
- [ ] Supprimer les composants frontend Hipay

### Phase 2: Structure Stripe
- [ ] Vérifier/créer `lib/stripe.ts`
- [ ] Vérifier/créer `lib/commissions.ts`
- [ ] Vérifier/créer `lib/encours.ts`
- [ ] Vérifier/créer `lib/transfers.ts`

### Phase 3: Routes API
- [ ] `POST /api/stripe/create-payment-intent` - Création PaymentIntent avec surcharge
- [ ] `POST /api/stripe/webhook` - Webhook principal
- [ ] `POST /api/stripe/connect-webhook` - Webhook Connect
- [ ] `GET /api/encours/status` - Statut encours par fournisseur
- [ ] `GET /api/encours/pending-orders` - Commandes encours à payer
- [ ] `POST /api/stripe/refund` - Remboursements

### Phase 4: Frontend
- [ ] `CheckoutProvider.tsx` - Provider Stripe Elements
- [ ] `StripePaymentForm.tsx` - Formulaire paiement avec surcharge
- [ ] Refactoriser la page checkout pour le multi-fournisseur
- [ ] Refactoriser la page `/paiement` pour les encours

### Phase 5: Webhooks
- [ ] Configurer webhook plateforme dans Dashboard Stripe
- [ ] Configurer webhook Connect dans Dashboard Stripe
- [ ] Tester avec `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Phase 6: Tests
- [ ] Paiement CB avec surcharge
- [ ] Paiement SEPA avec frais fixes
- [ ] Paiement multi-fournisseurs
- [ ] Encours + CB combiné
- [ ] Paiement page encours
- [ ] Remboursement total
- [ ] Remboursement partiel

---

## 📚 DOCUMENTATION STRIPE DE RÉFÉRENCE

- [Payment Element](https://docs.stripe.com/payments/payment-element)
- [Confirmation Tokens (surcharging)](https://docs.stripe.com/payments/finalize-payments-on-the-server)
- [Separate Charges and Transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- [Express Accounts](https://docs.stripe.com/connect/express-accounts)
- [Webhooks](https://docs.stripe.com/webhooks)
- [Refunds](https://docs.stripe.com/refunds)
- [SEPA Direct Debit](https://docs.stripe.com/payments/sepa-debit)
- [Bank Transfers](https://docs.stripe.com/payments/bank-transfers)

---

## 🔑 VARIABLES D'ENVIRONNEMENT

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# App
NEXT_PUBLIC_URL=https://your-domain.com
```

---

## 📝 NOTES IMPORTANTES POUR CLAUDE CODE

1. **UNE commande = UN fournisseur** : Dans le schéma, chaque `Order` a un `distributorId`. Si le client achète à plusieurs fournisseurs, plusieurs commandes sont créées.

2. **Le calcul des allocations** se fait côté frontend en groupant par fournisseur avant d'appeler Stripe.

3. **Les transfers sont déclenchés sur `charge.succeeded`**, pas sur `payment_intent.succeeded`, car on a besoin du `chargeId` pour `source_transaction`.

4. **L'encours n'implique PAS Stripe** : Quand un client choisit "Encours", on crée juste la commande avec `paymentMethod='ENCOURS'` et `paymentStatus='PENDING'`.

5. **Les commissions sont MENSUELLES** : Reset au 1er du mois, calculées sur le volume MTD.

6. **Surcharge sur TOUTES les cartes (marketplace B2B)** : Puisque tous tes clients sont des professionnels (`PROFESSIONAL` ou `DISTRIBUTOR`), la réglementation UE autorise le surcharging même sur les cartes débit. Si tu veux être plus restrictif, il y a du code commenté pour exclure les cartes débit.

7. **Tester avec** : `stripe listen --forward-to localhost:3000/api/stripe/webhook`
