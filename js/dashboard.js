// --- VARIABLES GLOBALES ---
var currentChartMode = 0;   // 0=Tout, 1=Jour, 7=Semaine
var currentChartOffset = 0;
var currentTagString = null; 
var fullHistoryData = [];    
var currentLiveTrophies = null;
var globalBrawlersList = []; 

// Variables spécifiques Brawlers
var currentBrawlerHistory = [];
var currentBrawlerMode = 0;
var brawlerChartInstance = null;

// Sécurité pour API_URL
var API_BASE = (typeof API_URL !== 'undefined') ? API_URL : ''; 
if (!API_BASE) console.warn("Attention : API_URL non défini dans config.js");

// --- INITIALISATION DU DASHBOARD ---
async function initDashboard() {
    const urlParams = new URLSearchParams(window.location.search);
    const tag = urlParams.get('tag');

    if (!tag) {
        window.location.href = "index.html";
        return;
    }

    currentTagString = tag.toUpperCase().replace('#', '');
    
    // Charger les données publiques du Tag
    await loadTagData(currentTagString);
    
    // Vérifier si l'utilisateur connecté peut claim ce tag
    checkClaimStatus();
}

// --- CHARGEMENT DONNÉES ---
async function loadTagData(tag) {
    try {
        const res = await fetch(`${API_BASE}/api/public/player/${tag}`);
        
        if (!res.ok) throw new Error("Joueur introuvable");
        
        const data = await res.json();
        
        // 1. Rendu Profil
        renderProfile(data);
        
        // 2. Grille Brawlers
        await loadBrawlersGrid(data.brawlers);
        
        // 3. Graphique Principal (Historique)
        // On stocke les données pour pouvoir filtrer plus tard
        loadHistoryChart(data.history || [], data.trophies);

    } catch (e) {
        console.error(e);
        const nameElem = document.getElementById('player-name');
        if(nameElem) nameElem.innerText = "Erreur / Introuvable";
        alert("Impossible de charger ce tag. Vérifiez qu'il est correct.");
        window.location.href = "index.html";
    }
}

