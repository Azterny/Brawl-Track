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
// === MOTEUR GRAPHIQUE (OPTIMISÉ FANTÔMES) ===
// =========================================================

/**
 * Calcule une valeur estimée à une date précise en se basant sur les points existants.
 * Gère l'exception : Si targetDate < Premier point connu, retourne la valeur du premier point.
 */
function getInterpolatedValue(targetDate, allData) {
    if (!allData || allData.length === 0) return 0;

    const targetTs = targetDate.getTime();
    
    // Convertir les données en format utilisable avec Timestamp
    // On suppose que allData est trié chronologiquement
    const points = allData.map(d => {
        let dateStr = (d.date || d.recorded_at).replace(' ', 'T');
        return { ts: new Date(dateStr).getTime(), val: d.trophies };
    });

    // Exception : Si la date cible est AVANT le tout premier enregistrement
    // On renvoie la valeur du premier enregistrement (Effet plateau au début)
    if (targetTs <= points[0].ts) {
        return points[0].val;
    }

    // Recherche des voisins (Précédent et Suivant)
    let prev = null, next = null;
    for (let pt of points) {
        if (pt.ts <= targetTs) prev = pt;
        if (pt.ts >= targetTs && !next) { next = pt; break; }
    }
    
    // Cas exact ou limites
    if (prev && next && prev.ts === next.ts) return prev.val; // Tombé pile sur un point
    if (!next) return prev ? prev.val : 0; // Au-delà du dernier point

    // Interpolation linéaire standard
    if (prev && next) {
        const factor = (targetTs - prev.ts) / (next.ts - prev.ts);
        return Math.round(prev.val + (next.val - prev.val) * factor);
    }
    
    return 0;
}

