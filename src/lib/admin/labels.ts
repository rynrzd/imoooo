/** Libellés français des actions du journal d'audit et statuts admin. */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.login": "Connexion admin",
  "admin.login_refused": "Connexion refusée",
  "admin.logout": "Déconnexion admin",
  "user.suspend": "Suspension de compte",
  "user.reactivate": "Réactivation de compte",
  "user.ban": "Bannissement de compte",
  "user.delete": "Suppression de compte",
  "user.change_plan": "Changement de plan",
  "user.note": "Note interne ajoutée",
  "subscription.cancel_period_end": "Abonnement annulé (fin de période)",
  "subscription.cancel_now": "Abonnement annulé (immédiat)",
  "subscription.sync": "Synchronisation Stripe",
  "subscription.change_plan": "Changement de plan (Stripe)",
  "promo.create": "Code promo créé",
  "promo.update": "Code promo modifié",
  "promo.toggle": "Code promo activé/désactivé",
  "support.status": "Statut de ticket modifié",
  "support.priority": "Priorité de ticket modifiée",
  "support.note": "Note interne de ticket",
  "support.reply": "Réponse envoyée au ticket",
  "settings.update": "Paramètre du site modifié",
  "founder.config": "Configuration Fondateur modifiée",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Essai",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  inactive: "Inactif",
};

export const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  starter: "Starter",
  pro: "Pro",
  business: "Business+",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
  ferme: "Fermé",
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
};
