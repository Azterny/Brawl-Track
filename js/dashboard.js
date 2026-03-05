// =========================================================
// === CONSTANTES & VARIABLES GLOBALES ===
// =========================================================

const CHART_MODE_HOUR = 0.042;

let currentChartMode = 0;
let currentChartOffset = 0;         // Offset graphique GLOBAL (trophées joueur)
let currentBrawlerChartOffset = 0;  // Offset graphique BRAWLER séparé
let currentTagString = null;
let mainFlatpickr = null;
let brawlerFlatpickr = null;
let currentUserId = null;

let currentBrawlerHistory = [];
let currentBrawlerMode = 0;
let brawlerChartInstance = null;

const API_BASE = (typeof API_URL !== 'undefined') ? API_URL : '';

// =========================================================
// === HELPER: isHourMode ===
// =========================================================

function isHourMode(mode) {
    return Math.abs(mode - CHART_MODE_HOUR) < 0.001;
}

// =========================================================
// === SYSTÈME DE RANGS BRAWLERS ===
// =========================================================

const RANK_CONFIG = {
    wood:      { label: 'Wood',        neon: false, icon: '/assets/ranks/wood.webp',      trophyIcon: '/assets/trophy_normal.png' },
    bronze:    { label: 'Bronze',      neon: false, icon: '/assets/ranks/bronze.webp',    trophyIcon: '/assets/trophy_normal.png' },
    silver:    { label: 'Silver',      neon: false, icon: '/assets/ranks/silver.webp',    trophyIcon: '/assets/trophy_normal.png' },
    gold:      { label: 'Gold',        neon: false, icon: '/assets/ranks/gold.webp',      trophyIcon: '/assets/trophy_normal.png' },
    prestige1: { label: 'Prestige 1',  neon: true,  icon: '/assets/ranks/prestige1.webp', trophyIcon: '/assets/trophy_prestige.png' },
    prestige2: { label: 'Prestige 2',  neon: true,  icon: '/assets/ranks/prestige2.webp', trophyIcon: '/assets/trophy_prestige.png' },
    prestige3: { label: 'Prestige 3+', neon: true,  icon: '/assets/ranks/prestige3.webp', trophyIcon: '/assets/trophy_prestige.png' },
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

// =========================================================
// === HELPER: calculateDateRange ===
// =========================================================

function calculateDateRange(mode, offset, firstDataPointDate) {
    const now = new Date();

    if (mode === 0) return null;

    if (isHourMode(mode)) {
        const target = new Date(now);
        target.setHours(target.getHours() - offset);
        const startDate = new Date(target);
        startDate.setMinutes(0, 0, 0);
        const endDate = new Date(target);
        endDate.setMinutes(59, 59, 999);

        if (firstDataPointDate) {
            const firstArchiveHour = new Date(firstDataPointDate);
            firstArchiveHour.setMinutes(0, 0, 0);
            if (startDate < firstArchiveHour) {
                return {
                    startDate: new Date(firstArchiveHour),
                    endDate: new Date(firstArchiveHour.setMinutes(59, 59, 999))
                };
            }
        }
        return { startDate, endDate };
    }

    if (mode === 1) {
        const target = new Date();
        target.setDate(now.getDate() - offset);
        const startDate = new Date(target.setHours(0, 0, 0, 0));
        const endDate = new Date(target.setHours(23, 59, 59, 999));
        return { startDate, endDate };
    }

    if (mode === 7) {
        const currentDay = now.getDay();
        const distanceToSunday = (currentDay === 0 ? 0 : 7 - currentDay);
        const targetEnd = new Date(now);
        targetEnd.setDate(now.getDate() + distanceToSunday - (offset * 7));
        targetEnd.setHours(23, 59, 59, 999);
        const targetStart = new Date(targetEnd);
        targetStart.setDate(targetEnd.getDate() - 6);
        targetStart.setHours(0, 0, 0, 0);
        return { startDate: targetStart, endDate: targetEnd };
    }

    if (mode === 31) {
        const target = new Date();
        target.setMonth(now.getMonth() - offset);
        return {
            startDate: new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0),
            endDate:   new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59)
        };
    }

    if (mode === 365) {
        const targetYear = now.getFullYear() - offset;
        return {
            startDate: new Date(targetYear, 0, 1, 0, 0, 0),
            endDate:   new Date(targetYear, 11, 31, 23, 59, 59)
        };
    }

    return null;
}

// =========================================================
// === INITIALISATION ===
// =========================================================
async function initDashboard() {
    const urlParams = new URLSearchParams(window.location.search);
    let tag = urlParams.get('tag');
    let brawler = urlParams.get('brawler');

    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts[0] === 'player' && pathParts[1]) {
        tag = pathParts[1];
        if (pathParts[2]) brawler = decodeURIComponent(pathParts[2]);
    }

    if (!tag) {
        window.location.href = "/";
        return;
    }

    currentTagString = tag.toUpperCase().replace('#', '');
    document.title = `Brawl Track - #${currentTagString}`;

    if (window.location.pathname.includes('dashboard.html')) {
        let cleanUrl = `/player/${currentTagString}`;
        if (brawler) cleanUrl += `/${encodeURIComponent(brawler)}`;
        window.history.replaceState({}, '', cleanUrl);
    }

    await fetchUserTier();
    await loadTagData(currentTagString);
    initFollowSystem(currentTagString);

    if (brawler && window.currentBrawlersDisplay) {
        const b = window.currentBrawlersDisplay.find(x => x.name.toLowerCase() === brawler.toLowerCase());
        if (b) goToBrawlerStats(b.id, b.name);
    }
}

