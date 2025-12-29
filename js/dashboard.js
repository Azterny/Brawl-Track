// --- VARIABLES GLOBALES ---
let currentChartMode = 0;   // 0=Tout, 1=Jour... (Principal)
let currentChartOffset = 0; // Décalage (Principal)
let currentActiveTagId = null;

// Variables spécifiques Brawlers
let currentBrawlerHistory = [];
let currentBrawlerMode = 0;
let brawlerChartInstance = null; // Instance Chart.js Brawler

// --- CHARGEMENT PRINCIPAL (DASHBOARD) ---
async function loadMyStats() {
    try {
        const token = localStorage.getItem('token');
        // Appel standard (sans paramètre = charge le premier tag par défaut)
        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session invalide");
        
        const data = await res.json();
        
        // --- GESTION MULTI-TAGS ---
        if (data.tags && data.tags.length > 0) {
            // L'API nous dit quel tag elle a chargé via active_tag_id
            currentActiveTagId = data.active_tag_id;
            setupAccountSwitcher(data.tags);
        } else {
            // Cas sans tags ou fallback
            document.getElementById('account-selector-container').innerHTML = 
                `<div style="color: #888; font-size: 0.9em; margin-top:5px;">${data.tag || 'Aucun Tag'}</div>`;
        }

        // --- RENDU UI ---
        currentUserTier = data.internal_tier || 'basic';
        window.currentUpdateInterval = data.internal_interval; 

        renderProfile(data);
        
        const badge = document.getElementById('tier-badge');
        if(badge) badge.classList.remove('hidden');
        
        if(typeof setupIntervalUI === 'function') setupIntervalUI(data.internal_tier, data.internal_interval);

        await loadBrawlersGrid(data.brawlers);
        
        unlockChart();
        
        // IMPORTANT : On passe l'ID actif pour charger le bon historique
        loadHistoryChart(token, data.trophies, currentActiveTagId);

    } catch (e) { 
        console.error(e);
        // logout(); // À décommenter en prod
    }
}

function setupAccountSwitcher(tags) {
    const container = document.getElementById('account-selector-container');
    if(!container) return; 

    if (tags.length <= 1) {
        // Un seul tag : Affichage simple texte
        // On cherche le tag actif dans la liste pour afficher son nom
        const activeTagName = tags.find(t => t.id == currentActiveTagId)?.tag || "Tag";
        container.innerHTML = `<div id="player-tag" style="color: #888; font-size: 0.9em; margin-top: 5px;">${activeTagName}</div>`;
        return;
    }

    // Plusieurs tags : Création du Select
    let html = `<select id="tag-switcher" onchange="switchAccount(this.value)" 
        style="margin-top: 5px; padding: 4px 8px; background: #252525; color: #fff; border: 1px solid #444; border-radius: 6px; font-size: 0.9em; cursor: pointer; outline: none;">`;
    
    tags.forEach(t => {
        const isSelected = (t.id == currentActiveTagId) ? 'selected' : '';
        html += `<option value="${t.id}" ${isSelected}>${t.tag}</option>`;
    });
    
    html += `</select>`;
    container.innerHTML = html;
}

