let currentZone = 'global';
let currentCategory = null; 
let selectedBrawlerId = null;
let currentDataList = []; 

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
    const urlParams = new URLSearchParams(window.location.search);
    
    let zone = null;
    let category = null;
    let brawlerId = null;

    // 1. Détection via Clean URL directe du navigateur
    if (pathParts.length > 1 && pathParts[0] === 'leaderboard') {
        zone = pathParts[1];
        category = pathParts[2];
        brawlerId = pathParts[3];
    } 
    // 2. Détection via la redirection 404.html (?zone=...&cat=...)
    else if (urlParams.has('cat')) {
        zone = urlParams.get('zone') || 'global';
        category = urlParams.get('cat');
        brawlerId = urlParams.get('id');
        
        // Restaure la jolie URL dans la barre d'adresse
        let cleanUrl = `/leaderboard/${zone}/${category}`;
        if (category === 'brawler' && brawlerId) cleanUrl += `/${brawlerId}`;
        window.history.replaceState({}, '', cleanUrl);
    }

    if (category) {
        currentZone = zone;
        document.getElementById('zone-select').value = currentZone;
        document.getElementById('lb-header').style.display = 'flex';
        currentCategory = category;
        
        if (category === 'brawler' && brawlerId) {
            selectedBrawlerId = brawlerId;
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
    document.getElementById('mobile-brawler-select-container').innerHTML = '';
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
                <img src="https://cdn.brawlify.com/brawlers/borderless/16000000.png"
                     class="menu-card-brawler-icon" alt="Brawlers">
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
    document.getElementById('search-input').value = ""; 
    
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
        <div class="brawler-item ${selectedBrawlerId == b.id ? 'active' : ''}" onclick="selectBrawler(${b.id})" data-name="${b.name.toLowerCase()}">
            <img src="https://cdn.brawlify.com/brawlers/borderless/${b.id}.png">
            <span>${b.name}</span>
        </div>
    `).join('');

    let datalistOptionsHtml = globalBrawlersList.map(b => `<option value="${b.name}">`).join('');

    mobileContainer.innerHTML = `
        <input list="brawlers-datalist" id="mobile-brawler-select" placeholder="-- Chercher ou choisir un Brawler --" onchange="selectBrawlerFromDatalist(this.value)" style="width: 100%; max-width: 600px; display: block; margin: 0 auto 15px auto; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; font-size: 1rem;">
        <datalist id="brawlers-datalist">
            ${datalistOptionsHtml}
        </datalist>
    `;

    // Interface PC (Sidebar) + Contenu Droite
    content.innerHTML = `
        <div class="brawler-split">
            <div class="brawler-sidebar">
                <input type="text" id="brawler-filter" placeholder="Chercher un brawler..." oninput="filterBrawlerList()" style="width: 100%; box-sizing:border-box; margin-bottom: 15px; padding: 10px; border-radius: 8px; border: 1px solid #444; background: #111; color: #fff; font-size: 0.95rem;">
                <div id="brawler-list-container">${brawlerListHtml}</div>
            </div>
            <div class="brawler-content" id="brawler-ranking-content">
                <div style="text-align:center; color:#aaa; margin-top: 50px;">Veuillez sélectionner un brawler</div>
            </div>
        </div>
    `;

    if (selectedBrawlerId) {
        selectBrawler(selectedBrawlerId, true);
    }
}

window.filterBrawlerList = function() {
    const query = document.getElementById('brawler-filter').value.toLowerCase();
    document.querySelectorAll('.brawler-item').forEach(el => {
        el.style.display = el.getAttribute('data-name').includes(query) ? 'flex' : 'none';
    });
};

window.filterMobileBrawlerList = function() {
    const query = document.getElementById('mobile-brawler-filter').value.toLowerCase();
    const select = document.getElementById('mobile-brawler-select');
    let selectOptionsHtml = `<option value="">-- Choisir un Brawler --</option>` + globalBrawlersList
        .filter(b => b.name.toLowerCase().includes(query))
        .map(b => `<option value="${b.id}" ${selectedBrawlerId == b.id ? 'selected' : ''}>${b.name}</option>`)
        .join('');
    select.innerHTML = selectOptionsHtml;
};

window.selectBrawlerFromDatalist = function(name) {
    const brawler = globalBrawlersList.find(b => b.name.toLowerCase() === name.toLowerCase());
    if (brawler) {
        selectBrawler(brawler.id);
        // On retire le focus pour fermer le clavier sur mobile
        document.getElementById('mobile-brawler-select').blur();
    }
};

async function selectBrawler(id, skipPushState = false) {
    if (!id) return;
    selectedBrawlerId = id;
    if (!skipPushState) window.history.pushState({}, '', `/leaderboard/${currentZone}/brawler/${id}`);

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
                        <span style="color:#ffce00;" class="list-stat-item"><img src="/assets/trophy_normal.png" class="stat-img-icon"> ${item.trophies}</span>
                    </div>
                </div>`;
        } else if (type === 'club') {
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
                        <span style="color:#aaa;" class="list-stat-item"><img src="/assets/icons/wipeout.png" class="stat-img-icon" style="filter: grayscale(100%);"> ${item.memberCount}</span>
                        <span style="color:#ffce00;" class="list-stat-item"><img src="/assets/trophy_normal.png" class="stat-img-icon"> ${item.trophies}</span>
                    </div>
                </div>`;
        } else if (type === 'brawler_ranking') {
            let rankData = getBrawlerRank(item.trophies);
            let prestige = Math.floor(item.trophies / 1000);
            // Récupération de l'icône de profil du joueur
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
                        ${prestige > 0 ? `<span style="color:#8A4FE8;" class="list-stat-item"><img src="${RANK_CONFIG[rankData].icon}" class="stat-img-icon" style="border-radius: 0;" title="${RANK_CONFIG[rankData].label}"> ${prestige}</span>` : ''}
                        <span style="color:#ffce00;" class="list-stat-item"><img src="${RANK_CONFIG[rankData].trophyIcon}" class="stat-img-icon"> ${item.trophies}</span>
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