async function fetchUserTier() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/api/my-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.tier)    currentUserTier = data.tier;
            if (data.user_id) currentUserId   = data.user_id;
        }
    } catch(e) { console.log("Guest mode"); }
}

// =========================================================
// === CHARGEMENT DONNÉES (Mode Public) ===
// =========================================================

async function loadTagData(tag) {
    try {
        const res = await fetch(`${API_BASE}/api/public/player/${tag}`);
        if (!res.ok) throw new Error("Joueur introuvable");
        const data = await res.json();
        renderProfile(data);
        await loadBrawlersGrid(data.brawlers);
        loadHistoryChart(data.history || [], data.trophies);
        checkClaimStatus(data);
    } catch (e) {
        console.error(e);
        window.location.href = `/404.html?target=${currentTagString}`;
    }
}

function renderProfile(data) {
    const nameElem = document.getElementById('player-name');
    nameElem.innerText = data.name;

    if (data.nameColor) {
        let color = data.nameColor;
        if (color.startsWith('0x')) color = '#' + (color.length >= 10 ? color.slice(4) : color.slice(2));
        nameElem.style.color = color;
        nameElem.style.textShadow = '1px 2px 3px rgba(0,0,0,0.8)';
    } else {
        nameElem.style.color = '#ffffff';
        nameElem.style.textShadow = 'none';
    }

    document.getElementById('player-tag').innerText = '#' + currentTagString;

    const iconImg = document.getElementById('player-icon');
    if (iconImg) {
        const iconId = (data.icon && data.icon.id) ? data.icon.id : 28000000;
        iconImg.src = `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`;
        iconImg.style.display = 'block';
    }

    const survivorVictories = (data.soloVictories || 0) + (data.duoVictories || 0);

    const prestiges = data.brawlers
        ? data.brawlers.reduce((sum, b) => sum + Math.floor((b.trophies || 0) / 1000), 0)
        : 0;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/trophy_normal.png" style="height:0.9em;"> ${data.trophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/icons/duels.png" style="height:0.9em;"> ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Survivant</div><div class="stat-value" style="color:#28a745; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/icons/solo.png" style="height:0.9em;"> ${survivorVictories}</div></div>
        <div class="stat-card"><div>Prestiges</div><div class="stat-value" style="color:#8A4FE8; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/total prestige.png" style="height:0.9em;"> ${prestiges}</div></div>
    `;

    const clubCard = document.getElementById('club-card');
    if (data.club && data.club.tag) {
        clubCard.classList.remove('hidden');
        clubCard.innerHTML = `<div style="color:#aaa; font-style:italic; padding: 10px;">Chargement des données du club...</div>`;
        fetchClubDetails(data.club.tag);
    } else {
        clubCard.classList.add('hidden');
    }
}

// =========================================================
// === LOGIQUE CLAIM ===
// =========================================================

function checkClaimStatus(tagData) {
    const token = localStorage.getItem('token');
    if (!token) return;

    const actionsDiv = document.getElementById('header-actions');
    const existingBtn = document.getElementById('btn-claim-action');
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'btn-claim-action';
    btn.style.width = "auto";
    btn.style.margin = "0";
    btn.style.padding = "6px 16px";
    btn.style.fontWeight = "bold";
    btn.style.fontSize = "0.9rem";
    btn.style.borderRadius = "8px";
    btn.style.border = "none";
    btn.style.transition = "all 0.2s";

    if (tagData.is_reserved) {
        btn.innerText = "🔒 RESERVED";
        btn.className = "btn-3d btn-purple";
        btn.disabled = true;
        btn.style.cursor = "not-allowed";
        actionsDiv.prepend(btn);
        return;
    }

    if (tagData.claimer_id === currentUserId) {
        btn.innerText = "❌ UNCLAIM";
        btn.className = "btn-3d btn-red";
        btn.onclick = () => unclaimTagAction();
        actionsDiv.prepend(btn);
        return;
    }

    if (tagData.claimer_id && tagData.claimer_id !== currentUserId) {
        btn.innerText = "👤 CLAIMED";
        btn.className = "btn-3d btn-grey";
        btn.disabled = true;
        btn.style.cursor = "not-allowed";
        actionsDiv.prepend(btn);
        return;
    }

    btn.innerText = "⚡ CLAIM";
    btn.className = "btn-3d btn-yellow";
    btn.onclick = () => claimTagAction();
    actionsDiv.prepend(btn);
}

async function claimTagAction() {
    if (!confirm("Lier ce tag à votre compte ?")) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/api/claim-tag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tag: currentTagString })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ Tag lié avec succès !");
            checkClaimStatus({ claimer_id: currentUserId, is_reserved: false });
        } else {
            alert("⚠️ " + data.message);
        }
    } catch(e) { alert("Erreur connexion"); }
}

async function unclaimTagAction() {
    if (!confirm("Ne plus suivre ce compte ?\nL'historique automatique sera arrêté.")) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/api/unclaim-tag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tag: currentTagString })
        });
        const data = await res.json();

        if (res.ok) {
            checkClaimStatus({ claimer_id: null, is_reserved: false });
        } else {
            alert("⚠️ " + data.message);
        }
    } catch(e) { alert("Erreur connexion"); }
}

// =========================================================
// === GESTION DU BOUTON FOLLOW ===
// =========================================================

async function initFollowSystem(tag) {
    const actionsDiv = document.getElementById('header-actions');
    if (!actionsDiv) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    let btnFollow = document.getElementById('btn-follow-addon');

    if (!btnFollow) {
        btnFollow = document.createElement('button');
        btnFollow.id = 'btn-follow-addon';
        btnFollow.className = 'btn-action-blue';
        btnFollow.style.marginRight = "10px";
        actionsDiv.insertBefore(btnFollow, actionsDiv.firstChild);
    }

    try {
        const res = await fetch(`${API_BASE}/api/follow-status/${tag}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            updateFollowButtonState(btnFollow, data.following, tag);
        }
    } catch (e) {
        console.error("Erreur Follow System:", e);
    }
}

