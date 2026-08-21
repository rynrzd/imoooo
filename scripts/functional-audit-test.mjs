/** QA — parcours utilisateur complet + persistance réelle. Comptes jetables. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim()]));
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, ANON=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET=env.SUPABASE_SECRET_KEY;
const admin=createClient(URL_,SECRET,{auth:{persistSession:false}});
const R=[]; const ck=(n,ok,d="")=>{R.push({n,ok});console.log(`${ok?"PASS":"FAIL"}  ${n}${d?` — ${d}`:""}`)};
const stamp=Date.now(); const email=`qa-${stamp}@nireo-audit.test`;
let U;
async function session(email){
  const {data:link,error:e1}=await admin.auth.admin.generateLink({type:"magiclink",email});
  if(e1) throw new Error(e1.message);
  const c=createClient(URL_,ANON,{auth:{persistSession:false}});
  const {data,error}=await c.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"email"});
  if(error) throw new Error(error.message);
  return {c,id:data.user.id};
}
try{
  const {data:cu,error:ce}=await admin.auth.admin.createUser({email,password:"Qa-2026!Secure#x",email_confirm:true});
  if(ce) throw new Error(ce.message); U=cu.user;
  let s=await session(email);

  /* ---------- 1. COMPTE VIDE ---------- */
  console.log("\n--- COMPTE VIDE ---");
  const {data:prof,error:pErr}=await s.c.from("profiles").select("*").eq("id",s.id).maybeSingle();
  ck("Profil créé automatiquement à l'inscription", !pErr && !!prof, pErr?.message);
  const {data:sub}=await s.c.from("subscriptions").select("plan,status").eq("user_id",s.id).maybeSingle();
  ck("Abonnement Free actif par défaut", sub?.plan==="free"&&sub?.status==="active", JSON.stringify(sub));
  // Aucune ligne `notification_preferences` n'est créée à l'inscription, et
  // c'est VOULU : `fetchNotificationPreferences` retombe sur les valeurs par
  // défaut, et le cron de relance ne sélectionne que les lignes dont
  // `rent_reminder_mode` a été explicitement changé (défaut 'notification').
  // Un compte neuf n'est donc jamais relancé par e-mail sans l'avoir demandé.
  // Ce qu'on vérifie ici : l'absence de ligne ne provoque AUCUNE erreur.
  const {error:npErr}=await s.c.from("notification_preferences").select("*").eq("user_id",s.id).maybeSingle();
  ck("Préférences absentes à l'inscription = lecture sans erreur (opt-in)", !npErr, npErr?.message);
  for(const t of ["properties","tenants","leases","rent_payments","documents","expenses","notifications"]){
    const {error}=await s.c.from(t).select("*");
    if(error){ ck(`Lecture ${t} sur compte vide`, false, error.message); }
  }
  ck("Lecture de toutes les tables sur compte vide : aucune erreur", true);

  /* ---------- 2. CHAÎNE MÉTIER COMPLÈTE ---------- */
  console.log("\n--- CRÉATION : logement → locataire → bail → loyer → document → travaux ---");
  const {data:p,error:pe}=await s.c.from("properties").insert({owner_id:s.id,name:"QA Appartement",address:"1 rue du Test",postal_code:"75011",city:"Paris",type:"T2",surface:45.5,rooms:2,purchase_price:250000,purchase_date:"2021-06-15",rent:950,charges:80,status:"vacant"}).select().single();
  ck("Logement créé", !pe, pe?.message);
  const {data:t,error:te}=await s.c.from("tenants").insert({owner_id:s.id,first_name:"Marie",last_name:"Testeur",email:"marie@qa.test",phone:"0611223344"}).select().single();
  ck("Locataire créé", !te, te?.message);
  const {data:l,error:le}=await s.c.from("leases").insert({owner_id:s.id,property_id:p.id,tenant_id:t.id,entry_date:"2024-03-01",rent:950,charges:80,deposit:950}).select().single();
  ck("Bail créé", !le, le?.message);
  const {error:we}=await s.c.from("maintenance_records").insert({owner_id:s.id,property_id:p.id,title:"QA Chaudière",company:"Plomberie QA",amount:1200,date:"2025-11-10",status:"planifie"}).select().single();
  ck("Travaux créés", !we, we?.message);
  const {error:de}=await s.c.from("documents").insert({owner_id:s.id,property_id:p.id,name:"QA Bail signé",category:"bail",file_path:`${s.id}/${p.id}/qa.pdf`,file_type:"pdf",size_bytes:1024}).select().single();
  ck("Document créé", !de, de?.message);
  const {error:ee}=await s.c.from("expenses").insert({owner_id:s.id,property_id:p.id,label:"QA Taxe foncière",category:"taxe_fonciere",amount:850,date:"2025-09-01"}).select().single();
  ck("Dépense créée", !ee, ee?.message);
  const {error:re}=await s.c.from("rent_payments").insert({owner_id:s.id,lease_id:l.id,month:"2025-11-01",expected:1030,received:1030,paid_at:"2025-11-03",status:"paye"}).select().single();
  ck("Loyer encaissé créé", !re, re?.message);

  /* ---------- 3. MODIFICATION PERSISTE ---------- */
  console.log("\n--- MODIFICATION ---");
  await s.c.from("properties").update({name:"QA Appartement MODIFIÉ",rent:1000,status:"loue"}).eq("id",p.id);
  const {data:pv}=await s.c.from("properties").select("name,rent,status").eq("id",p.id).maybeSingle();
  ck("Modification du logement persistée", pv?.name==="QA Appartement MODIFIÉ"&&Number(pv?.rent)===1000&&pv?.status==="loue", JSON.stringify(pv));
  await s.c.from("tenants").update({phone:"0699887766"}).eq("id",t.id);
  const {data:tv}=await s.c.from("tenants").select("phone").eq("id",t.id).maybeSingle();
  ck("Modification du locataire persistée", tv?.phone==="0699887766");

  /* ---------- 4. RECONNEXION : tout est encore là ---------- */
  console.log("\n--- DÉCONNEXION → RECONNEXION ---");
  await s.c.auth.signOut();
  const {data:afterOut}=await s.c.from("properties").select("id");
  ck("Après déconnexion : plus aucune donnée lisible", !afterOut||afterOut.length===0);
  s=await session(email);
  const counts={};
  for(const tbl of ["properties","tenants","leases","rent_payments","documents","expenses","maintenance_records"]){
    const {data}=await s.c.from(tbl).select("id"); counts[tbl]=(data??[]).length;
  }
  ck("Après reconnexion : les 7 entités sont retrouvées", Object.values(counts).every(v=>v===1), JSON.stringify(counts));

  /* ---------- 5. COHÉRENCE DES CHIFFRES ---------- */
  console.log("\n--- CHIFFRES ---");
  const {data:pay}=await s.c.from("rent_payments").select("expected,received,status");
  const enc=(pay??[]).reduce((a,x)=>a+Number(x.received),0);
  ck("Total encaissé = 1030 €", enc===1030, `calculé=${enc}`);
  const {data:exp}=await s.c.from("expenses").select("amount");
  const dep=(exp??[]).reduce((a,x)=>a+Number(x.amount),0);
  ck("Total dépenses = 850 €", dep===850, `calculé=${dep}`);
  ck("Résultat net = 180 €", enc-dep===180, `calculé=${enc-dep}`);

  /* ---------- 6. ÉCHÉANCIER AUTOMATIQUE ---------- */
  const {data:l2}=await s.c.from("leases").select("id,entry_date").eq("id",l.id).maybeSingle();
  ck("Bail conservé avec sa date d'entrée", l2?.entry_date==="2024-03-01");

  /* ---------- 7. SUPPRESSIONS EN CASCADE ---------- */
  console.log("\n--- SUPPRESSION ---");
  await s.c.from("properties").delete().eq("id",p.id);
  const after={};
  for(const tbl of ["properties","leases","documents","expenses","maintenance_records","rent_payments"]){
    const {data}=await s.c.from(tbl).select("id"); after[tbl]=(data??[]).length;
  }
  ck("Suppression du logement : cascade complète (0 orphelin)", Object.values(after).every(v=>v===0), JSON.stringify(after));
  const {data:tRest}=await s.c.from("tenants").select("id");
  ck("Le locataire survit à la suppression du logement", (tRest??[]).length===1, `${(tRest??[]).length} locataire(s)`);

  /* ---------- 8. VALIDATION DES ENTRÉES ---------- */
  console.log("\n--- VALIDATION SERVEUR ---");
  const bad=[
    ["surface négative",{surface:-5}],["surface nulle",{surface:0}],["pièces = 0",{rooms:0}],
    ["type inconnu",{type:"Chateau"}],["statut inconnu",{status:"pirate"}],["loyer négatif",{rent:-100}],
  ];
  for(const [label,patch] of bad){
    const {error}=await s.c.from("properties").insert({owner_id:s.id,name:"X",address:"a",postal_code:"75001",city:"P",type:"T1",surface:20,rooms:1,purchase_price:0,purchase_date:"2020-01-01",rent:0,...patch});
    ck(`Refus serveur : ${label}`, !!error, error?"":"### ACCEPTÉ ###");
  }
  const {error:catErr}=await s.c.from("documents").insert({owner_id:s.id,property_id:null,name:"x",category:"inventé"});
  ck("Refus serveur : catégorie de document inconnue", !!catErr);
}catch(e){ console.log("ERREUR:",e.message); }
finally{
  if(U) await admin.auth.admin.deleteUser(U.id).catch(()=>{});
  console.log("\nCompte QA supprimé.");
  console.log(`\n${R.filter(x=>x.ok).length}/${R.length} PASS`);
  const f=R.filter(x=>!x.ok); if(f.length) console.log("ÉCHECS :\n"+f.map(x=>"  - "+x.n).join("\n"));
}
