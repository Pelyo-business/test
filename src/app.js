/* =========================================================================
   Resto IA — runtime.
   Il fait quatre choses, et rien de plus : afficher l'écran de connexion,
   afficher la liste des postes une fois le compte démo choisi, ouvrir une
   application dans une scène vide, ranger ses minuteurs à la fermeture.

   Le runtime n'impose aucun chrome applicatif — pas de barre de titre, pas
   de barre d'onglets, pas de barre d'action communes. Chaque application
   dessine la totalité de son écran et charge sa propre feuille de style.
   C'est ce qui permet à la cuisine, au gérant et au commercial de ne
   partager aucun composant.

   Pas de maquette de téléphone à mettre à l'échelle : chaque écran remplit
   l'espace réel qu'on lui donne (voir base.css), donc pas de logique de
   redimensionnement ici non plus.
   ========================================================================= */
var RIA = (function(){
  "use strict";

  /* Le `?v=` de ce script lui-même (posé par outils/construire.sh, ou à la
     main en local — voir CONTRIBUER.md) sert aussi aux feuilles de style
     chargées dynamiquement par charger() : sans ça, elles échappaient au
     cache-buster et un navigateur pouvait en garder une version périmée
     indéfiniment. */
  var VERSION = (function(){
    var s = document.currentScript;
    var m = s && /[?&]v=([^&]+)/.exec(s.src);
    return m ? m[1] : "";
  })();

  var $ = function(i){ return document.getElementById(i); };
  var esc = function(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };
  var eur = function(c){ return (c/100).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + " €"; };
  var eur0 = function(c){ return Math.round(c/100).toLocaleString('fr-FR') + " €"; };
  var dur = function(s){ return s < 60 ? s + " s" : Math.floor(s/60) + " min " + String(s%60).padStart(2,"0"); };
  var chrono = function(s){ return String(Math.floor(s/60)).padStart(2,"0") + ":" + String(Math.floor(s)%60).padStart(2,"0"); };
  var norm = function(s){ return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); };
  var vibrer = function(ms){ try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch(e){} };
  var reduit = function(){ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };

  var APPS = [], courante = null, timers = [], toastT = null;

  function register(a){ APPS.push(a); }
  function every(fn, ms){ var id = setInterval(fn, ms); timers.push(id); return id; }
  function after(fn, ms){ var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers(){
    for (var i = 0; i < timers.length; i++){ clearInterval(timers[i]); clearTimeout(timers[i]); }
    timers = [];
  }

  /* ------------------------------ horloge ------------------------------ */
  /* Utilisée par les applications elles-mêmes (chacune affiche et met à
     jour sa propre horloge) — il n'y a plus d'horloge système partagée. */
  function heure(){
    var d = new Date();
    return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  }

  /* ----------------------- connexion / compte démo ----------------------- */
  var etapeAccueil = "connexion"; /* connexion | choix */

  function peindreConnexion(){
    $("home").innerHTML =
      '<div class="hbrand">' +
        '<img class="hlogo" src="assets/logo-toque.png" alt="Pelyo" width="52" height="52">' +
        '<b>Pelyo</b><span>Prise de commande par IA</span>' +
      '</div>' +
      '<div class="hform">' +
        '<input class="hchamp" type="email" placeholder="Adresse e-mail" autocomplete="email">' +
        '<input class="hchamp" type="password" placeholder="Mot de passe" autocomplete="current-password">' +
        '<button class="hbtn" data-connexion>Se connecter</button>' +
        '<button class="hbtn2" data-inscription>Créer un compte</button>' +
      '</div>' +
      '<button class="hdemo" data-demo>Compte démo</button>';
  }

  function peindreChoix(){
    $("home").innerHTML =
      '<div class="hbrand hbrand-sm"><b>Pelyo</b><span>Compte démo — ' + esc(D.resto.nom) + '</span></div>' +
      '<div class="hliste">' +
        APPS.map(function(a){
          return '<button class="hposte" data-app="' + a.id + '">' +
            '<span class="ic" style="background:' + a.fond + ';color:' + (a.encre || "#fff") + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + a.glyph + '</svg>' +
              (a.badge ? '<span class="bdg">' + esc(a.badge) + '</span>' : '') +
            '</span>' +
            '<span class="tx"><b>' + esc(a.nom) + '</b><small>Ouvrir</small></span>' +
          '</button>';
        }).join("") +
      '</div>' +
      '<button class="hdeco" data-deconnexion>Se déconnecter</button>';
  }

  /* ----------------------- ouverture d'une application ----------------------- */
  var cssCharge = {};
  function charger(app, pret){
    if (!app.css || cssCharge[app.id]) return pret();
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = "src/" + app.css + (VERSION ? "?v=" + VERSION : "");
    l.onload = pret; l.onerror = pret;
    document.head.appendChild(l);
    cssCharge[app.id] = true;
  }

  function ouvrir(id){
    var app = APPS.filter(function(a){ return a.id === id; })[0];
    if (!app || courante) return;
    vibrer(10);
    charger(app, function(){
      courante = app;
      document.documentElement.dataset.app = id;

      var scene = document.createElement("div");
      scene.className = "scene";
      scene.id = "scene";
      scene.dataset.app = id;
      $("glass").insertBefore(scene, $("homebar"));
      $("home").classList.add("away");

      try { app.demonter = app.monter(scene, api(app)) || null; }
      catch(e){
        console.error("[" + id + "]", e);
        scene.innerHTML = '<div style="padding:26px;color:#fff;font:14px/1.6 Inter,sans-serif">' +
          "Cette application n'a pas pu se charger.<br><span style=\"opacity:.6\">" + esc(e.message) + "</span></div>";
      }
    });
  }

  function fermer(){
    if (!courante) return;
    clearTimers();
    try { if (typeof courante.demonter === "function") courante.demonter(); } catch(e){ console.error(e); }
    courante.demonter = null;
    courante = null;
    delete document.documentElement.dataset.app;
    var s = $("scene");
    if (s) s.remove();
    $("home").classList.remove("away");
    vibrer(6);
  }

  /* --------------------------- toast système --------------------------- */
  function toast(msg, ms){
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function(){ t.classList.remove("on"); }, ms || 2600);
  }

  /* ------------------ ce qu'une application reçoit ------------------ */
  function api(app){
    return {
      data:D, esc:esc, eur:eur, eur0:eur0, dur:dur, chrono:chrono, norm:norm, heure:heure,
      toast:toast, fermer:fermer, vibrer:vibrer, reduit:reduit,
      every:every, after:after,
      badge:function(n){
        app.badge = n;
        var b = document.querySelector('[data-app="' + app.id + '"] .bdg');
        if (n && b) b.textContent = n;
        else if (n && !b){
          var ic = document.querySelector('[data-app="' + app.id + '"] .ic');
          if (ic) ic.insertAdjacentHTML("beforeend", '<span class="bdg">' + esc(n) + '</span>');
        } else if (!n && b) b.remove();
      },
      ouvrir:function(autre){ fermer(); setTimeout(function(){ ouvrir(autre); }, 260); }
    };
  }

  /* ------------------------------ démarrage ------------------------------ */
  function boot(){
    peindreConnexion();
    /* Direct preview link; this opens demo data, never an authenticated account. */
    if (window.location.hash === '#cuisine') ouvrir('cuisine');

    $("home").addEventListener("click", function(ev){
      var b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.connexion !== undefined || b.dataset.inscription !== undefined){
        toast("Maquette de démonstration — pas de vrais comptes. Utilisez « Compte démo ».");
        return;
      }
      if (b.dataset.demo !== undefined){
        etapeAccueil = "choix";
        peindreChoix();
        return;
      }
      if (b.dataset.deconnexion !== undefined){
        etapeAccueil = "connexion";
        peindreConnexion();
        return;
      }
      if (b.dataset.app) ouvrir(b.dataset.app);
    });
    $("homebar").addEventListener("click", fermer);
    document.addEventListener("keydown", function(ev){ if (ev.key === "Escape") fermer(); });
  }

  return { boot:boot, register:register, ouvrir:ouvrir, fermer:fermer, toast:toast };
})();
