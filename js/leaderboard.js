let currentZone = 'global';
let currentCategory = null; // 'trophies', 'club', 'brawler'
let selectedBrawlerId = null;
let currentDataList = []; // Pour la recherche en temps réel

// RANK_CONFIG copié/adapté de dashboard.js pour les rangs Brawlers
const RANK_CONFIG = {
    wood:      { label: 'Wood',        icon: '/assets/ranks/wood.webp',      trophyIcon: '/assets/trophy_normal.png' },
    bronze:    { label: 'Bronze',      icon: '/assets/ranks/bronze.webp',    trophyIcon: '/assets/trophy_normal.png' },
    silver:    { label: 'Silver',      icon: '/assets/ranks/silver.webp',    trophyIcon: '/assets/trophy_normal.png' },
    gold:      { label: 'Gold',        icon: '/assets/ranks/gold.webp',      trophyIcon: '/assets/trophy_normal.png' },
    prestige1: { label: 'Prestige 1',  icon: '/assets/ranks/prestige1.webp', trophyIcon: '/assets/trophy_prestige.png' },
    prestige2: { label: 'Prestige 2',  icon: '/assets/ranks/prestige2.webp', trophyIcon: '/assets/trophy_prestige.png' },
    prestige3: { label: 'Prestige 3+', icon: '/assets/ranks/prestige3.webp', trophyIcon: '/assets/trophy_prestige.png' },
};

function getBrawlerRank(trophies) {
    if (trophies >= 3000) return 'prestige3';
    if (trophies >= 2000) return 'prestige2';
    if (trophies >= 1000) return 'prestige1';
    if (trophies >= 750)  return 'gold';
    if (trophies >= 500)  return 'silver';
    if (trophies >= 250)  return 'bronze';
    return 'wood';
}

document.addEventListener("DOMContentLoaded", () => {
    initLeaderboardRouter();
});

async function initLeaderboardRouter() {
    const pathParts = window.location.pathname.split('/').filter(p => p);
    
    // /leaderboard/{zone}/{category}/{brawlerId}
    if (pathParts.length > 1) {
        currentZone = pathParts[1];
        document.getElementById('zone-select').value = currentZone;
        document.getElementById('lb-header').style.display = 'flex';
        
        currentCategory = pathParts[2];
        if (currentCategory === 'brawler' && pathParts[3]) {
            selectedBrawlerId = pathParts[3];
        }
        loadCategory(currentCategory);
    } else {
        renderMenu();
    }
}

function changeZone() {
    currentZone = document.getElementById('zone-select').value;
    let newUrl = `/leaderboard/${currentZone}/${currentCategory}`;
    if (currentCategory === 'brawler' && selectedBrawlerId) newUrl += `/${selectedBrawlerId}`;
    window.history.pushState({}, '', newUrl);
    loadCategory(currentCategory);
}

function renderMenu() {
    document.getElementById('lb-header').style.display = 'none';
    document.getElementById('mobile-brawler-select-container').innerHTML = ''; // Nettoyer
    document.getElementById('page-title').innerText = "Sélectionnez un Classement";
    
    const content = document.getElementById('dynamic-content');
    content.innerHTML = `
        <div class="menu-cards">
            <div class="menu-card" onclick="goTo('/leaderboard/global/trophies')">
                <img src="/assets/trophy_normal.png" height="55" alt="Joueurs">
                <h2>Joueurs</h2>
                <p>Top Trophées Joueurs</p>
            </div>
            <div class="menu-card" onclick="goTo('/leaderboard/global/club/trophies')">
                <img src="https://brawlify.com/images/club-badges/96/8000000.webp" height="55" alt="Clubs">
                <h2>Clubs</h2>
                <p>Top Trophées Clubs</p>
            </div>
            <div class="menu-card" onclick="goTo('/leaderboard/global/brawler')">
                <img src="https://cdn.brawlify.com/brawlers/borderless/16000000.png" height="55" alt="Brawlers">
                <h2>Brawlers</h2>
                <p>Top Joueurs par Brawler</p>
            </div>
        </div>
    `;
}

