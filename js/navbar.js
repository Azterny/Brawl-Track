document.addEventListener("DOMContentLoaded", function() {
    const navContainer = document.getElementById('global-navbar');
    if (!navContainer) return;

    const token = localStorage.getItem('token');
    // On récupère le nom sauvegardé, sinon 'Joueur' par défaut
    const username = localStorage.getItem('username') || 'Joueur'; 
    
    // Structure de base
    let html = `
    <nav class="navbar">
        <div class="nav-content">
            <a href="${token ? 'userhome.html' : 'index.html'}" class="nav-logo">
                <img src="assets/logo.png" alt="Logo" class="logo-img">
                BRAWL TRACK
            </a>

            <div class="nav-links desktop-only">
                ${getCenterLinks(token)}
            </div>

            <div class="nav-actions desktop-only">
                ${getRightActions(token, username)}
            </div>

            <div class="nav-burger" onclick="toggleMobileNav()">
                ☰
            </div>
        </div>

        <div id="mobile-nav-overlay" class="mobile-nav-overlay hidden">
            <div class="mobile-nav-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <span style="font-family:'Lilita One'; color:#ffce00; font-size:1.5em;">MENU</span>
                    <button onclick="toggleMobileNav()" style="background:none; border:none; color:white; font-size:1.5em; width:auto; margin:0;">✕</button>
                </div>
                ${getMobileLinks(token, username)}
            </div>
        </div>
    </nav>
    `;

    navContainer.innerHTML = html;
});

// --- GÉNÉRATEURS DE HTML ---

function getCenterLinks(token) {
    let links = `<a href="#" onclick="alert('🏆 Leaderboard : Bientôt Disponible !')" class="nav-link">🏆 Leaderboard</a>`;
    
    if (!token) {
        links += `<a href="#" onclick="focusSearch()" class="nav-link">🔎 Recherche</a>`;
    } else {
        // AJOUT DE L'ACCUEIL POUR LES CONNECTÉS
        links = `<a href="index.html" class="nav-link">🏠 Accueil</a>` + links;
    }
    
    return links;
}

function getRightActions(token, username) {
    if (token) {
        return `
            <div class="dropdown">
                <button class="btn-3d btn-yellow btn-sm">👤 ${username} ▾</button>
                <div class="dropdown-menu right-aligned">
                    <a href="userhome.html">🏠 Mes Comptes</a>
                    <a href="#" onclick="alert('⭐ Abonnement : Bientôt Disponible !')">⭐ Abonnement</a>
                    <a href="#" onclick="alert('Paramètres : Bientôt Disponible !')">⚙️ Paramètres</a>
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="logoutNav()">🚪 Déconnexion</a>
                </div>
            </div>
        `;
    } else {
        return `
            <a href="index.html" class="nav-link">Connexion</a>
            <a href="index.html" class="nav-btn-cta">S'inscrire</a>
        `;
    }
}
function getMobileLinks(token, username) {
    let html = "";
    if (token) {
        html += `
            <div class="mobile-user-info">Connecté en tant que <strong>${username}</strong></div>
            <a href="index.html" class="mobile-link">🏠 Accueil</a>
            <a href="userhome.html" class="mobile-link">🏠 Mes Comptes</a>
            <a href="#" onclick="alert('⭐ Abonnement : Bientôt Disponible !')" class="mobile-link">⭐ Abonnement</a>
            <a href="#" class="mobile-link">🏆 Leaderboard</a>
            <a href="#" class="mobile-link">⚙️ Paramètres</a>
            <hr style="border-color:#333; width:100%; opacity:0.3;">
            <button onclick="logoutNav()" class="btn-danger" style="margin-top:20px;">Déconnexion</button>
        `;
    } else {
        html += `
            <a href="index.html" class="mobile-link">🔎 Recherche</a>
            <a href="#" onclick="alert('🏆 Leaderboard : Bientôt Disponible !')" class="mobile-link">🏆 Leaderboard</a>
            <hr style="border-color:#333; width:100%; opacity:0.3;">
            <a href="index.html" class="nav-btn-cta" style="text-align:center; display:block;">Se Connecter</a>
        `;
    }
    return html;
}

// --- FONCTIONS UTILITAIRES ---

function toggleMobileNav() {
    const el = document.getElementById('mobile-nav-overlay');
    if(el) el.classList.toggle('hidden');
}

function logoutNav() {
    localStorage.removeItem('token');
    localStorage.removeItem('username'); // On nettoie le nom aussi
    window.location.href = 'index.html';
}

function focusSearch() {
    if (window.location.pathname.includes('index.html')) {
        const el = document.getElementById('public-tag');
        if(el) el.focus();
    } else {
        window.location.href = 'index.html';
    }
}
