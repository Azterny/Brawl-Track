// ==========================================
// 1. VARIABLES GLOBALES (Indispensables !)
// ==========================================
let currentChartMode = 0; // 0=Tout, 1=Jour, 31=Mois, 365=Année
let currentChartOffset = 0; // Décalage temporel
let fullHistoryData = []; // Stocke l'historique complet
let globalBrawlersList = []; // Stocke la liste des brawlers
let currentUserTier = 'basic'; // Grade utilisateur
let currentLiveTrophies = null; // Trophées en direct

// ==========================================
// 2. CHARGEMENT & PROFIL
// ==========================================
async function loadMyStats() {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error("Pas de token");

        const res = await fetch(`${API_URL}/api/my-stats`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Session invalide");
        
        const data = await res.json();
        
        // Mise à jour des variables globales
        currentUserTier = data.internal_tier || 'basic';
        window.currentUpdateInterval = data.internal_interval; 

        // Rendu Interface
        renderProfile(data);
        
        const badge = document.getElementById('tier-badge');
        if(badge) badge.classList.remove('hidden');
        
        // Configuration intervalle (si settings.js est chargé)
        if(typeof setupIntervalUI === 'function') {
            setupIntervalUI(data.internal_tier, data.internal_interval);
        }
        
        loadBrawlersGrid(data.brawlers);
        
        // Graphique
        unlockChart();
        loadHistoryChart(token, data.trophies);

    } catch (e) { 
        console.error("Erreur chargement:", e);
        logout(); 
    }
}

function renderProfile(data) {
    const nameElem = document.getElementById('player-name');
    if(nameElem) {
        nameElem.innerText = data.name;
        // Couleur pseudo
        if (data.nameColor) {
            let color = data.nameColor;
            if (color.startsWith('0x')) color = '#' + (color.length >= 10 ? color.slice(4) : color.slice(2));
            nameElem.style.color = color;
            nameElem.style.textShadow = `0 0 15px ${color}66`;
        } else {
            nameElem.style.color = '#ffffff';
            nameElem.style.textShadow = 'none';
        }
    }

    const tagElem = document.getElementById('player-tag');
    if(tagElem) tagElem.innerText = data.tag;

    const badge = document.getElementById('tier-badge');
    if(badge) {
        badge.className = `badge badge-${currentUserTier}`;
        badge.innerText = currentUserTier === 'subscriber' ? 'Abonné' : currentUserTier;
    }

    const statsArea = document.getElementById('stats-area');
    if(statsArea) {
        statsArea.innerHTML = `
            <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
            <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
            <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
            <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
        `;
    }
}

// ==========================================
// 3. BRAWLERS
// ==========================================
async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    if(!grid) return;
    
    try {
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
    } catch(e) { console.error("Erreur Brawlers", e); }
}

function sortBrawlers() {
    const select = document.getElementById('sort-brawlers');
    const criteria = select ? select.value : 'trophies';
    
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
    if(!grid) return;
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

// ==========================================
// 4. LOGIQUE MATHÉMATIQUE (Interpolation & Lissage)
// ==========================================

// Règle de trois pour trouver les trophées entre deux dates
function getInterpolatedValue(targetDate, allData) {
    if(!allData || allData.length === 0) return null;
    
    const targetTs = targetDate.getTime();
    let prev = null, next = null;

    for (let pt of allData) {
        let ptTs = new Date(pt.date).getTime();
        if (ptTs <= targetTs) prev = pt;
        if (ptTs >= targetTs && !next) { next = pt; break; }
    }

    if (prev && prev === next) return prev.trophies;

    if (prev && next) {
        const totalDiff = new Date(next.date).getTime() - new Date(prev.date).getTime();
        if (totalDiff === 0) return prev.trophies;
        
        const factor = (targetTs - new Date(prev.date).getTime()) / totalDiff;
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }

    if (prev) return prev.trophies; 
    if (next) return next.trophies;
    
    return null;
}

// Lissage : Ne garde qu'un point par jour
function decimateDataPoints(points) {
    if(!points) return [];
    const grouped = {};
    points.forEach(p => {
        // Supporte format brut (.date) ou format graph (.x)
        const d = p.date || p.x; 
        if (!d) return; 
        const dayKey = d.split('T')[0]; 
        grouped[dayKey] = p; // On écrase -> garde le dernier de la journée
    });
    // Retourne trié par date
    return Object.values(grouped).sort((a,b) => new Date(a.date || a.x) - new Date(b.date || b.x));
}

// ==========================================
// 5. NAVIGATION GRAPHIQUE
// ==========================================

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    renderChart();
}

