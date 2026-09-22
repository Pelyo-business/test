/* =========================================================================
   Pelyo — Le Passe. Application cuisine mobile.
   Four destinations, complete order tickets, incremental timers.
   Demonstration data and simulated hardware actions are explicitly labelled.

   ES5 strict. Toutes les classes commencent par k-. Voir src/cuisine.css.
   ========================================================================= */
(function(){
  "use strict";

  var api, root, D_;
  var tiroir, scrim;       /* le tiroir de navigation : monté une fois, hors du cycle de repaint */
  var vue = "service";
  var recherche = "";
  var impressionAuto = true, impressionAnnulations = false;
  var derniereAction = null;
  var brouillon = "";
  var montageId = 0;
  var filtre = "faire";
  var son = true;
  var charge = "rush";
  var cmds = [];           /* copie de travail : on ne mute jamais D.commandes */
  var ouverte = null;      /* commande affichée en plein écran */
  var horloge = "";
  var audio = null;
  var imprimes = {};
  var ticketOuvert = null; /* commande dont le ticket numérique est affiché */
  var triHistorique = "recent"; /* recent | ancien | nom */
  var triOuvert = false;
  var reglagesOuverts = false;
  var menuOuvert = false;  /* tiroir de navigation */
  var rupt = {};           /* id produit → true si en rupture */
  var catOff = {};
  var delaiRetrait = 15, delaiLivraison = 35, capacite = 12;
  var nouvelles = 0;
  var ruptChat = [{ de:"ia", texte:"Dites-moi ce qui manque, à l'écrit ou à la voix — je mets la carte à jour tout de suite. Ça s'applique aux nouveaux appels, jamais à une commande déjà confirmée." }];
  var ruptEcoute = false;
  var VOIX = [
    "Il n'y a plus de tacos M, arrête-les",
    "On n'a plus de mozzarella, stop les pizzas",
    "Remets les tacos M, on en a reçu",
    "Le poulet mariné est fini pour ce soir"
  ];
  var voixIdx = 0;

  /* Adresse du relais IA (voir worker/README.md). Vide = le chat retombe
     automatiquement sur une reconnaissance locale par mots-clés, gratuite
     et sans réseau — la démo reste utilisable tant que rien n'est déployé. */
  var IA_ENDPOINT = "https://pelyo-ruptures-ia.haydenrouet2104.workers.dev";

  /* ------------------------------ états ------------------------------ */
  var ETATS = {
    appel:       { lbl:"IA en ligne",     suite:null,        bouton:null },
    attente:     { lbl:"À confirmer",     suite:null,        bouton:null },
    confirmee:   { lbl:"À préparer",      suite:"preparation", bouton:"Commencer" },
    preparation: { lbl:"En préparation",  suite:"prete",     bouton:null },
    prete:       { lbl:"Prête",           suite:"terminee",  bouton:null },
    terminee:    { lbl:"Terminée",        suite:null,        bouton:null },
    expiree:     { lbl:"Expirée",         suite:null,        bouton:null }
  };
  /* Plus de « Tout » : chaque filtre trie déjà directement sur un état
     précis, superposer une vue qui mélange tout n'apportait rien de plus. */
  var FILTRES = [
    { id:"faire",  lbl:"À préparer", test:function(c){ return c.etat === "confirmee"; } },
    { id:"cours",  lbl:"En cours",   test:function(c){ return c.etat === "preparation"; } },
    { id:"pretes", lbl:"Prêtes",     test:function(c){ return c.etat === "prete"; } },
    { id:"fin",    lbl:"Terminées",  test:function(c){ return c.etat === "terminee" || c.etat === "expiree"; } }
  ];
  var VUES = [
    { id:"service",  lbl:"Service" },
    { id:"ruptures", lbl:"La carte" },
    { id:"tickets",  lbl:"Tickets" },
    { id:"rythme",   lbl:"Rythme" }
  ];

  /* ------------------------------ utilitaires ------------------------------ */
  function esc(s){ return api.esc(s); }
  function eur(c){ return api.eur(c); }
  function niveau(){
    for (var i = 0; i < D_.charges.length; i++) if (D_.charges[i].id === charge) return D_.charges[i];
    return D_.charges[0];
  }
  function compte(f){
    var n = 0;
    for (var i = 0; i < cmds.length; i++) if (f.test(cmds[i])) n++;
    return n;
  }
  function aPreparer(){
    var n = 0;
    for (var i = 0; i < cmds.length; i++) if (cmds[i].etat === "confirmee" || cmds[i].etat === "preparation") n++;
    return n;
  }
  /* D.commandes[].total inclut déjà les frais de livraison : ne pas les ajouter. */
  function total(c){ return c.total; }

  function icone(n){
    var paths = {
      service:'<path d="M4 5h16v15H4zM8 2v6m8-6v6M8 12h8m-8 4h5"/>',
      ruptures:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4zm9 3a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3"/>',
      tickets:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6"/>',
      rythme:'<path d="M3 17a9 9 0 1 1 18 0M12 13l4-5M6 17h12"/><circle cx="12" cy="14" r="2"/>',
      sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
      mute:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/>',
      arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
      print:'<path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7zM16 11h1"/>',
      bag:'<path d="M5 7h14l1 14H4zM9 8V5a3 3 0 0 1 6 0v3"/>',
      truck:'<path d="M2 6h12v12H2zm12 4h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
      wave:'<path d="M3 10v4m4-7v10m5-14v18m5-15v12m4-8v4"/>',
      settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
      search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>'
    };
    return '<svg class="k-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[n] || paths.service) + '</svg>';
  }

  function navigation(){
    return '<nav class="k-dock" aria-label="Navigation cuisine">' + VUES.map(function(v){
      return '<button data-vue="' + v.id + '" aria-current="' + (vue === v.id ? 'page' : 'false') + '" class="' + (vue === v.id ? 'k-active' : '') + '">' + icone(v.id) + '<span>' + esc(v.lbl) + '</span></button>';
    }).join('') + '</nav>';
  }

  function titre(sous, titreTexte, droite){
    return '<div class="k-page-title"><div><span class="k-eyebrow">' + sous + '</span><h1>' + titreTexte + '</h1></div>' + (droite || '') + '</div>';
  }

  /* Toutes les commandes de cette maquette se déroulent le même jour — la
     date du jour suffit, affichée telle quelle partout où une date est due. */
  function dateCourte(){
    var d = new Date();
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function dateLongue(){
    var d = new Date(), MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
    return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear();
  }

  function bip(){
    if (!son) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      var t = audio.currentTime;
      [880, 1320].forEach(function(f, i){
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t + i*.12);
        g.gain.exponentialRampToValueAtTime(.16, t + i*.12 + .01);
        g.gain.exponentialRampToValueAtTime(.0001, t + i*.12 + .1);
        o.connect(g); g.connect(audio.destination);
        o.start(t + i*.12); o.stop(t + i*.12 + .12);
      });
    } catch(e){}
  }

  /* --------------------------- rendu : en-tête --------------------------- */
  function head(){
    /* Le niveau (rush/normal/…) a sa propre ligne juste sous les filtres,
       dans l'écran Service (voir vueService) : plus besoin de le répéter
       ici, à côté du nom du restaurant. */
    return '<header class="k-head"><button class="k-logo" data-menu aria-label="Pelyo, ouvrir le menu"><img src="assets/logo-toque.png" alt="" width="36" height="36"></button>' +
      '<div class="k-brand"><b>' + esc(D_.resto.nom) + '</b><span>Pelyo · cuisine</span></div>' +
      '<button class="k-sound" data-son aria-label="' + (son ? 'Couper' : 'Activer') + ' les alertes sonores" aria-pressed="' + son + '">' + icone(son ? 'sound' : 'mute') + '</button></header>';
  }

  /* -------------------------- tiroir de navigation -------------------------- */
  /* Monté une seule fois dans monter(), hors du cycle de repaint de .k-app —
     c'est ce qui permet à la transition de glissement de vraiment s'animer :
     un nœud recréé à chaque `innerHTML` n'a pas d'état précédent depuis
     lequel transitionner. Seule sa liste interne est régénérée (rafraichirTiroir),
     pour refléter l'onglet actif sans reconstruire le tiroir lui-même. */
  function listeTiroir(){
    return VUES.map(function(v){
      return '<button data-vue="' + v.id + '" class="' + (vue === v.id ? "on" : "") + '">' + esc(v.lbl) + '</button>';
    }).join("");
  }

  function rafraichirTiroir(){
    var liste = tiroir.querySelector("[data-tiroir-liste]");
    if (liste) liste.innerHTML = listeTiroir();
  }

  function ouvrirTiroir(){
    if (menuOuvert) return;
    menuOuvert = true;
    scrim.classList.add("on");
    tiroir.classList.add("on");
    root.inert = true;
    tiroir.setAttribute('role','dialog');
    tiroir.setAttribute('aria-modal','true');
    tiroir.setAttribute('aria-label','Menu Pelyo');
    tiroir.querySelector('button').focus();
  }

  function fermerTiroir(){
    if (!menuOuvert) return;
    menuOuvert = false;
    scrim.classList.remove("on");
    tiroir.classList.remove("on");
    root.inert = false;
    var trigger = root.querySelector('[data-menu]'); if (trigger) trigger.focus();
  }

  /* --------------------------- rendu : le tableau --------------------------- */
  function ligneMinuteur(c){
    if (c.etat === "attente"){
      var r = Math.max(0, c.reste | 0);
      return '<u class="k-amb">' + api.chrono(r) + '</u><small>expire</small>';
    }
    if (c.etat === "preparation"){
      var d = c.depuis | 0;
      var trop = d > (c.mode === "livraison" ? delaiLivraison : delaiRetrait) * 60;
      return '<u class="' + (trop ? "k-amb" : "") + '">' + api.chrono(d) + '</u><small>en cuisson</small>';
    }
    if (c.etat === "prete") return '<u class="k-rdy">' + esc(c.prete || "—") + '</u><small>à remettre</small>';
    if (c.etat === "appel") return '<u>' + api.chrono(c.depuis | 0) + '</u><small>en ligne</small>';
    if (c.etat === "expiree") return '<u class="k-strike">00:00</u><small>sans validation</small>';
    if (c.etat === "terminee") return '<u>' + esc(c.prete || "") + '</u><small>servie</small>';
    return '<u>' + esc(c.prete || "—") + '</u><small>annoncée</small>';
  }

  function ligneAction(c){
    if (c.etat === "confirmee")
      return '<button class="k-btn" data-go="' + c.id + '">Commencer</button>';
    if (c.etat === "preparation")
      return '<button class="k-btn amb" data-go="' + c.id + '">' +
        (c.mode === "livraison" ? "Prête pour livreur" : "Prête au comptoir") + '</button>';
    if (c.etat === "prete")
      return '<button class="k-btn rdy" data-go="' + c.id + '">' +
        (c.mode === "livraison" ? "Livrée" : "Récupérée") + '</button>';
    if (c.etat === "attente") return '<div class="k-hold">Ne rien<br>préparer</div>';
    if (c.etat === "appel")   return '<div class="k-hold">Commande<br>en cours</div>';
    return '<div class="k-hold">—</div>';
  }

  function ligne(c){
    var e = ETATS[c.etat];
    var mort = (c.etat === "expiree" || c.etat === "terminee" || c.etat === "attente" || c.etat === "appel");
    var contenu = c.lignes.length
      ? c.lignes.map(function(l){ return l.q + "× " + l.nom; }).join(", ")
      : "prise de commande en cours";
    var detail = c.lignes.length
      ? c.lignes.map(function(l){ return [l.opt, l.sup ? "+ " + l.sup : "", l.dem].filter(Boolean).join(" · "); })
          .filter(Boolean).join("  ·  ")
      : "aucun produit tant que le client n'a pas confirmé";

    return '<article class="k-order k-state-' + c.etat + '"><div class="k-order-top"><button class="k-order-id" data-open="' + c.id + '" aria-label="Détails de la commande ' + c.id + '"><span>#</span>' + c.id + '</button><span class="k-status">' + esc(e.lbl) + '</span><span class="k-t" data-timer="' + c.id + '">' + ligneMinuteur(c) + '</span></div>' +
      '<div class="k-customer">' + icone(c.mode === 'livraison' ? 'truck' : 'bag') + '<b>' + esc(c.client || 'Client en ligne') + '</b><span>' + (c.mode === 'livraison' ? 'Livraison' : 'À emporter') + '</span></div>' +
      '<div class="k-order-lines">' + (c.lignes.length ? c.lignes.map(function(l){
        return '<div class="k-product"><span class="k-quantity">' + l.q + '</span><div><b>' + esc(l.nom) + '</b>' + (l.opt ? '<p>' + esc(l.opt) + '</p>' : '') + (l.sup ? '<p class="k-extra">+ ' + esc(l.sup) + '</p>' : '') + (l.dem ? '<p class="k-request">' + esc(l.dem) + '</p>' : '') + '</div></div>';
      }).join('') : '<p class="k-note">Le client compose sa commande.</p>') + '</div>' +
      (c.mode === 'livraison' && c.adresse ? '<button class="k-address" data-open="' + c.id + '">' + esc(c.adresse) + '<span>' + esc(c.km) + ' km ' + icone('arrow') + '</span></button>' : '') +
      '<div class="k-order-foot">' + (mort ? '<span class="k-hold">' + (c.etat === 'terminee' ? 'Commande terminée' : c.etat === 'expiree' ? 'Sans validation' : 'Ne pas préparer avant confirmation') + '</span>' : '<button class="k-print" data-imprimer="' + c.id + '" aria-label="Imprimer le ticket ' + c.id + '">' + icone('print') + '</button>' + ligneAction(c)) + '</div></article>';
  }

  function vueService(){
    var f = FILTRES.filter(function(x){ return x.id === filtre; })[0] || FILTRES[0];
    var liste = cmds.filter(f.test);

    var appels = cmds.filter(function(c){ return c.etat === 'appel' || c.etat === 'attente'; });
    return titre('LE PASSE', 'Le service.', '<button class="k-pace-pill" data-vue="rythme"><i></i>' + esc(niveau().nom) + ' ' + icone('arrow') + '</button>') +
    '<div class="k-service-meta"><span><b>' + aPreparer() + '</b> en production</span><span>Retrait <b>' + delaiRetrait + ' min</b></span><button data-demo-arrive>+ Démo</button></div>' +
    '<div class="k-filt" aria-label="Filtrer les commandes">' +
      FILTRES.map(function(x){
        return '<button data-filt="' + x.id + '" class="' + (filtre === x.id ? "on" : "") + '">' +
          esc(x.lbl) + '<em>' + compte(x) + '</em></button>';
      }).join("") +
    '</div>' +
    '<div class="k-body">' +
      (derniereAction ? '<button class="k-undo" data-undo>Commande #' + derniereAction.id + ' mise à jour <b>Annuler</b></button>' : '') +
      (liste.length ? '<div class="k-orders">' + liste.map(ligne).join('') + '</div>'
        : '<div class="k-empty">' + icone('check') + '<h2>Le passe est libre.</h2><p>Aucune commande dans cette file.<br>Les nouvelles commandes apparaîtront ici.</p></div>') +
      (appels.length ? '<section class="k-incoming"><div class="k-incoming-title">' + icone('wave') + '<div><b>L’IA prend le relais</b><span>' + appels.length + ' commande(s) non confirmée(s)</span></div></div>' + appels.map(function(c){ return '<button class="k-call" data-open="' + c.id + '"><span>#' + c.id + ' · ' + esc(c.client || 'Client') + '<small>' + esc(ETATS[c.etat].lbl) + '</small></span><span class="k-t" data-timer="' + c.id + '">' + ligneMinuteur(c) + '</span></button>'; }).join('') + '</section>' : '') +
      '<div class="k-demo-note">Compte démo · données de démonstration</div>' +
    '</div>';
  }

  /* ------------------------------ ticket ------------------------------ */
  function ticket(c){
    if (!c) return "Aucune commande : rien à imprimer.";
    var l = [];
    l.push("      " + D_.resto.nom.toUpperCase());
    l.push("   " + D_.resto.adresse);
    l.push("================================");
    l.push("COMMANDE #" + c.id + "        " + (c.mode === "livraison" ? "LIVRAISON" : "RETRAIT"));
    l.push("Date      " + dateLongue());
    l.push("Recue     " + (c.heure || "--:--"));
    l.push("Annoncee  " + (c.prete || "--:--"));
    l.push("Client    " + (c.client || "-"));
    l.push("--------------------------------");
    c.lignes.forEach(function(x){
      l.push(x.q + "x " + x.nom.toUpperCase());
      if (x.opt) l.push("   " + x.opt);
      if (x.sup) l.push("   + " + x.sup);
      if (x.dem) l.push("   ! " + x.dem);
    });
    l.push("--------------------------------");
    l.push("TOTAL                    " + (total(c)/100).toFixed(2).replace(".", ","));
    if (c.mode === "livraison") l.push("dont frais " + (c.frais/100).toFixed(2).replace(".", ",") + " - " + c.paiement);
    else l.push("A REGLER SUR PLACE");
    l.push("================================");
    l.push(" Commande confirmee par le client");
    l.push(" Prise par assistant vocal - IA");
    return l.join("\n");
  }

  /* Déclenche un vrai téléchargement du ticket en texte brut — pas une
     simulation : un fichier .txt part réellement dans le navigateur. */
  function telechargerTicket(c){
    var blob = new Blob([ticket(c)], { type:"text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "ticket-" + c.id + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    api.toast("Ticket " + c.id + " téléchargé.");
  }

  /* --------------------------- historique des tickets --------------------------- */
  /* Tout ce qui a été confirmé a un ticket : ni les appels en cours, ni les
     commandes jamais validées, ni les expirées (rien n'a été imprimé). */
  var TRIS = [
    { id:"recent", lbl:"Récent" },
    { id:"ancien", lbl:"Ancien" },
    { id:"nom",    lbl:"Nom" }
  ];

  function ticketsHistorique(){
    var liste = cmds
      .filter(function(c){ return c.etat !== "appel" && c.etat !== "attente" && c.etat !== "expiree"; })
      .slice();
    if (recherche) liste = liste.filter(function(c){ return api.norm(String(c.id) + ' ' + (c.client || '') + ' ' + c.lignes.map(function(l){return l.nom;}).join(' ')).indexOf(api.norm(recherche)) !== -1; });
    if (triHistorique === "nom") liste.sort(function(a, b){ return String(a.client || "").localeCompare(String(b.client || ""), "fr"); });
    else if (triHistorique === "ancien") liste.sort(function(a, b){ return a.id - b.id; });
    else liste.sort(function(a, b){ return b.id - a.id; });
    return liste;
  }

  function ligneTicket(c){
    var contenu = c.lignes.length
      ? c.lignes.map(function(l){ return l.q + "× " + l.nom; }).join(", ")
      : "—";
    return '<div class="k-trow" data-voirticket="' + c.id + '" role="button" tabindex="0">' +
      '<span class="k-trow-n k-mono">' + c.id + '</span>' +
      '<span class="k-trow-c"><b>' + esc(c.client || "Non communiqué") + '</b><span>' + esc(contenu) + '</span></span>' +
      '<span class="k-trow-h k-mono">' + dateCourte() + ' · ' + esc(c.heure || "—") + '</span>' +
    '</div>';
  }

  function vueTickets(){
    var historique = ticketsHistorique();
    var triActuel = TRIS.filter(function(t){ return t.id === triHistorique; })[0];
    return titre('LA MÉMOIRE DU SERVICE', 'Les tickets.', '<span class="k-total-count">' + historique.length + '</span>') +
    '<form class="k-search" data-search-form>' + icone('search') + '<input data-search aria-label="Rechercher un ticket" placeholder="Un nom, un numéro, un produit…" value="' + esc(recherche) + '"><button type="submit">Chercher</button></form>' + '<div class="k-tikhead">' +
      '<button class="k-btn2" data-tri-ouvrir>Trier · ' + esc(triActuel.lbl) + '</button>' +
      '<button class="k-btn2" data-reglages>Paramètres</button>' +
    '</div>' +
    '<div class="k-body">' +
      (historique.length ? historique.map(ligneTicket).join("")
        : '<div class="k-empty">Aucun ticket pour l\'instant.</div>') +
    '</div>';
  }

  function overlayTri(){
    return '<div class="k-over">' +
      '<div class="k-ohead"><button data-fermer-tri>← Retour</button></div>' +
      '<div class="k-lbl">Trier l\'historique</div>' +
      TRIS.map(function(t){
        return '<button class="k-r' + (triHistorique === t.id ? " sel" : "") + '" data-tri="' + t.id + '">' +
          '<span class="v">' + esc(t.lbl) + '</span>' +
          '<span class="s' + (triHistorique === t.id ? " rdy" : "") + '">' + (triHistorique === t.id ? "Actif" : "Choisir") + '</span>' +
        '</button>';
      }).join("") +
    '</div>';
  }

  function overlayTicket(c){
    var imp = imprimes[c.id];
    return '<div class="k-over">' +
      '<div class="k-ohead"><button data-fermer-ticket>← Retour</button></div>' +
      '<div class="k-lbl">Ticket<em>#' + c.id + '</em></div>' +
      '<div class="k-tkwrap"><div class="k-tk">' + esc(ticket(c)) + '</div></div>' +
      '<div class="k-ofoot">' +
        '<button class="k-btn" data-telecharger="' + c.id + '">Télécharger</button>' +
        '<button class="k-btn2" data-imprimer="' + c.id + '">' + (imp ? "Réimprimer" : "Imprimer") + '</button>' +
      '</div>' +
    '</div>';
  }

  function overlayReglages(){
    var reglages = [
      { k:"Alerte sonore",        v:son ? "Active" : "Coupée",            a:"son" },
      { k:"Impression auto",      v:impressionAuto ? "Activée (démo)" : "Désactivée", a:"auto" },
      { k:"Annulations",          v:impressionAnnulations ? "Imprimées (démo)" : "Non imprimées", a:"ann" },
      { k:"Imprimante",           v:"Epson TM-m30 · comptoir",            a:"imp" },
      { k:"Test",                 v:"Envoyer une ligne de test",          a:"test" }
    ];
    return '<div class="k-over">' +
      '<div class="k-ohead"><button data-fermer-reglages>← Retour</button></div>' +
      '<div class="k-lbl">Réglages d\'impression<em>ESC/POS</em></div>' +
      reglages.map(function(r){
        return '<button class="k-r" data-reg="' + r.a + '">' +
          '<span class="k">' + esc(r.k) + '</span>' +
          '<span class="v">' + esc(r.v) + '</span>' +
          '<span class="s">Changer</span></button>';
      }).join("") +
      '<div class="k-note">Le restaurant n\'a pas d\'imprimante ? <b>Pack imprimante 79 €</b>. ' +
        'Pour une micro-structure, le ticket part en SMS ou WhatsApp au gérant.</div>' +
    '</div>';
  }

  /* ------------------------------ ruptures ------------------------------ */
  /* Plus de liste exhaustive du menu à cocher produit par produit : un
     chatbot reçoit l'info (à l'écrit ou dictée), reconnaît le ou les
     produits cités et applique la rupture — ou la lève — lui-même. Les
     chips au-dessus du fil ne servent qu'à voir d'un coup d'œil ce qui est
     actuellement fermé, et à l'annuler en un geste en cas d'erreur. */
  function trouverProduit(id){
    for (var i = 0; i < D_.menu.length; i++)
      for (var j = 0; j < D_.menu[i].items.length; j++)
        if (String(D_.menu[i].items[j].id) === String(id)) return D_.menu[i].items[j];
    return null;
  }

  function ruptActives(){
    var l = [];
    D_.menu.forEach(function(cat){
      if (catOff[cat.cat]) l.push({ id:"cat:" + cat.cat, nom:cat.cat });
      else cat.items.forEach(function(it){ if (rupt[it.id]) l.push({ id:"it:" + it.id, nom:it.nom }); });
    });
    return l;
  }

  function retablirUn(id){
    if (id.indexOf("cat:") === 0){
      var nomCat = id.slice(4);
      catOff[nomCat] = false;
      ruptChat.push({ de:"ia", texte:"C'est noté, " + nomCat + " est de nouveau en carte." });
    } else if (id.indexOf("it:") === 0){
      var pid = id.slice(3), it = trouverProduit(pid);
      rupt[pid] = false;
      ruptChat.push({ de:"ia", texte:"C'est noté, " + (it ? it.nom : "ce produit") + " est de nouveau disponible." });
    }
    peindre();
  }

  /* ------------------------ reconnaissance locale ------------------------ */
  /* Repli sans réseau : recherche de mots-clés. Utilisé quand IA_ENDPOINT
     est vide, ou quand le relais ne répond pas. Ne pousse pas le message du
     cuisinier (déjà fait par traiterMessage) — seulement la réponse. */
  function appliquerLocal(texte){
    var n = api.norm(texte);
    var restaurer = /remet|revient|redispo|recu|arrivee|de nouveau|a nouveau/.test(n) || (/\bdisponible/.test(n) && !/plus|pas|indisponible/.test(n));
    /* Un produit trouvé prime sur sa catégorie : « tacos M » contient
       « tacos », qui est aussi le nom de la catégorie « Tacos ». Sans cette
       priorité, citer un seul produit fermerait toute la catégorie. */
    var catsT = [], itemsT = [];
    D_.menu.forEach(function(cat){
      cat.items.forEach(function(it){
        if (n.indexOf(api.norm(it.nom)) !== -1) itemsT.push({ item:it, cat:cat });
      });
    });
    D_.menu.forEach(function(cat){
      var viaItem = itemsT.some(function(x){ return x.cat === cat; });
      if (!viaItem && n.indexOf(api.norm(cat.cat)) !== -1) catsT.push(cat);
    });
    if (!catsT.length && !itemsT.length){
      ruptChat.push({ de:"ia", texte:"Je n'ai pas reconnu de produit du menu. Essayez par exemple « il n'y a plus de tacos M »." });
      return;
    }
    var mettre = !restaurer;
    catsT.forEach(function(c){ catOff[c.cat] = mettre; });
    itemsT.forEach(function(x){ rupt[x.item.id] = mettre; });
    var noms = catsT.map(function(c){ return c.cat; }).concat(itemsT.map(function(x){ return x.item.nom; }));
    var reponse;
    if (mettre){
      reponse = "Noté : " + noms.join(", ") + " en rupture. L'IA au téléphone ne le" +
        (noms.length > 1 ? "s" : "") + " proposera plus dès le prochain appel, et le signalera si un client insiste.";
      if (itemsT.length === 1 && !catsT.length){
        var cat0 = itemsT[0].cat, id0 = itemsT[0].item.id;
        var alt = cat0.items.filter(function(x){ return x.id !== id0 && !rupt[x.id] && !catOff[cat0.cat]; })[0];
        if (alt) reponse += " Elle proposera plutôt : " + alt.nom + ".";
      }
    } else {
      reponse = "C'est noté, " + noms.join(", ") + " de nouveau disponible" + (noms.length > 1 ? "s" : "") + ".";
    }
    ruptChat.push({ de:"ia", texte:reponse });
  }

  /* ------------------------------ relais IA ------------------------------ */
  function menuCompact(){
    return D_.menu.map(function(cat){
      return { cat:cat.cat, items:cat.items.map(function(it){ return { id:String(it.id), nom:it.nom }; }) };
    });
  }

  function etatActuel(){
    var catsOff = [], prodOff = [];
    D_.menu.forEach(function(cat){
      if (catOff[cat.cat]) catsOff.push(cat.cat);
      cat.items.forEach(function(it){ if (rupt[it.id]) prodOff.push(String(it.id)); });
    });
    return { categories_off:catsOff, produits_off:prodOff };
  }

  /* Applique ce que le relais a décidé — categories[] et produits[] portent
     chacun {nom|id, off}. Ignore silencieusement un nom/id inconnu plutôt
     que de planter sur une réponse mal formée. */
  function appliquerChangements(resultat){
    var categories = Array.isArray(resultat.categories) ? resultat.categories : [];
    var produits = Array.isArray(resultat.produits) ? resultat.produits : [];
    categories.forEach(function(c){ if (c && typeof c.off === 'boolean' && D_.menu.some(function(cat){ return cat.cat === c.nom; })) catOff[c.nom] = c.off; });
    produits.forEach(function(p){ if (p && typeof p.off === 'boolean' && trouverProduit(p.id)) rupt[String(p.id)] = p.off; });
  }

  /* L'IA a besoin de tout l'échange, pas seulement du dernier message —
     sinon elle « oublie » ce qui a été dit deux messages plus haut (produit
     déjà cité, réponse à une question posée juste avant). On reconstruit
     l'historique à partir du fil affiché, dans l'ordre, sans les bulles
     d'attente ("···"). */
  function historiqueChat(){
    return ruptChat
      .filter(function(m){ return !m.attente; })
      .map(function(m){ return { role: m.de === "ia" ? "assistant" : "user", contenu: m.texte }; });
  }

  function appelIA(historique, cb){
    var xhr = new XMLHttpRequest();
    try { xhr.open("POST", IA_ENDPOINT, true); }
    catch(e){ cb(e); return; }
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 12000;
    xhr.onload = function(){
      if (xhr.status < 200 || xhr.status >= 300){ cb(new Error("http " + xhr.status)); return; }
      var data;
      try { data = JSON.parse(xhr.responseText); } catch(e){ cb(e); return; }
      if (data.erreur){ cb(new Error(data.erreur)); return; }
      cb(null, data);
    };
    xhr.onerror = function(){ cb(new Error("réseau")); };
    xhr.ontimeout = function(){ cb(new Error("délai dépassé")); };
    try { xhr.send(JSON.stringify({ historique:historique, menu:menuCompact(), etat:etatActuel() })); }
    catch(e){ cb(e); }
  }

  function traiterMessage(texte){
    var generation = montageId;
    ruptChat.push({ de:"cu", texte:texte });

    if (!IA_ENDPOINT){
      appliquerLocal(texte);
      peindre();
      return;
    }

    var attente = { de:"ia", texte:"···", attente:true };
    ruptChat.push(attente);
    peindre();

    appelIA(historiqueChat(), function(erreur, resultat){
      if (generation !== montageId || !root.isConnected) return;
      var i = ruptChat.indexOf(attente);
      if (i !== -1) ruptChat.splice(i, 1);
      if (erreur){
        /* Le chat reste utilisable même si le relais est hors service. */
        appliquerLocal(texte);
      } else {
        appliquerChangements(resultat);
        ruptChat.push({ de:"ia", texte:resultat.reponse || "C'est noté." });
      }
      peindre();
    });
  }

  function envoyerChat(){
    var inp = root.querySelector("[data-chatinp]");
    var texte = inp ? inp.value.trim() : "";
    if (!texte) return;
    brouillon = "";
    traiterMessage(texte);
  }

  function ecouter(){
    if (ruptEcoute) return;
    ruptEcoute = true;
    api.toast("Démonstration vocale : une phrase exemple sera utilisée. Le microphone n’est pas activé.");
    peindre();
    api.after(function(){
      ruptEcoute = false;
      var phrase = VOIX[voixIdx % VOIX.length];
      voixIdx++;
      traiterMessage(phrase);
    }, 1500);
  }

  function bulle(m){
    return '<div class="k-bulle ' + (m.de === "ia" ? "ia" : "cu") + (m.attente ? " attente" : "") + '">' +
      esc(m.texte) + '</div>';
  }

  function vueRuptures(){
    var actifs = ruptActives();
    return titre('DISPONIBILITÉS', 'À la carte.', '<span class="k-total-count">' + actifs.length + '<small>ruptures</small></span>') + '<div class="k-chat">' +
      '<details class="k-inventory"><summary>Gérer les produits à la main ' + icone('settings') + '</summary><div class="k-inventory-list">' + D_.menu.map(function(cat){ return '<div class="k-inventory-category"><b>' + esc(cat.cat) + '</b><button data-toggle-cat="' + esc(cat.cat) + '" aria-pressed="' + !!catOff[cat.cat] + '">' + (catOff[cat.cat] ? 'Rétablir' : 'Tout suspendre') + '</button></div>' + cat.items.map(function(it){ return '<button class="k-stock-item" data-toggle-stock="' + esc(it.id) + '" aria-pressed="' + !!(rupt[it.id] || catOff[cat.cat]) + '"><span>' + esc(it.nom) + '</span><span class="k-stock-state">' + (rupt[it.id] || catOff[cat.cat] ? 'En rupture' : 'Disponible') + '</span></button>'; }).join(''); }).join('') + '</div></details>' +
      '<div class="k-chips">' +
        (actifs.length
          ? actifs.map(function(x){
              return '<button class="k-chip" data-unrupt="' + esc(x.id) + '">' + esc(x.nom) + ' ✕</button>';
            }).join("")
          : '<span class="k-chipsvide">Aucune rupture en cours</span>') +
      '</div>' +
      '<div class="k-msgs">' + ruptChat.map(bulle).join("") + '</div>' +
      '<div class="k-chatbar">' +
        '<button class="k-mic' + (ruptEcoute ? " on" : "") + '" data-mic aria-label="Simuler une dictée vocale">' +
          (ruptEcoute ? "···" : icone('mic')) +
        '</button>' +
        '<input class="k-chatinp" data-chatinp aria-label="Message à l’assistant de disponibilité" value="' + esc(brouillon) + '" autocomplete="off" placeholder="Il n’y a plus de tacos M…">' +
        '<button class="k-send" data-send aria-label="Envoyer le message">' + icone('arrow') + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------- rythme ------------------------------- */
  function vueRythme(){
    var lv = niveau();
    return titre('VOUS GARDEZ LA MAIN', 'Le rythme.', icone('rythme')) + '<div class="k-pane">' +
      '<div class="k-colL">' +
        '<div class="k-lbl">Niveau de service<em>Votre décision</em></div><div class="k-pace-grid">' +
        D_.charges.map(function(c){
          return '<button aria-pressed="' + (charge === c.id) + '" class="k-r' + (charge === c.id ? " sel" : "") + '" data-charge="' + c.id + '">' +
            '<span class="k">' + (c.delai ? 'Repère · ' + c.delai + " min" : "Pause des prises de commande") + '</span>' +
            '<span class="v">' + esc(c.nom) + '</span>' +
            '<span class="s' + (charge === c.id ? " rdy" : "") + '">' + (charge === c.id ? "Actif" : "Choisir") + '</span>' +
          '</button>';
        }).join("") + '</div>' +
        '<div class="k-note">Les changements concernent les <b>prochains appels</b>. Les commandes déjà confirmées restent inchangées.</div>' +
      '</div>' +
      '<div class="k-colR">' +
        '<div class="k-lbl">Délais annoncés<em>' + esc(lv.nom) + '</em></div>' +
        '<div class="k-r"><span class="k">Retrait</span><span class="v">Délai annoncé au comptoir</span>' +
          '<span class="k-step"><button data-d="retrait-">−</button><span class="k-mono">' + delaiRetrait + ' min</span>' +
          '<button data-d="retrait+">+</button></span></div>' +
        '<div class="k-r"><span class="k">Livraison</span><span class="v">Délai annoncé à domicile</span>' +
          '<span class="k-step"><button data-d="liv-">−</button><span class="k-mono">' + delaiLivraison + ' min</span>' +
          '<button data-d="liv+">+</button></span></div>' +
        '<div class="k-r"><span class="k">Capacité</span><span class="v">Commandes simultanées acceptées</span>' +
          '<span class="k-step"><button data-d="cap-">−</button><span class="k-mono">' + capacite + '</span>' +
          '<button data-d="cap+">+</button></span></div>' +
        '<div class="k-note amb">' + (charge === 'stop' ? 'Les prises de commande sont en pause. L’assistant reste disponible pour informer les clients.' : 'Retrait dans ' + delaiRetrait + ' min · livraison dans ' + delaiLivraison + ' min. ' + esc(lv.dit)) + '</div>' +
        '<div class="k-acts">' +
          '<button class="k-btn' + (charge === "stop" ? " rdy" : " amb") + '" data-stop>' +
            (charge === "stop" ? "Reprendre les commandes" : "Stopper les commandes") + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* --------------------- détail d'une commande, plein écran --------------------- */
  function overlay(c){
    var liv = c.mode === "livraison";
    var lignes = c.lignes.map(function(l){
      var sous = [l.opt, l.sup ? "+ " + l.sup : ""].filter(Boolean).join(" · ");
      return '<div class="k-li"><span class="q k-mono">' + l.q + '×</span>' +
        '<span class="x"><b>' + esc(l.nom) + '</b>' +
          (sous ? '<small>' + esc(sous) + '</small>' : '') +
          (l.dem ? '<small class="d">' + esc(l.dem) + '</small>' : '') + '</span>' +
        '<span class="p">' + eur(l.prix) + '</span></div>';
    }).join("");

    var infos =
      '<div class="k-r"><span class="k">Client</span><span class="v">' + esc(c.client || "non communiqué") + '</span></div>' +
      '<div class="k-r"><span class="k">Mode</span><span class="v">' + (liv ? "Livraison" : "Retrait au comptoir") +
        (liv ? '<small>' + esc(c.adresse || "") + '</small>' : '') + '</span></div>' +
      (liv ? '<div class="k-r"><span class="k">Distance</span><span class="v"><em>' +
        String(c.km).replace(".", ",") + ' km</em> · frais ' + eur(c.frais) + '</span></div>' : '') +
      '<div class="k-r"><span class="k">Paiement</span><span class="v">' + esc(c.paiement || "—") + '</span></div>' +
      '<div class="k-r"><span class="k">Reçue</span><span class="v"><em>' + esc(c.heure || "—") + '</em>' +
        (c.prete ? ' · annoncée <em>' + esc(c.prete) + '</em>' : '') + '</span></div>' +
      (c.motif ? '<div class="k-note amb">' + esc(c.motif) + '</div>' : '');

    return '<div class="k-over">' +
      '<div class="k-ohead"><button data-close>← Retour au tableau</button>' +
        '<span class="k-clock k-mono" data-hor style="margin-left:auto">' + esc(horloge) + '</span></div>' +
      '<div class="k-hero">' +
        '<span class="l"><b class="k-mono">' + c.id + '</b><span>' + esc(ETATS[c.etat].lbl) + '</span></span>' +
        '<span class="r" data-timer="' + c.id + '">' + ligneMinuteur(c) + '</span>' +
      '</div>' +
      lignes + infos +
      '<div class="k-tot">Total de la commande<i>' + eur(total(c)) + '</i></div>' +
      '<div class="k-ofoot">' +
        (ETATS[c.etat].suite
          ? '<button class="k-btn' + (c.etat === "preparation" ? " amb" : (c.etat === "prete" ? " rdy" : "")) +
            '" data-go="' + c.id + '">' + esc(
              c.etat === "confirmee" ? "Commencer" :
              c.etat === "preparation" ? (liv ? "Prête pour livreur" : "Prête au comptoir") :
              (liv ? "Livrée" : "Récupérée")) + '</button>'
          : '<div class="k-hold" style="flex:1">Aucune action : ' + esc(ETATS[c.etat].lbl.toLowerCase()) + '</div>') +
        (c.etat !== 'appel' && c.etat !== 'attente' && c.etat !== 'expiree' ? '<button class="k-btn2" data-ticket="' + c.id + '">Ticket</button>' : '') +
      '</div>' +
    '</div>';
  }

  /* ------------------------------- rendu ------------------------------- */
  function peindre(){
    /* Le tableau de service (et le détail ouvert) sont repeints chaque
       seconde pour faire avancer les minuteurs — sans ça, le défilement
       repartirait de zéro à chaque tic. On mémorise donc la position avant
       de réécrire le DOM, et on la restitue juste après. */
    var inventory = root.querySelector('.k-inventory');
    var inventoryOpen = inventory && inventory.open;
    var inventoryList = root.querySelector('.k-inventory-list');
    var inventoryY = inventoryList ? inventoryList.scrollTop : 0;
    var filterBar = root.querySelector('.k-filt');
    var filterX = filterBar ? filterBar.scrollLeft : 0;
    var oldOverlay = root.querySelector('.k-over');
    var overlayY = oldOverlay ? oldOverlay.scrollTop : 0;
    var focus = document.activeElement;
    var focusSelector = null;
    if (focus && root.contains(focus)) {
      ['data-vue','data-filt','data-d','data-charge','data-reg','data-son','data-close','data-imprimer','data-toggle-stock','data-toggle-cat','data-search'].some(function(attr){
        if (focus.hasAttribute(attr)) { focusSelector = '[' + attr + '="' + focus.getAttribute(attr) + '"]'; return true; }
        return false;
      });
    }
    var ancre = root.querySelector(".k-body, .k-pane");
    var y = ancre ? ancre.scrollTop : 0;
    var corps = vue === "service" ? vueService()
              : vue === "tickets" ? vueTickets()
              : vue === "ruptures" ? vueRuptures()
              : vueRythme();
    var superposition = ouverte ? overlay(ouverte)
                       : ticketOuvert ? overlayTicket(ticketOuvert)
                       : reglagesOuverts ? overlayReglages()
                       : triOuvert ? overlayTri()
                       : "";
    root.innerHTML = head() + corps + navigation() + superposition;
    if (root.querySelector('.k-filt')) root.querySelector('.k-filt').scrollLeft = filterX;
    if (inventoryOpen && root.querySelector('.k-inventory')) {
      root.querySelector('.k-inventory').open = true;
      root.querySelector('.k-inventory-list').scrollTop = inventoryY;
    }
    if (superposition) {
      var dialog = root.querySelector('.k-over');
      dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); dialog.setAttribute('aria-label','Détails et réglages cuisine');
      Array.prototype.forEach.call(root.children,function(el){ if (el !== dialog) el.inert = true; });
      var first = focusSelector && dialog.querySelector(focusSelector) || dialog.querySelector('button'); if (first) first.focus({preventScroll:true});
      dialog.scrollTop = overlayY;
    } else if (focusSelector) {
      var nextFocus = root.querySelector(focusSelector); if (nextFocus) nextFocus.focus({preventScroll:true});
    }
    api.badge(aPreparer() ? String(aPreparer()) : 0);
    var ancre2 = root.querySelector(".k-body, .k-pane");
    if (ancre2) ancre2.scrollTop = y;
    if (vue === "ruptures" && !ouverte){
      var msgs = root.querySelector(".k-msgs");
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
  }

  /* ------------------------------ actions ------------------------------ */
  function avancer(id){
    var c = null, i;
    for (i = 0; i < cmds.length; i++) if (cmds[i].id === id) c = cmds[i];
    if (!c) return;
    var suite = ETATS[c.etat].suite;
    if (!suite){ api.toast("Rien à faire avancer sur la commande " + id + "."); return; }
    derniereAction = {id:c.id, etat:c.etat, depuis:c.depuis};
    c.etat = suite;
    if (suite === "preparation") c.depuis = 0;
    api.vibrer(12);
    api.toast("Commande " + id + " — " + ETATS[suite].lbl.toLowerCase() + ".");
    if (ouverte && ouverte.id === id) ouverte = c;
    peindre();
  }

  function arrive(){
    nouvelles++;
    var base = D_.commandes[2];
    var id = 251 + nouvelles;
    var c = {
      id:id, etat:"confirmee", mode: nouvelles % 2 ? "retrait" : "livraison",
      heure:api.heure(), prete:"20:1" + nouvelles, client: nouvelles % 2 ? "Inès" : "Théo",
      lignes:[{ q:2, nom:"Tacos M", opt:"Poulet · sauce blanche", dem:"", sup:"Cheddar", prix:2100 }],
      total:2100, frais:250, paiement: nouvelles % 2 ? "Sur place" : "Carte au livreur", depuis:0
    };
    if (c.mode === "livraison"){ c.total = 2350; c.km = 1.8; c.adresse = "3 rue Chevreul, 2e étage"; }
    cmds.unshift(c);
    bip();
    api.vibrer(20);
    api.toast("Nouvelle commande " + id + " — confirmée par le client.");
    peindre();
  }

  /* ------------------------------- montage ------------------------------- */
  function monter(scene, a){
    api = a; D_ = a.data;
    montageId++;
    vue = 'service'; filtre = 'faire'; ouverte = null; ticketOuvert = null;
    reglagesOuverts = false; triOuvert = false; menuOuvert = false;
    derniereAction = null; nouvelles = 0; recherche = ''; ruptEcoute = false;
    charge = D_.resto.charge;
    delaiRetrait = niveau().delai || 15;
    horloge = api.heure();

    /* copie de travail : les autres applications lisent les mêmes données */
    cmds = D_.commandes.map(function(c){
      var n = {};
      for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) n[k] = c[k];
      n.lignes = c.lignes.slice();
      n.reste = c.expire || 0;
      n.depuis = c.depuis || (c.etat === "preparation" ? 540 : 0);
      return n;
    });

    root = document.createElement("div");
    root.className = "k-app";
    scene.appendChild(root);

    /* Tiroir de navigation : monté une fois, en dehors de root, pour que sa
       transition de glissement soit une vraie transition CSS et non un
       DOM recréé déjà ouvert. */
    scrim = document.createElement("div");
    scrim.className = "k-scrim";
    scene.appendChild(scrim);
    scrim.addEventListener("click", fermerTiroir);

    tiroir = document.createElement("nav");
    tiroir.className = "k-tiroir";
    tiroir.innerHTML =
      '<div class="k-tiroir-head">' + esc(D_.resto.nom) +
        '<button data-fermer-tiroir aria-label="Fermer">✕</button></div>' +
      '<div class="k-tiroir-liste" data-tiroir-liste></div>';
    scene.appendChild(tiroir);
    rafraichirTiroir();
    tiroir.addEventListener("click", function(ev){
      var b = ev.target.closest && ev.target.closest("[data-vue],[data-fermer-tiroir]");
      if (!b) return;
      if (b.dataset.vue){
        vue = b.dataset.vue; ouverte = null; ticketOuvert = null; reglagesOuverts = false; triOuvert = false;
        rafraichirTiroir(); fermerTiroir(); peindre();
        return;
      }
      fermerTiroir();
    });
    tiroir.addEventListener('keydown',function(ev){
      if (ev.key === 'Escape') { ev.stopPropagation(); fermerTiroir(); }
      if (ev.key === 'Tab') {
        var items = tiroir.querySelectorAll('button');
        if (ev.shiftKey && document.activeElement === items[0]) {ev.preventDefault();items[items.length-1].focus();}
        else if (!ev.shiftKey && document.activeElement === items[items.length-1]) {ev.preventDefault();items[0].focus();}
      }
    });

    peindre();

    /* une seconde qui passe : minuteurs, expiration, horloge */
    api.every(function(){
      var bouge = false, expiration = false, i, c;
      for (i = 0; i < cmds.length; i++){
        c = cmds[i];
        if (c.etat === "attente"){
          c.reste = Math.max(0, (c.reste | 0) - 1);
          if (c.reste === 0){ c.etat = "expiree"; c.motif = "Aucune validation du client"; expiration = true; }
          bouge = true;
        } else if (c.etat === "preparation" || c.etat === "appel"){
          c.depuis = (c.depuis | 0) + 1; bouge = true;
        }
      }
      var h = api.heure();
      if (h !== horloge){ horloge = h; bouge = true; }
      if (!bouge) return;
      if (expiration && (vue === 'service' || ouverte)) { peindre(); return; }
      api.badge(aPreparer() ? String(aPreparer()) : 0);
      /* On ne repeint en continu que ce qui affiche un minuteur : le tableau
         de service et le détail ouvert. Les autres écrans — impression,
         ruptures, rythme — ne bougent pas tout seuls, sinon la discussion de
         rupture en cours de frappe serait effacée à chaque seconde. */
      /* Update only clocks: preserve scroll, focus, text selection and gestures. */
      var expireVisible = root.querySelector('[data-timer]');
      if (expireVisible) {
        Array.prototype.forEach.call(root.querySelectorAll('[data-timer]'),function(el){
          var cmd = cmds.filter(function(x){ return x.id === +el.getAttribute('data-timer'); })[0];
          if (cmd) el.innerHTML = ligneMinuteur(cmd);
        });
      }
      Array.prototype.forEach.call(root.querySelectorAll('[data-hor]'),function(el){ el.textContent = horloge; });
    }, 1000);

    api.after(arrive, 21000);
    api.after(arrive, 52000);

    root.addEventListener("click", function(ev){
      var t = ev.target;
      if (!t.closest) return;
      var SEL = "[data-vue],[data-undo],[data-demo-arrive],[data-toggle-stock],[data-toggle-cat],[data-go],[data-open],[data-close],[data-filt],[data-son]," +
                "[data-reg],[data-unrupt],[data-charge],[data-stop],[data-ticket],[data-d]," +
                "[data-mic],[data-send],[data-menu],[data-voirticket],[data-fermer-ticket]," +
                "[data-telecharger],[data-imprimer],[data-reglages],[data-fermer-reglages],[data-tri]," +
                "[data-tri-ouvrir],[data-fermer-tri]";
      var b = t.closest(SEL);
      if (!b) return;
      var d = b.dataset;

      if (d.vue){ vue = d.vue; ouverte = null; ticketOuvert = null; reglagesOuverts = false; triOuvert = false; peindre(); return; }
      if (d.demoArrive !== undefined){ arrive(); return; }
      if (d.undo !== undefined && derniereAction){
        cmds.forEach(function(c){ if (c.id === derniereAction.id){ c.etat = derniereAction.etat; c.depuis = derniereAction.depuis; }});
        derniereAction = null; api.toast('Dernière action annulée.'); peindre(); return;
      }
      if (d.toggleStock){
        var parentCat = D_.menu.filter(function(cat){ return cat.items.some(function(it){ return String(it.id) === d.toggleStock; }); })[0];
        if (parentCat && catOff[parentCat.cat]) { api.toast('Rétablissez d’abord la catégorie ' + parentCat.cat + '.'); return; }
        rupt[d.toggleStock] = !rupt[d.toggleStock]; peindre(); return;
      }
      if (d.toggleCat){ catOff[d.toggleCat] = !catOff[d.toggleCat]; peindre(); return; }

      if (d.go !== undefined){ ev.stopPropagation(); avancer(+d.go); return; }
      if (d.open !== undefined && !ouverte){
        var id = +d.open;
        for (var i = 0; i < cmds.length; i++) if (cmds[i].id === id) ouverte = cmds[i];
        peindre(); return;
      }
      if (d.close !== undefined){ ouverte = null; peindre(); return; }
      if (d.filt){ filtre = d.filt; peindre(); return; }
      if (d.menu !== undefined){ ouvrirTiroir(); return; }
      if (d.son !== undefined){
        son = !son;
        api.toast(son ? "Alerte sonore active." : "Alerte sonore coupée — les commandes arrivent en silence.");
        peindre(); return;
      }
      if (d.voirticket){
        var idv = +d.voirticket, cv = null;
        for (var iv = 0; iv < cmds.length; iv++) if (cmds[iv].id === idv) cv = cmds[iv];
        if (cv){ ticketOuvert = cv; peindre(); }
        return;
      }
      if (d.fermerTicket !== undefined){ ticketOuvert = null; peindre(); return; }
      if (d.telecharger){
        var idt = +d.telecharger, ct = null;
        for (var it2 = 0; it2 < cmds.length; it2++) if (cmds[it2].id === idt) ct = cmds[it2];
        if (ct) telechargerTicket(ct);
        return;
      }
      if (d.imprimer){
        var idp = +d.imprimer;
        var printOrder = cmds.filter(function(c){ return c.id === idp; })[0];
        if (!printOrder || /^(appel|attente|expiree)$/.test(printOrder.etat)) { api.toast('La commande doit être confirmée avant impression.'); return; }
        imprimes[idp] = true;
        api.toast("Démo : impression du ticket #" + idp + " simulée. Aucune imprimante connectée.");
        peindre(); return;
      }
      if (d.triOuvrir !== undefined){ triOuvert = true; peindre(); return; }
      if (d.fermerTri !== undefined){ triOuvert = false; peindre(); return; }
      if (d.tri){ triHistorique = d.tri; triOuvert = false; peindre(); return; }
      if (d.reglages !== undefined){ reglagesOuverts = true; peindre(); return; }
      if (d.fermerReglages !== undefined){ reglagesOuverts = false; peindre(); return; }
      if (d.reg){
        if (d.reg === "son"){ son = !son; api.toast(son ? "Alerte sonore active." : "Alerte sonore coupée."); }
        else if (d.reg === "test") api.toast("Démo : test simulé, aucune imprimante connectée.");
        else if (d.reg === "imp") api.toast("Epson TM-m30 : exemple de configuration, connexion réelle à intégrer.");
        else if (d.reg === "auto") impressionAuto = !impressionAuto;
        else if (d.reg === "ann") impressionAnnulations = !impressionAnnulations;
        peindre(); return;
      }
      if (d.unrupt){ retablirUn(d.unrupt); return; }
      if (d.mic !== undefined){ ecouter(); return; }
      if (d.send !== undefined){ envoyerChat(); return; }
      if (d.charge){
        charge = d.charge;
        if (niveau().delai) delaiRetrait = niveau().delai;
        api.toast("Rythme : " + niveau().nom + " — " + niveau().dit);
        peindre(); return;
      }
      if (d.stop !== undefined){
        charge = charge === "stop" ? "rush" : "stop";
        api.toast(charge === "stop"
          ? "Démo : commandes en pause. Les commandes confirmées restent à préparer."
          : "Commandes rouvertes — retrait annoncé " + delaiRetrait + " min.");
        peindre(); return;
      }
      if (d.ticket){
        var idtk = +d.ticket, ctk = null;
        for (var itk = 0; itk < cmds.length; itk++) if (cmds[itk].id === idtk) ctk = cmds[itk];
        ouverte = null; vue = "tickets"; ticketOuvert = ctk;
        rafraichirTiroir(); peindre(); return;
      }
      if (d.d){
        if (d.d === "retrait-") delaiRetrait = Math.max(5, delaiRetrait - 5);
        if (d.d === "retrait+") delaiRetrait = Math.min(90, delaiRetrait + 5);
        if (d.d === "liv-") delaiLivraison = Math.max(10, delaiLivraison - 5);
        if (d.d === "liv+") delaiLivraison = Math.min(120, delaiLivraison + 5);
        if (d.d === "cap-") capacite = Math.max(1, capacite - 1);
        if (d.d === "cap+") capacite = Math.min(40, capacite + 1);
        peindre(); return;
      }
    });

    /* Entrée envoie le message de rupture sans passer par le bouton. */
    root.addEventListener("keydown", function(ev){
      if (ev.key === 'Escape') {
        ev.stopPropagation(); ouverte = null; ticketOuvert = null; reglagesOuverts = false; triOuvert = false; fermerTiroir(); peindre(); return;
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.getAttribute('role') === 'button') { ev.preventDefault(); ev.target.click(); return; }
      if (ev.key === 'Tab' && root.querySelector('.k-over')) {
        var btns = root.querySelector('.k-over').querySelectorAll('button,input,summary');
        if (btns.length && ev.shiftKey && document.activeElement === btns[0]) { ev.preventDefault(); btns[btns.length-1].focus(); }
        else if (btns.length && !ev.shiftKey && document.activeElement === btns[btns.length-1]) { ev.preventDefault(); btns[0].focus(); }
      }
      if ((ev.key === "Enter" || ev.keyCode === 13) && ev.target && ev.target.matches && ev.target.matches("[data-chatinp]")){
        ev.preventDefault();
        envoyerChat();
      }
    });
    root.addEventListener('input',function(ev){ if (ev.target.hasAttribute('data-chatinp')) brouillon = ev.target.value; });
    root.addEventListener('submit',function(ev){
      if (ev.target.hasAttribute('data-search-form')) { ev.preventDefault(); recherche = root.querySelector('[data-search]').value.trim(); peindre(); }
    });

    return function(){
      montageId++;
      try { if (audio && audio.close) audio.close(); } catch(e){}
      audio = null;
    };
  }

  RIA.register({
    id:"cuisine", nom:"Cuisine", badge:"2",
    fond:"linear-gradient(145deg,#F5B544,#C8811A)", encre:"#1A1206",
    glyph:'<path d="M4 7h16M4 12h16M4 17h10"/><path d="M19.5 15.5v4"/>',
    format:"phone",
    css:"cuisine.css",
    monter:monter
  });
})();
