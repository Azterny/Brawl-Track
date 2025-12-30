// --- GESTION DU MENU MOBILE ---
function toggleMenu() {
    const menu = document.getElementById('menu-dropdown');
    if(menu) menu.classList.toggle('active');
}

// Fermer le menu si on clique ailleurs (Mise à jour sélecteur)
window.addEventListener('click', function(e) {
    // On cible le conteneur mobile spécifique
    const mobileContainer = document.querySelector('.mobile-nav-container');
    const menu = document.getElementById('menu-dropdown');
    
    // Si on clique en dehors du conteneur mobile et que le menu est ouvert
    if (mobileContainer && !mobileContainer.contains(e.target) && menu && menu.classList.contains('active')) {
        menu.classList.remove('active');
    }
});

// --- NAVIGATION (VUES) ---
function switchView(viewName) {
    // 1. Masquer toutes les sections
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    
    // 2. Afficher la cible
    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.add('active');

    // 3. Fermer le menu mobile après clic
    const menu = document.getElementById('menu-dropdown');
    if(menu) menu.classList.remove('active');

    // 4. (NOUVEAU) Mettre à jour la classe 'active' sur les boutons Desktop
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${viewName}`);
    if(activeBtn) activeBtn.classList.add('active');
}

// --- OUTILS DIVERS ---
function toggleForms() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
    const msg = document.getElementById('message');
    if(msg) msg.innerText = "";
}