function navigateChart(direction) {
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderChart();
}

function navigateUpper(direction) {
    // direction: 1 (Reculer dans le temps), -1 (Avancer vers le présent)
    
    let absoluteStartDate = null;
    if (fullHistoryData && fullHistoryData.length > 0) {
        absoluteStartDate = new Date(fullHistoryData[0].date);
    }
    const now = new Date();

    // -- SI MODE JOUR -> Navigation par MOIS --
    if (currentChartMode === 1) { 
        const currentDate = new Date();
        currentDate.setDate(now.getDate() - currentChartOffset);
        
        const targetDate = new Date(currentDate);
        targetDate.setMonth(targetDate.getMonth() - direction); // +/- 1 Mois

        // Bloquer Futur
        if (direction === -1 && targetDate > now) {
            currentChartOffset = 0;
        } else {
            // Calcul nouvel offset en JOURS
            const diffTime = Math.abs(now - targetDate);
            let newOffset = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (direction === 1) { 
                // Reculer
                currentChartOffset = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
            } else { 
                // Avancer
                currentChartOffset = newOffset;
            }
            if(currentChartOffset < 0) currentChartOffset = 0;
        }

    // -- SI MODE MOIS -> Navigation par ANNÉE --
    } else if (currentChartMode === 31) {
        // Offset est en mois, on saute 12
        currentChartOffset += (direction * 12);
        if (currentChartOffset < 0) currentChartOffset = 0;
    }

    renderChart();
}


// ==========================================
// 6. CHARGEMENT & RENDU GRAPHIQUE
// ==========================================

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
    } catch(e) { 
        console.error("Erreur History", e);
        fullHistoryData = []; 
    }
    
    // Gérer les boutons filtres
    manageFilterButtons();
    
    // Initialiser le graph (Vue "Tout" par défaut)
    setChartMode(0);

    // Timer Auto-Update
    let lastDate = null;
    if (fullHistoryData.length > 0) lastDate = fullHistoryData[fullHistoryData.length - 1].date;
    
    if(typeof updateNextArchiveTimer === 'function' && window.currentUpdateInterval) {
        updateNextArchiveTimer(lastDate, window.currentUpdateInterval);
    }
}

function manageFilterButtons() {
    const btn1h = document.getElementById('btn-1h');
    // Sécurité : si les boutons n'existent pas encore, on arrête
    if (!btn1h) return;

    if (currentUserTier === 'premium') btn1h.classList.remove('hidden'); 
    else btn1h.classList.add('hidden');

    let oldestDate = new Date();
    if (fullHistoryData.length > 0) oldestDate = new Date(fullHistoryData[0].date);
    const diffDays = (new Date() - oldestDate) / (1000 * 60 * 60 * 24);

    const showBtn = (id, cond) => {
        const el = document.getElementById(id);
        if(el) el.classList[cond ? 'remove' : 'add']('hidden');
    };
    
    showBtn('btn-7d', diffDays > 1);
    showBtn('btn-31d', diffDays > 7);
    showBtn('btn-365d', diffDays > 31);
}

