// --- VARIABLES GLOBALES CHART ---
let currentChartMode = 0; // 0=Tout, 1=Jour, 7=Semaine...
let currentChartOffset = 0; // Décalage temporel

// --- CHARGEMENT PRINCIPAL ---
async function loadMyStats() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session invalide");
        
        const data = await res.json();
        currentUserTier = data.internal_tier || 'basic';
        
        // Sauvegarde intervalle pour le timer (settings.js)
        window.currentUpdateInterval = data.internal_interval; 

        renderProfile(data);
        
        // MODE CONNECTÉ : On affiche le badge
        const badge = document.getElementById('tier-badge');
        if(badge) badge.classList.remove('hidden');
        
        if(typeof setupIntervalUI === 'function') setupIntervalUI(data.internal_tier, data.internal_interval);
        
        loadBrawlersGrid(data.brawlers);
        
        unlockChart();
        loadHistoryChart(token, data.trophies);

    } catch (e) { 
        console.error(e);
        logout(); 
    }
}

function renderProfile(data) {
    const nameElem = document.getElementById('player-name');
    nameElem.innerText = data.name;

    // --- GESTION COULEUR PSEUDO ---
    if (data.nameColor) {
        let color = data.nameColor;
        if (color.startsWith('0x')) {
            // Conversion ARGB (0xFF...) -> RGB (#...)
            color = '#' + (color.length >= 10 ? color.slice(4) : color.slice(2));
        }
        nameElem.style.color = color;
        nameElem.style.textShadow = `0 0 15px ${color}66`; // Effet Néon
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

// --- BRAWLERS ---
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

// === MATHS : INTERPOLATION LINÉAIRE ===
function getInterpolatedValue(targetDate, allData) {
    const targetTs = targetDate.getTime();
    let prev = null;
    let next = null;

    for (let pt of allData) {
        let ptTs = new Date(pt.date).getTime();
        if (ptTs <= targetTs) prev = pt;
        if (ptTs >= targetTs && !next) { 
            next = pt;
            break;
        }
    }

    if (prev && prev === next) return prev.trophies;

    if (prev && next) {
        const prevTs = new Date(prev.date).getTime();
        const nextTs = new Date(next.date).getTime();
        const totalDiff = nextTs - prevTs;
        const targetDiff = targetTs - prevTs;
        
        if (totalDiff === 0) return prev.trophies;

        const factor = targetDiff / totalDiff;
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }

    if (prev) return prev.trophies; 
    if (next) return next.trophies;
    
    return null;
}

// === OPTIMISATION : DÉCIMATION (CORRIGÉE) ===
function decimateDataPoints(points) {
    const grouped = {};
    points.forEach(p => {
        // CORRECTION ICI : On utilise p.date (format brut) car p.x n'existe pas encore
        const d = p.date || p.x; 
        if (!d) return; 
        const dayKey = d.split('T')[0]; 
        grouped[dayKey] = p; 
    });
    // Tri basé sur la date
    return Object.values(grouped).sort((a,b) => new Date(a.date || a.x) - new Date(b.date || b.x));
}


// --- LOGIQUE NAVIGATION CHART ---

function navigateChart(direction) {
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderChart();
}

function navigateMonth(direction) {
    // Navigue par mois entier au dessus des jours
    if (currentChartMode !== 1) return; // Uniquement en mode Jour

    const now = new Date();
    const currentDate = new Date();
    currentDate.setDate(now.getDate() - currentChartOffset);

    const targetDate = new Date(currentDate);
    targetDate.setMonth(targetDate.getMonth() - direction); 

    // Recalcul de l'offset en jours
    if (direction === 1) { // Reculer
        currentChartOffset = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
    } else { // Avancer
        currentChartOffset = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
        if (currentChartOffset < 0) currentChartOffset = 0;
    }
    renderChart();
}

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    renderChart();
}


// --- CHARGEMENT DONNÉES GRAPHIQUE ---

async function loadHistoryChart(token, liveTrophies) {
    if (!token) {
        lockChart();
        fullHistoryData = [];
        return;
    }

    currentLiveTrophies = liveTrophies;
    try {
        const res = await fetch(`${API_URL}/api/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) fullHistoryData = await res.json();
        else fullHistoryData = [];
    } catch(e) { fullHistoryData = []; }
    
    manageFilterButtons();
    setChartMode(0); // Vue par défaut : Tout

    // Mise à jour du Timer (Next Archive)
    let lastDate = null;
    if (fullHistoryData.length > 0) lastDate = fullHistoryData[fullHistoryData.length - 1].date;
    if(typeof updateNextArchiveTimer === 'function' && window.currentUpdateInterval) {
        updateNextArchiveTimer(lastDate, window.currentUpdateInterval);
    }
}

function manageFilterButtons() {
    const btn1h = document.getElementById('btn-1h');
    if (currentUserTier === 'premium') btn1h.classList.remove('hidden');
    else btn1h.classList.add('hidden');

    let oldestDate = new Date();
    if (fullHistoryData.length > 0) oldestDate = new Date(fullHistoryData[0].date);
    const diffDays = (new Date() - oldestDate) / (1000 * 60 * 60 * 24);

    if (diffDays > 1) document.getElementById('btn-7d').classList.remove('hidden');
    else document.getElementById('btn-7d').classList.add('hidden');
    if (diffDays > 7) document.getElementById('btn-31d').classList.remove('hidden');
    else document.getElementById('btn-31d').classList.add('hidden');
    if (diffDays > 31) document.getElementById('btn-365d').classList.remove('hidden');
    else document.getElementById('btn-365d').classList.add('hidden');
}


// --- RENDU FINAL GRAPHIQUE ---

function renderChart() {
    // 1. UI Boutons
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode < 0.1 && currentChartMode > 0) btnId = 'btn-1h';
    else if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // Récupération Start Absolu
    let absoluteStartDate = null;
    if (fullHistoryData.length > 0) absoluteStartDate = new Date(fullHistoryData[0].date);

    // 2. Bornes Temporelles
    let startDate = null;
    let endDate = null;
    let label = "Tout l'historique";
    let monthLabel = ""; // Pour le navigateur Mois

    if (currentChartMode > 0) {
        const now = new Date();
        
        if (currentChartMode < 0.1) { // 1H
            const target = new Date();
            target.setHours(now.getHours() - currentChartOffset);
            startDate = new Date(target.setMinutes(0, 0, 0));
            endDate = new Date(target.setMinutes(59, 59, 999));
            const h = startDate.getHours();
            label = `${h}h00 - ${h}h59`;
        }
        else if (currentChartMode === 1) { // 24H
            const target = new Date();
            target.setDate(now.getDate() - currentChartOffset);
            startDate = new Date(target.setHours(0,0,0,0));
            endDate = new Date(target.setHours(23,59,59,999));
            
            if (currentChartOffset === 0) label = "Aujourd'hui";
            else if (currentChartOffset === 1) label = "Hier";
            else label = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });

            // Label Mois
            let mLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            monthLabel = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);
        } 
        else if (currentChartMode === 7) { // Semaine
            const targetEnd = new Date();
            targetEnd.setDate(now.getDate() - (currentChartOffset * 7));
            endDate = targetEnd;
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetEnd.getDate() - 7);
            startDate = targetStart;
            if(currentChartOffset === 0) label = "7 derniers jours";
            else label = `Semaine du ${startDate.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`;
        } 
        else if (currentChartMode === 31) { // Mois
            const target = new Date();
            target.setMonth(now.getMonth() - currentChartOffset);
            startDate = new Date(target.getFullYear(), target.getMonth(), 1);
            endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);
            label = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }
        else if (currentChartMode === 365) { // Année
            const targetYear = now.getFullYear() - currentChartOffset;
            startDate = new Date(targetYear, 0, 1);
            endDate = new Date(targetYear, 11, 31, 23, 59, 59);
            label = targetYear.toString();
        }
    }
    
    document.getElementById('chart-period-label').innerText = label;
    if(monthLabel) document.getElementById('chart-month-label').innerText = monthLabel;

    // 3. Gestion Visibilité des Barres de Navigation
    const navBarMain = document.getElementById('chart-navigation');
    const navBarMonth = document.getElementById('chart-nav-month');
    const prevBtn = navBarMain.querySelector('.nav-arrow:first-child');
    const nextBtn = document.getElementById('btn-nav-next');

    if (currentChartMode === 0) {
        // Mode Tout : Aucune nav
        navBarMain.classList.add('hidden');
        navBarMonth.classList.add('hidden');
    } else {
        navBarMain.classList.remove('hidden');
        nextBtn.disabled = (currentChartOffset === 0);
        
        // Navigation Mois : Visible UNIQUEMENT en mode JOUR (1)
        if (currentChartMode === 1) navBarMonth.classList.remove('hidden');
        else navBarMonth.classList.add('hidden');

        // Blocage bouton gauche (Début absolu)
        if (absoluteStartDate && startDate <= absoluteStartDate) prevBtn.disabled = true;
        else prevBtn.disabled = false;
    }

    // 4. CONSTRUCTION DATASET
    let finalDataPoints = [];

    // --- CONDITION POUR LISSAGE (Smart Points) ---
    const shouldDecimate = (currentChartMode === 0 || currentChartMode === 365);
    const shouldHidePoints = shouldDecimate;

    if (currentChartMode === 0) {
        // --- MODE "TOUT" ---
        let sourceData = fullHistoryData;
        
        if (shouldDecimate) {
            sourceData = decimateDataPoints(fullHistoryData);
        }

        sourceData.forEach((h) => {
            // Vérification Point Bleu (Start)
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });
        
        if (currentLiveTrophies) finalDataPoints.push({ x: new Date().toISOString(), y: currentLiveTrophies, type: 'live' });
    
    } else {
        // --- MODE PLAGES (Interpolation) ---
        
        // A. Points Réels (Filtrés)
        let inRange = fullHistoryData.filter(i => {
            const d = new Date(i.date);
            return d >= startDate && d <= endDate;
        });

        // Lissage si plage longue (ex: Année passée)
        if (shouldDecimate) {
            inRange = decimateDataPoints(inRange);
        }

        inRange.forEach(h => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });

        // B. Fantôme Début
        if (startDate > absoluteStartDate) {
            const hasPointAtStart = finalDataPoints.some(p => new Date(p.x).getTime() === startDate.getTime());
            if (!hasPointAtStart) {
                const startVal = getInterpolatedValue(startDate, fullHistoryData);
                if (startVal !== null) {
                    finalDataPoints.unshift({ x: startDate.toISOString(), y: Math.round(startVal), type: 'ghost' });
                }
            }
        }

        // C. Fantôme Fin ou Live
        if (currentChartOffset === 0) {
            if (currentLiveTrophies) finalDataPoints.push({ x: new Date().toISOString(), y: currentLiveTrophies, type: 'live' });
        } else {
            const endVal = getInterpolatedValue(endDate, fullHistoryData);
            if (endVal !== null) finalDataPoints.push({ x: endDate.toISOString(), y: Math.round(endVal), type: 'ghost' });
        }
    }

    finalDataPoints.sort((a,b) => new Date(a.x) - new Date(b.x));

    // 5. Variation
    const varElem = document.getElementById('trophy-variation');
    if (finalDataPoints.length >= 2) {
        const startVal = finalDataPoints[0].y;
        const endVal = finalDataPoints[finalDataPoints.length - 1].y;
        const diff = endVal - startVal;
        if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
        else if (diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
        else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
    } else varElem.innerHTML = `<span style="color:#888">--</span>`;

    // 6. Styles Dynamiques
    const pointColors = finalDataPoints.map(p => {
        if (p.type === 'live') return '#ff5555'; // Rouge
        if (p.type === 'start') return '#007bff'; // Bleu
        return '#ffce00';
    });

    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        if (p.type === 'live' || p.type === 'start') return 5; 
        
        // Smart Points : On cache si vue large
        if (shouldHidePoints) return 0;
        return 3;
    });

    const hoverRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 6;
        return 7;
    });

    // 7. Rendu Chart
    let timeUnit = 'day';
    if (currentChartMode < 0.1) timeUnit = 'minute';
    else if (currentChartMode === 1) timeUnit = 'hour';
    else if (currentChartMode === 0 || currentChartMode === 365) timeUnit = 'month';

    const canvas = document.getElementById('trophyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if(window.myChart) window.myChart.destroy();
    
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: { 
            datasets: [{ 
                label: 'Trophées', 
                data: finalDataPoints, 
                borderColor: '#ffce00', 
                backgroundColor: 'rgba(255, 206, 0, 0.1)', 
                borderWidth: 2, 
                tension: 0.2, 
                fill: true,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointRadius: pointRadiuses,
                pointHoverRadius: hoverRadiuses
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
                            if (point.type === 'start') return `★ Début : ${point.y}`;
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
                    min: currentChartMode > 0 ? startDate : undefined,
                    max: currentChartMode > 0 ? endDate : undefined,
                    time: { unit: timeUnit, displayFormats: { minute:'HH:mm', hour:'HH:mm', day:'dd/MM', month:'MMM yy' }}, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
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

        // MODE PUBLIC : Pas de badge grade
        const badge = document.getElementById('tier-badge');
        if(badge) badge.classList.add('hidden');
        
        loadBrawlersGrid(data.brawlers);
        
        // Graphique verrouillé
        loadHistoryChart(null, data.trophies);

    } catch (e) { alert("Joueur introuvable"); }
}

function publicSearch() {
    const tag = document.getElementById('public-tag').value.trim().replace('#', '');
    if(tag) window.location.href = `dashboard.html?tag=${tag}`;
}
