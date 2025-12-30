// --- VARIABLES GLOBALES ---
let currentChartMode = 0;   // 0=Tout, 1=Jour...
let currentChartOffset = 0; 
let currentTagString = null;

// Variables spécifiques Brawlers
let currentBrawlerHistory = [];
let currentBrawlerMode = 0;
let brawlerChartInstance = null;

// Vérification API
const API_BASE = (typeof API_URL !== 'undefined') ? API_URL : '';

// --- INITIALISATION ---
async function initDashboard() {
    const urlParams = new URLSearchParams(window.location.search);
    const tag = urlParams.get('tag');

    if (!tag) {
        window.location.href = "index.html";
        return;
    }

    currentTagString = tag.toUpperCase().replace('#', '');
    
    // On appelle la fonction de chargement principale
    await loadTagData(currentTagString);

    // Si connecté, on propose de Claim
    checkClaimStatus();
}

// --- CHARGEMENT DONNÉES (Mode Public) ---
async function loadTagData(tag) {
    try {
        // Utilisation de la nouvelle route publique
        const res = await fetch(`${API_BASE}/api/public/player/${tag}`);
        
        if (!res.ok) throw new Error("Joueur introuvable");
        
        const data = await res.json();
        
        // 1. Rendu Profil
        renderProfile(data);
        
        // 2. Grille Brawlers
        await loadBrawlersGrid(data.brawlers);
        
        // 3. Graphique Principal
        // Note: data.history est renvoyé par l'API publique si dispo
        loadHistoryChart(data.history || [], data.trophies);

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

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
        <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
    `;
}

// --- LOGIQUE CLAIM (Si connecté) ---
function checkClaimStatus() {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Ajout bouton claim
    const actionsDiv = document.getElementById('header-actions');
    if(document.getElementById('btn-claim-action')) return;

    const claimBtn = document.createElement('button');
    claimBtn.id = 'btn-claim-action';
    claimBtn.innerText = "⚡ CLAIM";
    claimBtn.style.background = "linear-gradient(to bottom, #ffce00, #e6b800)";
    claimBtn.style.color = "black";
    claimBtn.style.width = "auto";
    claimBtn.style.margin = "0";
    claimBtn.style.padding = "5px 15px";
    claimBtn.style.fontWeight = "bold";
    
    claimBtn.onclick = () => claimTagAction();
    actionsDiv.prepend(claimBtn);
}

async function claimTagAction() {
    if(!confirm("Lier ce tag à votre compte ?")) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/api/claim-tag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tag: currentTagString })
        });
        const data = await res.json();
        if(res.ok) {
            alert("✅ " + data.message);
            window.location.href = "userhome.html";
        } else {
            alert("⚠️ " + data.message);
        }
    } catch(e) { alert("Erreur connexion"); }
}

// --- BRAWLERS GRID ---
async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    if(!grid) return;
    
    // Chargement liste globale si vide
    if (globalBrawlersList.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/api/brawlers`);
            const data = await res.json();
            globalBrawlersList = data.items || [];
        } catch(e) { console.error(e); }
    }
    
    // Mapping
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
        img.alt = b.name;

        const nameDiv = document.createElement('div');
        nameDiv.style.fontSize = '0.8em';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.textContent = b.name; 

        card.appendChild(img);
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

// --- NAVIGATION BRAWLER ---
async function goToBrawlerStats(id, name) {
    if(typeof switchView === 'function') switchView('brawlers');
    
    document.getElementById('selected-brawler-id').value = id;
    document.getElementById('selected-brawler-name').textContent = name;
    
    let liveVal = null;
    const b = window.currentBrawlersDisplay.find(x => x.id == id);
    if(b) {
        document.getElementById('selected-brawler-img').src = b.imageUrl;
        liveVal = b.trophies;
    }

    // Chargement Historique Brawler Public
    try {
        const res = await fetch(`${API_BASE}/api/public/player/${currentTagString}/brawler/${id}`);
        if(res.ok) currentBrawlerHistory = await res.json();
        else currentBrawlerHistory = [];
    } catch(e) { currentBrawlerHistory = []; }

    manageGenericFilters(currentBrawlerHistory, 'btn-brawler');
    setBrawlerChartMode(0, liveVal); 
}

