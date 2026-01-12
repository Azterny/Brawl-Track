async function initUserHome() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "index.html";
        return;
    }

    try {
        // 1. Récupération des statistiques globales (Tags + Limites)
        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session expirée ou invalide");
        
        const data = await res.json();

        // 2. Mise à jour Interface Header
        const username = data.username || "Joueur";
        document.getElementById('welcome-msg').innerText = `Bienvenue, ${username} !`;
        localStorage.setItem('username', username); // Sync pour Navbar

        // 3. Mise à jour Compteurs
        const claimedList = data.claimed_tags || [];
        const followedList = data.followed_tags || [];
        const limits = data.limits || { claim_max: 5, follow_max: 15 };

        document.getElementById('counter-claims').innerText = `${claimedList.length} / ${limits.claim_max}`;
        document.getElementById('counter-follows').innerText = `${followedList.length} / ${limits.follow_max}`; // Affichage limite réelle

        // 4. Rendu des Grilles
        renderGrid('claims-grid', claimedList, 'Aucun compte lié.');
        renderGrid('follows-grid', followedList, 'Aucun compte suivi.');

    } catch (e) {
        console.error(e);
        localStorage.removeItem('token');
        window.location.href = "index.html";
    }
}

// --- RENDU DES GRILLES ---

function renderGrid(containerId, tagsList, emptyMsg) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear loading

    if (tagsList.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #555; font-style: italic; padding: 20px;">${emptyMsg}</div>`;
        return;
    }

    tagsList.forEach(tagObj => {
        // Création du squelette de la carte (Loader)
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.onclick = () => window.location.href = `dashboard.html?tag=${tagObj.tag.replace('#','')}`;

        // Contenu initial (Loader)
        card.innerHTML = `
            <div class="card-loader"></div>
            <div class="profile-name" style="margin-top:10px;">Chargement...</div>
            <div class="profile-tag">${tagObj.tag}</div>
        `;

        container.appendChild(card);

        // Appel asynchrone pour récupérer Icone + Nom (Lazy loading)
        fetchProfileMetadata(tagObj.tag, card);
    });
}

// Récupère les infos visuelles (Nom, Icone) depuis l'API publique
// car la BDD locale ne stocke pas forcément l'icone ou le nom à jour dans la table Tags
async function fetchProfileMetadata(tag, cardElement) {
    try {
        const cleanTag = tag.replace('#', '');
        // On utilise l'API publique (Attention : peut charger Supercell API)
        const res = await fetch(`${API_URL}/api/public/player/${cleanTag}`);
        
        if (res.ok) {
            const data = await res.json();
            const iconId = (data.icon && data.icon.id) ? data.icon.id : 28000000;
            const name = data.name || "Inconnu";
            const nameColor = data.nameColor ? '#' + data.nameColor.replace('0x', '').slice(-6) : '#ffffff';

            // Mise à jour de la carte existante
            cardElement.innerHTML = `
                <img src="https://cdn.brawlify.com/profile-icons/regular/${iconId}.png" class="profile-icon" alt="Icon">
                <div class="profile-name" style="color: ${nameColor}; text-shadow: 0 0 10px ${nameColor}44;">${name}</div>
                <div class="profile-tag">${tag}</div>
            `;
        } else {
            throw new Error("Erreur fetch");
        }
    } catch (e) {
        // Fallback si erreur (API Down ou autre)
        const currentContent = cardElement.innerHTML;
        // On remplace juste le loader par une icone par défaut si besoin, ou on laisse le tag
        cardElement.innerHTML = `
            <img src="assets/default_icon.png" class="profile-icon" style="opacity:0.5;">
            <div class="profile-name">Inconnu</div>
            <div class="profile-tag">${tag}</div>
        `;
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = "index.html";
}

// Démarrage
document.addEventListener('DOMContentLoaded', initUserHome);
