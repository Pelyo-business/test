/* =========================================================================
   Resto IA — application GÉRANT.
   Direction B validée : « Console silencieuse ».

   Un seul élément domine chaque écran ; tout le reste est relégué en bas,
   en petit, à faible opacité. Aucune bordure, aucun fond de bloc, aucun
   séparateur : la hiérarchie ne tient qu'à la taille et à l'opacité. Les
   réglages s'ouvrent en feuilles plein écran, une tâche à la fois.

   ES5 strict. Toutes les classes commencent par g-. Voir src/gerant.css.
   ========================================================================= */
(function(){
  "use strict";

  var api, root, D_;
  var ecran = "soir";
  var menuOuvert = false;
  var charge, voix, ouvert = true, reprise = "";
  var rupt = {}, forfait, langues;
  var rejeu = null;          /* état du rejeu d'appel */
  var sheet = null;          /* feuille plein écran */

  var ECRANS = [
    { id:"soir",      lbl:"Ce soir" },
    { id:"appels",    lbl:"Appels" },
    { id:"carte",     lbl:"Carte" },
    { id:"assistant", lbl:"Assistant" },
    { id:"reglages",  lbl:"Réglages" }
  ];

  function esc(s){ return api.esc(s); }
  function niveau(){
    for (var i = 0; i < D_.charges.length; i++) if (D_.charges[i].id === charge) return D_.charges[i];
    return D_.charges[0];
  }
  function leForfait(){
    for (var i = 0; i < D_.forfaits.length; i++) if (D_.forfaits[i].id === forfait) return D_.forfaits[i];
    return D_.forfaits[2];
  }
  function nomEcran(){
    for (var i = 0; i < ECRANS.length; i++) if (ECRANS[i].id === ecran) return ECRANS[i].lbl;
    return "";
  }

  /* --------------------------- fragments communs --------------------------- */
  function statusbar(){
    return '<div class="g-status"><span data-hor>' + esc(api.heure()) + '</span>' +
      '<span>' + esc(D_.resto.nom) + '</span></div>';
  }
  function nav(){
    return '<button class="g-nav" data-menu><i></i><em>' + esc(nomEcran()) + '</em></button>';
  }
  function menu(){
    return '<div class="g-center g-fade"><div class="g-menu">' +
      ECRANS.map(function(e){
        return '<button data-ecran="' + e.id + '" class="' + (ecran === e.id ? "g-on" : "") + '">' +
          esc(e.lbl) + '</button>';
      }).join("") +
      '</div></div>' +
      '<div class="g-foot"><button class="g-act g-off" data-menu>Fermer</button></div>';
  }

  /* ------------------------------- ce soir ------------------------------- */
  function vueSoir(){
    var lv = niveau();
    var j = D_.jour;
    var taille = lv.nom.length > 12 ? " g-small" : (lv.nom.length > 6 ? " g-mid" : "");
    return '<div class="g-top">Service en cours</div>' +
      '<div class="g-center g-fade">' +
        '<div class="g-mode' + taille + '">' + esc(lv.nom) + '</div>' +
        '<div class="g-delay">' + (ouvert && lv.delai ? lv.delai + " minutes annoncées" : "commandes arrêtées · reprise " + esc(reprise || "21h15")) + '</div>' +
        '<p class="g-say">« ' + esc(lv.dit) + ' »</p>' +
      '</div>' +
      '<div class="g-foot">' +
        '<div class="g-dial">' +
          D_.charges.map(function(c){
            return '<button data-charge="' + c.id + '" class="' + (charge === c.id ? "g-on" : "") + '">' +
              esc(c.nom) + '</button>';
          }).join("") +
        '</div>' +
        '<p class="g-micro">' + j.appels + ' appels pris · ' + j.commandes + ' commandes · ' +
          esc(api.eur0(j.ca)) + ' récupérés<br>' + j.expirees + ' expirées · ' + j.transferts +
          ' transferts · ' + j.minutes + ' minutes sur ' + leForfait().minutes + '</p>' +
        '<div class="g-acts">' +
          '<button class="g-act" data-arret>' + (ouvert ? "Arrêter 30 minutes" : "Reprendre les commandes") + '</button>' +
          '<button class="g-act g-off" data-cuisine>Écran cuisine</button>' +
        '</div>' +
      '</div>';
  }

  /* -------------------------------- appels -------------------------------- */
  function vueAppels(){
    if (rejeu) return vueRejeu();
    var a = D_.appels;
    return '<div class="g-top">Ce soir · ' + a.length + ' appels</div>' +
      '<div class="g-center g-flow g-fade"><div class="g-list" style="padding-top:26px">' +
        a.map(function(x, i){
          var issue = x.issue === "commande" ? esc(api.eur(x.montant))
                    : x.issue === "transfert" ? "transféré"
                    : x.issue === "expiree" ? "expiré" : "question";
          return '<div class="g-row' + (x.issue === "expiree" ? " g-out" : "") + '">' +
            '<button data-appel="' + i + '"><span class="g-k">' + esc(x.num) +
              '<span class="g-s">' + esc(x.h) + ' · ' + esc(api.dur(x.duree)) +
              (x.info ? ' · ' + esc(x.info) : (x.cmd ? ' · commande ' + x.cmd : '')) + '</span></span></button>' +
            '<span class="g-v' + (x.issue === "commande" ? " g-cu" : "") + '">' + issue + '</span>' +
          '</div>';
        }).join("") +
      '</div></div>' +
      '<div class="g-foot">' +
        '<div class="g-acts"><button class="g-act" data-rejeu>Rejouer un appel</button></div>' +
        '<p class="g-micro g-dim">' + esc(D_.regles.confirmation) + '</p>' +
      '</div>';
  }

  function vueRejeu(){
    var r = rejeu;
    var lignes = r.vues.map(function(e){
      if (e.qui === "sys") return '<p class="g-sys">' + esc(e.txt) + '</p>';
      if (e.qui === "me")  return '<p class="g-me">' + esc(e.txt) + '</p>';
      return '<p class="g-bot">' + esc(e.txt) + '</p>';
    }).join("");
    var panier = r.panier
      ? r.panier.q + "× " + r.panier.nom + (r.panier.sup ? " + " + r.panier.sup : "") +
        "<br>" + r.panier.opt + " — " + api.eur(r.panier.prix)
      : "panier vide — l'IA construit en silence";

    return '<div class="g-top">Appel en direct · ' + api.chrono(r.t) + ' · ' +
        esc(api.eur(Math.round(r.t / 60 * D_.coutMinute))) + '</div>' +
      '<div class="g-center g-flow">' +
        '<div class="g-basket">' + panier + '</div>' +
        '<div class="g-tr" data-tr>' + lignes + '</div>' +
        '<div class="g-block' + (r.sms ? " g-on" : "") + '">' +
          '<p class="g-smslab">Récapitulatif envoyé</p>' +
          '<p class="g-sms">' + esc(D_.sms) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="g-foot">' +
        '<p class="g-micro">' + (r.fini ? "Commande 248 confirmée par le client, envoyée en cuisine." :
          (r.confirme ? "Le client a validé." : "Rien ne part en cuisine avant confirmation.")) + '</p>' +
        '<div class="g-acts">' +
          '<button class="g-act" data-rejeu>' + (r.fini ? "Rejouer" : "Reprendre au début") + '</button>' +
          '<button class="g-act g-off" data-transfert>Transférer</button>' +
          '<button class="g-act g-off" data-stoprejeu>Fermer</button>' +
        '</div>' +
      '</div>';
  }

  /* --------------------------------- carte --------------------------------- */
  function vueCarte(){
    var off = 0;
    D_.menu.forEach(function(c){ c.items.forEach(function(i){ if (rupt[i.id]) off++; }); });
    return '<div class="g-top">Carte · ' + D_.menu.length + ' catégories' +
      (off ? ' · ' + off + ' en rupture' : '') + '</div>' +
      '<div class="g-center g-flow g-fade"><div class="g-list" style="padding-top:22px">' +
        D_.menu.map(function(cat){
          return '<p class="g-lab" style="margin:10px 0 2px">' + esc(cat.cat) + '</p>' +
            cat.items.map(function(it){
              var ko = rupt[it.id] || !it.dispo;
              return '<div class="g-row' + (ko ? " g-out" : "") + '">' +
                '<button data-produit="' + it.id + '"><span class="g-k">' + esc(it.nom) +
                  '<span class="g-s">' + esc(it.inclus || it.prec || "—") + '</span></span></button>' +
                '<span class="g-v' + (ko ? " g-cu" : "") + '">' + (ko ? "rupture" : esc(api.eur(it.prix))) + '</span>' +
              '</div>';
            }).join("");
        }).join("") +
      '</div></div>' +
      '<div class="g-foot"><div class="g-acts">' +
        '<button class="g-act" data-import>Importer une carte</button>' +
      '</div></div>';
  }

  function feuilleProduit(id){
    var item = null, cat = "";
    D_.menu.forEach(function(c){ c.items.forEach(function(i){ if (i.id === id){ item = i; cat = c.cat; } }); });
    if (!item) return "";
    var ko = rupt[item.id] || !item.dispo;
    return '<div class="g-top">' + esc(cat) + '</div>' +
      '<div class="g-body">' +
        '<div style="text-align:center"><div class="g-figure">' + esc(api.eur(item.prix)) + '</div>' +
          '<p class="g-note" style="margin:14px auto 0">' + esc(item.nom) +
          (item.inclus ? ' — ' + esc(item.inclus) : '') + '</p></div>' +
        (item.obl.length ? '<div><p class="g-lab">Questions posées, dans cet ordre</p>' +
          '<div class="g-list" style="margin-top:12px">' +
          item.obl.map(function(o, i){
            return '<div class="g-row"><span class="g-k">' + (i+1) + '. ' + esc(o.nom) +
              '<span class="g-s">' + esc(o.choix) + '</span></span>' +
              '<span class="g-v">' + (o.min === o.max ? o.min : o.min + "–" + o.max) + '</span></div>';
          }).join("") + '</div></div>' : '') +
        (item.sup.length ? '<div><p class="g-lab">Suppléments</p><div class="g-list" style="margin-top:12px">' +
          item.sup.map(function(s){
            return '<div class="g-row' + (s.dispo ? "" : " g-out") + '"><span class="g-k">' + esc(s.nom) + '</span>' +
              '<span class="g-v">' + (s.dispo ? "+ " + esc(api.eur(s.prix)) : "rupture") + '</span></div>';
          }).join("") + '</div></div>' : '') +
        (item.prec ? '<div><p class="g-lab">Précisions</p><p class="g-para">' + esc(item.prec) + '</p>' +
          '<p class="g-note g-cu" style="margin-top:10px">' + esc(D_.regles.allergenes) + '</p></div>' : '') +
        (item.dem ? '<div><p class="g-lab">Demandes admises</p><p class="g-para">' + esc(item.dem) + '</p></div>' : '') +
      '</div>' +
      '<div class="g-foot"><div class="g-acts">' +
        '<button class="g-act" data-rupture="' + item.id + '">' + (ko ? "Remettre en carte" : "Mettre en rupture") + '</button>' +
        '<button class="g-act g-off" data-fermer>Fermer</button>' +
      '</div></div>';
  }

  function feuilleImport(){
    var etapes = [
      "Photo de la carte, PDF, site web ou saisie",
      "L'IA propose catégories, produits, tailles et prix",
      "Vous vérifiez chaque ligne",
      "Publication — la nouvelle carte s'applique au prochain appel"
    ];
    var n = sheet.etape || 0;
    return '<div class="g-top">Importer une carte</div>' +
      '<div class="g-body g-mid-v">' +
        '<div class="g-figure' + (n < etapes.length ? " g-pulse" : "") + '">' +
          (n < etapes.length ? Math.round(n / etapes.length * 100) + '<small>%</small>' : 'Prêt') + '</div>' +
        '<div class="g-steps" style="max-width:280px">' +
          etapes.map(function(e, i){
            return '<p class="g-step' + (i < n ? " g-done" : (i === n ? " g-on" : "")) + '">' + esc(e) + '</p>';
          }).join("") +
        '</div>' +
      '</div>' +
      '<div class="g-foot"><div class="g-acts">' +
        (n >= etapes.length
          ? '<button class="g-act" data-publier>Publier la carte</button>'
          : '<button class="g-act g-off" data-fermer>Annuler</button>') +
      '</div></div>';
  }

  /* ------------------------------- assistant ------------------------------- */
  function vueAssistant(){
    return '<div class="g-top">Voix de l\'assistant</div>' +
      '<div class="g-center g-fade">' +
        '<div class="g-name">' + esc(voix.prenom) + '</div>' +
        '<div class="g-delay">' + esc(voix.ton) + ' · ' + esc(voix.vitesse) + ' · ' + langues.join(" ") + '</div>' +
        '<p class="g-quote" style="margin-top:26px;max-width:270px">« ' + esc(voix.accueil) + ' »</p>' +
      '</div>' +
      '<div class="g-foot">' +
        '<div class="g-dial">' +
          D_.tons.map(function(t){
            return '<button data-ton="' + esc(t) + '" class="' + (voix.ton === t ? "g-on" : "") + '">' + esc(t) + '</button>';
          }).join("") +
        '</div>' +
        '<div class="g-dial">' +
          D_.vitesses.map(function(v){
            return '<button data-vitesse="' + esc(v) + '" class="' + (voix.vitesse === v ? "g-on" : "") + '">' + esc(v) + '</button>';
          }).join("") +
        '</div>' +
        '<p class="g-micro g-dim">L\'assistant annonce toujours qu\'il est automatisé. Un changement ne s\'applique jamais au milieu d\'un appel.</p>' +
        '<div class="g-acts">' +
          '<button class="g-act" data-test>Appel test</button>' +
          '<button class="g-act g-off" data-signature>Voix signature</button>' +
          '<button class="g-act g-off" data-prenom>Prénom</button>' +
        '</div>' +
      '</div>';
  }

  function feuilleSignature(){
    return '<div class="g-top">Voix signature</div>' +
      '<div class="g-body g-mid-v">' +
        '<div class="g-figure">1<small>min</small></div>' +
        '<p class="g-note" style="margin-top:8px">Vous lisez un texte guidé d\'une minute. L\'assistant reprend votre timbre et votre rythme.</p>' +
        '<p class="g-note g-cu" style="margin-top:22px">' +
          (sheet.consent ? "Consentement donné." : "Vous devez confirmer posséder cette voix et en autoriser l'usage.") + '</p>' +
      '</div>' +
      '<div class="g-foot"><div class="g-acts">' +
        '<button class="g-act" data-consent>' + (sheet.consent ? "Enregistrer ma voix" : "Je confirme") + '</button>' +
        '<button class="g-act g-off" data-fermer>Fermer</button>' +
      '</div></div>';
  }

  function feuillePrenom(){
    return '<div class="g-top">Prénom de l\'assistant</div>' +
      '<div class="g-body g-mid-v">' +
        '<input class="g-input" id="g-prenom" value="' + esc(voix.prenom) + '" maxlength="14">' +
        '<p class="g-note" style="margin-top:26px">C\'est le prénom que le client entend au décrochage.</p>' +
        '<p class="g-note g-cu" style="margin-top:18px">« Bonsoir, ' +
          '<span data-apercu>' + esc(voix.prenom) + '</span>, assistant vocal automatisé du Comptoir. »</p>' +
      '</div>' +
      '<div class="g-foot"><div class="g-acts">' +
        '<button class="g-act" data-prenom-ok>Enregistrer</button>' +
        '<button class="g-act g-off" data-fermer>Annuler</button>' +
      '</div></div>';
  }

  /* -------------------------------- réglages -------------------------------- */
  function vueReglages(){
    var f = leForfait();
    var pct = Math.round(D_.resto.minutes / f.minutes * 100);
    return '<div class="g-top">Réglages</div>' +
      '<div class="g-center g-flow g-fade"><div class="g-list" style="padding-top:22px">' +
        '<p class="g-lab">Abonnement</p>' +
        '<div class="g-row"><button data-sheet="abo"><span class="g-k">' + esc(f.nom) +
          '<span class="g-s">' + D_.resto.minutes + ' minutes sur ' + f.minutes + ' · alerte à 80 %</span></span></button>' +
          '<span class="g-v g-cu">' + esc(api.eur0(f.prix)) + '</span></div>' +
        '<p class="g-lab" style="margin-top:14px">Service</p>' +
        D_.horaires.map(function(h){
          return '<div class="g-row"><span class="g-k">' + esc(h.j) + '</span>' +
            '<span class="g-v">' + esc(h.c) + '</span></div>';
        }).join("") +
        '<div class="g-row"><span class="g-k">Dernière commande<span class="g-s">avant fermeture</span></span>' +
          '<span class="g-v">− 20 min</span></div>' +
        D_.exceptions.map(function(x){
          return '<div class="g-row g-out"><span class="g-k">' + esc(x.d) + '</span>' +
            '<span class="g-v">' + esc(x.r) + '</span></div>';
        }).join("") +
        '<p class="g-lab" style="margin-top:14px">Livraison</p>' +
        '<div class="g-row"><span class="g-k">Rayon<span class="g-s">hors zone, l\'IA propose le retrait</span></span>' +
          '<span class="g-v">' + esc(D_.livraison.rayon) + '</span></div>' +
        '<div class="g-row"><span class="g-k">Minimum</span><span class="g-v">' + esc(api.eur(D_.livraison.minimum)) + '</span></div>' +
        '<div class="g-row"><span class="g-k">Frais</span><span class="g-v">' + esc(api.eur(D_.livraison.frais)) + '</span></div>' +
        '<div class="g-row"><span class="g-k">Paiement</span><span class="g-v">' + esc(D_.livraison.paiement) + '</span></div>' +
        '<p class="g-lab" style="margin-top:14px">Cadre</p>' +
        '<div class="g-row"><button data-sheet="rgpd"><span class="g-k">Annonce IA et données' +
          '<span class="g-s">RGPD et AI Act</span></span></button><span class="g-v g-cu">lire</span></div>' +
        '<div class="g-row"><button data-sheet="paiement"><span class="g-k">Encaissement' +
          '<span class="g-s">ce que Resto IA ne fait jamais</span></span></button><span class="g-v g-cu">lire</span></div>' +
      '</div></div>' +
      '<div class="g-foot"><p class="g-micro g-dim">' + pct + ' % du forfait consommé. ' +
        'L\'alerte à 80 % ne coupe jamais le service.</p></div>';
  }

  function feuilleAbo(){
    var f = leForfait();
    return '<div class="g-top">Abonnement</div>' +
      '<div class="g-body">' +
        '<div style="text-align:center"><div class="g-figure">' + esc(api.eur0(f.prix)) +
          '<small>/mois</small></div>' +
          '<p class="g-note" style="margin:14px auto 0">' + esc(f.nom) + ' · ' + f.minutes +
          ' minutes · dépassement ' + (f.dep/100).toFixed(2).replace(".", ",") + ' € la minute</p></div>' +
        '<div class="g-list">' +
          D_.forfaits.map(function(p){
            return '<div class="g-row' + (forfait === p.id ? "" : " g-out") + '">' +
              '<button data-forfait="' + p.id + '"><span class="g-k">' + esc(p.nom) +
                '<span class="g-s">' + p.minutes + ' minutes · ' + esc(p.note) + '</span></span></button>' +
              '<span class="g-v' + (forfait === p.id ? " g-cu" : "") + '">' +
                (forfait === p.id ? "en cours" : esc(api.eur0(p.prix))) + '</span></div>';
          }).join("") +
        '</div>' +
        '<p class="g-note">Essai gratuit d\'abord : le vrai volume d\'appels décide du forfait. Ensuite, engagement de six mois.</p>' +
      '</div>' +
      '<div class="g-foot"><div class="g-acts">' +
        '<button class="g-act g-off" data-fermer>Fermer</button>' +
      '</div></div>';
  }

  function feuilleTexte(titre, texte){
    return '<div class="g-top">' + esc(titre) + '</div>' +
      '<div class="g-body g-mid-v"><p class="g-quote" style="max-width:280px">' + esc(texte) + '</p></div>' +
      '<div class="g-foot"><div class="g-acts"><button class="g-act g-off" data-fermer>Fermer</button></div></div>';
  }

  /* -------------------------------- rendu -------------------------------- */
  function corps(){
    if (menuOuvert) return menu();
    if (ecran === "soir")      return vueSoir();
    if (ecran === "appels")    return vueAppels();
    if (ecran === "carte")     return vueCarte();
    if (ecran === "assistant") return vueAssistant();
    return vueReglages();
  }

  function feuille(){
    if (!sheet) return "";
    var dedans =
      sheet.type === "produit"   ? feuilleProduit(sheet.id) :
      sheet.type === "import"    ? feuilleImport() :
      sheet.type === "signature" ? feuilleSignature() :
      sheet.type === "prenom"    ? feuillePrenom() :
      sheet.type === "abo"       ? feuilleAbo() :
      sheet.type === "rgpd"      ? feuilleTexte("Annonce IA et données", D_.regles.rgpd) :
      sheet.type === "paiement"  ? feuilleTexte("Encaissement", D_.regles.paiement) : "";
    return '<div class="g-sheet' + (sheet.on ? " g-on" : "") + '">' + dedans + '</div>';
  }

  function peindre(){
    root.innerHTML = statusbar() + corps() + (menuOuvert ? "" : nav()) + feuille();
    if (sheet && !sheet.on){
      sheet.on = true;
      requestAnimationFrame(function(){
        var s = root.querySelector(".g-sheet");
        if (s) s.classList.add("g-on");
      });
    }
    var tr = root.querySelector("[data-tr]");
    if (tr) tr.scrollTop = tr.scrollHeight;
  }

  /* ------------------------------ rejeu d'appel ------------------------------ */
  function demarrerRejeu(){
    rejeu = { t:0, i:0, vues:[], panier:null, sms:false, confirme:false, fini:false };
    ecran = "appels";
    peindre();
    api.every(function(){
      if (!rejeu || rejeu.fini) return;
      rejeu.t += 1;
      var avance = false;
      while (rejeu.i < D_.appel.length && D_.appel[rejeu.i].t <= rejeu.t){
        var e = D_.appel[rejeu.i];
        rejeu.vues.push(e);
        if (e.panier) rejeu.panier = { q:e.panier.q, nom:e.panier.nom, opt:e.panier.opt, prix:e.panier.prix, sup:"" };
        if (e.maj && rejeu.panier){
          rejeu.panier.opt = e.maj.opt; rejeu.panier.prix = e.maj.prix; rejeu.panier.sup = e.maj.sup || "";
        }
        if (e.sms) rejeu.sms = true;
        if (e.confirme) rejeu.confirme = true;
        if (e.fin) rejeu.fini = true;
        rejeu.i++; avance = true;
      }
      if (rejeu.t > 90) rejeu.fini = true;
      if (ecran === "appels") peindre();
      else if (avance) { /* l'appel continue en fond */ }
    }, api.reduit() ? 400 : 260);
  }

  /* ------------------------------- montage ------------------------------- */
  function monter(scene, a){
    api = a; D_ = a.data;
    charge = D_.resto.charge;
    forfait = D_.resto.forfait;
    langues = D_.voix.langues.slice();
    voix = { prenom:D_.voix.prenom, ton:D_.voix.ton, vitesse:D_.voix.vitesse, accueil:D_.voix.accueil };

    root = document.createElement("div");
    root.className = "g-app";
    scene.appendChild(root);
    peindre();

    api.every(function(){
      var n = root.querySelectorAll("[data-hor]");
      for (var i = 0; i < n.length; i++) n[i].textContent = api.heure();
    }, 20000);

    root.addEventListener("input", function(ev){
      if (ev.target.id === "g-prenom"){
        var ap = root.querySelector("[data-apercu]");
        if (ap) ap.textContent = ev.target.value || "…";
      }
    });

    root.addEventListener("click", function(ev){
      var t = ev.target;
      if (!t.closest) return;
      var SEL = "[data-menu],[data-ecran],[data-charge],[data-arret],[data-cuisine],[data-rejeu]," +
                "[data-stoprejeu],[data-transfert],[data-appel],[data-produit],[data-import]," +
                "[data-rupture],[data-publier],[data-ton],[data-vitesse],[data-test],[data-signature]," +
                "[data-consent],[data-prenom],[data-prenom-ok],[data-sheet],[data-forfait],[data-fermer]";
      var b = t.closest(SEL);
      if (!b) return;
      var d = b.dataset;

      if (d.menu !== undefined){ menuOuvert = !menuOuvert; peindre(); return; }
      if (d.ecran){ ecran = d.ecran; menuOuvert = false; if (ecran !== "appels") rejeu = null; peindre(); return; }
      if (d.charge){
        charge = d.charge; ouvert = charge !== "stop";
        api.toast(niveau().dit);
        peindre(); return;
      }
      if (d.arret !== undefined){
        ouvert = !ouvert;
        if (!ouvert){
          charge = "stop";
          var dt = new Date(Date.now() + 30*60000);
          reprise = String(dt.getHours()).padStart(2,"0") + "h" + String(dt.getMinutes()).padStart(2,"0");
          api.toast("Commandes arrêtées. L'IA répond encore et annonce une reprise à " + reprise + ".");
        } else {
          charge = "rush";
          api.toast("Commandes rouvertes — " + niveau().delai + " minutes annoncées.");
        }
        peindre(); return;
      }
      if (d.cuisine !== undefined){ api.ouvrir("cuisine"); return; }
      if (d.rejeu !== undefined){ demarrerRejeu(); return; }
      if (d.stoprejeu !== undefined){ rejeu = null; peindre(); return; }
      if (d.transfert !== undefined){
        rejeu = null;
        api.toast("Appel transféré au restaurant — allergie évoquée, aucune commande enregistrée.");
        peindre(); return;
      }
      if (d.appel !== undefined){ demarrerRejeu(); return; }
      if (d.produit){ sheet = { type:"produit", id:d.produit }; peindre(); return; }
      if (d.import !== undefined){
        sheet = { type:"import", etape:0 };
        peindre();
        var pas = api.every(function(){
          if (!sheet || sheet.type !== "import"){ clearInterval(pas); return; }
          sheet.etape = (sheet.etape || 0) + 1;
          if (sheet.etape > 4){ clearInterval(pas); sheet.etape = 4; }
          peindre();
        }, 900);
        return;
      }
      if (d.rupture){
        rupt[d.rupture] = !rupt[d.rupture];
        api.toast(rupt[d.rupture]
          ? "En rupture dès le prochain appel. Les commandes déjà confirmées ne sont pas touchées."
          : "De nouveau proposé par l'IA.");
        peindre(); return;
      }
      if (d.publier !== undefined){
        sheet = null;
        api.toast("Carte publiée : elle s'applique dès le prochain appel.");
        peindre(); return;
      }
      if (d.ton){ voix.ton = d.ton; peindre(); return; }
      if (d.vitesse){ voix.vitesse = d.vitesse; peindre(); return; }
      if (d.test !== undefined){
        api.toast("Appel test lancé sur votre vrai menu — obligatoire avant activation.");
        return;
      }
      if (d.signature !== undefined){ sheet = { type:"signature", consent:false }; peindre(); return; }
      if (d.consent !== undefined){
        if (!sheet.consent){ sheet.consent = true; api.toast("Consentement enregistré."); }
        else { sheet = null; api.toast("Voix signature enregistrée. L'assistant annonce toujours qu'il est automatisé."); }
        peindre(); return;
      }
      if (d.prenom !== undefined && d.prenomOk === undefined){ sheet = { type:"prenom" }; peindre(); return; }
      if (d.prenomOk !== undefined){
        var v = root.querySelector("#g-prenom");
        if (v && v.value.trim()) voix.prenom = v.value.trim();
        voix.accueil = "Bonsoir, assistant vocal automatisé du Comptoir, je prends votre commande ?";
        sheet = null;
        api.toast("L'assistant s'appelle désormais " + voix.prenom + ".");
        peindre(); return;
      }
      if (d.sheet){ sheet = { type:d.sheet }; peindre(); return; }
      if (d.forfait){
        forfait = d.forfait;
        api.toast("Forfait " + leForfait().nom + " — changement au prochain cycle.");
        peindre(); return;
      }
      if (d.fermer !== undefined){ sheet = null; peindre(); return; }
    });

    return function(){ rejeu = null; sheet = null; };
  }

  RIA.register({
    id:"gerant", nom:"Gérant", badge:"2",
    fond:"linear-gradient(145deg,#D9A273,#A66B3C)", encre:"#1A1206",
    glyph:'<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>',
    format:"phone",
    css:"gerant.css",
    monter:monter
  });
})();