// =========================================================
// === MOTEUR GRAPHIQUE (CONSERVÉ INTACT) ===
// =========================================================

function getInterpolatedValue(targetDate, allData) {
    const targetTs = targetDate.getTime();
    let prev = null, next = null;
    for (let pt of allData) {
        let d = pt.date || pt.recorded_at;
        if(d) d = d.replace(' ', 'T'); 
        let ptTs = new Date(d).getTime();
        
        if (ptTs <= targetTs) prev = { ...pt, ts: ptTs };
        if (ptTs >= targetTs && !next) { next = { ...pt, ts: ptTs }; break; }
    }
    if (prev && next && prev.ts === next.ts) return prev.trophies;
    if (prev && next) {
        const factor = (targetTs - prev.ts) / (next.ts - prev.ts);
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }
    if (prev) return prev.trophies; 
    if (next) return next.trophies;
    return null;
}

function decimateDataPoints(points) {
    const grouped = {};
    points.forEach(p => {
        const dObj = new Date(p.x);
        if (isNaN(dObj)) return;
        const dayKey = dObj.toISOString().split('T')[0]; 
        grouped[dayKey] = p; 
    });
    return Object.values(grouped).sort((a,b) => new Date(a.x) - new Date(b.x));
}

// --- GESTION GRAPH GLOBAL ---

function loadHistoryChart(historyData, currentTrophies) {
    fullHistoryData = historyData || [];
    currentLiveTrophies = currentTrophies;
    
    manageGenericFilters(fullHistoryData, 'btn');
    setChartMode(0);
}

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    renderMainChart();
}

function navigateChart(direction) {
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderMainChart();
}

function navigateMonth(direction) {
    if (currentChartMode !== 1) return;
    const now = new Date();
    const currentDate = new Date();
    currentDate.setDate(now.getDate() - currentChartOffset);
    const targetDate = new Date(currentDate);
    targetDate.setMonth(targetDate.getMonth() - direction); 
    currentChartOffset = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderMainChart();
}

function renderMainChart() {
    // Boutons actifs
    document.querySelectorAll('.filter-btn:not(.filter-brawler-btn)').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    if(window.myChart) window.myChart.destroy();

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

// --- GESTION GRAPH BRAWLER ---

function setBrawlerChartMode(mode, liveValOverride) {
    currentBrawlerMode = mode;
    
    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-brawler-all';
    if(currentBrawlerMode === 1) btnId = 'btn-brawler-24h';
    else if(currentBrawlerMode === 7) btnId = 'btn-brawler-7d'; 
    else if(currentBrawlerMode === 31) btnId = 'btn-brawler-31d';
    else if(currentBrawlerMode === 365) btnId = 'btn-brawler-365d';
    
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    let liveVal = liveValOverride;
    if (liveVal === undefined || liveVal === null) {
        const hiddenId = document.getElementById('selected-brawler-id').value;
        const b = window.currentBrawlersDisplay.find(x => x.id == hiddenId);
        if(b) liveVal = b.trophies;
    }

    if(brawlerChartInstance) brawlerChartInstance.destroy();
    
    brawlerChartInstance = renderGenericChart({
        canvasId: 'brawlerChartCanvas',
        rawData: currentBrawlerHistory,
        mode: currentBrawlerMode,
        offset: 0,
        liveValue: liveVal,
        color: '#00d2ff',
        variationId: 'brawler-trophy-variation',
        isBrawler: true
    });
}

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
        if(el) {
            if(condition) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    };
    toggle('7d', diffDays >= 1);
    toggle('31d', diffDays > 7);
    toggle('365d', diffDays > 31);
}