function updateFollowButtonState(btn, isFollowing, tag) {
    if (isFollowing) {
        btn.innerText = "UNFOLLOW";
        btn.className = 'btn-3d btn-blue active';
        btn.onclick = () => toggleFollowAction(tag, btn, 'unfollow-tag');
    } else {
        btn.innerText = "FOLLOW";
        btn.className = 'btn-3d btn-yellow';
        btn.onclick = () => toggleFollowAction(tag, btn, 'follow-tag');
    }
}

async function toggleFollowAction(tag, btn, endpoint) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/api/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tag: tag })
        });

        const data = await res.json();
        if (res.ok) {
            const isNowFollowing = (endpoint === 'follow-tag');
            updateFollowButtonState(btn, isNowFollowing, tag);
        } else {
            alert(data.message || "Erreur action");
        }
    } catch (e) {
        console.error(e);
    }
}

// =========================================================
// === BRAWLERS GRID ===
// =========================================================

async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    if (!grid) return;

    if (globalBrawlersList.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/api/brawlers`);
            const data = await res.json();
            globalBrawlersList = data.items || [];
        } catch(e) { console.error(e); }
    }

    window.currentBrawlersDisplay = globalBrawlersList.map(b => {
        const owned = playerBrawlers.find(pb => pb.id === b.id);
        return {
            id: b.id, name: b.name,
            imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png`,
            owned: !!owned,
            trophies: owned ? owned.trophies : 0,
            change24h: owned ? (owned.trophy_change_24h || 0) : 0
        };
    });
    sortBrawlers();
}

function sortBrawlers() {
    if (!window.currentBrawlersDisplay) return;
    const criteria = document.getElementById('sort-brawlers').value;
    window.currentBrawlersDisplay.sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? -1 : 1;
        if (criteria === 'trophies') return b.trophies - a.trophies;
        else if (criteria === 'name') return a.name.localeCompare(b.name);
        else return a.id - b.id;
    });
    renderBrawlersGrid();
}

function renderBrawlersGrid() {
    const grid = document.getElementById('brawlers-grid');
    if (!grid) return;
    grid.innerHTML = '';

    window.currentBrawlersDisplay.forEach(b => {
        const card = document.createElement('div');
        card.className = 'brawler-card';

        if (!b.owned) {
            card.style.filter = "grayscale(100%) opacity(0.3)";
            card.style.cursor = "default";
        } else {
            const rank = getBrawlerRank(b.trophies);
            card.classList.add(`rank-${rank}`);
            card.style.cursor = "pointer";
            card.onclick = () => goToBrawlerStats(b.id, b.name);

            const badge = document.createElement('img');
            badge.src = RANK_CONFIG[rank].icon;
            badge.alt = RANK_CONFIG[rank].label;
            badge.className = 'brawler-rank-badge';
            badge.title = RANK_CONFIG[rank].label;
            card.appendChild(badge);
        }

        const img = document.createElement('img');
        img.src = b.imageUrl;
        img.style.width = '100%';
        img.style.aspectRatio = '1/1';
        img.style.objectFit = 'contain';
        img.loading = 'lazy';
        card.appendChild(img);

        const nameDiv = document.createElement('div');
        nameDiv.style.fontSize = '0.8em';
        nameDiv.className = 'brawler-name-label';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.textContent = b.name;
        card.appendChild(nameDiv);

        if (b.owned) {
            const rank = getBrawlerRank(b.trophies);
            const trophyDiv = document.createElement('div');
            trophyDiv.style.color = '#ffce00';
            trophyDiv.style.fontSize = '1em';
            trophyDiv.style.marginTop = '2px';
            trophyDiv.style.display = 'flex';
            trophyDiv.style.alignItems = 'center';
            trophyDiv.style.justifyContent = 'center';
            trophyDiv.style.gap = '2px';

            const trophyImg = document.createElement('img');
            trophyImg.src = RANK_CONFIG[rank].trophyIcon;
            trophyImg.className = 'brawler-trophy-icon';
            trophyImg.alt = 'trophée';
            trophyDiv.appendChild(trophyImg);

            const trophyText = document.createElement('span');
            trophyText.textContent = b.trophies;
            trophyText.className = 'brawler-trophy-count';
            trophyDiv.appendChild(trophyText);

            if (b.change24h !== 0) {
                const arrow = document.createElement('span');
                arrow.textContent = b.change24h > 0 ? ' ↗' : ' ↘';
                arrow.style.color = b.change24h > 0 ? '#28a745' : '#ff5555';
                trophyDiv.appendChild(arrow);
            }
            card.appendChild(trophyDiv);
        }

        grid.appendChild(card);
    });
}

// =========================================================
// === NAVIGATION BRAWLER ===
// =========================================================

function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