function goTo(url) {
    window.history.pushState({}, '', url);
    initLeaderboardRouter();
}

async function loadCategory(category) {
    const content = document.getElementById('dynamic-content');
    content.innerHTML = `<div style="text-align:center;"><img src="/assets/loading_icon.png" class="spin" width="50"></div>`;
    document.getElementById('search-input').value = ""; // Reset recherche
    
    // Nettoyer le select mobile par défaut
    if (category !== 'brawler') {
        document.getElementById('mobile-brawler-select-container').innerHTML = '';
    }

    if (category === 'trophies') {
        document.getElementById('page-title').innerText = `Top Joueurs - ${currentZone.toUpperCase()}`;
        const data = await fetchAPI(`/api/rankings/${currentZone}/players`);
        currentDataList = data.items || [];
        renderList(currentDataList, 'player');
    } 
    else if (category === 'club') {
        document.getElementById('page-title').innerText = `Top Clubs - ${currentZone.toUpperCase()}`;
        const data = await fetchAPI(`/api/rankings/${currentZone}/clubs`);
        currentDataList = data.items || [];
        renderList(currentDataList, 'club');
    } 
    else if (category === 'brawler') {
        document.getElementById('page-title').innerText = `Top Brawlers - ${currentZone.toUpperCase()}`;
        renderBrawlerSplitScreen();
    }
}

async function renderBrawlerSplitScreen() {
    const content = document.getElementById('dynamic-content');
    const mobileContainer = document.getElementById('mobile-brawler-select-container');
    
    if (globalBrawlersList.length === 0) {
        const bRes = await fetchAPI(`/api/brawlers`);
        globalBrawlersList = bRes.items || [];
    }

    let brawlerListHtml = globalBrawlersList.map(b => `
        <div class="brawler-item ${selectedBrawlerId == b.id ? 'active' : ''}" onclick="selectBrawler(${b.id})">
            <img src="https://cdn.brawlify.com/brawlers/borderless/${b.id}.png">
            <span>${b.name}</span>
        </div>
    `).join('');

    let selectOptionsHtml = `<option value="">-- Choisir un Brawler --</option>` + globalBrawlersList.map(b => `
        <option value="${b.id}" ${selectedBrawlerId == b.id ? 'selected' : ''}>${b.name}</option>
    `).join('');

    // Injecter le menu déroulant dans le conteneur du HAUT (au-dessus de la recherche)
    mobileContainer.innerHTML = `
        <select class="mobile-brawler-select" onchange="selectBrawler(this.value)">
            ${selectOptionsHtml}
        </select>
    `;

    // Injecter le reste (Sidebar + Contenu de droite) en bas
    content.innerHTML = `
        <div class="brawler-split">
            <div class="brawler-sidebar">${brawlerListHtml}</div>
            <div class="brawler-content" id="brawler-ranking-content">
                <div style="text-align:center; color:#aaa; margin-top: 50px;">Veuillez sélectionner un brawler</div>
            </div>
        </div>
    `;

    if (selectedBrawlerId) {
        selectBrawler(selectedBrawlerId, true);
    }
}

async function selectBrawler(id, skipPushState = false) {
    if (!id) return;
    selectedBrawlerId = id;
    if (!skipPushState) window.history.pushState({}, '', `/leaderboard/${currentZone}/brawler/${id}`);

    // Update active class
    document.querySelectorAll('.brawler-item').forEach(el => el.classList.remove('active'));
    const targetEl = document.querySelector(`.brawler-item[onclick="selectBrawler(${id})"]`);
    if (targetEl) targetEl.classList.add('active');

    const rightContent = document.getElementById('brawler-ranking-content');
    rightContent.innerHTML = `<div style="text-align:center;"><img src="/assets/loading_icon.png" class="spin" width="50"></div>`;

    const data = await fetchAPI(`/api/rankings/${currentZone}/brawlers/${id}`);
    currentDataList = data.items || [];
    
    rightContent.innerHTML = `<div id="list-render-target"></div>`;
    renderList(currentDataList, 'brawler_ranking', 'list-render-target');
}

