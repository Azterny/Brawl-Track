async function initUserHome() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/";
        return;
    }

    try {
        // CORRECTION ICI : Utilisation de API_URL au lieu de API_BASE
        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session expirée");
        const data = await res.json();
        const username = data.username || "Joueur";

        // Nettoyage de l'URL vers /home
        if (window.location.pathname.includes('userhome.html')) {
            window.history.replaceState({}, '', `/home`);
        }

        document.getElementById('welcome-msg').innerText = `Bienvenue, ${username} !`;
        localStorage.setItem('username', username);
        
        const claimedList = data.claimed_tags || [];
        const followedList = data.followed_tags || [];
        const limits = data.limits || { claim_max: 5, follow_max: 15 };

        document.getElementById('counter-claims').innerText = `${claimedList.length} / ${limits.claim_max}`;
        document.getElementById('counter-follows').innerText = `${followedList.length} / ${limits.follow_max}`;

        renderSkeletons('claims-grid', claimedList.length || 1);
        renderSkeletons('follows-grid', followedList.length || 1);

        const allTags = [...claimedList, ...followedList].map(t => t.tag);
        let metadataMap = {};

        if (allTags.length > 0) {
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

        renderGrid('claims-grid', claimedList, metadataMap, 'Aucun compte lié.');
        renderGrid('follows-grid', followedList, metadataMap, 'Aucun compte suivi.');

    } catch (e) {
        console.error(e);
        localStorage.removeItem('token');
        window.location.href = "/"; // CORRIGÉ
    }
}

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
                <img src="https://cdn.brawlify.com/profile-icons/regular/${meta.iconId}.png" class="profile-icon" onerror="this.src='/assets/default_icon.png'" alt="Icon">
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
    window.location.href = "/";
}
