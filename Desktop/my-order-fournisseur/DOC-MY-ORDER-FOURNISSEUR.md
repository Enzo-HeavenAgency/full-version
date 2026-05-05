# My-Order Fournisseur

Plateforme marketplace B2B permettant aux distributeurs de gérer leur catalogue, leurs commandes, leurs clients et leurs opérations logistiques.

## Fonctionnalités

### Gestion des commandes

- Création, suivi et gestion complète des commandes
- Statuts : `PENDING` > `CONFIRMED` > `PROCESSING` > `READY` > `COLLECTED` (+ `CANCELLED`, `EN_ATTENTE_VALIDATION`)
- Suivi du paiement : `PENDING`, `PARTIAL`, `PAID`, `REFUNDED`, `AUTHORIZED`, `CAPTURED`, `REFUSED`
- Livraison partielle (split d'une commande en plusieurs livraisons)
- Validation de commande
- Génération de lien de paiement Stripe
- Envoi d'emails de confirmation
- Vérification de livraison (photo, signature, plaque d'immatriculation)
- Génération PDF (bon de commande, facture)

### Retours et remboursements

- Workflow complet : `PENDING` > `APPROVED` > `PROCESSING` > `COMPLETED` (+ `REJECTED`, `CANCELLED`)
- Retour partiel ou total
- Génération automatique d'un avoir (credit note) à la finalisation
- Création d'un ajustement de commande (order adjustment)
- Remboursement Stripe avec calcul de commission (15%)
- Suivi des dettes distributeur (commission déduite)
- Génération PDF du retour

### Avoirs et crédits

- Création automatique lors de la finalisation d'un retour
- Statuts : `ISSUED`, `PARTIALLY_APPLIED`, `FULLY_APPLIED`, `VOID`
- Application d'un avoir sur une nouvelle commande
- Historique complet des crédits par client
- Numérotation unique des avoirs

### Catalogue produits

- Gestion des produits avec variantes (SKU, prix, spécifications)
- Attributs dynamiques par produit
- Tarification personnalisée par distributeur (`DistributorProduct`)
- Produits en bundle (kits)
- Catégories hiérarchiques
- Fiches techniques (PDF)
- Statuts : `PUBLISHED`, `DRAFT`, `ARCHIVED`, `ACTIVE`, `INACTIVE`, `DISCONTINUED`, `PENDING_APPROVAL`
- Demandes de nouveaux produits (product requests)

### Gestion des stocks

- Inventaire par entrepôt
- Mouvements de stock avec traçabilité complète
- Alertes de stock bas
- Suivi des entrées/sorties

### Entrepôts

- Gestion multi-entrepôts par distributeur
- Horaires d'ouverture configurables (jours + créneaux)
- Zones de livraison
- Bons de livraison (delivery notes)

### Codes promotionnels

- Création de codes promo par distributeur
- Types : remise fixe ou pourcentage
- Limites d'utilisation et dates de validité
- Suivi de l'utilisation par code
- Application à la commande

### Programme de fidélité

- Système de points de fidélité
- Transactions de points
- Goodies échangeables contre des points

### Relations clients

- Gestion des relations distributeur-client (B2B)
- Demandes de connexion (connection requests)
- Paramétrage par client : limites de crédit, conditions de paiement
- Gestion des encours
- Historique des commandes par relation

### Paiements

- **Stripe** : Payment Intents
- **Stripe Connect** : Comptes connectés pour les distributeurs, onboarding, dashboard, transferts marketplace
- **Paiements internes** : Système d'encours (achat maintenant, paiement différé)
- **Virements bancaires** : Suivi manuel avec upload de justificatif
- Commissions marketplace avec résumé mensuel

### Service après-vente (SAV)

- Création de demandes SAV (marque, numéro de série, description)
- Statuts : `SUBMITTED` > `IN_PROGRESS` > `RESOLVED` > `CLOSED`
- Commentaires sur les demandes
- Upload de photos
- Notifications
- Génération PDF du rapport SAV

### Messagerie

- Conversations entre utilisateurs
- Participants multiples par conversation
- Statut de lecture des messages
- Pièces jointes

### Connecteurs de données

- Framework de connecteurs pour sources de données externes
- Configuration d'instances de connecteur
- Mapping de champs personnalisable
- Synchronisation manuelle ou planifiée (cron)
- Réception de données via webhooks
- Upload de fichiers de données
- Logs de synchronisation et suivi des erreurs

### Génération PDF

- Factures
- Bons de commande
- Documents de retour
- Rapports SAV

### Notifications

- Emails transactionnels (Nodemailer)
- Notifications push iOS (APNS)
- Notifications SAV in-app

### Statistiques et dashboard

- Statistiques du tableau de bord
- Graphiques (Recharts)
- Top produits, commandes récentes, revenus