// --- RENDER GÉNÉRIQUE ---
function renderGenericChart(config) {
    let { rawData, mode, offset, liveValue, color, canvasId, variationId } = config;
    
    // Préparation des données brutes
    let processedData = [];
    rawData.forEach(d => {
        processedData.push({
            date: (d.date || d.recorded_at).replace(' ', 'T'),
            trophies: d.trophies
        });
    });
    // Tri indispensable pour l'interpolation
    processedData.sort((a,b) => new Date(a.date) - new Date(b.date));

    // 1. DÉFINITION DES BORNES TEMPORELLES (MODE CALENDRIER)
    let startDate = null;
    let endDate = null;
    const now = new Date();

    if (mode > 0) {
        if (mode === 0.042) { // 1H (Heure fixe : HH:00 à HH:59)
            // Note: offset déplace d'heure en heure
            const target = new Date();
            target.setHours(target.getHours() - offset);
            startDate = new Date(target.setMinutes(0, 0, 0)); // 0min 0s
            endDate = new Date(target.setMinutes(59, 59, 999)); // 59min 59s
            
        } else if (mode === 1) { // 24H / JOUR (00:00 à 23:59)
            const target = new Date();
            target.setDate(now.getDate() - offset);
            startDate = new Date(target.setHours(0, 0, 0, 0));
            endDate = new Date(target.setHours(23, 59, 59, 999));

        } else if (mode === 7) { // SEMAINE (Lundi 00:00 à Dimanche 23:59)
            const target = new Date();
            target.setDate(now.getDate() - (offset * 7));
            
            // Trouver le Lundi de cette semaine cible
            // (getDay: Dim=0, Lun=1... Sam=6)
            const day = target.getDay();
            const diff = target.getDate() - day + (day === 0 ? -6 : 1); // Ajustement pour Lundi start
            
            const monday = new Date(target.setDate(diff));
            startDate = new Date(monday.setHours(0, 0, 0, 0));
            
            const sunday = new Date(startDate);
            sunday.setDate(startDate.getDate() + 6);
            endDate = new Date(sunday.setHours(23, 59, 59, 999));

        } else if (mode === 31) { // MOIS (1er 00:00 au Dernier 23:59)
            const target = new Date();
            target.setMonth(now.getMonth() - offset);
            startDate = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0);
            endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);

        } else if (mode === 365) { // ANNÉE (1er Jan au 31 Déc)
            const targetYear = now.getFullYear() - offset;
            startDate = new Date(targetYear, 0, 1, 0, 0, 0);
            endDate = new Date(targetYear, 11, 31, 23, 59, 59);
        }
    } else {
        // Mode "TOUT" (Pas de bornes fixes, s'adapte aux données)
        if (processedData.length > 0) {
            startDate = new Date(processedData[0].date);
            endDate = new Date(); // Jusqu'à maintenant
        } else {
            startDate = new Date(); endDate = new Date();
        }
    }

    // Mise à jour de la barre de navigation UI
    if (canvasId === 'trophyChart' && mode > 0 && typeof updateNavigationUI === 'function') {
        updateNavigationUI(startDate, endDate);
    }

    // 2. CONSTRUCTION DES POINTS
    let finalDataPoints = [];
    
    // A. POINT FANTÔME GAUCHE (Début de période)
    // Toujours présent si on est en mode fenêtré (mode > 0)
    if (mode > 0 && processedData.length > 0) {
        const valStart = getInterpolatedValue(startDate, processedData);
        finalDataPoints.push({ x: startDate, y: valStart, type: 'ghost' });
    }

    // B. POINTS RÉELS (Filtrés)
    let sourceData = processedData;
    if (mode > 0) {
        sourceData = processedData.filter(pt => {
            const d = new Date(pt.date);
            return d >= startDate && d <= endDate;
        });
    }
    // Décimation seulement pour l'année pour éviter la surcharge
    if (mode === 365) {
        let temp = sourceData.map(p => ({ x: p.date, y: p.trophies }));
        sourceData = decimateDataPoints(temp).map(p => ({ date: p.x, trophies: p.y }));
    }

    sourceData.forEach(h => {
        finalDataPoints.push({ x: new Date(h.date), y: h.trophies, type: 'real' });
    });

    // C. POINT FANTÔME DROITE (Fin de période)
    // Règle : On ne l'ajoute QUE si on n'est pas sur la période actuelle (offset > 0)
    // Si offset == 0, on veut le "trou" jusqu'à maintenant/fin de journée
    if (mode > 0 && offset > 0 && processedData.length > 0) {
        const valEnd = getInterpolatedValue(endDate, processedData);
        finalDataPoints.push({ x: endDate, y: valEnd, type: 'ghost' });
    }

    // D. POINT LIVE
    // S'affiche uniquement si offset == 0 (Aujourd'hui)
    if (offset === 0 && liveValue !== null && liveValue !== undefined) {
        finalDataPoints.push({ x: new Date(), y: liveValue, type: 'live' });
    }

    // Tri final chronologique (Ghost -> Real -> Live -> Ghost)
    finalDataPoints.sort((a,b) => a.x - b.x);


    // 3. CALCUL VARIATION (Sur la période affichée)
    if (variationId) {
        const varElem = document.getElementById(variationId);
        if (varElem && finalDataPoints.length >= 2) {
            // On compare le dernier point visible (Live ou Ghost Fin) au premier (Ghost Début)
            const startVal = finalDataPoints[0].y;
            const endVal = finalDataPoints[finalDataPoints.length - 1].y;
            const diff = endVal - startVal;
            
            varElem.innerHTML = diff > 0 ? `<span style="color:#28a745">▲ +${diff}</span>` : 
                               (diff < 0 ? `<span style="color:#ff5555">▼ ${diff}</span>` : `<span style="color:#888">= 0</span>`);
        } else if (varElem) {
            varElem.innerHTML = `<span style="color:#888">--</span>`;
        }
    }

    // 4. CONFIGURATION GRAPHIQUE
    const pointColors = finalDataPoints.map(p => p.type === 'live' ? '#ff5555' : color);
    
    // Gestion visuelle des points
    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0; // Invisible
        if (p.type === 'live') return 5;  // Gros point rouge
        if (mode === 0 || mode === 365 || mode === 31) return 0; // Cache les points réels sur vues larges
        return 3; // Points normaux
    });

    // Gestion des zones de clic (HitRadius)
    const pointHitRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0; // Non cliquable
        return 10; // Cliquable
    });

    // Configuration Chart.js
    let timeUnit = 'day';
    if (mode === 0.042) timeUnit = 'minute';
    else if (mode === 1) timeUnit = 'hour';
    else if (mode === 0 || mode === 365) timeUnit = 'month';

    const ctx = document.getElementById(canvasId).getContext('2d');
    const lineTension = (mode <= 1) ? 0 : 0.2; // Ligne droite pour 1H/24H, courbe pour le reste

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
                pointHoverRadius: pointRadiuses.map(r => r > 0 ? 6 : 0), // Pas de hover si radius 0
                pointHitRadius: pointHitRadiuses // Applique la règle "non cliquable"
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: {display:false},
                tooltip: {
                    filter: function(tooltipItem) {
                        // Empêche le tooltip de s'afficher sur un point ghost
                        return tooltipItem.raw.type !== 'ghost';
                    },
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
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
                        unit: timeUnit, 
                        displayFormats: { minute:'HH:mm', hour:'HH:mm', day:'dd/MM', month:'MMM yy' },
                        tooltipFormat: 'dd/MM/yyyy HH:mm'
                    }, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
    });
}

// Fonction utilitaire pour décimer (inchangée mais nécessaire si absente)
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
