/* =========================================================================
   Resto IA — application COMMERCIAL.
   Direction A validée : « Carte d'abord ».

   La carte occupe tout l'écran, jusque sous la barre d'état. Une feuille
   glissante à trois hauteurs porte la liste et la fiche du prospect. Une
   seule action flottante : l'itinéraire. L'utilisateur est debout, dehors,
   une main occupée — grandes cibles, une décision par écran.

   ES5 strict. Toutes les classes commencent par m-. Voir src/commercial.css.
   ========================================================================= */
(function(){
  "use strict";

  var api, root, D_;
  var P = [];               /* copie de travail des prospects */
  var filtre = "";          /* statut filtré, "" = tous */
  var choisi = null;        /* prospect ouvert dans la feuille */
  var hauteur = 1;          /* 0 haut · 1 milieu · 2 bas */
  var surface = null;       /* argumentaire | revenus | tournee */
  var preuve = "photo";
  var pitchT = null, demo = null;
  var TOPS = ["21%", "54%", "76%"];

  function esc(s){ return api.esc(s); }
  function st(p){ return D_.statuts[p.statut]; }

  /* Position stable sur la carte, dérivée de l'identifiant et de la distance :
     la distance est réelle, la projection est une commodité de maquette. */
  function pos(p){
    var a = (p.id * 2.399963) % 6.283185;
    var r = 14 + Math.min(34, p.dist / 26);
    return { x: 50 + Math.cos(a) * r, y: 47 + Math.sin(a) * r * 0.86 };
  }

  /* ------------------------------- la carte ------------------------------- */
  function carte(){
    var pins = P.map(function(p){
      var c = pos(p), off = (filtre && p.statut !== filtre) ? '1' : '0';
      return '<g class="m-pin" data-pin="' + p.id + '" data-off="' + off + '">' +
        (p.statut === "reserve" ? '<circle class="m-halo" cx="' + c.x + '%" cy="' + c.y + '%" r="9" fill="#3FA9FF" opacity=".5"/>' : '') +
        '<circle cx="' + c.x + '%" cy="' + c.y + '%" r="8.5" fill="#0B0D11" opacity=".9"/>' +
        '<circle cx="' + c.x + '%" cy="' + c.y + '%" r="6" class="m-bg-' + p.statut + '"/>' +
      '</g>';
    }).join("");

    return '<div class="m-map"><svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="390" height="844" fill="#181C22"/>' +
      /* îlots */
      '<g fill="#1E232A">' +
        '<rect x="14" y="70" width="150" height="120"/><rect x="186" y="70" width="190" height="120"/>' +
        '<rect x="14" y="212" width="150" height="150"/><rect x="186" y="212" width="120" height="150"/>' +
        '<rect x="14" y="384" width="112" height="128"/><rect x="148" y="384" width="158" height="128"/>' +
        '<rect x="14" y="534" width="150" height="140"/><rect x="186" y="534" width="120" height="140"/>' +
      '</g>' +
      /* le Rhône */
      '<path d="M328 0 L390 0 L390 844 L306 844 Q344 600 318 420 Q296 220 328 0 Z" fill="#141B24"/>' +
      '<path d="M328 0 Q296 220 318 420 Q344 600 306 844" stroke="#1E2731" fill="none"/>' +
      /* rues */
      '<g stroke="#272D35" stroke-width="10">' +
        '<path d="M0 200 H390"/><path d="M0 372 H390"/><path d="M0 522 H390"/><path d="M0 684 H390"/>' +
        '<path d="M174 0 V844"/><path d="M0 0 V844" transform="translate(4)"/>' +
      '</g>' +
      /* pont */
      '<g stroke="#2E3842" stroke-width="6"><path d="M306 372 H390"/></g>' +
      '<g stroke="#313842" stroke-width="5"><path d="M306 372 H390"/><path d="M306 522 H390"/></g>' +
      /* square */
      '<rect x="148" y="384" width="158" height="128" fill="#1A2620"/>' +
      '<text x="196" y="452" fill="#33403A" font-family="Inter" font-size="11" font-weight="600">SQUARE</text>' +
      '<text x="20" y="196" fill="#39414B" font-family="Inter" font-size="10.5" font-weight="700" letter-spacing="1.4">COURS GAMBETTA</text>' +
      '<text x="20" y="518" fill="#39414B" font-family="Inter" font-size="10.5" font-weight="700" letter-spacing="1.4">AV. JEAN-JAURÈS</text>' +
      pins +
      /* vous êtes ici */
      '<circle class="m-halo" cx="50%" cy="47%" r="12" fill="#fff" opacity=".35"/>' +
      '<circle cx="50%" cy="47%" r="7" fill="#fff"/><circle cx="50%" cy="47%" r="3.4" fill="#11141A"/>' +
    '</svg></div>';
  }

  /* ------------------------------ la feuille ------------------------------ */
  function listeHtml(){
    var liste = P.filter(function(p){ return !filtre || p.statut === filtre; });
    liste.sort(function(a, b){ return a.dist - b.dist; });
    var chips = Object.keys(D_.statuts).map(function(k){
      var n = P.filter(function(p){ return p.statut === k; }).length;
      return '<button class="m-chip' + (filtre === k ? " on" : "") + '" data-filtre="' + k + '">' +
        '<i class="m-bg-' + k + '"></i>' + esc(D_.statuts[k].nom) + '<span>' + n + '</span></button>';
    }).join("");

    return '<div class="m-grip" data-grip><div class="m-grab"></div>' +
        '<button class="m-cyc" data-cycle>' + (hauteur === 0 ? "▾" : "▴") + '</button></div>' +
      '<div class="m-hd"><div class="m-t"><h3>' + esc(D_.commercial.zone) + '</h3>' +
        '<p>' + D_.commercial.cibles + ' cibles · ' + liste.length + ' affichées · ' + esc(D_.commercial.nom) + '</p></div></div>' +
      '<div class="m-filters">' +
        '<button class="m-chip' + (filtre ? "" : " on") + '" data-filtre="">Tous<span>' + P.length + '</span></button>' +
        chips +
      '</div>' +
      '<div class="m-body">' +
        liste.map(function(p){
          return '<button class="m-row" data-fiche="' + p.id + '">' +
            '<span class="m-d10 m-bg-' + p.statut + '"></span>' +
            '<span class="m-n"><b>' + esc(p.nom) +
              '<em class="m-s-' + p.statut + '">' + esc(st(p).nom) + '</em></b>' +
              '<span>' + esc(p.adr) + (p.reste ? ' · ' + reste(p) : '') + '</span></span>' +
            '<span class="m-km"><b>' + p.dist + ' m</b><span>' + esc(p.type) + '</span></span>' +
          '</button>';
        }).join("") +
        (liste.length ? "" : '<div style="padding:26px 18px;color:#6F7987;font-size:13px">Aucun restaurant avec ce statut sur le secteur.</div>') +
        '<button class="m-link" data-surf="tournee">Tournée suggérée' +
          '<small>Les jamais démarchés, par distance croissante</small><span class="m-chev">›</span></button>' +
        '<button class="m-link" data-surf="argu">Parler du produit' +
          '<small>Pitch de 20 secondes, objections, démo à faire écouter</small><span class="m-chev">›</span></button>' +
        '<button class="m-link" data-surf="revenus">Mes revenus' +
          '<small>' + esc(api.eur(D_.commission)) + ' par mois et par client actif</small><span class="m-chev">›</span></button>' +
        '<div class="m-band">Le secteur est une <b>priorité commerciale, pas un planning</b> : ' +
          'vous gardez vos horaires, votre parcours et votre organisation.</div>' +
      '</div>';
  }

  function reste(p){
    var s = p.reste | 0;
    var j = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return j + " j " + String(h).padStart(2, "0") + " h " + String(m).padStart(2, "0");
  }

  function ficheHtml(p){
    var dur = 3 * 86400;
    return '<div class="m-grip" data-grip><div class="m-grab"></div>' +
        '<button class="m-cyc" data-liste>✕</button></div>' +
      '<div class="m-body">' +
        '<div class="m-title"><span class="m-st m-s-' + p.statut + '">' + esc(st(p).nom) + '</span>' +
          '<h2>' + esc(p.nom) + '</h2>' +
          '<p>' + esc(p.type) + ' · ' + esc(p.adr) + '</p>' +
          '<p class="m-km2">' + p.dist + ' m<i>·</i>' + Math.max(1, Math.round(p.dist / 75)) + ' min à pied' +
            (p.info ? '<i>·</i>' + esc(p.info) : '') + '</p></div>' +

        (p.statut === "reserve" && p.reste ?
          '<div class="m-resa"><div class="m-lb">Réservé par vous</div>' +
            '<div class="m-cd"><b data-cd>' + reste(p) + '</b><span>restantes</span></div>' +
            '<div class="m-bar"><i style="width:' + Math.round(p.reste / dur * 100) + '%"></i></div>' +
            '<p class="m-ft">Sans action il retourne au commun : vous serez bloqué deux mois, ' +
            'un autre commercial pourra le prendre tout de suite.</p></div>' : '') +

        (p.derniere || p.objection ?
          '<div class="m-log"><div class="m-lb">Dernière action</div>' +
            (p.derniere ? '<div>' + esc(p.derniere) + '</div>' : '') +
            (p.preuve ? '<div>preuve : ' + esc(p.preuve) + '</div>' : '') +
            (p.objection ? '<div class="m-q">' + esc(p.objection) + '</div>' : '') +
          '</div>' : '') +

        '<div class="m-act">' +
          (p.statut === "jamais" || p.statut === "sansrep"
            ? '<button class="m-cta" data-prendre="' + p.id + '">Je prends ce prospect</button>'
            : (p.statut === "reserve"
              ? '<button class="m-cta" data-visite="' + p.id + '">Marquer une visite</button>'
              : '<button class="m-cta m-ghost" data-visite="' + p.id + '">Marquer une visite</button>')) +
          '<div class="m-proof">' +
            ['appel', 'message', 'photo'].map(function(k){
              var lbl = k === "appel" ? "Appel<br>numéro pro" : k === "message" ? "Message<br>canal Resto IA" : "Photo<br>de devanture";
              return '<button data-preuve="' + k + '" class="' + (preuve === k ? "on" : "") + '">' + lbl + '</button>';
            }).join("") +
          '</div>' +
          '<p class="m-note">Photo de devanture <b>sans visages ni plaques</b>. L\'audio ne sert pas de preuve. ' +
            'La géolocalisation est ponctuelle, jamais un suivi continu.</p>' +
        '</div>' +

        '<button class="m-link" data-rappel="' + p.id + '">Planifier un rappel' +
          '<span class="m-chev">›</span></button>' +
        '<button class="m-link" data-essai="' + p.id + '">Passer en essai gratuit' +
          '<small>La commission de ' + esc(api.eur(D_.commission)) + ' court dès le premier mois payant</small>' +
          '<span class="m-chev">›</span></button>' +
        '<button class="m-link m-dng" data-stop="' + p.id + '">Ne plus contacter' +
          '<small>Opposition définitive, respectée par tous les commerciaux</small>' +
          '<span class="m-chev">›</span></button>' +
        (p.statut === "reserve" ? '<button class="m-link" data-rendre="' + p.id + '">Rendre au commun' +
          '<span class="m-chev">›</span></button>' : '') +
      '</div>';
  }

  /* ---------------------------- surfaces plein écran ---------------------------- */
  function surfArgu(){
    var pitch = "Vous ratez des appels entre midi et deux, et le soir. " +
      "Un assistant décroche à votre place, prend la commande et vous l'envoie confirmée. " +
      "Vous gardez votre numéro. Dix minutes à installer.";
    return '<div class="m-shead"><button class="m-back" data-close>‹</button>' +
        '<div class="m-t"><h2>Parler du produit</h2><p>Vingt secondes, debout, hors rush</p></div></div>' +
      '<div class="m-scroll">' +
        '<div class="m-pitch">' + esc(pitch) + '</div>' +
        '<div class="m-tm"><span class="m-c" data-chrono>00:00</span>' +
          '<span class="m-t"><i data-jauge></i></span><span class="m-e">20 s</span></div>' +
        '<div class="m-act"><button class="m-cta m-ghost" data-pitch>Lancer le minuteur</button></div>' +
        '<div class="m-sec">Objections</div>' +
        D_.commercial.objections.map(function(o){
          return '<details class="m-obj"><summary>' + esc(o.q) + '</summary>' +
            '<div class="m-r">' + esc(o.r) + '</div></details>';
        }).join("") +
        '<div class="m-sec">Faire écouter</div>' +
        '<div class="m-thread" data-demo>' +
          '<div class="m-bub m-sys">Touchez « jouer » pour faire entendre l\'assistant au gérant</div>' +
        '</div>' +
        '<div class="m-act"><button class="m-cta m-ghost" data-demo>Jouer la démo</button></div>' +
        '<div class="m-sec">Ce qui tient</div>' +
        '<div class="m-step"><span class="m-num">1</span><span class="m-tx"><b>Il garde son numéro</b>' +
          '<span>' + esc(D_.regles.renvoi) + '</span></span></div>' +
        '<div class="m-step"><span class="m-num">2</span><span class="m-tx"><b>Rien ne part sans confirmation</b>' +
          '<span>' + esc(D_.regles.confirmation) + '</span></span></div>' +
        '<div class="m-step"><span class="m-num">3</span><span class="m-tx"><b>Resto IA n\'encaisse jamais</b>' +
          '<span>' + esc(D_.regles.paiement) + '</span></span></div>' +
      '</div>';
  }

  function surfRevenus(){
    var actifs = P.filter(function(p){ return p.statut === "client"; }).length;
    var g = D_.commercial.gains, max = Math.max.apply(null, g.map(function(x){ return x.v; }));
    var fun = D_.commercial.entonnoir, fmax = fun[0].n;
    return '<div class="m-shead"><button class="m-back" data-close>‹</button>' +
        '<div class="m-t"><h2>Mes revenus</h2><p>' + esc(api.eur(D_.commission)) + ' par mois et par client actif</p></div></div>' +
      '<div class="m-scroll">' +
        '<div class="m-big"><div class="m-lb">Ce mois-ci</div>' +
          '<div class="m-v">' + esc(api.eur(actifs * D_.commission)) + '</div>' +
          '<div class="m-u">' + actifs + ' clients actifs. Récurrent tant qu\'ils restent abonnés. ' +
            'Aucun quota, aucun plafond ; les frais de déplacement restent à votre charge.</div></div>' +
        '<div class="m-sec">Quatre derniers mois</div>' +
        g.map(function(x){
          return '<div class="m-month"><span class="m-m">' + esc(x.mois) + '</span>' +
            '<span class="m-t"><i style="width:' + Math.round(x.v / max * 100) + '%"></i></span>' +
            '<span class="m-v">' + esc(api.eur(x.v)) + '</span></div>';
        }).join("") +
        '<div class="m-sec">Entonnoir du secteur</div>' +
        '<div class="m-fun">' +
          fun.map(function(e, i){
            var cls = i === fun.length - 1 ? " m-r" : (i === fun.length - 2 ? " m-g" : "");
            return '<div><span class="m-f">' + esc(e.etape) + '</span>' +
              '<span class="m-t"><i class="' + cls + '" style="width:' + Math.round(e.n / fmax * 100) + '%"></i></span>' +
              '<span class="m-n">' + e.n + '</span></div>';
          }).join("") +
        '</div>' +
        '<div class="m-sec">Si j\'en signe davantage</div>' +
        '<div class="m-slide"><input type="range" id="m-sl" min="1" max="120" value="' + Math.max(1, actifs) + '"></div>' +
        '<div class="m-kv">Clients actifs<b data-sl-n>' + Math.max(1, actifs) + '</b></div>' +
        '<div class="m-kv">Par mois<b class="m-gv" data-sl-m>' + esc(api.eur(Math.max(1, actifs) * D_.commission)) + '</b></div>' +
        '<div class="m-kv">Sur douze mois<b data-sl-a>' + esc(api.eur0(Math.max(1, actifs) * D_.commission * 12)) + '</b></div>' +
        '<div class="m-band">Repère du business plan : 1 500 à 1 800 visites par an, conversion supposée de 10 à 15 %, ' +
          'soit 150 à 270 clients par an. <b>Hypothèse à valider, pas une promesse.</b></div>' +
        '<div class="m-sec">Règles</div>' +
        D_.commercial.regles.map(function(r, i){
          return '<div class="m-step"><span class="m-num">' + (i+1) + '</span>' +
            '<span class="m-tx"><b>' + esc(r.t) + '</b><span>' + esc(r.x) + '</span></span></div>';
        }).join("") +
      '</div>';
  }

  function surfTournee(){
    var libres = P.filter(function(p){ return p.statut === "jamais" || p.statut === "sansrep"; });
    libres.sort(function(a, b){ return a.dist - b.dist; });
    var total = 0;
    libres.forEach(function(p){ total += Math.round(p.dist / 75) + 12; });
    return '<div class="m-shead"><button class="m-back" data-close>‹</button>' +
        '<div class="m-t"><h2>Tournée suggérée</h2><p>' + libres.length + ' à voir · environ ' + total + ' min</p></div></div>' +
      '<div class="m-scroll">' +
        libres.map(function(p, i){
          return '<div class="m-step"><span class="m-num">' + (i+1) + '</span>' +
            '<span class="m-tx"><b>' + esc(p.nom) + '</b>' +
            '<span>' + esc(p.adr) + ' · ' + p.dist + ' m · ' + Math.max(1, Math.round(p.dist / 75)) + ' min à pied</span></span></div>';
        }).join("") +
        (libres.length ? "" : '<div style="padding:26px 18px;color:#6F7987;font-size:13px">Tout le secteur a été démarché.</div>') +
        '<div class="m-band">Ordre par distance croissante depuis votre position. ' +
          '<b>Rien ne vous oblige à le suivre</b> — c\'est une suggestion, pas un itinéraire imposé.</div>' +
        '<div class="m-band" style="margin-top:0">Repère national : environ <b>29 700 cibles</b> en France, ' +
          'soit une pour 2 300 habitants. Le ratio « une pour 400 » des premières versions comptait tous les restaurants.</div>' +
      '</div>';
  }

  /* -------------------------------- rendu -------------------------------- */
  function peindre(){
    var dedans = choisi ? ficheHtml(choisi) : listeHtml();
    var fabBas = hauteur === 0 ? "calc(79% + 14px)" : hauteur === 1 ? "calc(46% + 14px)" : "calc(24% + 14px)";
    root.innerHTML =
      carte() +
      '<div class="m-stat"><b data-hor>' + esc(api.heure()) + '</b>' +
        '<span class="m-sg"><svg width="16" height="12" viewBox="0 0 16 12" fill="#fff">' +
        '<rect x="0" y="8" width="3" height="4"/><rect x="4.5" y="5.5" width="3" height="6.5"/>' +
        '<rect x="9" y="3" width="3" height="9"/><rect x="13.5" y="0" width="2.5" height="12" opacity=".4"/></svg></span></div>' +
      '<div class="m-zone"><i></i>' + esc(D_.commercial.zone.split("—")[0].trim()) + '</div>' +
      '<button class="m-plus" data-menu>' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E7EBF0" stroke-width="2" stroke-linecap="round">' +
        '<path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '<button class="m-fab" data-itineraire style="bottom:' + fabBas + '">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#08130D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3 21 21 12 17 3 21z"/></svg></button>' +
      '<div class="m-sheet" style="top:' + TOPS[hauteur] + '">' + dedans + '</div>' +
      (surface ? '<div class="m-surface on">' +
        (surface === "argu" ? surfArgu() : surface === "revenus" ? surfRevenus() : surfTournee()) + '</div>' : '');

    var sl = root.querySelector("#m-sl");
    if (sl) sl.addEventListener("input", majCurseur);
    api.badge(P.filter(function(p){ return p.statut === "reserve" || p.statut === "attente"; }).length || 0);
  }

  function majCurseur(){
    var v = +root.querySelector("#m-sl").value;
    root.querySelector("[data-sl-n]").textContent = v;
    root.querySelector("[data-sl-m]").textContent = api.eur(v * D_.commission);
    root.querySelector("[data-sl-a]").textContent = api.eur0(v * D_.commission * 12);
  }

  /* ------------------------------- actions ------------------------------- */
  function trouver(id){
    for (var i = 0; i < P.length; i++) if (P[i].id === +id) return P[i];
    return null;
  }

  function monter(scene, a){
    api = a; D_ = a.data;

    P = D_.prospects.map(function(p){
      var n = {};
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) n[k] = p[k];
      if (p.statut === "reserve") n.reste = 2 * 86400 + 4 * 3600 + 15 * 60;
      return n;
    });

    root = document.createElement("div");
    root.className = "m-app";
    scene.appendChild(root);
    peindre();

    /* la réservation descend réellement */
    api.every(function(){
      var bouge = false;
      P.forEach(function(p){
        if (p.statut === "reserve" && p.reste > 0){
          p.reste -= 1; bouge = true;
          if (p.reste <= 0){
            p.statut = "jamais"; p.reste = 0;
            api.toast("Réservation expirée : " + p.nom + " est revenu au commun.");
          }
        }
      });
      if (!bouge) return;
      var cd = root.querySelector("[data-cd]");
      if (cd && choisi && choisi.statut === "reserve") cd.textContent = reste(choisi);
      var n = root.querySelectorAll("[data-hor]");
      for (var i = 0; i < n.length; i++) n[i].textContent = api.heure();
    }, 1000);

    root.addEventListener("click", function(ev){
      var t = ev.target;
      if (!t.closest) return;
      var SEL = "[data-pin],[data-fiche],[data-filtre],[data-cycle],[data-grip],[data-liste]," +
                "[data-prendre],[data-visite],[data-preuve],[data-rappel],[data-essai],[data-stop]," +
                "[data-rendre],[data-menu],[data-itineraire],[data-close],[data-pitch],[data-demo],[data-surf]";
      var b = t.closest(SEL);
      if (!b) return;
      var d = b.dataset, p;

      if (d.pin){ choisi = trouver(d.pin); hauteur = 1; peindre(); return; }
      if (d.fiche){ choisi = trouver(d.fiche); hauteur = 0; peindre(); return; }
      if (d.liste !== undefined){ choisi = null; hauteur = 1; peindre(); return; }
      if (d.filtre !== undefined){ filtre = d.filtre; choisi = null; peindre(); return; }
      if (d.cycle !== undefined || d.grip !== undefined){
        hauteur = (hauteur + 1) % 3; peindre(); return;
      }
      if (d.prendre){
        p = trouver(d.prendre);
        p.statut = "reserve"; p.reste = 3 * 86400;
        p.info = "Réservé par vous";
        choisi = p;
        api.vibrer(14);
        api.toast("Réservé 3 jours. Sans action il retourne au commun : vous serez bloqué deux mois, un autre pourra le prendre.");
        peindre(); return;
      }
      if (d.rendre){
        p = trouver(d.rendre);
        p.statut = "jamais"; p.reste = 0;
        api.toast("Rendu au commun. Blocage de deux mois pour vous ; disponible tout de suite pour un autre.");
        peindre(); return;
      }
      if (d.preuve){ preuve = d.preuve; peindre(); return; }
      if (d.visite){
        p = trouver(d.visite);
        var lbl = preuve === "appel" ? "appel depuis le numéro professionnel"
                : preuve === "message" ? "message depuis le canal Resto IA"
                : "photo de devanture";
        p.derniere = api.heure() + " · visite tracée";
        p.preuve = lbl;
        if (p.statut === "jamais" || p.statut === "sansrep") p.statut = "attente";
        api.toast("Visite tracée (" + lbl + "). Protection de 30 jours depuis cette action.");
        choisi = p; peindre(); return;
      }
      if (d.rappel){
        p = trouver(d.rappel);
        p.statut = "attente"; p.info = "Rappel programmé lundi 10h";
        api.toast("Rappel programmé lundi 10h — hors rush.");
        choisi = p; peindre(); return;
      }
      if (d.essai){
        p = trouver(d.essai);
        p.statut = "essai"; p.info = "Essai — jour 1 sur 14";
        api.toast("Essai gratuit lancé. La commission de " + api.eur(D_.commission) + " court dès le premier mois payant.");
        choisi = p; peindre(); return;
      }
      if (d.stop){
        p = trouver(d.stop);
        p.statut = "stop"; p.info = "Opposition explicite";
        api.toast("Ne plus contacter : opposition définitive, respectée par tous les commerciaux.");
        choisi = null; peindre(); return;
      }
      if (d.surf){ surface = d.surf; peindre(); return; }
      if (d.menu !== undefined){
        surface = surface === "tournee" ? null : "tournee";
        peindre(); return;
      }
      if (d.itineraire !== undefined){
        var cible = choisi || P.filter(function(x){ return x.statut === "jamais"; })
          .sort(function(a2, b2){ return a2.dist - b2.dist; })[0];
        if (cible) api.toast("Itinéraire vers " + cible.nom + " — " + cible.dist + " m, " +
          Math.max(1, Math.round(cible.dist / 75)) + " min à pied.");
        return;
      }
      if (d.close !== undefined){ surface = null; peindre(); return; }
      if (d.pitch !== undefined){
        var t0 = 0;
        if (pitchT) clearInterval(pitchT);
        pitchT = api.every(function(){
          t0 += 0.2;
          var c = root.querySelector("[data-chrono]"), j = root.querySelector("[data-jauge]");
          if (!c || !j){ clearInterval(pitchT); return; }
          c.textContent = "00:" + String(Math.floor(t0)).padStart(2, "0");
          j.style.width = Math.min(100, t0 / 20 * 100) + "%";
          if (t0 >= 20){ clearInterval(pitchT); api.toast("Vingt secondes. C'est tout ce qu'il faut pour obtenir une démo."); }
        }, 200);
        return;
      }
      if (d.demo !== undefined){
        var fil = root.querySelector("[data-demo].m-thread") || root.querySelector(".m-thread");
        if (!fil) return;
        fil.innerHTML = "";
        var i = 0;
        var extrait = D_.appel.slice(0, 6);
        if (demo) clearInterval(demo);
        demo = api.every(function(){
          if (i >= extrait.length){ clearInterval(demo); return; }
          var e = extrait[i];
          var cls = e.qui === "sys" ? "m-sys" : (e.qui === "me" ? "m-me" : "m-bot");
          fil.insertAdjacentHTML("beforeend", '<div class="m-bub ' + cls + '">' + esc(e.txt) + '</div>');
          fil.scrollTop = fil.scrollHeight;
          i++;
        }, 1100);
        return;
      }
    });

    return function(){
      if (pitchT) clearInterval(pitchT);
      if (demo) clearInterval(demo);
    };
  }

  RIA.register({
    id:"commercial", nom:"Commercial", badge:"3",
    fond:"linear-gradient(145deg,#5BE4A0,#12A05E)", encre:"#04200F",
    glyph:'<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    format:"phone",
    css:"commercial.css",
    monter:monter
  });
})();