async function goToBrawlerStats(id, name) {
    if (typeof switchView === 'function') switchView('brawlers');

    window.history.pushState({}, '', `/player/${currentTagString}/${encodeURIComponent(name)}`);
    
    document.getElementById('selected-brawler-id').value = id;
    document.getElementById('selected-brawler-name').textContent = name;

    let liveVal = null;
    const b = window.currentBrawlersDisplay.find(x => x.id == id);
    if (b) {
        document.getElementById('selected-brawler-img').src = b.imageUrl;
        liveVal = b.trophies;
    }

    try {
        const res = await fetch(`${API_BASE}/api/public/player/${currentTagString}/brawler/${id}`);
        if (res.ok) currentBrawlerHistory = await res.json();
        else currentBrawlerHistory = [];
    } catch(e) { currentBrawlerHistory = []; }

    manageGenericFilters(currentBrawlerHistory, 'btn-brawler');
    setBrawlerChartMode(0, liveVal);
}

// =========================================================
// === NAVIGATION GRAPHIQUE BRAWLER
// FIX BUG-JS-2: Utilise currentBrawlerChartOffset (séparé de currentChartOffset)
// =========================================================

function navigateBrawlerChart(direction) {
    if (isHourMode(currentBrawlerMode)) {
        currentBrawlerChartOffset += (direction * 24);
    } else {
        currentBrawlerChartOffset += direction;
    }
    if (currentBrawlerChartOffset < 0) currentBrawlerChartOffset = 0;
    renderBrawlerChart();
}

function navigateBrawlerHour(direction) {
    currentBrawlerChartOffset += direction;
    if (currentBrawlerChartOffset < 0) currentBrawlerChartOffset = 0;
    renderBrawlerChart();
}

function jumpToBrawlerDate(dateString) {
    if (!dateString) return;

    const parts = dateString.split('-');
    const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = todayMidnight - targetDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) { alert("Impossible de prédire le futur ! 🔮"); return; }

    if (isHourMode(currentBrawlerMode)) {
        const currentHourOffset = currentBrawlerChartOffset % 24;
        currentBrawlerChartOffset = (diffDays * 24) + currentHourOffset;
    } else if (currentBrawlerMode === 1) {
        currentBrawlerChartOffset = diffDays;
    } else if (currentBrawlerMode === 7) {
        const currentMonday = getMonday(todayMidnight);
        const targetMonday  = getMonday(targetDate);
        const diffWeeks = (currentMonday - targetMonday) / (1000 * 60 * 60 * 24 * 7);
        currentBrawlerChartOffset = Math.round(diffWeeks);
    } else if (currentBrawlerMode === 31) {
        let months = (todayMidnight.getFullYear() - targetDate.getFullYear()) * 12;
        months -= targetDate.getMonth();
        months += todayMidnight.getMonth();
        currentBrawlerChartOffset = months <= 0 ? 0 : months;
    } else if (currentBrawlerMode === 365) {
        currentBrawlerChartOffset = todayMidnight.getFullYear() - targetDate.getFullYear();
    }

    renderBrawlerChart();
}

function updateBrawlerNavigationUI(data) {
    const btnPrev    = document.getElementById('brawler-nav-btn-prev');
    const btnNext    = document.getElementById('brawler-nav-btn-next');
    const label      = document.getElementById('brawler-chart-period-label');
    const picker     = document.getElementById('picker-input-brawler');
    const btnPrevHour = document.getElementById('brawler-nav-btn-prev-hour');
    const btnNextHour = document.getElementById('brawler-nav-btn-next-hour');
    const labelHour   = document.getElementById('brawler-chart-hour-label');

    if (!btnPrev || !btnNext) return;

    let firstDataPointDate = new Date();
    if (data && data.length > 0) {
        const minTime = Math.min(...data.map(item => new Date((item.date || item.recorded_at).replace(' ', 'T') + 'Z').getTime()));
        firstDataPointDate = new Date(minTime);
    }

    const range = calculateDateRange(currentBrawlerMode, currentBrawlerChartOffset, firstDataPointDate);

    if (!range) return;

    const { startDate, endDate } = range;
    const isAtStart = (startDate <= firstDataPointDate);
    const options = { day: 'numeric', month: 'short' };

    btnPrev.disabled = isAtStart;
    btnNext.disabled = (currentBrawlerChartOffset === 0);

    if (isHourMode(currentBrawlerMode)) {
        label.innerText = startDate.toLocaleDateString('fr-FR', options);
        if (labelHour) {
            const hStart = startDate.getHours().toString().padStart(2, '0') + ":00";
            const nextHourDate = new Date(startDate);
            nextHourDate.setHours(startDate.getHours() + 1);
            const hEnd = nextHourDate.getHours().toString().padStart(2, '0') + ":00";
            labelHour.innerText = `${hStart} - ${hEnd} 🕓`;
        }
        if (btnPrevHour) btnPrevHour.disabled = isAtStart;
        if (btnNextHour) btnNextHour.disabled = (currentBrawlerChartOffset === 0);
    } else {
        if (currentBrawlerChartOffset === 0) {
            if (currentBrawlerMode === 1)   label.innerText = "Aujourd'hui";
            else if (currentBrawlerMode === 7)   label.innerText = "Cette semaine";
            else if (currentBrawlerMode === 31)  label.innerText = "Ce mois";
            else if (currentBrawlerMode === 365) label.innerText = "Cette année";
            else label.innerText = "Aujourd'hui";
        } else {
            if (currentBrawlerMode === 1)        label.innerText = startDate.toLocaleDateString('fr-FR', options);
            else if (currentBrawlerMode === 31)  label.innerText = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            else if (currentBrawlerMode === 365) label.innerText = startDate.getFullYear();
            else label.innerText = `${startDate.toLocaleDateString('fr-FR', options)} - ${endDate.toLocaleDateString('fr-FR', options)}`;
        }
    }

    if (picker && endDate) picker.value = endDate.toISOString().split('T')[0];
    if (brawlerFlatpickr && endDate) brawlerFlatpickr.setDate(endDate, false);
}

