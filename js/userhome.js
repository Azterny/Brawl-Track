async function initUserHome() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "index.html";
        return;
    }

    try {
        // 1. Récupération des tags suivis et claims
        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session expirée");
        const data = await res.json();

        // 2. Mise à jour Header
        const username = data.username || "Joueur";
        document.getElementById('welcome-msg').innerText = `Bienvenue, ${username} !`;
        localStorage.setItem('username', username);

        const claimedList = data.claimed_tags || [];
        const followedList = data.followed_tags || [];
        const limits = data.limits || { claim_max: 5, follow_max: 15 };

        document.getElementById('counter-claims').innerText = `${claimedList.length} / ${limits.claim_max}`;
        document.getElementById('counter-follows').innerText = `${followedList.length} / ${limits.follow_max}`;

        // Afficher des loaders (Skeletons) le temps du chargement groupé
        renderSkeletons('claims-grid', claimedList.length || 1);
        renderSkeletons('follows-grid', followedList.length || 1);

        // 3. Récupération en masse (BULK) des métadonnées
        const allTags = [...claimedList, ...followedList].map(t => t.tag);
        let metadataMap = {};

        if (allTags.length > 0) {
            // Déduplication des tags
            const uniqueTags = [...new Set(allTags)];
            const bulkRes = await fetch(`${API_URL}/api/bulk-players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tags: uniqueTags })
            });
            
            if (bulkRes.ok) {
                metadataMap = await bulkRes.json();
            }
        }

        // 4. Rendu final des grilles
        renderGrid('claims-grid', claimedList, metadataMap, 'Aucun compte lié.');
        renderGrid('follows-grid', followedList, metadataMap, 'Aucun compte suivi.');
        
        const pathParts = window.location.pathname.split('/').filter(p => p);
        const urlUsername = pathParts.length > 0 ? decodeURIComponent(pathParts[0]) : null;

        if (urlUsername && urlUsername !== 'userhome.html' && urlUsername.toLowerCase() !== username.toLowerCase()) {
            window.location.href = `/error404?target=${encodeURIComponent(urlUsername)}`;
            return;
        }

        if (window.location.pathname.includes('userhome.html')) {
            window.history.replaceState({}, '', `/${username}`);
        }

    } catch (e) {
        console.error(e);
        localStorage.removeItem('token');
        window.location.href = "index.html";
    }
}

// Fonction utilitaire : affiche un joli squelette clignotant pendant le chargement
function renderSkeletons(containerId, count) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    for(let i=0; i<count; i++) {
        container.innerHTML += `
            <div class="profile-card skeleton-mode">
                <div class="skeleton-box" style="width: 55px; height: 55px; border-radius: 12px; margin-right: 15px;"></div>
                <div class="profile-info">
                    <div class="skeleton-box" style="width: 60%; height: 18px; margin-bottom: 8px;"></div>
                    <div class="skeleton-box" style="width: 30%; height: 14px;"></div>
                </div>
            </div>
        `;
    }
}

// Fonction utilitaire : rendu final des cartes (Horizontal)
function renderGrid(containerId, tagsList, metadataMap, emptyMsg) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (tagsList.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #555; font-style: italic; padding: 20px;">${emptyMsg}</div>`;
        return;
    }

    tagsList.forEach(tagObj => {
        const tag = tagObj.tag;
        const meta = metadataMap[tag] || null;

        const card = document.createElement('div');
        card.className = 'profile-card';
        card.onclick = () => window.location.href = `/player/${tag.replace('#','')}`;

        if (meta) {
            let nameColor = meta.nameColor || '#ffffff';
            if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

            card.innerHTML = `
                <img src="https://cdn.brawlify.com/profile-icons/regular/${meta.iconId}.png" class="profile-icon" alt="Icon">
                <div class="profile-info">
                    <div class="profile-name" style="color: ${nameColor}; text-shadow: 0 0 10px ${nameColor}44;">${meta.name}</div>
                    <div class="profile-tag">${tag}</div>
                </div>
                <div class="profile-trophies">
                    ${meta.trophies} <img src="/assets/trophy_normal.png" alt="Trophée">
                </div>
            `;
        } else {
            card.innerHTML = `
                <img src="/assets/default_icon.png" class="profile-icon" style="opacity:0.5;">
                <div class="profile-info">
                    <div class="profile-name">Inconnu / Erreur</div>
                    <div class="profile-tag">${tag}</div>
                </div>
            `;
        }

        container.appendChild(card);
    });
}

function searchFromUserhome() {
    let tag = document.getElementById('userhome-search-input').value;
    if (!tag) return;
    tag = tag.toUpperCase().replace('#', '').replace('O', '0');
    window.location.href = `/player/${tag}`;
}

document.addEventListener('DOMContentLoaded', () => {
    initUserHome();
    const searchInput = document.getElementById('userhome-search-input');
    if(searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') searchFromUserhome();
        });
    }
});

function logout() {
    localStorage.removeItem('token');
    window.location.href = "index.html";
}
