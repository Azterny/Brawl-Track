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

        document.getElementById('counter-follows').innerText = `${followedList.length} / ${limits.follow_max}`;

        // ==========================================
        // 1. GESTION DU COMPTE LIÉ (PRINCIPAL)
        // ==========================================
        const linkedContainer = document.getElementById('linked-account-container');
        
        if (claimedList.length === 0) {
            // Aucun compte lié : Affichage de la case "+"
            linkedContainer.innerHTML = `
                <div class="empty-link-card clickable" onclick="promptLinkAccount()">
                    <div class="plus-btn">+</div>
                    <div style="font-size: 1.2em; font-weight: bold; text-align: center;">Lier mon compte Brawl Stars</div>
                </div>
            `;
        } else {
            // Un compte est lié : On charge ses stats complètes (et celles de son club)
            const linkedTag = claimedList[0].tag;
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

        // ==========================================
        // 3. GESTION DES CLUBS SUIVIS
        // ==========================================
        // Le HTML affiche déjà "Fonctionnalité à venir..." par défaut dans #club-grid.
        // Aucune action JS requise pour l'instant, mais l'espace est prêt !

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
        
        // 2. Fetch Club (Si le joueur en a un)
        let clubHtml = '';
        if (pData.club && pData.club.tag) {
            const cRes = await fetch(`${API_URL}/api/public/club/${pData.club.tag.replace('#','')}`);
            if (cRes.ok) {
                const cData = await cRes.json();
                
                // --- HTML DU CLUB ---
                clubHtml = `
                    <div class="club-card clickable" onclick="window.location.href='/club/${cData.tag.replace('#','')}'">
                        <img src="https://cdn.brawlify.com/club/${cData.badgeId}.png" class="profile-icon" onerror="this.src='/assets/default_icon.png'">
                        <div class="big-profile-info">
                            <div class="big-profile-name" style="color: #ffce00;">${cData.name}</div>
                            <div class="big-profile-tag">${cData.tag}</div>
                            <div class="big-stats-row">
                                <div class="stat-badge" style="color: #ffce00;"><img src="/assets/trophy_normal.png" style="width:16px;"> ${cData.trophies.toLocaleString()}</div>
                                <div class="stat-badge" style="color: #aaa;">👤 ${cData.members.length} / 30</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        // Si pas de club ou erreur
        if (!clubHtml) {
            clubHtml = `
                <div class="empty-link-card">
                    <img src="/assets/icons/wipeout.png" style="height: 40px; margin-bottom: 10px; opacity: 0.5;" onerror="this.style.display='none'">
                    <div style="font-size: 1.2em; color: #555;">Pas de club</div>
                </div>
            `;
        }
        
        // 3. Rendu Joueur
        let nameColor = pData.nameColor || '#ffffff';
        if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

        let prestigeValue = pData.totalPrestigeLevel || 0;
        let prestigeHtml = '';
        if (prestigeValue > 0) {
            prestigeHtml = `<div class="stat-badge" style="color: #00d2ff; border-color: #00d2ff;"><img src="/assets/total_prestige.png" style="width:16px;"> ${prestigeValue}</div>`;
        }

        // --- HTML DU JOUEUR (Exactement symétrique au club) ---
        const playerHtml = `
            <div class="linked-card clickable" onclick="window.location.href='/player/${pData.tag.replace('#','')}'">
                <img src="https://cdn.brawlify.com/profile-icons/regular/${pData.icon.id}.png" class="profile-icon" style="border: 2px solid ${nameColor};" onerror="this.src='/assets/default_icon.png'">
                <div class="big-profile-info">
                    <div class="big-profile-name" style="color: ${nameColor}; text-shadow: 0 0 10px ${nameColor}44;">${pData.name}</div>
                    <div class="big-profile-tag">${pData.tag}</div>
                    <div class="big-stats-row">
                        <div class="stat-badge" style="color: #ffce00;"><img src="/assets/trophy_normal.png" style="width:16px;"> ${pData.trophies.toLocaleString()}</div>
                        ${prestigeHtml}
                    </div>
                </div>
            </div>
        `;
        
        // Assemblage final
        container.innerHTML = playerHtml + clubHtml;

    } catch(e) {
        container.innerHTML = `<div style="width: 100%; color: #ff5555; padding: 20px; text-align: center;">Erreur de chargement du profil lié. Vérifiez la connexion.</div>`;
    }
}

// Fonction pour lier un compte via le bouton "+"
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

function logout() {
    localStorage.removeItem('token');
    window.location.href = "/";
}