// =========================================================
// === MOTEUR GRAPHIQUE AVANCÉ ===
// =========================================================

function getInterpolatedValue(targetDate, allData) {
    if (!allData || allData.length === 0) return null;

    const targetTs = targetDate.getTime();
    let prev = null, next = null;

    for (let pt of allData) {
        let ptTs = new Date(pt.date).getTime();

        if (ptTs <= targetTs) prev = { ...pt, ts: ptTs };
        if (ptTs >= targetTs && !next) { next = { ...pt, ts: ptTs }; break; }
    }

    if (!prev && next) return next.trophies; 
    
    if (prev && !next) return prev.trophies; 

    if (prev && next) {
        if (prev.ts === next.ts) return prev.trophies;
        const factor = (targetTs - prev.ts) / (next.ts - prev.ts);
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }
    return null;
}

// =========================================================
// === GESTION GRAPH PRINCIPAL ===
// =========================================================

function loadHistoryChart(historyData, currentTrophies) {
    fullHistoryData = historyData || [];
    currentLiveTrophies = currentTrophies;

    manageGenericFilters(fullHistoryData, 'btn');
    setChartMode(0);
}

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;

    const navMain = document.getElementById('chart-navigation');
    const navHour = document.getElementById('chart-navigation-hour');

    if (navMain) {
        if (mode === 0) {
            navMain.classList.add('hidden');
            if (navHour) navHour.classList.add('hidden');
        } else {
            navMain.classList.remove('hidden');
            if (navHour) {
                if (isHourMode(mode)) navHour.classList.remove('hidden');
                else navHour.classList.add('hidden');
            }
        }
    }
    syncPickerWithMode(false, mode, fullHistoryData);
    renderMainChart();
}

function setBrawlerChartMode(mode, liveValOverride) {
    currentBrawlerMode = mode;
    currentBrawlerChartOffset = 0; // FIX BUG-JS-2: Reset de l'offset BRAWLER uniquement

    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-brawler-all';
    if (currentBrawlerMode === 1)         btnId = 'btn-brawler-24h';
    else if (currentBrawlerMode === 7)    btnId = 'btn-brawler-7d';
    else if (currentBrawlerMode === 31)   btnId = 'btn-brawler-31d';
    else if (currentBrawlerMode === 365)  btnId = 'btn-brawler-365d';
    if (isHourMode(currentBrawlerMode))   btnId = 'btn-brawler-1h';

    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');

    const nav     = document.getElementById('brawler-chart-navigation');
    const navHour = document.getElementById('brawler-chart-navigation-hour');

    if (nav) {
        if (mode === 0) {
            nav.classList.add('hidden');
            if (navHour) navHour.classList.add('hidden');
        } else {
            nav.classList.remove('hidden');
            if (navHour) {
                if (isHourMode(mode)) navHour.classList.remove('hidden');
                else navHour.classList.add('hidden');
            }
        }
    }

    let liveVal = liveValOverride;
    if (liveVal === undefined || liveVal === null) {
        const hiddenId = document.getElementById('selected-brawler-id').value;
        if (window.currentBrawlersDisplay) {
            const b = window.currentBrawlersDisplay.find(x => x.id == hiddenId);
            if (b) liveVal = b.trophies;
        }
    }

    window.currentBrawlerLiveVal = liveVal;

    syncPickerWithMode(true, mode, currentBrawlerHistory);
    renderBrawlerChart();
}

function renderBrawlerChart() {
    if (brawlerChartInstance) brawlerChartInstance.destroy();

    // FIX BUG-JS-2: Passe currentBrawlerChartOffset au lieu de currentChartOffset
    brawlerChartInstance = renderGenericChart({
        canvasId: 'brawlerChartCanvas',
        rawData: currentBrawlerHistory,
        mode: currentBrawlerMode,
        offset: currentBrawlerChartOffset,
        liveValue: window.currentBrawlerLiveVal,
        color: '#00d2ff',
        variationId: 'brawler-trophy-variation',
        isBrawler: true
    });

    updateBrawlerNavigationUI(currentBrawlerHistory);
}

function renderMainChart() {
    document.querySelectorAll('.filter-btn:not(.filter-brawler-btn)').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if (currentChartMode === 1)        btnId = 'btn-24h';
    else if (currentChartMode === 7)   btnId = 'btn-7d';
    else if (currentChartMode === 31)  btnId = 'btn-31d';
    else if (currentChartMode === 365) btnId = 'btn-365d';
    if (isHourMode(currentChartMode))  btnId = 'btn-1h';

    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');

    if (window.myChart) window.myChart.destroy();

    window.myChart = renderGenericChart({
        canvasId: 'trophyChart',
        rawData: fullHistoryData,
        mode: currentChartMode,
        offset: currentChartOffset,
        liveValue: currentLiveTrophies,
        color: '#ffce00',
        variationId: 'trophy-variation'
    });
}

// =========================================================
// === FILTRES & NAVIGATION PRINCIPALE ===
// =========================================================

