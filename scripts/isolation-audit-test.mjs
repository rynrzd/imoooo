/** AUDIT — isolation réelle entre deux utilisateurs. Comptes jetables, supprimés à la fin. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(readFileSync("./.env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim()]));
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, ANON=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET=env.SUPABASE_SECRET_KEY;
const admin=createClient(URL_,SECRET,{auth:{persistSession:false}});
const R=[]; const check=(n,ok,d="")=>{R.push({n,ok});console.log(`${ok?"PASS":"FAIL"}  ${n}${d?` — ${d}`:""}`)};
const stamp=Date.now();
const mk=(x)=>`audit-${x}-${stamp}@nireo-audit.test`;
let A,B;

async function session(email){
  const {data:link,error:le}=await admin.auth.admin.generateLink({type:"magiclink",email});
  if(le) throw new Error("generateLink: "+le.message);
  const c=createClient(URL_,ANON,{auth:{persistSession:false}});
  const {data,error}=await c.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"email"});
  if(error) throw new Error("verifyOtp: "+error.message);
  return {c,id:data.user.id};
}
try{
  for(const l of ["a","b"]){
    const {data,error}=await admin.auth.admin.createUser({email:mk(l),password:"Audit-2026!Secure#x",email_confirm:true});
    if(error) throw new Error(`create ${l}: ${error.message}`);
    if(l==="a") A=data.user; else B=data.user;
  }
  const a=await session(mk("a")), b=await session(mk("b"));
  check("Session réelle obtenue pour A et B", !!a.id && !!b.id);

  // ---- A crée un jeu de données complet ----
  const {data:pA,error:pe}=await a.c.from("properties").insert({owner_id:a.id,name:"AUDIT-A",address:"1 rue A",postal_code:"75001",city:"Paris",type:"T2",surface:40,rooms:2,purchase_price:100000,purchase_date:"2020-01-01",rent:800,charges:50}).select().single();
  check("A crée un logement", !pe, pe?.message);
  if(pe) throw new Error("stop");
  const {data:tA}=await a.c.from("tenants").insert({owner_id:a.id,first_name:"Jean",last_name:"AUDIT",email:"jean@audit.test",phone:"0600000000"}).select().single();
  const {data:lA}=await a.c.from("leases").insert({owner_id:a.id,property_id:pA.id,tenant_id:tA.id,entry_date:"2024-01-01",rent:800,charges:50,deposit:800}).select().single();
  const {data:dA}=await a.c.from("documents").insert({owner_id:a.id,property_id:pA.id,name:"AUDIT bail",category:"bail",file_path:`${a.id}/secret.pdf`}).select().single();
  const {data:eA}=await a.c.from("expenses").insert({owner_id:a.id,property_id:pA.id,label:"AUDIT",category:"travaux",amount:100,date:"2025-01-01"}).select().single();
  const {data:rA}=await a.c.from("rent_payments").insert({owner_id:a.id,lease_id:lA.id,month:"2025-01-01",expected:800}).select().single();
  check("Jeu de données A complet", !!(tA&&lA&&dA&&eA&&rA));

  // ---- B : LECTURE horizontale ----
  const reads=[["properties",pA.id],["tenants",tA.id],["leases",lA.id],["documents",dA.id],["expenses",eA.id],["rent_payments",rA.id]];
  for(const [t,id] of reads){
    const {data}=await b.c.from(t).select("*").eq("id",id);
    check(`IDOR lecture — B ne voit pas ${t} de A`, !data||data.length===0, data?.length?JSON.stringify(data[0]).slice(0,80):"");
  }
  const {data:profA}=await b.c.from("profiles").select("*").eq("id",a.id);
  check("IDOR lecture — B ne voit pas le profil de A", !profA||profA.length===0);
  const {data:subA}=await b.c.from("subscriptions").select("*").eq("user_id",a.id);
  check("IDOR lecture — B ne voit pas l'abonnement de A", !subA||subA.length===0);

  // ---- B : ÉCRITURE horizontale ----
  for(const [t,id] of reads){
    const {data:up}=await b.c.from(t).update({updated_at:new Date().toISOString()}).eq("id",id).select();
    check(`IDOR écriture — B ne modifie pas ${t} de A`, !up||up.length===0);
    const {data:del}=await b.c.from(t).delete().eq("id",id).select();
    check(`IDOR suppression — B ne supprime pas ${t} de A`, !del||del.length===0);
  }

  // ---- B : usurpation d'owner_id ----
  const {error:imp}=await b.c.from("properties").insert({owner_id:a.id,name:"VOL",address:"x",postal_code:"75001",city:"P",type:"T1",surface:10,rooms:1,purchase_price:0,purchase_date:"2020-01-01",rent:0});
  check("B ne peut pas insérer avec owner_id = A", !!imp, imp?.code);

  // ---- B : référence croisée (DoS sur le bien de A) ----
  const {data:tB}=await b.c.from("tenants").insert({owner_id:b.id,first_name:"Bob",last_name:"AUDIT"}).select().single();
  const {error:xo}=await b.c.from("leases").insert({owner_id:b.id,property_id:pA.id,tenant_id:tB.id,entry_date:"2024-06-01",rent:1,charges:0,deposit:0});
  check("B ne peut pas poser un bail sur le logement de A (référence croisée)", !!xo, xo?.message?.slice(0,90));
  const {error:xo2}=await b.c.from("documents").insert({owner_id:b.id,property_id:pA.id,name:"x",category:"autres"});
  check("B ne peut pas rattacher un document au logement de A", !!xo2, xo2?.message?.slice(0,60));
  const {error:xo3}=await b.c.from("rent_payments").insert({owner_id:b.id,lease_id:lA.id,month:"2025-02-01",expected:1});
  check("B ne peut pas créer un loyer sur le bail de A", !!xo3, xo3?.message?.slice(0,60));

  // ---- Élévation de privilèges ----
  const {error:esc1}=await b.c.from("profiles").update({plan:"business"}).eq("id",b.id);
  check("B ne peut pas s'auto-attribuer un plan (profiles.plan)", !!esc1, esc1?.message?.slice(0,70));
  const {error:esc2}=await b.c.from("subscriptions").update({plan:"business",status:"active"}).eq("user_id",b.id);
  check("B ne peut pas modifier son abonnement (subscriptions)", !!esc2, esc2?.message?.slice(0,70));
  const {error:esc3}=await b.c.from("admin_users").insert({user_id:b.id,role:"owner",is_active:true});
  check("B ne peut pas se déclarer administrateur", !!esc3, esc3?.code);
  const {data:esc4}=await b.c.from("admin_users").select("*");
  check("B ne peut pas lister les administrateurs", !esc4||esc4.length===0);

  // ---- Storage ----
  const buf=new Blob([new Uint8Array([0xff,0xd8,0xff,0xdb,0,0,0,0])],{type:"image/jpeg"});
  const pathA=`${a.id}/audit-${stamp}.jpg`;
  const {error:upErr}=await a.c.storage.from("property-photos").upload(pathA,buf,{contentType:"image/jpeg"});
  check("A dépose un fichier privé", !upErr, upErr?.message);
  const {error:dlErr}=await b.c.storage.from("property-photos").download(pathA);
  check("B ne peut pas télécharger le fichier de A", !!dlErr, dlErr?.message?.slice(0,60));
  const {data:signB,error:signErr}=await b.c.storage.from("property-photos").createSignedUrl(pathA,60);
  check("B ne peut pas signer une URL sur le fichier de A", !!signErr||!signB?.signedUrl, signErr?.message?.slice(0,60));
  await b.c.storage.from("property-photos").remove([pathA]);
  const {data:still}=await admin.storage.from("property-photos").list(a.id);
  check("B ne peut pas supprimer le fichier de A", (still??[]).some(f=>f.name===`audit-${stamp}.jpg`));
  const {error:evil}=await b.c.storage.from("property-photos").upload(`${a.id}/vol-${stamp}.jpg`,buf,{contentType:"image/jpeg"});
  check("B ne peut pas écrire dans le dossier de A", !!evil, evil?.message?.slice(0,50));
  const {error:mime}=await b.c.storage.from("property-photos").upload(`${b.id}/x-${stamp}.svg`,new Blob(["<svg onload=alert(1)>"],{type:"image/svg+xml"}),{contentType:"image/svg+xml"});
  check("Envoi d'un SVG refusé par le serveur (type MIME borné)", !!mime, mime?.message?.slice(0,60));
  const {error:htm}=await b.c.storage.from("property-documents").upload(`${b.id}/x-${stamp}.html`,new Blob(["<script>alert(1)</script>"],{type:"text/html"}),{contentType:"text/html"});
  check("Envoi d'un HTML refusé par le serveur", !!htm, htm?.message?.slice(0,60));
  const {error:trav}=await b.c.storage.from("property-photos").upload(`${b.id}/../${a.id}/trav-${stamp}.jpg`,buf,{contentType:"image/jpeg"});
  check("Traversée de chemin (../) refusée ou neutralisée", !!trav, trav?.message?.slice(0,60) ?? "ACCEPTÉE — à vérifier");

  // ---- Quotas serveur (plan free = 1 logement) ----
  const {error:q1}=await b.c.from("properties").insert({owner_id:b.id,name:"Q1",address:"x",postal_code:"75001",city:"P",type:"T1",surface:10,rooms:1,purchase_price:0,purchase_date:"2020-01-01",rent:0});
  const {error:q2}=await b.c.from("properties").insert({owner_id:b.id,name:"Q2",address:"x",postal_code:"75001",city:"P",type:"T1",surface:10,rooms:1,purchase_price:0,purchase_date:"2020-01-01",rent:0});
  check("Quota serveur : 2e logement refusé en plan Free", !q1 && !!q2, `1er:${q1?.message?.slice(0,40)??"ok"} 2e:${q2?.message?.slice(0,50)??"ACCEPTÉ"}`);

  // ---- Course sur le quota (5 requêtes simultanées) ----
  await b.c.from("properties").delete().eq("owner_id",b.id);
  const race=await Promise.all([0,1,2,3,4].map(i=>b.c.from("properties").insert({owner_id:b.id,name:`R${i}`,address:"x",postal_code:"75001",city:"P",type:"T1",surface:10,rooms:1,purchase_price:0,purchase_date:"2020-01-01",rent:0})));
  const okCount=race.filter(r=>!r.error).length;
  const {count:finalCount}=await admin.from("properties").select("*",{count:"exact",head:true}).eq("owner_id",b.id);
  check("Course : 5 créations simultanées ne dépassent pas le quota Free (1)", finalCount<=1, `acceptées=${okCount} en base=${finalCount}`);
}catch(e){ console.log("ERREUR:",e.message); }
finally{
  for(const u of [A,B]) if(u) await admin.auth.admin.deleteUser(u.id).catch(()=>{});
  console.log("\nNettoyage : comptes d'audit supprimés.");
  console.log(`\n${R.filter(r=>r.ok).length}/${R.length} tests PASS`);
  const f=R.filter(r=>!r.ok); if(f.length) console.log("ÉCHECS :\n"+f.map(x=>"  - "+x.n).join("\n"));
}
