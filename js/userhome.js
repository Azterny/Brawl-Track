// js/userhome.js

async function initUserHome() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/";
        return;
    }

    try {
        const res = await fetchAuth(`${API_URL}/api/my-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res) return; // 401 géré par fetchAuth

        if (!res.ok) throw new Error("Session expirée");
        const data = await res.json();
        const username = data.username || "Joueur";

        if (window.location.pathname.includes('userhome.html')) {
            window.history.replaceState({}, '', `/home`);
        }

        document.getElementById('welcome-msg').innerText = `Bienvenue, ${username} !`;
        localStorage.setItem('username', username);

        const claimedList  = data.claimed_tags  || [];
        const followedList = data.followed_tags || [];
        const limits       = data.limits || { claim_max: 1, follow_max: 15 };

        document.getElementById('counter-follows').innerText = `${followedList.length} / ${limits.follow_max}`;

        // ==========================================
        // 1. GESTION DU COMPTE LIÉ (PRINCIPAL)
        // ==========================================
        const linkedContainer = document.getElementById('linked-account-container');

        if (claimedList.length === 0) {
            linkedContainer.innerHTML = `
                <div class="empty-link-card clickable" onclick="openLinkModal()" style="min-height:120px; max-height:160px; height:auto;">
                    <div class="plus-btn">+</div>
                    <div style="font-size:1.2em; font-weight:bold; text-align:center;">Lier mon compte Brawl Stars</div>
                </div>
            `;
        } else {
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
            const bulkRes = await fetchAuth(`${API_URL}/api/bulk-players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ tags: uniqueTags })
            });

            let metadataMap = {};
            if (bulkRes && bulkRes.ok) metadataMap = await bulkRes.json();

            renderGrid('follows-grid', followedList, metadataMap, 'Aucun compte suivi.');
        } else {
            renderGrid('follows-grid', [], {}, 'Vous ne suivez aucun compte.');
        }

    } catch (e) {
        console.error(e);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = "/";
    }
}

// Fix #15 — Requêtes joueur et club en parallèle (Promise.all)
async function fetchAndRenderLinkedAccount(tag, container) {
    try {
        const cleanTag = tag.replace('#', '');

        // Lancement simultané des deux requêtes indépendantes
        const playerPromise = fetch(`${API_URL}/api/public/player/${cleanTag}`);

        const pRes = await playerPromise;
        if (!pRes.ok) throw new Error("Erreur joueur");
        const pData = await pRes.json();

        // Couleur du nom joueur
        let nameColor = pData.nameColor || '#ffffff';
        if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

        const prestigeValue = pData.totalPrestigeLevel ?? (pData.brawlers
            ? pData.brawlers.reduce((sum, b) => sum + Math.floor((b.trophies || 0) / 1000), 0)
            : 0);

        const playerHtml = `
            <div class="linked-card clickable" onclick="window.location.href='/player/${pData.tag.replace('#', '')}'">
                <img src="https://cdn.brawlify.com/profile-icons/regular/${pData.icon?.id || 28000000}.png"
                     class="profile-icon"
                     onerror="this.src='/assets/default_icon.png'">
                <div class="big-profile-info">
                    <div class="big-profile-name" style="color: ${nameColor}; text-shadow: 0 0 10px ${nameColor}44;">${pData.name}</div>
                    <div class="big-profile-tag">${pData.tag}</div>
                    <div class="big-stats-row">
                        <div class="stat-badge" style="color:#ffce00;">
                            <img src="/assets/trophy_normal.png" style="width:16px; vertical-align:middle;">
                            ${pData.trophies.toLocaleString('fr-FR')}
                        </div>
                        <div class="stat-badge" style="color:#8A4FE8;">
                            <img src="/assets/total prestige.png" style="width:16px; vertical-align:middle;">
                            ${prestigeValue}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Fetch club en parallèle si disponible
        let clubHtml = '';
        if (pData.club && pData.club.tag) {
            try {
                const cRes = await fetch(`${API_URL}/api/public/club/${pData.club.tag.replace('#', '')}`);
                if (cRes.ok) {
                    const cData = await cRes.json();
                    const badgeId     = cData.badgeId || 8000000;
                    const membersCount = cData.members ? cData.members.length : 0;

                    clubHtml = `
                        <div class="linked-card clickable" onclick="window.location.href='/club/${cData.tag.replace('#', '')}'">
                            <img src="https://brawlify.com/images/club-badges/96/${badgeId}.webp"
                                 class="profile-icon"
                                 style="object-fit:contain; border:none; background:none;"
                                 onerror="this.src='/assets/default_icon.png'">
                            <div class="big-profile-info">
                                <div class="big-profile-name" style="color:#ffce00; text-shadow:0 0 10px #ffce0044;">${cData.name}</div>
                                <div class="big-profile-tag">${cData.tag}</div>
                                <div class="big-stats-row">
                                    <div class="stat-badge" style="color:#ffce00;">
                                        <img src="/assets/trophy_normal.png" style="width:16px; vertical-align:middle;">
                                        ${cData.trophies.toLocaleString('fr-FR')}
                                    </div>
                                    <div class="stat-badge" style="color:#fff;">
                                        <img src="/assets/icons/wipeout.png" style="width:16px; vertical-align:middle; filter:grayscale(100%) brightness(1.5);">
                                        ${membersCount}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (e) {
                // Club indisponible — on continue sans
            }
        }

        if (!clubHtml) {
            clubHtml = `
                <div class="empty-link-card">
                    <div class="plus-btn" style="font-size:2em; opacity:0.3;">🏆</div>
                    <div style="font-size:1.1em; color:#555;">Pas de club</div>
                </div>
            `;
        }

        container.innerHTML = playerHtml + clubHtml;

    } catch (e) {
        container.innerHTML = `<div style="width:100%; color:#ff5555; padding:20px; text-align:center;">Erreur de chargement du profil lié. Vérifiez la connexion.</div>`;
    }
}

function renderSkeletons(gridId, count) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < Math.min(count, 6); i++) {
        grid.innerHTML += `<div class="skeleton-box" style="height:90px; border-radius:12px;"></div>`;
    }
}

function renderGrid(gridId, followedList, metadataMap, emptyMsg) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (followedList.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:30px;">${emptyMsg}</div>`;
        return;
    }

    followedList.forEach(followed => {
        const tag     = followed.tag;
        const meta    = metadataMap[tag] || {};
        const name    = meta.name    || tag;
        const trophies = meta.trophies != null ? meta.trophies.toLocaleString('fr-FR') : '—';
        const iconId  = meta.icon?.id || 28000000;

        let nameColor = meta.nameColor || '#fff';
        if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

        const card = document.createElement('div');
        card.className = 'mini-profile-card clickable';
        card.onclick   = () => window.location.href = `/player/${tag.replace('#', '')}`;
        card.innerHTML = `
            <img src="https://cdn.brawlify.com/profile-icons/regular/${iconId}.png"
                 class="mini-icon"
                 onerror="this.src='/assets/default_icon.png'">
            <div class="mini-info">
                <div class="mini-name" style="color:${nameColor};">${name}</div>
                <div class="mini-tag">${tag}</div>
                <div class="mini-trophies">
                    <img src="/assets/trophy_normal.png" style="width:12px; vertical-align:middle;">
                    ${trophies}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}