async function switchAccount(newTagId) {
    // Feedback visuel (Loader léger)
    document.getElementById('player-name').innerText = "Chargement...";
    const statsArea = document.getElementById('stats-area');
    if(statsArea) statsArea.style.opacity = '0.5';
    
    const token = localStorage.getItem('token');

    try {
        // Appel avec paramètre tag_id
        const res = await fetch(`${API_URL}/api/my-stats?tag_id=${newTagId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            
            // Mise à jour ID actif
            currentActiveTagId = data.active_tag_id;
            
            // Rafraîchir UI
            renderProfile(data);
            await loadBrawlersGrid(data.brawlers);
            
            // Reset Graphique
            if(window.myChart) window.myChart.destroy();
            loadHistoryChart(token, data.trophies, currentActiveTagId);
            
            if(statsArea) statsArea.style.opacity = '1';
        }
    } catch(e) {
        console.error("Erreur switch compte", e);
        alert("Impossible de changer de compte.");
        if(statsArea) statsArea.style.opacity = '1';
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
            owned: !!owned, 
            trophies: owned ? owned.trophies : 0,
            change24h: owned ? (owned.trophy_change_24h || 0) : 0 // Récupération de la variation
        };
    });
    sortBrawlers();
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
    if (!grid) return;
    
    grid.innerHTML = ''; 
    
    globalBrawlersList.forEach(b => {
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

            // Affichage des flèches
            if (b.change24h > 0) {
                const arrow = document.createElement('span');
                arrow.textContent = ' ↗'; 
                arrow.style.color = '#28a745';
                arrow.style.fontWeight = 'bold';
                trophyDiv.appendChild(arrow);
            } else if (b.change24h < 0) {
                const arrow = document.createElement('span');
                arrow.textContent = ' ↘'; 
                arrow.style.color = '#ff5555';
                arrow.style.fontWeight = 'bold';
                trophyDiv.appendChild(arrow);
            }
            
            card.appendChild(trophyDiv);
        }

        grid.appendChild(card);
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
    let { rawData, mode, offset, liveValue, color, canvasId, variationId, isBrawler } = config;
    
    // --- SPECIFIQUE BRAWLER : Gestion Déblocage ---
    let unlockTs = null;
    if (isBrawler && rawData.length > 0) {
        const firstPoint = rawData[0];
        if (firstPoint.trophies === -1) {
            const u = rawData.find(d => d.trophies > -1);
            if (u) {
                unlockTs = new Date(u.date).getTime();
            } else {
                unlockTs = Number.MAX_SAFE_INTEGER;
            }
        }
        // Nettoyer les données : -1 devient 0 pour le dessin
        rawData = rawData.map(d => ({
            ...d,
            trophies: d.trophies === -1 ? 0 : d.trophies
        }));
    }

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
    
    // <--- AMÉLIORATION : On cache les points pour Tout, Année et MOIS (31)
    const shouldHidePoints = (mode === 0 || mode === 365 || mode === 31);

    if (mode === 0) {
        // Mode TOUT
        let source = shouldDecimate ? decimateDataPoints(rawData) : rawData;
        source.forEach(h => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            
            // Logique Brawler Unlock
            if (isBrawler && unlockTs !== null) {
                const t = new Date(h.date).getTime();
                if (t === unlockTs) type = 'unlock';
                else if (t < unlockTs) type = 'locked';
            }

            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });
        if (liveValue !== null && liveValue !== undefined) 
            finalDataPoints.push({ x: new Date().toISOString(), y: liveValue, type: 'live' });
    } else {
        // Mode Plages
        let inRange = rawData.filter(i => {
            const d = new Date(i.date);
            return d >= startDate && d <= endDate;
        });
        if (shouldDecimate) inRange = decimateDataPoints(inRange);

        inRange.forEach(h => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            
            // Logique Brawler Unlock
            if (isBrawler && unlockTs !== null) {
                const t = new Date(h.date).getTime();
                if (t === unlockTs) type = 'unlock';
                else if (t < unlockTs) type = 'locked';
            }

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

    // 4. Styles (Couleurs)
    const pointColors = finalDataPoints.map(p => {
        if (p.type === 'live') return '#ff5555';
        if (isBrawler && p.type === 'unlock') return '#ffffff'; 
        if (isBrawler && p.type === 'locked') return '#ffffff'; 
        if (p.type === 'start') return '#007bff'; 
        return color;
    });
    
    // Styles (Rayons)
    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        if (isBrawler && p.type === 'unlock') return 6; 
        if (p.type === 'live' || p.type === 'start') return 5;
        if (shouldHidePoints) return 0; // Utilisation du nouveau filtre
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
    
    // <--- AMÉLIORATION : Ligne droite si < 24h, Courbe sinon
    const lineTension = (mode === 1 || (mode > 0 && mode < 0.2)) ? 0 : 0.2;
    
    return new Chart(ctx, {
        type: 'line',
        data: { 
            datasets: [{ 
                label: 'Trophées', 
                data: finalDataPoints, 
                borderColor: color, 
                backgroundColor: color + '1A', 
                borderWidth: 2, 
                tension: lineTension, // Utilisation de la tension dynamique
                fill: true,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointRadius: pointRadiuses,
                pointHoverRadius: 6,
                segment: {
                    borderColor: ctx => {
                        if (!isBrawler) return undefined;
                        const p = finalDataPoints[ctx.p1DataIndex];
                        if (p && (p.type === 'locked' || p.type === 'unlock')) return '#ffffff';
                        return undefined;
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
                            const point = context.raw;
                            if (point.type === 'ghost') return `~ Environ : ${point.y}`;
                            if (point.type === 'live') return `🔴 Actuel : ${point.y}`;
                            if (point.type === 'unlock') return `🔓 Débloquer`;
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

async function loadHistoryChart(token, liveTrophies, tagId = null) {
if (!token) { lockChart(); fullHistoryData = []; return; }

    currentLiveTrophies = liveTrophies;
    try {
        let url = `${API_URL}/api/history`;
        if (tagId) url += `?tag_id=${tagId}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) fullHistoryData = await res.json();
        else fullHistoryData = [];
    } catch(e) { fullHistoryData = []; }
    
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

async function loadSelectedBrawlerStats() {
    // On récupère l'ID depuis le champ caché
    const brawlerId = document.getElementById('selected-brawler-id').value;
    
    if(!brawlerId) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/api/my-brawler-history/${brawlerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        currentBrawlerHistory = res.ok ? await res.json() : [];
        
        // Mise à jour du graphique
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
    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    
    let btnId = 'btn-brawler-all';
    if(currentBrawlerMode < 0.1 && currentBrawlerMode > 0) btnId = 'btn-brawler-1h';
    else if(currentBrawlerMode === 1) btnId = 'btn-brawler-24h';
    else if(currentBrawlerMode === 7) btnId = 'btn-brawler-7d';
    else if(currentBrawlerMode === 31) btnId = 'btn-brawler-31d';
    else if(currentBrawlerMode === 365) btnId = 'btn-brawler-365d';
    
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    if(brawlerChartInstance) brawlerChartInstance.destroy();

    const hiddenInput = document.getElementById('selected-brawler-id');
    let liveVal = null;
    
    if(hiddenInput && globalBrawlersList) {
        const b = globalBrawlersList.find(i => i.id == hiddenInput.value);
        if(b) liveVal = b.trophies;
    }

    brawlerChartInstance = renderGenericChart({
        canvasId: 'brawlerChartCanvas',
        rawData: currentBrawlerHistory,
        mode: currentBrawlerMode,
        offset: 0,
        liveValue: liveVal, 
        color: '#00d2ff', 
        variationId: 'brawler-trophy-variation',
        isBrawler: true // Activation du mode Brawler (Unlock blanc)
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

function goToBrawlerStats(id, name) {
    // 1. Changer la vue
    switchView('brawlers');
    
    // 2. Mettre à jour l'ID caché
    const hiddenInput = document.getElementById('selected-brawler-id');
    if(hiddenInput) hiddenInput.value = id;

    // 3. Mettre à jour le NOM
    const nameLabel = document.getElementById('selected-brawler-name');
    if(nameLabel) nameLabel.textContent = name;

    // 4. Mettre à jour l'IMAGE (Nouveau !)
    const imgElement = document.getElementById('selected-brawler-img');
    if(imgElement && globalBrawlersList) {
        // On cherche le brawler dans la liste déjà chargée pour récupérer son URL d'image
        // (Note: on utilise "==" car id peut être string ou number selon la source)
        const brawlerObj = globalBrawlersList.find(b => b.id == id);
        if(brawlerObj) {
            imgElement.src = brawlerObj.imageUrl;
        } else {
            // Fallback si jamais on ne trouve pas l'image
            imgElement.src = ''; 
        }
    }

    // 5. Charger les statistiques
    loadSelectedBrawlerStats();
}
