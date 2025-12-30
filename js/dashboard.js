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
    document.title = `Brawl Track - #${currentTagString} - Statistiques`;
    
    // Récupération du Tier Utilisateur (si connecté) pour le bouton 1H
    await fetchUserTier();

    // On appelle la fonction de chargement principale
    await loadTagData(currentTagString);

    // Si connecté, on propose de Claim
    checkClaimStatus();
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
            // On met à jour la variable globale définie dans config.js
            if(data.tier) currentUserTier = data.tier;
        }
    } catch(e) { console.log("Guest mode"); }
}

// --- CHARGEMENT DONNÉES (Mode Public) ---
async function loadTagData(tag) {
    try {
        const res = await fetch(`${API_BASE}/api/public/player/${tag}`);
        if (!res.ok) throw new Error("Joueur introuvable");
        const data = await res.json();
        
        renderProfile(data);
        await loadBrawlersGrid(data.brawlers);
        
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

// --- LOGIQUE CLAIM ---
function checkClaimStatus() {
    const token = localStorage.getItem('token');
    if (!token) return;

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

    try {
        const res = await fetch(`${API_BASE}/api/public/player/${currentTagString}/brawler/${id}`);
        if(res.ok) currentBrawlerHistory = await res.json();
        else currentBrawlerHistory = [];
    } catch(e) { currentBrawlerHistory = []; }

    manageGenericFilters(currentBrawlerHistory, 'btn-brawler');
    setBrawlerChartMode(0, liveVal); 
}

// =========================================================
// === MOTEUR GRAPHIQUE AVANCÉ ===
// =========================================================

function getInterpolatedValue(targetDate, allData) {
    if (!allData || allData.length === 0) return null;
    
    const targetTs = targetDate.getTime();
    let prev = null, next = null;

    // Récupération points bornes
    for (let pt of allData) {
        let d = pt.date || pt.recorded_at;
        if(d) d = d.replace(' ', 'T'); 
        let ptTs = new Date(d).getTime();
        
        if (ptTs <= targetTs) prev = { ...pt, ts: ptTs };
        if (ptTs >= targetTs && !next) { next = { ...pt, ts: ptTs }; break; }
    }

    // Interpolation impossible hors bornes (Respect Règle 4)
    if (!prev && next) return null; // Avant le début
    if (prev && !next) return null; // Après la fin

    // Interpolation standard
    if (prev && next) {
        if(prev.ts === next.ts) return prev.trophies;
        const factor = (targetTs - prev.ts) / (next.ts - prev.ts);
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }
    return null;
}

// --- GESTION GRAPH ---

function loadHistoryChart(historyData, currentTrophies) {
    fullHistoryData = historyData || [];
    currentLiveTrophies = currentTrophies;
    
    manageGenericFilters(fullHistoryData, 'btn');
    setChartMode(0);
}

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    const nav = document.getElementById('chart-navigation');
    if (nav) {
        if (mode === 0) nav.classList.add('hidden');
        else nav.classList.remove('hidden');
    }
    renderMainChart();
}

function setBrawlerChartMode(mode, liveValOverride) {
    currentBrawlerMode = mode;
    currentChartOffset = 0; 
    
    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-brawler-all';
    if(currentBrawlerMode === 1) btnId = 'btn-brawler-24h';
    else if(currentBrawlerMode === 7) btnId = 'btn-brawler-7d'; 
    else if(currentBrawlerMode === 31) btnId = 'btn-brawler-31d';
    else if(currentBrawlerMode === 365) btnId = 'btn-brawler-365d';
    if(Math.abs(currentBrawlerMode - 0.042) < 0.001) btnId = 'btn-brawler-1h';

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

function renderMainChart() {
    document.querySelectorAll('.filter-btn:not(.filter-brawler-btn)').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    if(Math.abs(currentChartMode - 0.042) < 0.001) btnId = 'btn-1h'; 

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

// --- FILTRES & NAVIGATION ---

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
    
    // Règle 1: 1H visible uniquement si Premium
    const isPremium = (typeof currentUserTier !== 'undefined' && currentUserTier === 'premium');
    toggle('1h', diffDays > 0 && isPremium); 
    
    toggle('7d', diffDays >= 1);
    toggle('31d', diffDays > 7);
    toggle('365d', diffDays > 31);
}

function navigateChart(direction) {
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
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffTime = now - targetDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24); 
    
    if (diffDays < 0) { alert("Impossible de prédire le futur ! 🔮"); return; }

    if (currentChartMode === 1) currentChartOffset = Math.floor(diffDays);
    else if (currentChartMode === 7) currentChartOffset = Math.floor(diffDays / 7);
    else if (currentChartMode === 31) {
        let months = (now.getFullYear() - targetDate.getFullYear()) * 12;
        months -= targetDate.getMonth();
        months += now.getMonth();
        currentChartOffset = months <= 0 ? 0 : months;
    } else if (currentChartMode === 365) currentChartOffset = now.getFullYear() - targetDate.getFullYear();

    renderMainChart();
}

function updateNavigationUI(startDate, endDate, firstDataPointDate) {
    const btnPrev = document.getElementById('nav-btn-prev');
    const btnNext = document.getElementById('nav-btn-next');
    const label = document.getElementById('chart-period-label');
    const picker = document.getElementById('chart-date-picker');

    if (!btnPrev || !btnNext) return;

    // Règle 4: Navigation bornée (Pas avant début)
    btnPrev.disabled = (startDate <= firstDataPointDate);

    // Pas après maintenant (Offset 0)
    if (currentChartOffset === 0) {
        btnNext.disabled = true;
        label.innerText = "Aujourd'hui";
    } else {
        btnNext.disabled = false;
        const options = { day: 'numeric', month: 'short' };
        
        if (currentChartMode === 1 || Math.abs(currentChartMode - 0.042) < 0.001) {
             label.innerText = startDate.toLocaleDateString('fr-FR', options);
        } else if (currentChartMode === 31) {
             label.innerText = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        } else if (currentChartMode === 365) {
             label.innerText = startDate.getFullYear();
        } else {
             label.innerText = `${startDate.toLocaleDateString('fr-FR', options)} - ${endDate.toLocaleDateString('fr-FR', options)}`;
        }
    }
    if(picker) picker.value = endDate.toISOString().split('T')[0];
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

        // Règle 2: Gestion Points (Brawlers)
        // Le point "Débloqué" est le DERNIER point à -1, avant que les valeurs passent à >= 0
        if (isBrawler) {
            if (rawVal === -1) {
                // On regarde le prochain point dans la liste brute
                const nextRaw = (index + 1 < rawData.length) ? rawData[index+1].trophies : null;
                
                // Si le prochain n'est pas -1 (donc on change d'état), alors C'EST le moment du déblocage
                if (nextRaw !== null && nextRaw !== -1) {
                    specialType = 'unlocked';
                    specialLabel = "Débloqué";
                } else {
                    specialType = 'locked';
                }
                displayVal = 0; // Visuellement ramené à 0
            }
        }

        // Règle 2: Le tout premier point de l'historique est "Début" (Bleu)
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
    
    // Récupération borne absolue des données (pour bloquer nav)
    let firstDataPointDate = new Date();
    if (processedData.length > 0) firstDataPointDate = new Date(processedData[0].date);

    // 2. Calcul Bornes Temporelles (Start/End View)
    let startDate = null;
    let endDate = null;
    const now = new Date();

    if (mode > 0) {
        if (Math.abs(mode - 0.042) < 0.001) { // 1H
             startDate = new Date(now.getTime() - (60 * 60 * 1000));
             endDate = now;
        } else if (mode === 1) { // 24H
            const target = new Date();
            target.setDate(now.getDate() - offset);
            startDate = new Date(target.setHours(0,0,0,0));
            endDate = new Date(target.setHours(23,59,59,999));
        } else if (mode === 7) { // Semaine
            const currentDay = now.getDay(); 
            const distanceToSunday = (currentDay === 0 ? 0 : 7 - currentDay);
            const targetEnd = new Date(now);
            targetEnd.setDate(now.getDate() + distanceToSunday - (offset * 7));
            targetEnd.setHours(23,59,59,999);
            endDate = targetEnd;
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetEnd.getDate() - 6);
            targetStart.setHours(0,0,0,0);
            startDate = targetStart;
        } else if (mode === 31) { // Mois
            const target = new Date();
            target.setMonth(now.getMonth() - offset);
            startDate = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0);
            endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);
        } else if (mode === 365) { // Année
            const targetYear = now.getFullYear() - offset;
            startDate = new Date(targetYear, 0, 1, 0, 0, 0);
            endDate = new Date(targetYear, 11, 31, 23, 59, 59);
        }
    }

    if (canvasId === 'trophyChart' && mode > 0) {
        updateNavigationUI(startDate, endDate, firstDataPointDate);
    }
    
    // 3. Construction des Points
    let finalDataPoints = [];
    
    // a) Points Réels dans la vue
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

    // b) Points Fantômes (Règle 4: Pas de fantôme hors zone donnée)
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
            // On vérifie qu'on ne dépasse pas "Maintenant" avec le fantôme
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

    finalDataPoints.sort((a,b) => a.x - b.x);

    // Variation
    if (variationId && document.getElementById(variationId)) {
        const el = document.getElementById(variationId);
        if (finalDataPoints.length >= 2) {
            const diff = finalDataPoints[finalDataPoints.length - 1].y - finalDataPoints[0].y;
            el.innerHTML = diff > 0 ? `<span style="color:#28a745">▲ +${diff}</span>` : 
                           (diff < 0 ? `<span style="color:#ff5555">▼ ${diff}</span>` : `<span style="color:#888">= 0</span>`);
        } else el.innerHTML = `<span style="color:#888">--</span>`;
    }

    // 4. Styles (Couleurs & Segments)
    const getPointColor = (p) => {
        if (p.type === 'ghost') return 'transparent';
        if (p.cType === 'start') return '#007bff'; // Bleu Début
        if (p.type === 'live') return '#ff5555';
        if (p.cType === 'locked' || p.cType === 'unlocked') return '#ffffff'; // Blanc
        return color;
    };

    const pointColors = finalDataPoints.map(p => getPointColor(p));
    
    // Règle: Cacher points sur grandes périodes (sauf spéciaux)
    // Mode 0 inclus
    const shouldHidePoints = (mode >= 7 || mode === 0); 

    const ctx = document.getElementById(canvasId).getContext('2d');
    let timeUnit = 'day';
    if (Math.abs(mode - 0.042) < 0.001) timeUnit = 'minute';
    else if (mode === 1) timeUnit = 'hour';
    else if (mode === 0 || mode === 365) timeUnit = 'month';

    // Règle 3: Plage complète (Min/Max forcés)
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
                // Tension (Courbe) : Arrondie pour mode 0 aussi (mode !== 0 enlevé)
                // Seul 1H et 24H (mode <= 1 mais > 0) restent carrés
                tension: (mode === 1 || (mode < 1 && mode > 0)) ? 0 : 0.2,
                fill: true,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                // Visibilité des points
                pointRadius: p => {
                    const r = p.raw;
                    if (r.type === 'ghost') return 0;
                    if (r.type === 'live' || r.cType === 'start' || r.cType === 'unlocked') return 5; 
                    if (shouldHidePoints) return 0; // Masqué si > Jour OU Tout
                    return 3;
                },
                pointHoverRadius: p => (p.raw.type === 'ghost' ? 0 : 6),
                
                // Règle 2: Courbe Blanche si points débloqués
                segment: {
                    borderColor: ctx => {
                        const p1 = finalDataPoints[ctx.p1DataIndex]; 
                        // Si le point cible est 'locked' ou 'unlocked', ligne blanche
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
                legend: {display:false},
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
                    min: scaleMin, // Règle 3
                    max: scaleMax, // Règle 3
                    time: { unit: timeUnit, displayFormats: { minute:'HH:mm', hour:'HH:mm', day:'dd/MM', month:'MMM yy' }}, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
    });
}
