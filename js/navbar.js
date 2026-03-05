document.addEventListener("DOMContentLoaded", function() {
    const navContainer = document.getElementById('global-navbar');
    if (!navContainer) return;

    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username') || 'Joueur'; 
    const safeUsername = encodeURIComponent(username);
    
    let html = `
    <nav class="navbar">
        <div class="nav-content">
            <a href="${token ? '/home' : '/'}" class="nav-logo">
                <img src="/assets/logo.png" alt="Logo" class="logo-img">
                BRAWL TRACK
            </a>

            <div class="nav-links desktop-only">
                ${getCenterLinks(token)}
            </div>

            <div class="nav-actions desktop-only">
                ${getRightActions(token, safeUsername, username)}
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
                ${getMobileLinks(token, safeUsername, username)}
            </div>
        </div>
    </nav>
    `;

    navContainer.innerHTML = html;
    
    initSmartNavbar();
});

// --- GÉNÉRATEURS DE HTML ---

function getCenterLinks(token) {
    let links = `<a href="/leaderboard" class="nav-link"><img src="/assets/icons/leaderboard.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Classements</a>`;
    
    if (!token) {
        links += `<a href="#" onclick="focusSearch()" class="nav-link">🔎 Recherche</a>`;
    } else {
        links = `<a href="/" class="nav-link"><img src="/assets/icons/mastery_point.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Accueil</a>` + links;
    }
    
    return links;
}

function getRightActions(token, safeUsername, username) {
    if (token) {
        return `
            <div class="dropdown">
                <button class="btn-3d btn-yellow btn-sm">👤 ${username} ▾</button>
                <div class="dropdown-menu right-aligned">
                    <a href="/home"><img src="/assets/icons/wipeout.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Mes Comptes</a>
                    <a href="#" onclick="alert('⭐ Abonnement : Bientôt Disponible !')"><img src="/assets/icons/subscribe.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Abonnement</a>
                    <a href="#" onclick="alert('Paramètres : Bientôt Disponible !')"><img src="/assets/icons/settings.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Paramètres</a>
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="logoutNav()" style="color: #ff5555;">Déconnexion</a>
                </div>
            </div>
        `;
    } else {
        return `
            <a href="/" class="nav-link">Connexion</a>
            <a href="/" class="nav-btn-cta">S'inscrire</a>
        `;
    }
}

function getMobileLinks(token, safeUsername, username) {
    let html = "";
    if (token) {
        html += `
            <div class="mobile-user-info">Connecté en tant que <strong>${username}</strong></div>
            <a href="/" class="mobile-link"><img src="/assets/icons/mastery_point.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Accueil</a>
            <a href="/home" class="mobile-link"><img src="/assets/icons/wipeout.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Mes Comptes</a>
            <a href="#" onclick="alert('⭐ Abonnement : Bientôt Disponible !')" class="mobile-link"><img src="/assets/icons/subscribe.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Abonnement</a>
            <a href="/leaderboard" class="mobile-link"><img src="/assets/icons/leaderboard.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Classements</a>
            <a href="#" class="mobile-link"><img src="/assets/icons/settings.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Paramètres</a>
            <hr style="border-color:#333; width:100%; opacity:0.3;">
            <button onclick="logoutNav()" class="btn-danger" style="margin-top:20px; color: #ff5555;">Déconnexion</button>
        `;
    } else {
        html += `
            <a href="/" class="mobile-link"><img src="/assets/icons/mastery_point.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Accueil</a>
            <a href="#" onclick="focusSearch()" class="mobile-link">🔎 Recherche</a>
            <a href="/leaderboard" class="mobile-link"><img src="/assets/icons/leaderboard.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Classements</a>
            <hr style="border-color:#333; width:100%; opacity:0.3;">
            <a href="/" class="nav-btn-cta" style="text-align:center; display:block;">Se Connecter</a>
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
    window.location.href = '/';
}

function focusSearch() {
    if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
        const el = document.getElementById('public-tag');
        if(el) el.focus();
    } else {
        window.location.href = '/';
    }
}

function initSmartNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // Force les styles pour rendre la navbar fixe et animable
    navbar.style.position = 'fixed';
    navbar.style.top = '0';
    navbar.style.left = '0';
    navbar.style.width = '100%';
    navbar.style.zIndex = '9999';
    navbar.style.transition = 'transform 0.3s ease-in-out';

    // Compense la hauteur de la navbar sur le body pour éviter que le contenu passe en dessous
    const navHeight = navbar.offsetHeight;
    document.body.style.paddingTop = navHeight + 'px';

    let lastScrollTop = 0;

    window.addEventListener('scroll', () => {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Si on scroll vers le bas et qu'on a dépassé la hauteur de la navbar
        if (scrollTop > lastScrollTop && scrollTop > navHeight) {
            navbar.style.transform = 'translateY(-100%)'; // Cache la navbar vers le haut
        } else {
            // Si on scroll vers le haut
            navbar.style.transform = 'translateY(0)'; // Fait réapparaître la navbar
        }
        
        // Pour gérer le rebond sur Safari/iOS
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; 
    });
}
