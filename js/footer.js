// --- FOOTER GLOBAL ---
function renderFooter() {
    const container = document.getElementById('site-footer');
    if (!container) return;

    const year = new Date().getFullYear();

    container.innerHTML = `
        <div class="footer-inner">
            <div class="footer-logo">
                <img src="/assets/logo.png" alt="Logo" class="footer-logo-img" onerror="this.style.display='none'">
                <span>BRAWL TRACK</span>
            </div>
            <nav class="footer-links">
                <a href="/">Accueil</a>
                <a href="/leaderboard">Classements</a>
                <a href="/subscribe">Abonnements</a>
                <a href="#" onclick="return false;" title="Bientôt disponible">CGU</a>
                <a href="#" onclick="return false;" title="Bientôt disponible">Confidentialité</a>
                <a href="#" onclick="return false;" title="Bientôt disponible">Contact</a>
            </nav>
            <div class="footer-legal">
                <p>© ${year} Brawl-Track. Tous droits réservés.</p>
                <p class="footer-disclaimer">Brawl-Track n'est pas affilié à Supercell. Les contenus, noms et marques de Brawl Stars sont la propriété de Supercell.</p>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', renderFooter);