function manageGenericFilters(data, idPrefix) {
    let diffDays = 0;
    if (data && data.length > 0) {
        // Trouver la vraie date la plus ancienne
        const minTime = Math.min(...data.map(item => new Date((item.date || item.recorded_at).replace(' ', 'T') + 'Z').getTime()));
        const oldest = new Date(minTime);
        const now = new Date();
        diffDays = (now - oldest) / (1000 * 60 * 60 * 24);
    }

    const toggle = (suffix, condition) => {
        const el = document.getElementById(`${idPrefix}-${suffix}`);
        if (el) {
            if (condition) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    };

    const isPremium = (currentUserTier === 'premium');
    toggle('1h', diffDays > 0 && isPremium);
    toggle('7d', diffDays >= 1);
    toggle('31d', diffDays > 7);
    toggle('365d', diffDays > 31);
}

function navigateChart(direction) {
    if (isHourMode(currentChartMode)) {
        currentChartOffset += (direction * 24);
    } else {
        currentChartOffset += direction;
    }
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderMainChart();
}

function navigateHour(direction) {
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderMainChart();
}

function navigateMonth(direction) {
    if (currentChartMode !== 31) return;
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderMainChart();
}

function jumpToDate(dateString) {
    if (!dateString) return;

    const parts = dateString.split('-');
    const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = todayMidnight - targetDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) { alert("Impossible de prédire le futur ! 🔮"); return; }

    if (isHourMode(currentChartMode)) {
        const currentHourOffset = currentChartOffset % 24;
        currentChartOffset = (diffDays * 24) + currentHourOffset;
    } else if (currentChartMode === 1) {
        currentChartOffset = diffDays;
    } else if (currentChartMode === 7) {
        const currentMonday = getMonday(todayMidnight);
        const targetMonday  = getMonday(targetDate);
        const diffWeeks = (currentMonday - targetMonday) / (1000 * 60 * 60 * 24 * 7);
        currentChartOffset = Math.round(diffWeeks);
    } else if (currentChartMode === 31) {
        let months = (todayMidnight.getFullYear() - targetDate.getFullYear()) * 12;
        months -= targetDate.getMonth();
        months += todayMidnight.getMonth();
        currentChartOffset = months <= 0 ? 0 : months;
    } else if (currentChartMode === 365) {
        currentChartOffset = todayMidnight.getFullYear() - targetDate.getFullYear();
    }

    renderMainChart();
}

function updateNavigationUI(startDate, endDate, firstDataPointDate) {
    const btnPrev     = document.getElementById('nav-btn-prev');
    const btnNext     = document.getElementById('nav-btn-next');
    const label       = document.getElementById('chart-period-label');
    const picker      = document.getElementById('picker-input-main');
    const btnPrevHour = document.getElementById('nav-btn-prev-hour');
    const btnNextHour = document.getElementById('nav-btn-next-hour');
    const labelHour   = document.getElementById('chart-hour-label');

    if (!btnPrev || !btnNext) return;

    const isAtStart = (startDate <= firstDataPointDate);
    btnPrev.disabled = isAtStart;

    const options = { day: 'numeric', month: 'short' };

    if (isHourMode(currentChartMode)) {
        label.innerText = startDate.toLocaleDateString('fr-FR', options);
        btnNext.disabled = (currentChartOffset === 0);

        if (labelHour) {
            const hStart = startDate.getHours().toString().padStart(2, '0') + ":00";
            const nextHourDate = new Date(startDate);
            nextHourDate.setHours(startDate.getHours() + 1);
            const hEnd = nextHourDate.getHours().toString().padStart(2, '0') + ":00";
            labelHour.innerText = `${hStart} - ${hEnd} 🕓`;
        }

        if (btnPrevHour) btnPrevHour.disabled = isAtStart;
        if (btnNextHour) btnNextHour.disabled = (currentChartOffset === 0);

    } else {
        btnNext.disabled = (currentChartOffset === 0);

        if (currentChartOffset === 0) {
            if (currentChartMode === 1)        label.innerText = "Aujourd'hui";
            else if (currentChartMode === 7)   label.innerText = "Cette semaine";
            else if (currentChartMode === 31)  label.innerText = "Ce mois";
            else if (currentChartMode === 365) label.innerText = "Cette année";
            else label.innerText = "Aujourd'hui";
        } else {
            if (currentChartMode === 1)        label.innerText = startDate.toLocaleDateString('fr-FR', options);
            else if (currentChartMode === 31)  label.innerText = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            else if (currentChartMode === 365) label.innerText = startDate.getFullYear();
            else label.innerText = `${startDate.toLocaleDateString('fr-FR', options)} - ${endDate.toLocaleDateString('fr-FR', options)}`;
        }
    }

    if (picker && endDate) picker.value = endDate.toISOString().split('T')[0];
    if (mainFlatpickr && endDate) mainFlatpickr.setDate(endDate, false);
}

// =========================================================
// === GESTION DU CALENDRIER FLATPICKR ===
// =========================================================

