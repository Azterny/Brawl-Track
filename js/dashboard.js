// --- VARIABLES GLOBALES ---
let currentChartMode = 0;   // 0=Tout, 1=Jour... (Principal)
let currentChartOffset = 0; // Décalage (Principal)

// Variables spécifiques Brawlers
let currentBrawlerHistory = [];
let currentBrawlerMode = 0;
let brawlerChartInstance = null; // Instance Chart.js Brawler

// --- CHARGEMENT PRINCIPAL (DASHBOARD) ---
// js/dashboard.js

async function loadMyStats() {
    const token = localStorage.getItem('token');
    let data;

    // --- BLOC 1 : CRITIQUE (Authentification & Données de base) ---
    // Si ça échoue ici, c'est que le token est invalide -> Logout
    try {
        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session invalide ou expirée");
        
        data = await res.json();
        
        // Configuration de base
        currentUserTier = data.internal_tier || 'basic';
        window.currentUpdateInterval = data.internal_interval; 

        renderProfile(data);
        
        const badge = document.getElementById('tier-badge');
        if(badge) badge.classList.remove('hidden');
        
        if(typeof setupIntervalUI === 'function') setupIntervalUI(data.internal_tier, data.internal_interval);

    } catch (e) { 
        console.error("⛔ Erreur Critique (Auth):", e);
        logout(); // On ne déconnecte QUE si l'API refuse l'accès
        return;   // On arrête tout
    }

    // --- BLOC 2 : SECONDAIRE (Interface & Graphiques) ---
    // Si ça échoue ici, on affiche une erreur dans la console MAIS ON NE DÉCONNECTE PAS
    
    // 2.1 Charger la grille des brawlers (et attendre la fin)
    try {
        await loadBrawlersGrid(data.brawlers);
    } catch (e) {
        console.warn("⚠️ Erreur chargement Grille Brawlers:", e);
    }
    
    // 2.2 Charger le graphique historique
    try {
        unlockChart();
        loadHistoryChart(token, data.trophies);
    } catch (e) {
        console.warn("⚠️ Erreur chargement Graphique:", e);
    }
    
    // 2.3 Initialiser l'autocomplétion
    try {
        initBrawlerSelector();
    } catch (e) {
        console.warn("⚠️ Erreur init Autocomplétion:", e);
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

    document.getElementById('player-tag').innerText = data.tag;
    const badge = document.getElementById('tier-badge');
    badge.className = `badge badge-${currentUserTier}`;
    badge.innerText = currentUserTier === 'subscriber' ? 'Abonné' : currentUserTier;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
        <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
    `;
}

// --- BRAWLERS GRID (ACCUEIL) ---
async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    if(!grid) return;
    
    const res = await fetch(`${API_URL}/api/brawlers`);
    const data = await res.json();
    
    globalBrawlersList = (data.items || []).map(b => {
        const owned = playerBrawlers.find(pb => pb.id === b.id);
        return { 
            id: b.id, name: b.name, 
            imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png`, 
            owned: !!owned, trophies: owned ? owned.trophies : 0 
        };
    });
    sortBrawlers();
    initBrawlerSelector(); // Met à jour le menu déroulant si besoin
}

function sortBrawlers() {
    const criteria = document.getElementById('sort-brawlers').value;
    globalBrawlersList.sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? -1 : 1; 
        if (criteria === 'trophies') return b.trophies - a.trophies;
        else if (criteria === 'name') return a.name.localeCompare(b.name);
        else return a.id - b.id; 
    });
    renderBrawlersGrid();
}

function renderBrawlersGrid() {
    const grid = document.getElementById('brawlers-grid');
    grid.innerHTML = '';
    globalBrawlersList.forEach(b => {
        const d = document.createElement('div');
        d.className = 'brawler-card';
        if (!b.owned) d.style.filter = "grayscale(100%) opacity(0.3)";
        else d.style.border = "1px solid #ffce00";
        d.innerHTML = `
            <img src="${b.imageUrl}" style="width:100%; aspect-ratio:1/1; object-fit:contain;" loading="lazy">
            <div style="font-size:0.8em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.name}</div>
            ${b.owned ? `<div style="color:#ffce00;font-size:0.7em;">🏆 ${b.trophies}</div>` : ''}
        `;
        grid.appendChild(d);
    });
}

