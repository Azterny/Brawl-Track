// --- GESTION DU MENU ---
function toggleMenu() {
    const menu = document.getElementById('menu-dropdown');
    if(menu) menu.classList.toggle('active');
}

// Fermer le menu si on clique ailleurs
window.addEventListener('click', function(e) {
    const burger = document.getElementById('burger-menu');
    const menu = document.getElementById('menu-dropdown');
    if (burger && !burger.contains(e.target) && menu) {
        menu.classList.remove('active');
    }
});

// --- NAVIGATION (VUES) ---
function switchView(viewName) {
    // Masquer toutes les sections
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    
    // Afficher la cible
    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.add('active');

    // Fermer le menu après clic
    const menu = document.getElementById('menu-dropdown');
    if(menu) menu.classList.remove('active');
}

// --- OUTILS DIVERS ---
function toggleForms() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
    const msg = document.getElementById('message');
    if(msg) msg.innerText = "";
}
