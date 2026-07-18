This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## TODO — prochaines étapes

1. ~~Storage réel~~ ✅ fait : upload des documents/photos vers les buckets privés (`property-documents`, `property-photos`, `expense-receipts`, `profile-avatars`), chemins `{owner_id}/{property_id}/…` déjà prévus (`file_path`).
2. ~~URL signées~~ ✅ fait : résoudre `file_path` → `createSignedUrl()` dans `src/lib/supabase/queries.ts` (mapper `mapPhoto` / téléchargement documents).
3. ~~Suppression sécurisée des fichiers~~ ✅ fait : supprimer l'objet Storage avec la ligne (documents, photos, justificatifs).
4. **Génération des échéances de loyers** : créer automatiquement les lignes `rent_payments` de chaque mois pour les baux actifs (fonction SQL planifiée ou à la volée).
5. **Limites par abonnement** : plafonds (nb logements, stockage) selon le plan, vérifiés côté serveur.
6. **Stripe** : abonnements (checkout, portail client, webhooks → table `subscriptions`).
7. **E-mails & rappels** : relances loyers en retard, rapport mensuel (Resend + cron Supabase).
8. **Déploiement production** : Vercel + variables d'env, domaines de redirection Supabase.
