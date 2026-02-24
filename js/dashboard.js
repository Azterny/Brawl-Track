// =========================================================
// === CONSTANTES & VARIABLES GLOBALES ===
// =========================================================

// FIX: Toutes les variables globales sont désormais explicitement déclarées ici.
// L'absence de ces déclarations causait des ReferenceError en mode strict
// (modules ES6, 'use strict') car les variables étaient utilisées avant
// d'être affectées, parfois dans des fonctions appelées avant l'affectation.

// OPT: Constante nommée pour le mode 1H (remplace le "magic number" 0.042).
// L'ancienne valeur 0.042 était une approximation de 1/24, utilisée 15+ fois
// dans le fichier avec Math.abs(mode - 0.042) < 0.001, ce qui était illisible
// et risqué si la valeur changeait. On garde la même valeur numérique pour
// la compatibilité avec le HTML existant (les boutons appellent setChartMode(0.042)).
const CHART_MODE_HOUR = 0.042;

// FIX: Déclarations globales manquantes
let currentChartMode = 0;       // 0=Tout, 1=Jour...
let currentChartOffset = 0;
let currentTagString = null;
let mainFlatpickr = null;
let brawlerFlatpickr = null;
let currentUserId = null;

// NOTE: currentUserTier, globalBrawlersList, fullHistoryData, currentLiveTrophies
// et myChart sont déjà déclarés avec `let` dans config.js (chargé avant dashboard.js).
// Les redéclarer ici causerait un SyntaxError "already declared" qui bloquerait
// le chargement de tout ce fichier — c'est exactement ce qui rendait le dashboard vide.
// Ces variables sont donc utilisées directement sans re-déclaration.

// Variables spécifiques Brawlers
let currentBrawlerHistory = [];
let currentBrawlerMode = 0;
let brawlerChartInstance = null;

// Vérification API
const API_BASE = (typeof API_URL !== 'undefined') ? API_URL : '';

// =========================================================
// === HELPER: isHourMode ===
// =========================================================

/**
 * OPT: Fonction utilitaire centralisée pour tester le mode 1H.
 * Remplace les 15+ occurrences de Math.abs(mode - 0.042) < 0.001
 * dispersées dans le fichier. Utilise la constante CHART_MODE_HOUR.
 */
function isHourMode(mode) {
    return Math.abs(mode - CHART_MODE_HOUR) < 0.001;
}

// =========================================================
// === HELPER: calculateDateRange ===
// =========================================================

/**
 * OPT: Calcul centralisé des bornes temporelles start/end pour un mode+offset donné.
 * Élimine la duplication de ~80 lignes de logique identique entre
 * renderGenericChart(), updateNavigationUI() et updateBrawlerNavigationUI().
 *
 * @param {number} mode    - Mode graphique (0=All, CHART_MODE_HOUR, 1, 7, 31, 365)
 * @param {number} offset  - Décalage dans le passé (en unités du mode)
 * @param {Date}   firstDataPointDate - Première date de l'historique (pour le mode 1H)
 * @returns {{ startDate: Date, endDate: Date } | null} - null si mode === 0 (Tout)
 */
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

        // Clamping au premier point d'historique disponible
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

    if (mode === 1) { // 24H — vue journalière
        const target = new Date();
        target.setDate(now.getDate() - offset);
        const startDate = new Date(target.setHours(0, 0, 0, 0));
        const endDate = new Date(target.setHours(23, 59, 59, 999));
        return { startDate, endDate };
    }

    if (mode === 7) { // Semaine
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

    if (mode === 31) { // Mois
        const target = new Date();
        target.setMonth(now.getMonth() - offset);
        return {
            startDate: new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0),
            endDate:   new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59)
        };
    }

    if (mode === 365) { // Année
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
    const tag = urlParams.get('tag');

    if (!tag) {
        window.location.href = "index.html";
        return;
    }

    currentTagString = tag.toUpperCase().replace('#', '');
    document.title = `Brawl Track - #${currentTagString} - Statistiques`;

    await fetchUserTier();
    await loadTagData(currentTagString);
    initFollowSystem(currentTagString);
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
        document.getElementById('player-name').innerText = "Erreur / Introuvable";
        alert("Impossible de charger ce tag.");
        window.location.href = "index.html";
    }
}

