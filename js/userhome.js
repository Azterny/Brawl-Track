async function initUserHome() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session expirée");
        const data = await res.json();
        const username = data.username || "Joueur";

        if (window.location.pathname.includes('userhome.html')) {
            window.history.replaceState({}, '', `/home`);
        }

        document.getElementById('welcome-msg').innerText = `Bienvenue, ${username} !`;
        localStorage.setItem('username', username);
        
        const claimedList = data.claimed_tags || [];
        const followedList = data.followed_tags || [];
        const limits = data.limits || { claim_max: 1, follow_max: 15 };

        // Séparer les tags vérifiés des tags en attente de vérification
        const verifiedClaimed = claimedList.filter(t => t.is_verified !== false);
        const pendingClaimed  = claimedList.filter(t => t.is_verified === false);

        document.getElementById('counter-follows').innerText = `${followedList.length} / ${limits.follow_max}`;

        // ==========================================
        // 1. GESTION DU COMPTE LIÉ (PRINCIPAL)
        // ==========================================
        const linkedContainer = document.getElementById('linked-account-container');

        if (pendingClaimed.length > 0 && verifiedClaimed.length === 0) {
            // Un défi de vérification est en cours
            linkedContainer.innerHTML = `
                <div class="empty-link-card" style="min-height: 120px; height: auto; border-color: #ffce00; cursor: default;">
                    <div style="font-size: 1.5em; margin-bottom: 8px;">⏳</div>
                    <div style="font-size: 1.1em; font-weight: bold; text-align: center; color: #ffce00;">Vérification en cours</div>
                    <div style="font-size: 0.9em; color: #888; margin-top: 5px;">Tag : ${pendingClaimed[0].tag}</div>
                    <button onclick="openLinkModal()" class="btn-3d btn-yellow w-auto" style="margin-top: 10px; font-size: 0.85em; padding: 6px 14px;">Continuer la vérification</button>
                </div>
            `;
        } else if (verifiedClaimed.length === 0) {
            linkedContainer.innerHTML = `
                <div class="empty-link-card clickable" onclick="openLinkModal()" style="min-height: 120px; max-height: 160px; height: auto;">
                    <div class="plus-btn">+</div>
                    <div style="font-size: 1.2em; font-weight: bold; text-align: center;">Lier mon compte Brawl Stars</div>
                </div>
            `;
        } else {
            const linkedTag = verifiedClaimed[0].tag;
            linkedContainer.innerHTML = `<div class="skeleton-box" style="width:100%; height:120px; border-radius:15px;"></div>`;
            await fetchAndRenderLinkedAccount(linkedTag, linkedContainer);
        }

        // ==========================================
        // 2. GESTION DES COMPTES SUIVIS (MINI CARTES)
        // ==========================================
        renderSkeletons('follows-grid', followedList.length || 1);

        if (followedList.length > 0) {
            const uniqueTags = [...new Set(followedList.map(t => t.tag))];
            const bulkRes = await fetch(`${API_URL}/api/bulk-players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ tags: uniqueTags })
            });
            
            let metadataMap = {};
            if (bulkRes.ok) metadataMap = await bulkRes.json();
            
            renderGrid('follows-grid', followedList, metadataMap, 'Aucun compte suivi.');
        } else {
            renderGrid('follows-grid', [], {}, 'Vous ne suivez aucun compte.');
        }

    } catch (e) {
        console.error(e);
        localStorage.removeItem('token');
        window.location.href = "/";
    }
}

async function fetchAndRenderLinkedAccount(tag, container) {
    try {
        const cleanTag = tag.replace('#', '');

        // 1. Fetch Joueur
        const pRes = await fetch(`${API_URL}/api/public/player/${cleanTag}`);
        if (!pRes.ok) throw new Error("Erreur joueur");
        const pData = await pRes.json();

        // 2. Couleur du nom joueur
        let nameColor = pData.nameColor || '#ffffff';
        if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

        // FIX-PRESTIGE : utilise totalPrestigeLevel de l'API Supercell (archivé par le worker).
        // Avant : brawlers.reduce(trophies / 1000) → approximation incorrecte après resets de saison.
        const prestigeValue = pData.totalPrestigeLevel ?? (pData.brawlers
            ? pData.brawlers.reduce((sum, b) => sum + Math.floor((b.trophies || 0) / 1000), 0)
            : 0);

        // 4. HTML JOUEUR
        const playerHtml = `
            <div class="linked-card clickable" onclick="window.location.href='/player/${pData.tag.replace('#', '')}'">
                <img src="https://cdn.brawlify.com/profile-icons/regular/${pData.icon.id}.png"
                     class="profile-icon"
                     onerror="this.src='/assets/default_icon.png'">
                <div class="big-profile-info">
                    <div class="big-profile-name" style="color: ${nameColor}; text-shadow: 0 0 10px ${nameColor}44;">${pData.name}</div>
                    <div class="big-profile-tag">${pData.tag}</div>
                    <div class="big-stats-row">
                        <div class="stat-badge" style="color: #ffce00;">
                            <img src="/assets/trophy_normal.png" style="width:16px; vertical-align:middle;">
                            ${pData.trophies.toLocaleString('fr-FR')}
                        </div>
                        <div class="stat-badge" style="color: #8A4FE8;">
                            <img src="/assets/total prestige.png" style="width:16px; vertical-align:middle;">
                            ${prestigeValue}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 5. HTML CLUB
        let clubHtml = '';
        if (pData.club && pData.club.tag) {
            const cRes = await fetch(`${API_URL}/api/public/club/${pData.club.tag.replace('#', '')}`);
            if (cRes.ok) {
                const cData = await cRes.json();
                const badgeId = cData.badgeId || 8000000;
                const membersCount = cData.members ? cData.members.length : 0;

                clubHtml = `
                    <div class="linked-card clickable" onclick="window.location.href='/club/${cData.tag.replace('#', '')}'">
                        <img src="https://brawlify.com/images/club-badges/96/${badgeId}.webp"
                             class="profile-icon"
                             style="object-fit: contain; border: none; background: none;"
                             onerror="this.src='/assets/default_icon.png'">
                        <div class="big-profile-info">
                            <div class="big-profile-name" style="color: #ffce00; text-shadow: 0 0 10px #ffce0044;">${cData.name}</div>
                            <div class="big-profile-tag">${cData.tag}</div>
                            <div class="big-stats-row">
                                <div class="stat-badge" style="color: #ffce00;">
                                    <img src="/assets/trophy_normal.png" style="width:16px; vertical-align:middle;">
                                    ${cData.trophies.toLocaleString('fr-FR')}
                                </div>
                                <div class="stat-badge" style="color: #fff;">
                                    <img src="/assets/icons/wipeout.png" style="width:16px; vertical-align:middle; filter: grayscale(100%) brightness(1.5);">
                                    ${membersCount}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        if (!clubHtml) {
            clubHtml = `
                <div class="empty-link-card">
                    <div class="plus-btn" style="font-size: 2em; opacity: 0.3;">🏆</div>
                    <div style="font-size: 1.1em; color: #555;">Pas de club</div>
                </div>
            `;
        }

        container.innerHTML = playerHtml + clubHtml;

    } catch(e) {
        container.innerHTML = `<div style="width: 100%; color: #ff5555; padding: 20px; text-align: center;">Erreur de chargement du profil lié. Vérifiez la connexion.</div>`;
    }
}

function promptLinkAccount() {
    const tag = prompt("Entrez votre Tag Brawl Stars (ex: #2RUPLG8G) :\nCe compte deviendra votre compte principal.");
    if(!tag) return;
    
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/claim-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tag: tag })
    }).then(r => r.json()).then(res => {
        alert(res.message);
        window.location.reload();
    }).catch(e => alert("Erreur réseau de liaison."));
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
                    ${meta.trophies.toLocaleString()} <img src="/assets/trophy_normal.png" alt="Trophée">
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