function syncPickerWithMode(isBrawler, mode, historyData) {
    const containerId  = isBrawler ? 'picker-container-brawler' : 'picker-container-main';
    const triggerId    = isBrawler ? 'trigger-picker-brawler'   : 'trigger-picker-main';
    const inputId      = isBrawler ? 'picker-input-brawler'     : 'picker-input-main';

    const container    = document.getElementById(containerId);
    const trigger      = document.getElementById(triggerId);
    const inputElement = document.getElementById(inputId);

    if (!container || !trigger || !inputElement) return;

    let minDate = undefined;
    let daysOfHistory = 0;

    if (historyData && historyData.length > 0) {
        // Calcul propre de la date minimale garantie
        const minTime = Math.min(...historyData.map(item => new Date((item.date || item.recorded_at).replace(' ', 'T') + 'Z').getTime()));
        minDate = new Date(minTime);
        const now = new Date();
        daysOfHistory = (now - minDate) / (1000 * 60 * 60 * 24);
    }

    const isHistoryTooShort = (mode > 0 && daysOfHistory < mode);

    if (mode === 365 || mode === 0 || isHistoryTooShort) {
        container.classList.add('hidden');
        let currentInstance = isBrawler ? brawlerFlatpickr : mainFlatpickr;
        if (currentInstance) {
            currentInstance.destroy();
            if (isBrawler) brawlerFlatpickr = null;
            else mainFlatpickr = null;
        }
        return;
    }

    container.classList.remove('hidden');

    let currentInstance = isBrawler ? brawlerFlatpickr : mainFlatpickr;
    if (currentInstance) {
        currentInstance.destroy();
        if (isBrawler) brawlerFlatpickr = null;
        else mainFlatpickr = null;
    }

    const config = {
        disableMobile: "true",
        clickOpens: false,
        theme: "dark",
        maxDate: new Date(),
        minDate: minDate,
        onChange: function(selectedDates, dateStr) {
            if (selectedDates.length > 0) {
                if (isBrawler) jumpToBrawlerDate(dateStr);
                else jumpToDate(dateStr);
            }
        }
    };

    if (mode === 31) {
        if (typeof monthSelectPlugin !== 'undefined') {
            config.plugins = [new monthSelectPlugin({
                shorthand: true,
                dateFormat: "Y-m-d",
                altFormat: "F Y",
                theme: "dark"
            })];
        } else {
            console.warn("Plugin MonthSelect introuvable");
        }
    } else {
        config.dateFormat = "Y-m-d";
    }

    try {
        const fp = flatpickr(inputElement, config);

        trigger.onclick = () => {
            fp._positionElement = trigger;
            fp.open();
        };

        if (isBrawler) brawlerFlatpickr = fp;
        else mainFlatpickr = fp;

    } catch(e) {
        console.error("Erreur init Flatpickr:", e);
    }
}

// =========================================================
// === GESTION DU CLUB ===
// =========================================================

async function fetchClubDetails(clubTag) {
    try {
        const cleanTag = clubTag.replace('#', '');
        const res = await fetch(`${API_BASE}/api/public/club/${cleanTag}`);
        if (res.ok) {
            const clubData = await res.json();
            renderClubCard(clubData);
        } else {
            document.getElementById('club-card').classList.add('hidden');
        }
    } catch (e) {
        console.error("Erreur chargement club :", e);
        document.getElementById('club-card').classList.add('hidden');
    }
}

function renderClubCard(club) {
    const clubCard = document.getElementById('club-card');
    const badgeId = club.badgeId || 8000000; 
    const membersCount = club.members ? club.members.length : 0;
    const iconUrl = `https://brawlify.com/images/club-badges/96/${badgeId}.webp`;
    
    clubCard.style.cursor = "pointer";
    clubCard.onclick = () => window.location.href = `/club/${club.tag.replace('#', '')}`;
    
    clubCard.innerHTML = `
        <img src="${iconUrl}" class="club-icon" onerror="this.src='/assets/default_icon.png'" alt="Club Icon">
        
        <div class="club-title-area">
            <h3 class="club-name">${club.name}</h3>
            <div class="club-tag">${club.tag}</div>
        </div>
        
        <div class="club-stats-row">
            <div class="club-stat-item trophies" title="Total Trophées du Club">
                <img src="/assets/trophy_normal.png" class="stat-icon">
                <span class="stat-text">${club.trophies.toLocaleString('fr-FR')}</span>
            </div>
            <div class="club-stat-item members" title="Membres du club">
                <span class="stat-icon-emoji">👥</span>
                <span class="stat-text">${membersCount} <span class="max-members">/ 30</span></span>
            </div>
        </div>
        
        <div class="club-deco-glow"></div>
    `;
}

// =========================================================
// === COEUR DU RENDU ===
// =========================================================

function preprocessData(rawData, isBrawler) {
    let processed = [];

    // FIX : On s'assure que les données sont TOUJOURS triées du plus ancien au plus récent.
    // L'API les renvoie souvent en DESC, ce qui cassait l'interpolation et les limites de temps !
    let sortedRaw = [...rawData].sort((a, b) => {
        const dateA = new Date((a.date || a.recorded_at).replace(' ', 'T') + 'Z').getTime();
        const dateB = new Date((b.date || b.recorded_at).replace(' ', 'T') + 'Z').getTime();
        return dateA - dateB;
    });

    sortedRaw.forEach((d, index) => {
        const rawVal = d.trophies;
        let displayVal = rawVal;
        let specialType = 'real';
        let specialLabel = null;

        if (isBrawler) {
            if (rawVal === -1) {
                const nextRaw = (index + 1 < sortedRaw.length) ? sortedRaw[index+1].trophies : null;
                if (nextRaw !== null && nextRaw !== -1) {
                    specialType = 'unlocked';
                    specialLabel = "Débloqué";
                } else {
                    specialType = 'locked';
                }
                displayVal = 0;
            }
        }

        if (index === 0 && specialType !== 'locked' && specialType !== 'unlocked') {
            specialType = 'start';
            specialLabel = `Début : ${displayVal}`;
        }

        processed.push({
            date: (d.date || d.recorded_at).replace(' ', 'T') + 'Z',
            trophies: displayVal,
            customType: specialType,
            customLabel: specialLabel
        });
    });
    
    return processed;
}


