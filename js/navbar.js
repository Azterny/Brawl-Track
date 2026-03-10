function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const API_BASE_NAV = (typeof API_URL !== 'undefined') ? API_URL : '';

document.addEventListener("DOMContentLoaded", async function() {
    const navContainer = document.getElementById('global-navbar');
    if (!navContainer) return;

    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username') || 'Joueur';
    const safeUsername = escapeHtml(username);
    
    let unreadCount = 0;
    if (token) {
        try {
            const res = await fetch(`${API_BASE_NAV}/api/messages/unread-count`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                unreadCount = data.count || 0;
            }
        } catch (e) {
            console.warn("Erreur chargement notifications NavBar :", e);
        }
    }
    
    const notifBadge = unreadCount > 0 ? `<span class="nav-notif-dot"></span>` : "";
    const notifCountText = unreadCount > 0 ? `<span style="background: #ff4757; color: white; border-radius: 10px; padding: 2px 6px; font-size: 0.8em; margin-left: 5px; font-weight: bold;">${unreadCount}</span>` : "";

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
                ${getRightActions(token, safeUsername, notifBadge, notifCountText)}
            </div>

            <div class="nav-burger" onclick="toggleMobileNav()">
                ☰ ${notifBadge}
            </div>
        </div>
    </nav>
    <div id="mobile-nav-overlay" class="mobile-nav-overlay hidden">
        <div class="mobile-nav-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <span style="font-family:'Lilita One'; color:#ffce00; font-size:1.5em;">MENU</span>
                <button onclick="toggleMobileNav()" style="background:none; border:none; color:white; font-size:1.5em; width:auto; margin:0;">✕</button>
            </div>
            ${getMobileLinks(token, safeUsername, notifCountText)}
        </div>
    </div>
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

function getRightActions(token, safeUsername, notifBadge, notifCountText) {
    if (token) {
        return `
            <div class="dropdown">
                <button class="btn-3d btn-yellow btn-sm" style="position: relative;">
                    👤 ${safeUsername} ▾
                    ${notifBadge}
                </button>
                <div class="dropdown-menu right-aligned">
                    <a href="/home"><img src="/assets/icons/wipeout.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Mes Comptes</a>
                    <a href="#" onclick="alert('⭐ Abonnement : Bientôt Disponible !')"><img src="/assets/icons/subscribe.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Abonnement</a>
                    <a href="/mailbox"><img src="/assets/icons/mailbox.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Messages ${notifCountText}</a>
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

function getMobileLinks(token, safeUsername, notifCountText) {
    let html = "";
    if (token) {
        html += `
            <div class="mobile-user-info">Connecté en tant que <strong>${safeUsername}</strong></div>
            <a href="/" class="mobile-link"><img src="/assets/icons/mastery_point.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Accueil</a>
            <a href="/home" class="mobile-link"><img src="/assets/icons/wipeout.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Mes Comptes</a>
            <a href="#" onclick="alert('⭐ Abonnement : Bientôt Disponible !')" class="mobile-link"><img src="/assets/icons/subscribe.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Abonnement</a>
            <a href="/leaderboard" class="mobile-link"><img src="/assets/icons/leaderboard.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Classements</a>
            <a href="/mailbox" class="mobile-link"><img src="/assets/icons/mailbox.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 8px;" onerror="this.style.display='none'">Messages ${notifCountText}</a>
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

    navbar.style.position = 'fixed';
    navbar.style.top = '0';
    navbar.style.left = '0';
    navbar.style.right = '0';
    navbar.style.zIndex = '9999';
    navbar.style.transition = 'transform 0.3s ease-in-out';

    const navHeight = navbar.offsetHeight;
    const currentPadding = parseInt(getComputedStyle(document.body).paddingTop, 10) || 0;
    document.body.style.paddingTop = (currentPadding + navHeight) + 'px';

    let lastScrollTop = 0;

    window.addEventListener('scroll', () => {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop < 0) return;
        if (Math.abs(scrollTop - lastScrollTop) < 5) return;

        if (scrollTop > lastScrollTop && scrollTop > navHeight) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
    });
}