// --- UTILITAIRES CHART ---
function lockChart() {
    const content = document.getElementById('chart-content-wrapper');
    const overlay = document.getElementById('chart-lock-overlay');
    if(content) content.classList.add('blur-content');
    if(overlay) overlay.classList.remove('hidden');
}

function unlockChart() {
    const content = document.getElementById('chart-content-wrapper');
    const overlay = document.getElementById('chart-lock-overlay');
    if(content) content.classList.remove('blur-content');
    if(overlay) overlay.classList.add('hidden');
}

function manageGenericFilters(data, idPrefix) {
    // 1. Gestion du bouton 1H (Premium uniquement)
    const btn1h = document.getElementById(`${idPrefix}-1h`);
    if(btn1h) {
        if (currentUserTier === 'premium') btn1h.classList.remove('hidden');
        else btn1h.classList.add('hidden');
    }

    // 2. Gestion Temporelle (Semaine, Mois, Année)
    let diffDays = 0;
    if (data && data.length > 0) {
        // CORRECTION DATE : On remplace l'espace par T pour compatibilité iOS/Safari
        const dateStr = data[0].date.replace(' ', 'T'); 
        const oldest = new Date(dateStr);
        const now = new Date();
        
        // Calcul de la différence en jours
        diffDays = (now - oldest) / (1000 * 60 * 60 * 24);
    }

    // Helper pour afficher/cacher
    const toggle = (suffix, condition) => {
        const el = document.getElementById(`${idPrefix}-${suffix}`);
        if(el) {
            if(condition) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    };

    // Logique d'affichage (>= 1 jour pour afficher la semaine)
    toggle('7d', diffDays >= 1);
    toggle('31d', diffDays > 7);
    toggle('365d', diffDays > 31);
}

// === MATHS : INTERPOLATION & DÉCIMATION ===
function getInterpolatedValue(targetDate, allData) {
    const targetTs = targetDate.getTime();
    let prev = null, next = null;
    for (let pt of allData) {
        let ptTs = new Date(pt.date).getTime();
        if (ptTs <= targetTs) prev = pt;
        if (ptTs >= targetTs && !next) { next = pt; break; }
    }
    if (prev && prev === next) return prev.trophies;
    if (prev && next) {
        const prevTs = new Date(prev.date).getTime();
        const nextTs = new Date(next.date).getTime();
        if ((nextTs - prevTs) === 0) return prev.trophies;
        const factor = (targetTs - prevTs) / (nextTs - prevTs);
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }
    if (prev) return prev.trophies; 
    if (next) return next.trophies;
    return null;
}

function decimateDataPoints(points) {
    const grouped = {};
    points.forEach(p => {
        const d = p.date || p.x; 
        if (!d) return; 
        const dayKey = d.split('T')[0]; 
        grouped[dayKey] = p; 
    });
    return Object.values(grouped).sort((a,b) => new Date(a.date || a.x) - new Date(b.date || b.x));
}


// =========================================================
// === CŒUR DU SYSTÈME : MOTEUR DE GRAPHIQUE GÉNÉRIQUE ===
// =========================================================

function renderGenericChart(config) {
    /* config = {
         canvasId: 'trophyChart',
         rawData: [...],
         mode: 0, 1, 7...,
         offset: 0,
         liveValue: 1234 (optionnel),
         color: '#ffce00',
         variationId: 'trophy-variation',
         labelId: 'chart-period-label',
         // ... autres options d'UI
       }
    */

    const { rawData, mode, offset, liveValue, color, canvasId, variationId } = config;
    
    // 1. Calcul des bornes temporelles
    let startDate = null;
    let endDate = null;
    let absoluteStartDate = rawData.length > 0 ? new Date(rawData[0].date) : null;
    const now = new Date();

    if (mode > 0) {
        if (mode < 0.1) { // 1H
            const target = new Date();
            target.setHours(now.getHours() - offset);
            startDate = new Date(target.setMinutes(0, 0, 0));
            endDate = new Date(target.setMinutes(59, 59, 999));
        } else if (mode === 1) { // 24H
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

    // 2. Préparation des points
    let finalDataPoints = [];
    const shouldDecimate = (mode === 0 || mode === 365);
    const shouldHidePoints = shouldDecimate;

    if (mode === 0) {
        // Mode TOUT
        let source = shouldDecimate ? decimateDataPoints(rawData) : rawData;
        source.forEach(h => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });
        if (liveValue !== null && liveValue !== undefined) 
            finalDataPoints.push({ x: new Date().toISOString(), y: liveValue, type: 'live' });
    } else {
        // Mode Plages (avec interpolation)
        let inRange = rawData.filter(i => {
            const d = new Date(i.date);
            return d >= startDate && d <= endDate;
        });
        if (shouldDecimate) inRange = decimateDataPoints(inRange);

        inRange.forEach(h => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });

        // Fantôme Début
        if (absoluteStartDate && startDate > absoluteStartDate) {
            const hasPoint = finalDataPoints.some(p => new Date(p.x).getTime() === startDate.getTime());
            if (!hasPoint) {
                const val = getInterpolatedValue(startDate, rawData);
                if (val !== null) finalDataPoints.unshift({ x: startDate.toISOString(), y: Math.round(val), type: 'ghost' });
            }
        }
        // Fantôme Fin / Live
        if (offset === 0) {
            if (liveValue !== null && liveValue !== undefined) 
                finalDataPoints.push({ x: new Date().toISOString(), y: liveValue, type: 'live' });
        } else {
            const val = getInterpolatedValue(endDate, rawData);
            if (val !== null) finalDataPoints.push({ x: endDate.toISOString(), y: Math.round(val), type: 'ghost' });
        }
    }

    finalDataPoints.sort((a,b) => new Date(a.x) - new Date(b.x));

    // 3. Calcul Variation
    if (variationId) {
        const varElem = document.getElementById(variationId);
        if (varElem) {
            if (finalDataPoints.length >= 2) {
                const startVal = finalDataPoints[0].y;
                const endVal = finalDataPoints[finalDataPoints.length - 1].y;
                const diff = endVal - startVal;
                if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
                else if (diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
                else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
            } else varElem.innerHTML = `<span style="color:#888">--</span>`;
        }
    }

    // 4. Styles
    const pointColors = finalDataPoints.map(p => {
        if (p.type === 'live') return '#ff5555';
        if (p.type === 'start') return '#007bff';
        return color;
    });
    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        if (p.type === 'live' || p.type === 'start') return 5;
        if (shouldHidePoints) return 0;
        return 3;
    });

    // 5. Rendu Chart.js
    let timeUnit = 'day';
    if (mode < 0.1) timeUnit = 'minute';
    else if (mode === 1) timeUnit = 'hour';
    else if (mode === 0 || mode === 365) timeUnit = 'month';

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    
    // Destruction instance existante (géré par l'appelant via variable globale ou retour)
    
    return new Chart(ctx, {
        type: 'line',
        data: { 
            datasets: [{ 
                label: 'Trophées', 
                data: finalDataPoints, 
                borderColor: color, 
                backgroundColor: color + '1A', // Ajoute 10% d'opacité hex
                borderWidth: 2, 
                tension: 0.2, 
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
                            if (point.type === 'ghost') return `~ Environ : ${point.y}`;
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
                    min: mode > 0 ? startDate : undefined,
                    max: mode > 0 ? endDate : undefined,
                    time: { unit: timeUnit, displayFormats: { minute:'HH:mm', hour:'HH:mm', day:'dd/MM', month:'MMM yy' }}, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
    });
}


// =========================================================
// === GESTION DU GRAPHIQUE PRINCIPAL (GLOBAL) ===
// =========================================================

async function loadHistoryChart(token, liveTrophies) {
    if (!token) { lockChart(); fullHistoryData = []; return; }

    currentLiveTrophies = liveTrophies;
    try {
        const res = await fetch(`${API_URL}/api/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) fullHistoryData = await res.json();
        else fullHistoryData = [];
    } catch(e) { fullHistoryData = []; }
    
    // APPEL DE LA NOUVELLE FONCTION (Préfixe 'btn' pour les IDs btn-7d, btn-31d...)
    manageGenericFilters(fullHistoryData, 'btn');
    
    setChartMode(0);

    let lastDate = fullHistoryData.length > 0 ? fullHistoryData[fullHistoryData.length - 1].date : null;
    if(typeof updateNextArchiveTimer === 'function' && window.currentUpdateInterval) {
        updateNextArchiveTimer(lastDate, window.currentUpdateInterval);
    }
}

function manageFilterButtons() {
    const btn1h = document.getElementById('btn-1h');
    if (currentUserTier === 'premium') btn1h.classList.remove('hidden');
    else btn1h.classList.add('hidden');
    // ... logique suppression boutons 7d/31d si historique trop court ...
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

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    renderMainChart();
}

// Fonction wrapper pour le graph principal
function renderMainChart() {
    // UI Boutons
    document.querySelectorAll('.filter-btn:not(.filter-brawler-btn)').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode < 0.1 && currentChartMode > 0) btnId = 'btn-1h';
    else if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // UI Labels & Nav (Simplifié pour l'exemple)
    // ... (Code de gestion des labels chart-period-label / month-label identique à l'ancien dashboard.js) ...
    
    if(window.myChart) window.myChart.destroy();

    // APPEL GÉNÉRIQUE
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
// === GESTION DU GRAPHIQUE BRAWLERS (NOUVEAU) ===
// =========================================================

// --- NOUVELLE FONCTION D'AUTOCOMPLÉTION ---
function initBrawlerSelector() {
    const input = document.getElementById('brawler-search-input');
    const hiddenInput = document.getElementById('brawler-select-dashboard');
    const listContainer = document.getElementById('brawler-dropdown-list');

    if (!input || !listContainer || !hiddenInput) return;

    // Si on a déjà des données chargées
    if (typeof globalBrawlersList !== 'undefined' && globalBrawlersList.length > 0) {
        // 1. Filtrer et Trier les Brawlers possédés
        const owned = globalBrawlersList.filter(b => b.owned).sort((a, b) => b.trophies - a.trophies);
        
        if (owned.length === 0) {
            input.value = "Aucun brawler possédé";
            input.disabled = true;
            return;
        }

        // 2. Fonction pour générer la liste HTML
        const renderList = (filterText = "") => {
            listContainer.innerHTML = "";
            const lowerFilter = filterText.toLowerCase();

            owned.forEach(b => {
                // Filtrage
                if (b.name.toLowerCase().includes(lowerFilter)) {
                    const item = document.createElement('div');
                    item.className = 'dropdown-item';
                    item.innerHTML = `
                        <span style="font-weight:bold;">${b.name}</span>
                        <span style="opacity:0.7;">🏆 ${b.trophies}</span>
                    `;
                    
                    // Clic sur un item
                    item.onclick = () => {
                        selectBrawler(b);
                    };
                    listContainer.appendChild(item);
                }
            });

            // Message si aucun résultat
            if (listContainer.children.length === 0) {
                listContainer.innerHTML = '<div style="padding:10px; color:#888; text-align:center;">Aucun résultat</div>';
            }
        };

        // 3. Fonction de sélection
        const selectBrawler = (brawler) => {
            input.value = brawler.name;       // Affiche le nom
            hiddenInput.value = brawler.id;   // Sauvegarde l'ID
            listContainer.classList.add('hidden'); // Cache la liste
            loadSelectedBrawlerStats();       // Lance le chargement du graph
        };

        // 4. Initialisation (Sélectionner le premier par défaut)
        if (!hiddenInput.value) {
            selectBrawler(owned[0]);
        }

        // 5. Gestion des Événements (Recherche)
        
        // Quand on tape dans l'input
        input.oninput = () => {
            renderList(input.value);
            listContainer.classList.remove('hidden');
        };

        // Quand on clique sur l'input (afficher tout)
        input.onfocus = () => {
            input.select(); // Sélectionne tout le texte pour faciliter le remplacement
            renderList(""); // Affiche tout
            listContainer.classList.remove('hidden');
        };

        // Fermer la liste si on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !listContainer.contains(e.target)) {
                listContainer.classList.add('hidden');
                // Si l'utilisateur a tapé un truc invalide, on remet le nom du brawler actuel
                const currentId = hiddenInput.value;
                const currentBrawler = owned.find(b => b.id == currentId);
                if (currentBrawler) input.value = currentBrawler.name;
            }
        });
    }
}

async function loadSelectedBrawlerStats() {
    const select = document.getElementById('brawler-select-dashboard');
    const brawlerId = select.value;
    if(!brawlerId) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/api/my-brawler-history/${brawlerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        currentBrawlerHistory = res.ok ? await res.json() : [];
        
        // APPEL DE LA NOUVELLE FONCTION (Préfixe 'btn-brawler' pour btn-brawler-7d...)
        manageGenericFilters(currentBrawlerHistory, 'btn-brawler');
        
        setBrawlerChartMode(0); 
    } catch(e) { console.error(e); }
}

function setBrawlerChartMode(mode) {
    currentBrawlerMode = mode;
    renderBrawlerChart();
}

function renderBrawlerChart() {
    // Gestion Active Class sur les boutons Brawler
    // On retire 'active' de tous les boutons brawlers
    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    
    // On détermine quel ID activer
    let btnId = 'btn-brawler-all';
    if(currentBrawlerMode < 0.1 && currentBrawlerMode > 0) btnId = 'btn-brawler-1h';
    else if(currentBrawlerMode === 1) btnId = 'btn-brawler-24h';
    else if(currentBrawlerMode === 7) btnId = 'btn-brawler-7d';
    else if(currentBrawlerMode === 31) btnId = 'btn-brawler-31d';
    else if(currentBrawlerMode === 365) btnId = 'btn-brawler-365d';
    
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    if(brawlerChartInstance) brawlerChartInstance.destroy();

    // ... (Le reste de la fonction renderBrawlerChart reste identique) ...
    const select = document.getElementById('brawler-select-dashboard');
    let liveVal = null;
    if(select && globalBrawlersList) {
        const b = globalBrawlersList.find(i => i.id == select.value);
        if(b) liveVal = b.trophies;
    }

    brawlerChartInstance = renderGenericChart({
        canvasId: 'brawlerChartCanvas',
        rawData: currentBrawlerHistory,
        mode: currentBrawlerMode,
        offset: 0,
        liveValue: liveVal,
        color: '#00d2ff', 
        variationId: 'brawler-trophy-variation'
    });
}

// --- PUBLIC ---
async function loadPublicProfile(tag) {
    document.getElementById('public-actions').classList.remove('hidden');
    document.getElementById('burger-menu').classList.add('hidden');
    try {
        const res = await fetch(`${API_URL}/api/public/player/${tag}`);
        const data = await res.json();
        currentUserTier = 'basic'; 
        renderProfile(data);
        const badge = document.getElementById('tier-badge');
        if(badge) badge.classList.add('hidden');
        loadBrawlersGrid(data.brawlers);
        loadHistoryChart(null, data.trophies);
    } catch (e) { alert("Joueur introuvable"); }
}

function publicSearch() {
    const tag = document.getElementById('public-tag').value.trim().replace('#', '');
    if(tag) window.location.href = `dashboard.html?tag=${tag}`;
}