function renderGenericChart(config) {
    let { rawData, mode, offset, liveValue, color, canvasId, variationId, isBrawler } = config;

    const processedData = preprocessData(rawData, isBrawler);

    let firstDataPointDate = new Date();
    if (processedData.length > 0) firstDataPointDate = new Date(processedData[0].date);

    let startDate = null;
    let endDate   = null;
    const now = new Date();

    if (mode > 0) {
        const range = calculateDateRange(mode, offset, firstDataPointDate);
        if (range) {
            startDate = range.startDate;
            endDate   = range.endDate;
        }
    }

    if (canvasId === 'trophyChart' && mode > 0) {
        updateNavigationUI(startDate, endDate, firstDataPointDate);
    }

    let finalDataPoints = [];

    if (mode > 0) {
        finalDataPoints = processedData.filter(pt => {
            const d = new Date(pt.date);
            return d >= startDate && d <= endDate;
        }).map(pt => ({
            x: new Date(pt.date),
            y: pt.trophies,
            type: 'real',
            cType: pt.customType,
            cLabel: pt.customLabel
        }));
    } else {
        finalDataPoints = processedData.map(pt => ({
            x: new Date(pt.date),
            y: pt.trophies,
            type: 'real',
            cType: pt.customType,
            cLabel: pt.customLabel
        }));
    }

    if (mode > 0) {
        if (startDate > firstDataPointDate) {
            // FIX : Ne créer un fantôme que s'il n'y a pas déjà un vrai point EXACTEMENT à cette date
            const hasExactStart = finalDataPoints.some(pt => pt.x.getTime() === startDate.getTime());
            if (!hasExactStart) {
                const valLeft = getInterpolatedValue(startDate, processedData);
                if (valLeft !== null) {
                    finalDataPoints.unshift({ x: startDate, y: Math.round(valLeft), type: 'ghost' });
                }
            }
        }

        if (offset === 0) {
            if (liveValue !== null && liveValue !== undefined) {
                finalDataPoints.push({ x: new Date(), y: liveValue, type: 'live', cLabel: 'Actuel' });
            }
        } else {
            if (endDate < now) {
                // FIX : Éviter le doublon à droite
                const hasExactEnd = finalDataPoints.some(pt => pt.x.getTime() === endDate.getTime());
                if (!hasExactEnd) {
                    const valRight = getInterpolatedValue(endDate, processedData);
                    if (valRight !== null) {
                        finalDataPoints.push({ x: endDate, y: Math.round(valRight), type: 'ghost' });
                    }
                }
            }
        }
    } else {
        if (liveValue !== null && liveValue !== undefined) {
            finalDataPoints.push({ x: new Date(), y: liveValue, type: 'live', cLabel: 'Actuel' });
        }
    }

    finalDataPoints.sort((a, b) => a.x - b.x);

    if (variationId && document.getElementById(variationId)) {
        const el = document.getElementById(variationId);
        if (finalDataPoints.length >= 2) {
            const diff = finalDataPoints[finalDataPoints.length - 1].y - finalDataPoints[0].y;
            el.innerHTML = diff > 0
                ? `<span style="color:#28a745">▲ +${diff}</span>`
                : (diff < 0
                    ? `<span style="color:#ff5555">▼ ${diff}</span>`
                    : `<span style="color:#888">= 0</span>`);
        } else {
            el.innerHTML = `<span style="color:#888">--</span>`;
        }
    }

    const getPointColor = (p) => {
        if (p.type === 'ghost') return 'transparent';
        if (p.cType === 'start') return '#007bff';
        if (p.type === 'live') return '#ff5555';
        if (p.cType === 'locked' || p.cType === 'unlocked') return '#ffffff';
        return color;
    };

    const pointColors = finalDataPoints.map(p => getPointColor(p));

    const canvasCtx = document.getElementById(canvasId).getContext('2d');
    let timeUnit = 'day';
    if (isHourMode(mode))                 timeUnit = 'minute';
    else if (mode === 1)                   timeUnit = 'hour';
    else if (mode === 0 || mode === 365)   timeUnit = 'month';

    let scaleMin = undefined;
    let scaleMax = undefined;
    if (mode > 0) {
        scaleMin = startDate;
        scaleMax = endDate;
    }

    return new Chart(canvasCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Trophées',
                data: finalDataPoints,
                backgroundColor: color + '1A',
                borderWidth: 2,
                tension: (mode === 1 || isHourMode(mode)) ? 0 : 0.2,
                fill: true,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointRadius: p => {
                    const r = p.raw;
                    if (!r) return 0;
                    if (r.type === 'ghost') return 0;
                    if (r.type === 'live' || r.cType === 'start' || r.cType === 'unlocked') return 5;
                    return 0;
                },
                pointHoverRadius: p => (p.raw && p.raw.type === 'ghost' ? 0 : 6),
                segment: {
                    borderColor: canvasCtx => {
                        const p1 = finalDataPoints[canvasCtx.p1DataIndex];
                        if (p1 && (p1.cType === 'locked' || p1.cType === 'unlocked')) return '#ffffff';
                        return color;
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const pt = context.raw;
                            if (pt.cLabel) return pt.cLabel;
                            return `Trophées: ${pt.y}`;
                        }
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: {
                x: {
                    type: 'time',
                    min: scaleMin,
                    max: scaleMax,
                    time: {
                        unit: timeUnit,
                        displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd/MM', month: 'MMM yy' }
                    },
                    grid: { color: '#333' }
                },
                y: {
                    grid: { color: '#333' },
                    ticks: { color: '#888' }
                }
            }
        }
    });
}
