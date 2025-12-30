document.addEventListener("DOMContentLoaded", function() {
    const navContainer = document.getElementById('global-navbar');
    if (!navContainer) return;

    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username') || 'Joueur'; // Pensez à stocker le username au login si possible
    
    // Structure de base
    let html = `
    <nav class="navbar">
        <div class="nav-content">
            <a href="${token ? 'userhome.html' : 'index.html'}" class="nav-logo">
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
    let links = `<a href="index.html#events-section" class="nav-link">🔥 Événements</a>`;
    
    if (token) {
        // Menu Déroulant Ressources (Simple pour l'instant)
        links += `
            <div class="dropdown">
                <span class="nav-link dropdown-trigger">📚 Ressources ▾</span>
                <div class="dropdown-menu">
                    <a href="#" onclick="alert('Bientôt disponible !')">Liste Brawlers</a>
                    <a href="#" onclick="alert('Bientôt disponible !')">Rotation Maps</a>
                </div>
            </div>
        `;
    } else {
        links += `<a href="#" onclick="focusSearch()" class="nav-link">🔎 Recherche</a>`;
    }
    return links;
}

function getRightActions(token, username) {
    if (token) {
        return `
            <div class="dropdown">
                <button class="nav-btn-user">👤 ${username} ▾</button>
                <div class="dropdown-menu right-aligned">
                    <a href="userhome.html">🏠 Mes Comptes</a>
                    <a href="#" onclick="alert('Page Paramètres à créer')">⚙️ Paramètres</a>
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
            <a href="userhome.html" class="mobile-link">🏠 Mes Comptes</a>
            <a href="#" class="mobile-link">⚙️ Paramètres</a>
            <hr style="border-color:#333; width:100%; opacity:0.3;">
            <a href="#" class="mobile-link">📚 Brawlers</a>
            <a href="index.html#events-section" class="mobile-link">🔥 Événements</a>
            <button onclick="logoutNav()" class="btn-danger" style="margin-top:20px;">Déconnexion</button>
        `;
    } else {
        html += `
            <a href="index.html" class="mobile-link">🔎 Recherche</a>
            <a href="index.html#events-section" class="mobile-link">🔥 Événements</a>
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
    localStorage.removeItem('username');
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