function renderProfile(data) {
    const nameElem = document.getElementById('player-name');
    if(!nameElem) return;
    
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

// --- LOGIQUE CLAIM (Connexion requise) ---
function checkClaimStatus() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const actionsDiv = document.getElementById('header-actions');
    if (!actionsDiv) return;
    
    // Vérifier si le bouton existe déjà pour éviter doublons
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
    if(!confirm("Voulez-vous lier ce Tag à votre compte ?")) return;
    
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/api/claim-tag`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tag: currentTagString })
        });
        
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            window.location.href = "userhome.html";
        } else {
            alert("⚠️ " + data.message);
        }
    } catch (e) {
        alert("Erreur de connexion");
    }
}

// --- GRILLE BRAWLERS ---
async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    if(!grid) return;
    
    if (globalBrawlersList.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/api/brawlers`);
            const data = await res.json();
            globalBrawlersList = data.items || [];
        } catch(e) { console.error("Err brawlers list", e); }
    }
    
    const displayList = globalBrawlersList.map(b => {
        const owned = playerBrawlers.find(pb => pb.id === b.id);
        return { 
            id: b.id, 
            name: b.name, 
            imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png`, 
            owned: !!owned, 
            trophies: owned ? owned.trophies : 0,
            change24h: owned ? (owned.trophy_change_24h || 0) : 0
        };
    });

    window.currentBrawlersDisplay = displayList;
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

// --- NAVIGATION BRAWLER & CHARGEMENT API ---

async function goToBrawlerStats(id, name) {
    // Correction 2: Appel sécurisé à switchView (global)
    if (typeof window.switchView === 'function') {
        window.switchView('brawlers');
    } else {
        console.warn("switchView non défini");
    }

    document.getElementById('selected-brawler-id').value = id;
    document.getElementById('selected-brawler-name').textContent = name;
    
    // Correction 3: Scope "let" au lieu de "var" dans if/else
    let liveBrawlerTrophies = null;
    
    // Image
    const b = window.currentBrawlersDisplay.find(x => x.id == id);
    if(b) {
        document.getElementById('selected-brawler-img').src = b.imageUrl;
        liveBrawlerTrophies = b.trophies;
    } else {
        // Reste null
    }

    // Chargement de l'historique spécifique via la nouvelle API publique
    try {
        const res = await fetch(`${API_BASE}/api/public/player/${currentTagString}/brawler/${id}`);
        if(res.ok) {
            currentBrawlerHistory = await res.json();
        } else {
            currentBrawlerHistory = [];
        }
    } catch(e) {
        console.error("Erreur chargement brawler history", e);
        currentBrawlerHistory = [];
    }

    // Affichage Graphique Brawler
    manageGenericFilters(currentBrawlerHistory, 'btn-brawler');
    
    // On force le mode "Tout" au démarrage
    setBrawlerChartMode(0, liveBrawlerTrophies); 
}


// =========================================================
// === MOTEUR GRAPHIQUE (RESTAURÉ & CORRIGÉ) ===
// =========================================================

// --- Utilitaires Mathématiques ---
function getInterpolatedValue(targetDate, allData) {
    const targetTs = targetDate.getTime();
    let prev = null, next = null;
    for (let pt of allData) {
        // Support des formats de date SQL ou ISO
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
        // Correction 4b: Utilisation de getTime() pour le tri et le groupement
        const dObj = new Date(p.x);
        if (isNaN(dObj)) return;
        const dayKey = dObj.toISOString().split('T')[0]; 
        grouped[dayKey] = p; 
    });
    return Object.values(grouped).sort((a,b) => new Date(a.x) - new Date(b.x));
}

// --- Gestion Graphique Principal ---

function loadHistoryChart(historyData, currentTrophies) {
    fullHistoryData = historyData || [];
    currentLiveTrophies = currentTrophies;
    
    manageGenericFilters(fullHistoryData, 'btn');
    setChartMode(0); // Vue "Tout" par défaut
}

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    renderMainChart();
}

function renderMainChart() {
    // UI Boutons
    document.querySelectorAll('.filter-btn:not(.filter-brawler-btn)').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
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

// --- Gestion Graphique Brawler ---

function setBrawlerChartMode(mode, liveValOverride) {
    currentBrawlerMode = mode;
    
    // UI Boutons
    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-brawler-all';
    if(currentBrawlerMode === 1) btnId = 'btn-brawler-24h';
    else if(currentBrawlerMode === 7) btnId = 'btn-brawler-7d'; 
    
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // Récupération valeur live si non fournie
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

// --- Filtres UI ---

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
}

// --- COEUR DU RENDU ---

function renderGenericChart(config) {
    let { rawData, mode, offset, liveValue, color, canvasId, variationId, isBrawler } = config;
    
    let processedData = [];

    // Normalisation des clés
    rawData.forEach(d => {
        processedData.push({
            date: (d.date || d.recorded_at).replace(' ', 'T'),
            trophies: d.trophies
        });
    });

    // 1. Calcul des bornes temporelles
    let startDate = null;
    let endDate = null;
    let absoluteStartDate = processedData.length > 0 ? new Date(processedData[0].date) : null;
    const now = new Date();

    if (mode > 0) {
        if (mode === 1) { // 24H
            const target = new Date();
            target.setDate(now.getDate() - offset);
            startDate = new Date(target.getTime() - (24 * 60 * 60 * 1000));
            endDate = new Date(); 
        } else if (mode === 7) { // Semaine
            const target = new Date();
            startDate = new Date(target.getTime() - (7 * 24 * 60 * 60 * 1000));
            endDate = new Date();
        }
    }

    // 2. Préparation des points finaux
    let finalDataPoints = [];
    
    // Décimation pour vue "Tout" si beaucoup de données
    const shouldDecimate = (mode === 0 && processedData.length > 100);
    
    let sourceData = mode === 0 ? processedData : processedData.filter(pt => {
        const d = new Date(pt.date);
        return d >= startDate && d <= endDate;
    });

    if (shouldDecimate) {
        let temp = sourceData.map(p => ({ x: p.date, y: p.trophies }));
        sourceData = decimateDataPoints(temp).map(p => ({ date: p.x, trophies: p.y }));
    }

    sourceData.forEach(h => {
        let type = 'real';
        if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
        // Correction 4: Conversion Explicite en Date
        finalDataPoints.push({ x: new Date(h.date), y: h.trophies, type: type });
    });

    // Gestion Fantômes (Interpolation)
    if (mode > 0) {
        if (absoluteStartDate && startDate > absoluteStartDate) {
            const hasPoint = finalDataPoints.some(p => p.x.getTime() >= startDate.getTime() && p.x.getTime() < startDate.getTime() + 60000);
            if (!hasPoint) {
                const val = getInterpolatedValue(startDate, processedData);
                // Correction 4: Date explicite ici aussi
                if (val !== null) finalDataPoints.unshift({ x: new Date(startDate), y: Math.round(val), type: 'ghost' });
            }
        }
    }

    // Point Live (Fin)
    if (liveValue !== null && liveValue !== undefined) {
        // Correction 4: Date explicite pour le live
        finalDataPoints.push({ x: new Date(), y: liveValue, type: 'live' });
    }

    // Tri final
    finalDataPoints.sort((a,b) => a.x - b.x);

    // 3. Calcul Variation
    if (variationId) {
        const varElem = document.getElementById(variationId);
        if (varElem) {
            if (finalDataPoints.length >= 2) {
                const startVal = finalDataPoints[0].y;
                const endVal = finalDataPoints[finalDataPoints.length - 1].y;
                const diff = endVal - startVal;
                
                if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
                else if (diff < 0) varElem.innerHTML = `<span style="color:#ff5555">▼ ${diff}</span>`;
                else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
            } else {
                varElem.innerHTML = `<span style="color:#888">--</span>`;
            }
        }
    }

    // 4. Styles Points
    const pointColors = finalDataPoints.map(p => {
        if (p.type === 'live') return '#ff5555'; 
        if (p.type === 'start') return '#007bff'; 
        return color;
    });
    
    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        if (p.type === 'live') return 5;
        if (shouldDecimate) return 2;
        return 3;
    });

    // 5. Rendu Chart.js
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const ctx2d = ctx.getContext('2d');

    const lineTension = (mode === 1) ? 0 : 0.2;

    return new Chart(ctx2d, {
        type: 'line',
        data: { 
            datasets: [{ 
                label: 'Trophées', 
                data: finalDataPoints, // Contient maintenant des objets Date en x
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
            plugins: { 
                legend: {display:false},
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            if (point.type === 'ghost') return `~ Approx : ${point.y}`;
                            if (point.type === 'live') return `🔴 Actuel : ${point.y}`;
                            return `🏆 ${point.y}`;
                        }
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: { 
                x: { 
                    type: 'time', 
                    time: { 
                        unit: mode === 1 ? 'hour' : 'day',
                        displayFormats: { hour:'HH:mm', day:'dd/MM' },
                        tooltipFormat: 'dd/MM HH:mm'
                    }, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
    });
}