function renderChart() {
    const canvas = document.getElementById('trophyChart');
    if (!canvas) return;

    // 1. Boutons Actifs
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode < 0.1 && currentChartMode > 0) btnId = 'btn-1h';
    else if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // Début Absolu
    let absoluteStartDate = null;
    if (fullHistoryData && fullHistoryData.length > 0) {
        absoluteStartDate = new Date(fullHistoryData[0].date);
    }
    const now = new Date();

    // 2. Calcul Bornes & Labels
    let startDate = null;
    let endDate = null;
    let label = "Tout l'historique";
    let upperLabel = ""; // Label barre supérieure

    if (currentChartMode > 0) {
        
        if (currentChartMode < 0.1) { // 1H
            const target = new Date();
            target.setHours(now.getHours() - currentChartOffset);
            startDate = new Date(target.setMinutes(0, 0, 0));
            endDate = new Date(target.setMinutes(59, 59, 999));
            const h = startDate.getHours();
            label = `${h}h00 - ${h}h59`;
        }
        else if (currentChartMode === 1) { // 24H (JOUR)
            const target = new Date();
            target.setDate(now.getDate() - currentChartOffset);
            startDate = new Date(target.setHours(0,0,0,0));
            endDate = new Date(target.setHours(23,59,59,999));
            
            if (currentChartOffset === 0) label = "Aujourd'hui";
            else if (currentChartOffset === 1) label = "Hier";
            else label = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });

            // Barre Supérieure : MOIS
            let mLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            upperLabel = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);
        } 
        else if (currentChartMode === 7) { // SEMAINE
            const targetEnd = new Date();
            targetEnd.setDate(now.getDate() - (currentChartOffset * 7));
            endDate = targetEnd;
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetEnd.getDate() - 7);
            startDate = targetStart;
            if(currentChartOffset === 0) label = "7 derniers jours";
            else label = `Semaine du ${startDate.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`;
        } 
        else if (currentChartMode === 31) { // MOIS
            const target = new Date();
            target.setMonth(now.getMonth() - currentChartOffset);
            startDate = new Date(target.getFullYear(), target.getMonth(), 1);
            endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);
            
            let mLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            label = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);

            // Barre Supérieure : ANNÉE
            upperLabel = startDate.getFullYear().toString();
        }
        else if (currentChartMode === 365) { // ANNÉE
            const targetYear = now.getFullYear() - currentChartOffset;
            startDate = new Date(targetYear, 0, 1);
            endDate = new Date(targetYear, 11, 31, 23, 59, 59);
            label = targetYear.toString();
        }
    }
    
    document.getElementById('chart-period-label').innerText = label;
    if(upperLabel) document.getElementById('chart-upper-label').innerText = upperLabel;

    // 3. Gestion Visibilité & Navigation
    const navBarMain = document.getElementById('chart-navigation');
    const navBarUpper = document.getElementById('chart-nav-upper');
    
    const prevBtn = navBarMain.querySelector('.nav-arrow:first-child');
    const nextBtn = document.getElementById('btn-nav-next');
    
    const prevUpper = navBarUpper.querySelector('.nav-arrow:first-child');
    const nextUpper = navBarUpper.querySelector('.nav-arrow:last-child');

    if (currentChartMode === 0) {
        // TOUT = Pas de nav
        navBarMain.classList.add('hidden');
        navBarUpper.classList.add('hidden');
    } else {
        navBarMain.classList.remove('hidden');
        nextBtn.disabled = (currentChartOffset === 0);
        
        // Blocage Micro : Si début de la plage est avant le début absolu
        if (absoluteStartDate && startDate <= absoluteStartDate) prevBtn.disabled = true;
        else prevBtn.disabled = false;

        // --- BARRE SUPÉRIEURE ---
        if (currentChartMode === 1 || currentChartMode === 31) {
            navBarUpper.classList.remove('hidden');
            nextUpper.disabled = (currentChartOffset === 0);

            // Blocage Macro : On regarde 1 unité de temps avant (1 mois ou 1 an)
            let checkDate = new Date(startDate);
            if(currentChartMode === 1) checkDate.setMonth(checkDate.getMonth() - 1);
            if(currentChartMode === 31) checkDate.setFullYear(checkDate.getFullYear() - 1);
            
            // Si la période précédente est ENTIÈREMENT avant le début absolu, on bloque
            if (absoluteStartDate && checkDate < absoluteStartDate && startDate <= absoluteStartDate) {
                prevUpper.disabled = true;
            } else {
                prevUpper.disabled = false;
            }
        } else {
            navBarUpper.classList.add('hidden');
        }
    }

    // 4. Construction des Données
    let finalDataPoints = [];
    const shouldDecimate = (currentChartMode === 0 || currentChartMode === 365);
    const shouldHidePoints = shouldDecimate; // On cache les points si on lisse

    if (currentChartMode === 0) {
        // MODE TOUT
        let sourceData = shouldDecimate ? decimateDataPoints(fullHistoryData) : fullHistoryData;
        
        sourceData.forEach((h) => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });
        if (currentLiveTrophies) finalDataPoints.push({ x: new Date().toISOString(), y: currentLiveTrophies, type: 'live' });
    
    } else {
        // MODE PLAGES
        let inRange = fullHistoryData.filter(i => {
            const d = new Date(i.date);
            return d >= startDate && d <= endDate;
        });
        
        if (shouldDecimate) inRange = decimateDataPoints(inRange);

        inRange.forEach(h => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });

        // Points Fantômes (Interpolation)
        if (startDate > absoluteStartDate) {
            const hasPointAtStart = finalDataPoints.some(p => new Date(p.x).getTime() === startDate.getTime());
            if (!hasPointAtStart) {
                const startVal = getInterpolatedValue(startDate, fullHistoryData);
                if (startVal !== null) finalDataPoints.unshift({ x: startDate.toISOString(), y: Math.round(startVal), type: 'ghost' });
            }
        }
        if (currentChartOffset === 0) {
            if (currentLiveTrophies) finalDataPoints.push({ x: new Date().toISOString(), y: currentLiveTrophies, type: 'live' });
        } else {
            const endVal = getInterpolatedValue(endDate, fullHistoryData);
            if (endVal !== null) finalDataPoints.push({ x: endDate.toISOString(), y: Math.round(endVal), type: 'ghost' });
        }
    }
    
    // Tri final
    finalDataPoints.sort((a,b) => new Date(a.x) - new Date(b.x));

    // 5. Calcul Variation
    const varElem = document.getElementById('trophy-variation');
    if (finalDataPoints.length >= 2) {
        const startVal = finalDataPoints[0].y;
        const endVal = finalDataPoints[finalDataPoints.length - 1].y;
        const diff = endVal - startVal;
        if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
        else if (diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
        else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
    } else varElem.innerHTML = `<span style="color:#888">--</span>`;

    // 6. Styles des points
    const pointColors = finalDataPoints.map(p => {
        if (p.type === 'live') return '#ff5555';
        if (p.type === 'start') return '#007bff';
        return '#ffce00';
    });
    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        if (p.type === 'live' || p.type === 'start') return 5;
        if (shouldHidePoints) return 0;
        return 3;
    });
    const hoverRadiuses = finalDataPoints.map(p => (p.type === 'ghost') ? 6 : 7);

    // 7. Rendu Chart.js
    let timeUnit = 'day';
    if (currentChartMode < 0.1) timeUnit = 'minute';
    else if (currentChartMode === 1) timeUnit = 'hour';
    else if (currentChartMode === 0 || currentChartMode === 365) timeUnit = 'month';

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
                y: { 
                    grid: {color:'#333'}, 
                    ticks: { 
                        color: '#888',
                        precision: 0 // Entiers uniquement
                    } 
                } 
            }
        }
    });
}

// ==========================================
// 7. MODE PUBLIC
// ==========================================
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