function renderProfile(data) {
    const nameElem = document.getElementById('player-name');
    nameElem.innerText = data.name;

    if (data.nameColor) {
        let color = data.nameColor;
        if (color.startsWith('0x')) color = '#' + (color.length >= 10 ? color.slice(4) : color.slice(2));
        nameElem.style.color = color;
        nameElem.style.textShadow = `0 0 15px ${color}66`;
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

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
        <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
    `;
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

    // État 3 : RESERVED (Violet)
    if (tagData.is_reserved) {
        btn.innerText = "🔒 RESERVED";
        btn.className = "btn-3d btn-purple";
        btn.disabled = true;
        btn.style.cursor = "not-allowed";
        actionsDiv.prepend(btn);
        return;
    }

    // État 5 : UNCLAIM (Rouge - C'est mon tag)
    if (tagData.claimer_id === currentUserId) {
        btn.innerText = "❌ UNCLAIM";
        btn.className = "btn-3d btn-red";
        btn.onclick = () => unclaimTagAction();
        actionsDiv.prepend(btn);
        return;
    }

    // État 2 : CLAIMED (Gris - À quelqu'un d'autre)
    if (tagData.claimer_id && tagData.claimer_id !== currentUserId) {
        btn.innerText = "👤 CLAIMED";
        btn.className = "btn-3d btn-grey";
        btn.disabled = true;
        btn.style.cursor = "not-allowed";
        actionsDiv.prepend(btn);
        return;
    }

    // État 4 : CLAIM (Jaune - Libre)
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
            // OPT: Mise à jour locale du bouton sans recharger toute la page
            // (évite de refaire tous les appels API + re-render des charts)
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
            // OPT: Mise à jour locale du bouton sans recharger toute la page
            checkClaimStatus({ claimer_id: null, is_reserved: false });
        } else {
            alert("⚠️ " + data.message);
        }
    } catch(e) { alert("Erreur connexion"); }
}

// =========================================================
// === GESTION DU BOUTON FOLLOW (Add-on) ===
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
            card.style.border = "1px solid #ffce00";
            card.style.cursor = "pointer";
            card.onclick = () => goToBrawlerStats(b.id, b.name);
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
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.textContent = b.name;
        card.appendChild(nameDiv);

        if (b.owned) {
            const trophyDiv = document.createElement('div');
            trophyDiv.style.color = '#ffce00';
            trophyDiv.style.fontSize = '0.7em';
            trophyDiv.style.marginTop = '2px';
            trophyDiv.textContent = `🏆 ${b.trophies}`;
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
// === NAVIGATION BRAWLER CHART ===
// =========================================================

function navigateBrawlerChart(direction) {
    // OPT: isHourMode() remplace Math.abs(currentBrawlerMode - 0.042) < 0.001
    if (isHourMode(currentBrawlerMode)) {
        currentChartOffset += (direction * 24);
    } else {
        currentChartOffset += direction;
    }
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderBrawlerChart();
}

function navigateBrawlerHour(direction) {
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0;
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

    // OPT: isHourMode() remplace Math.abs(currentBrawlerMode - 0.042) < 0.001
    if (isHourMode(currentBrawlerMode)) {
        const currentHourOffset = currentChartOffset % 24;
        currentChartOffset = (diffDays * 24) + currentHourOffset;
    } else if (currentBrawlerMode === 1) {
        currentChartOffset = diffDays;
    } else if (currentBrawlerMode === 7) {
        const currentMonday = getMonday(todayMidnight);
        const targetMonday  = getMonday(targetDate);
        const diffWeeks = (currentMonday - targetMonday) / (1000 * 60 * 60 * 24 * 7);
        currentChartOffset = Math.round(diffWeeks);
    } else if (currentBrawlerMode === 31) {
        let months = (todayMidnight.getFullYear() - targetDate.getFullYear()) * 12;
        months -= targetDate.getMonth();
        months += todayMidnight.getMonth();
        currentChartOffset = months <= 0 ? 0 : months;
    } else if (currentBrawlerMode === 365) {
        currentChartOffset = todayMidnight.getFullYear() - targetDate.getFullYear();
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
        let d = data[0].date || data[0].recorded_at;
        firstDataPointDate = new Date(d.replace(' ', 'T'));
    }

    // OPT: Utilise calculateDateRange() au lieu de dupliquer la logique
    const range = calculateDateRange(currentBrawlerMode, currentChartOffset, firstDataPointDate);

    if (!range) return; // Mode 0 (Tout) — pas de navigation

    const { startDate, endDate } = range;
    const isAtStart = (startDate <= firstDataPointDate);
    const options = { day: 'numeric', month: 'short' };

    btnPrev.disabled = isAtStart;
    btnNext.disabled = (currentChartOffset === 0);

    // OPT: isHourMode() remplace Math.abs(currentBrawlerMode - 0.042) < 0.001
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
        if (btnNextHour) btnNextHour.disabled = (currentChartOffset === 0);
    } else {
        if (currentChartOffset === 0) {
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
        let d = pt.date || pt.recorded_at;
        if (d) d = d.replace(' ', 'T');
        let ptTs = new Date(d).getTime();

        if (ptTs <= targetTs) prev = { ...pt, ts: ptTs };
        if (ptTs >= targetTs && !next) { next = { ...pt, ts: ptTs }; break; }
    }

    if (!prev && next) return null;
    if (prev && !next) return null;

    if (prev && next) {
        if (prev.ts === next.ts) return prev.trophies;
        const factor = (targetTs - prev.ts) / (next.ts - prev.ts);
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }
    return null;
}

// =========================================================
// === GESTION GRAPH ===
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
                // OPT: isHourMode() remplace Math.abs(mode - 0.042) < 0.001
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
    currentChartOffset = 0;

    // Mise à jour visuelle des boutons filtres
    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-brawler-all';
    if (currentBrawlerMode === 1)         btnId = 'btn-brawler-24h';
    else if (currentBrawlerMode === 7)    btnId = 'btn-brawler-7d';
    else if (currentBrawlerMode === 31)   btnId = 'btn-brawler-31d';
    else if (currentBrawlerMode === 365)  btnId = 'btn-brawler-365d';
    // OPT: isHourMode() remplace Math.abs(currentBrawlerMode - 0.042) < 0.001
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
                // OPT: isHourMode() remplace Math.abs(mode - 0.042) < 0.001
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

    brawlerChartInstance = renderGenericChart({
        canvasId: 'brawlerChartCanvas',
        rawData: currentBrawlerHistory,
        mode: currentBrawlerMode,
        offset: currentChartOffset,
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
    // OPT: isHourMode() remplace Math.abs(currentChartMode - 0.042) < 0.001
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
// === FILTRES & NAVIGATION ===
// =========================================================

function manageGenericFilters(data, idPrefix) {
    let diffDays = 0;
    if (data && data.length > 0) {
        let d = data[0].date || data[0].recorded_at;
        const dateStr = d.replace(' ', 'T');
        const oldest = new Date(dateStr);
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

    // Règle 1: 1H visible uniquement si Premium
    const isPremium = (currentUserTier === 'premium');
    toggle('1h', diffDays > 0 && isPremium);

    toggle('7d', diffDays >= 1);
    toggle('31d', diffDays > 7);
    toggle('365d', diffDays > 31);
}

function navigateChart(direction) {
    // OPT: isHourMode() remplace Math.abs(currentChartMode - 0.042) < 0.001
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

    // OPT: isHourMode() remplace Math.abs(currentChartMode - 0.042) < 0.001
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

    // OPT: isHourMode() remplace Math.abs(currentChartMode - 0.042) < 0.001
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
// === GESTION DU CALENDRIER INTELLIGENT (FLATPICKR) ===
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
        const d = historyData[0].date || historyData[0].recorded_at;
        if (d) {
            minDate = new Date(d.replace(' ', 'T'));
            const now = new Date();
            daysOfHistory = (now - minDate) / (1000 * 60 * 60 * 24);
        }
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
// === COEUR DU RENDU ===
// =========================================================

function preprocessData(rawData, isBrawler) {
    let processed = [];

    rawData.forEach((d, index) => {
        const rawVal = d.trophies;
        let displayVal = rawVal;
        let specialType = 'real';
        let specialLabel = null;

        if (isBrawler) {
            if (rawVal === -1) {
                const nextRaw = (index + 1 < rawData.length) ? rawData[index+1].trophies : null;
                if (nextRaw !== null && nextRaw !== -1) {
                    specialType = 'unlocked';
                    specialLabel = "Débloqué";
                } else {
                    specialType = 'locked';
                }
                displayVal = 0;
            }
        }

        if (index === 0) {
            specialType = 'start';
            specialLabel = `Début : ${displayVal}`;
        }

        processed.push({
            date: (d.date || d.recorded_at).replace(' ', 'T'),
            trophies: displayVal,
            customType: specialType,
            customLabel: specialLabel
        });
    });
    return processed;
}

function renderGenericChart(config) {
    let { rawData, mode, offset, liveValue, color, canvasId, variationId, isBrawler } = config;

    // 1. Pré-traitement (Start, Lock, Unlock)
    const processedData = preprocessData(rawData, isBrawler);

    let firstDataPointDate = new Date();
    if (processedData.length > 0) firstDataPointDate = new Date(processedData[0].date);

    // 2. Calcul Bornes Temporelles — OPT: utilise calculateDateRange()
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

    // 3. Construction des Points
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

    // Points Fantômes (Ghost Points)
    if (mode > 0) {
        // GAUCHE : Seulement si startDate > début historique
        if (startDate > firstDataPointDate) {
            const valLeft = getInterpolatedValue(startDate, processedData);
            if (valLeft !== null) {
                finalDataPoints.unshift({ x: startDate, y: Math.round(valLeft), type: 'ghost' });
            }
        }

        // DROITE : Seulement si offset > 0 (Passé)
        if (offset === 0) {
            // Live Point (Actuel)
            if (liveValue !== null && liveValue !== undefined) {
                finalDataPoints.push({ x: new Date(), y: liveValue, type: 'live', cLabel: 'Actuel' });
            }
        } else {
            if (endDate < now) {
                const valRight = getInterpolatedValue(endDate, processedData);
                if (valRight !== null) {
                    finalDataPoints.push({ x: endDate, y: Math.round(valRight), type: 'ghost' });
                }
            }
        }
    } else {
        // Mode 0 (Tout)
        if (liveValue !== null && liveValue !== undefined) {
            finalDataPoints.push({ x: new Date(), y: liveValue, type: 'live', cLabel: 'Actuel' });
        }
    }

    finalDataPoints.sort((a, b) => a.x - b.x);

    // Calcul Variation
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

    // 4. Styles (Couleurs & Segments)
    const getPointColor = (p) => {
        if (p.type === 'ghost') return 'transparent';
        if (p.cType === 'start') return '#007bff';
        if (p.type === 'live') return '#ff5555';
        if (p.cType === 'locked' || p.cType === 'unlocked') return '#ffffff';
        return color;
    };

    const pointColors = finalDataPoints.map(p => getPointColor(p));

    const ctx = document.getElementById(canvasId).getContext('2d');
    let timeUnit = 'day';
    // OPT: isHourMode() remplace Math.abs(mode - 0.042) < 0.001
    if (isHourMode(mode))                 timeUnit = 'minute';
    else if (mode === 1)                   timeUnit = 'hour';
    else if (mode === 0 || mode === 365)   timeUnit = 'month';

    let scaleMin = undefined;
    let scaleMax = undefined;
    if (mode > 0) {
        scaleMin = startDate;
        scaleMax = endDate;
    }

    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Trophées',
                data: finalDataPoints,
                backgroundColor: color + '1A',
                borderWidth: 2,
                // OPT: isHourMode() remplace Math.abs(mode - ...) < 0.001
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
                    borderColor: ctx => {
                        const p1 = finalDataPoints[ctx.p1DataIndex];
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