// --- RENDER GÉNÉRIQUE ---
function renderGenericChart(config) {
    let { rawData, mode, offset, liveValue, color, canvasId, variationId, isBrawler } = config;
    
    let processedData = [];
    rawData.forEach(d => {
        processedData.push({
            date: (d.date || d.recorded_at).replace(' ', 'T'),
            trophies: d.trophies
        });
    });

    // 1. Bornes temporelles
    let startDate = null;
    let endDate = null;
    const now = new Date();

    if (mode > 0) {
        if (mode === 1) { // 24H
            const target = new Date();
            target.setDate(now.getDate() - offset);
            startDate = new Date(target.setHours(0,0,0,0));
            endDate = new Date(target.setHours(23,59,59,999));
        } else if (mode === 7) { // Semaine
            const targetEnd = new Date();
            targetEnd.setDate(now.getDate() - (offset * 7));
            endDate = targetEnd;
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetEnd.getDate() - 7);
            startDate = targetStart;
        } else if (mode === 31) { // Mois
            const target = new Date();
            target.setMonth(now.getMonth() - offset);
            startDate = new Date(target.getFullYear(), target.getMonth(), 1);
            endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);
        } else if (mode === 365) { // Année
            const targetYear = now.getFullYear() - offset;
            startDate = new Date(targetYear, 0, 1);
            endDate = new Date(targetYear, 11, 31, 23, 59, 59);
        }
    }

    // 2. Filtrage & Décimation
    let finalDataPoints = [];
    const shouldHidePoints = (mode === 0 || mode === 365 || mode === 31);

    let sourceData = processedData;
    if (mode > 0) {
        sourceData = processedData.filter(pt => {
            const d = new Date(pt.date);
            return d >= startDate && d <= endDate;
        });
    }

    sourceData.forEach(h => {
        finalDataPoints.push({ x: new Date(h.date), y: h.trophies, type: 'real' });
    });

    // Fantômes / Live
    if (mode > 0 && processedData.length > 0) {
        // Début
        if (startDate > new Date(processedData[0].date)) {
            const val = getInterpolatedValue(startDate, processedData);
            if (val !== null) finalDataPoints.unshift({ x: new Date(startDate), y: Math.round(val), type: 'ghost' });
        }
    }
    
    if (liveValue !== null && liveValue !== undefined && offset === 0) {
        finalDataPoints.push({ x: new Date(), y: liveValue, type: 'live' });
    }

    finalDataPoints.sort((a,b) => a.x - b.x);

    // 3. Variation
    if (variationId) {
        const varElem = document.getElementById(variationId);
        if (varElem) {
            if (finalDataPoints.length >= 2) {
                const startVal = finalDataPoints[0].y;
                const endVal = finalDataPoints[finalDataPoints.length - 1].y;
                const diff = endVal - startVal;
                varElem.innerHTML = diff > 0 ? `<span style="color:#28a745">▲ +${diff}</span>` : 
                                   (diff < 0 ? `<span style="color:#ff5555">▼ ${diff}</span>` : `<span style="color:#888">= 0</span>`);
            } else varElem.innerHTML = `<span style="color:#888">--</span>`;
        }
    }

    // 4. Styles
    const pointColors = finalDataPoints.map(p => p.type === 'live' ? '#ff5555' : color);
    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        if (p.type === 'live') return 5;
        if (shouldHidePoints) return 0;
        return 3;
    });

    // 5. Chart.js
    let timeUnit = 'day';
    if (mode === 1) timeUnit = 'hour';
    else if (mode === 0 || mode === 365) timeUnit = 'month';

    const ctx = document.getElementById(canvasId).getContext('2d');
    const lineTension = (mode === 1) ? 0 : 0.2;

    return new Chart(ctx, {
        type: 'line',
        data: { 
            datasets: [{ 
                label: 'Trophées', 
                data: finalDataPoints, 
                borderColor: color, 
                backgroundColor: color + '1A', 
                borderWidth: 2, 
                tension: lineTension,
                fill: true,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointRadius: pointRadiuses,
                pointHoverRadius: 6
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: {display:false} },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: { 
                x: { 
                    type: 'time', 
                    time: { unit: timeUnit, displayFormats: { hour:'HH:mm', day:'dd/MM', month:'MMM yy' }}, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
    });
}