function filterList() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = currentDataList.filter(item => 
        (item.name && item.name.toLowerCase().includes(query)) || 
        (item.tag && item.tag.toLowerCase().includes(query))
    );
    
    let target = currentCategory === 'brawler' ? 'list-render-target' : 'dynamic-content';
    let type = currentCategory === 'trophies' ? 'player' : (currentCategory === 'club' ? 'club' : 'brawler_ranking');
    renderList(filtered, type, target);
}

function renderList(items, type, targetId = 'dynamic-content') {
    const container = document.getElementById(targetId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#aaa;">Aucun résultat trouvé.</div>`;
        return;
    }

    let html = `<div class="list-container">`;

    items.forEach(item => {
        let nameColor = item.nameColor ? (item.nameColor.startsWith('0x') ? '#' + item.nameColor.slice(4) : item.nameColor) : '#fff';
        
        if (type === 'player') {
            let icon = (item.icon && item.icon.id) ? `https://cdn.brawlify.com/profile-icons/regular/${item.icon.id}.png` : '/assets/default_icon.png';
            html += `
                <div class="list-item" style="cursor:pointer;" onclick="window.location.href='/player/${item.tag.replace('#','')}'">
                    <div class="list-rank">#${item.rank}</div>
                    <img src="${icon}" class="list-icon">
                    <div class="list-info">
                        <div class="list-name" style="color: ${nameColor}">${item.name}</div>
                        <div class="list-tag">${item.tag}</div>
                    </div>
                    <div class="list-stats">
                        <span style="color:#ffce00;"><img src="/assets/trophy_normal.png" height="15"> ${item.trophies}</span>
                    </div>
                </div>`;
        } 
        else if (type === 'club') {
            let icon = item.badgeId ? `https://brawlify.com/images/club-badges/96/${item.badgeId}.webp` : '/assets/default_icon.png';
            html += `
                <div class="list-item" style="cursor:pointer;" onclick="window.location.href='/club/${item.tag.replace('#','')}'">
                    <div class="list-rank">#${item.rank}</div>
                    <img src="${icon}" class="list-icon">
                    <div class="list-info">
                        <div class="list-name">${item.name}</div>
                        <div class="list-tag">${item.tag}</div>
                    </div>
                    <div class="list-stats">
                        <span style="color:#aaa;" class="list-stat-item"><img src="/assets/icons/solo.png" height="15" style="filter: grayscale(100%);"> ${item.memberCount}</span>
                        <span style="color:#ffce00;"><img src="/assets/trophy_normal.png" height="15"> ${item.trophies}</span>
                    </div>
                </div>`;
        }
        else if (type === 'brawler_ranking') {
            let rankData = getBrawlerRank(item.trophies);
            let prestige = Math.floor(item.trophies / 1000);
            html += `
                <div class="list-item" style="cursor:pointer;" onclick="window.location.href='/player/${item.tag.replace('#','')}'">
                    <div class="list-rank">#${item.rank}</div>
                    <img src="${RANK_CONFIG[rankData].icon}" style="height:40px;" title="${RANK_CONFIG[rankData].label}">
                    <div class="list-info">
                        <div class="list-name" style="color: ${nameColor}">${item.name}</div>
                        <div class="list-tag">${item.tag}</div>
                    </div>
                    <div class="list-stats">
                        ${prestige > 0 ? `<span style="color:#8A4FE8;"><img src="/assets/total prestige.png" height="15"> ${prestige}</span>` : ''}
                        <span style="color:#ffce00;"><img src="${RANK_CONFIG[rankData].trophyIcon}" height="15"> ${item.trophies}</span>
                    </div>
                </div>`;
        }
    });

    html += `</div>`;
    container.innerHTML = html;
}

async function fetchAPI(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`);
        if (!res.ok) throw new Error("Erreur serveur");
        return await res.json();
    } catch(e) {
        console.error(e);
        return { items: [] };
    }
}
