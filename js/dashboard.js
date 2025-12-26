// --- VARIABLES GLOBALES CHART ---
let currentChartMode = 0; // 0=Tout, 1=Jour, 7=Semaine...
let currentChartOffset = 0; // 0=Actuel, 1=Précédent...

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
        window.currentUpdateInterval = data.internal_interval; 

        renderProfile(data);
        
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

    if (data.nameColor) {
        let color = data.nameColor;
        if (color.startsWith('0x')) {
            color = '#' + (color.length >= 10 ? color.slice(4) : color.slice(2));
        }
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

// --- GRAPHIQUE : UTILITAIRES ---

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
    
    // Trouver les points bornes (Avant et Après)
    let prev = null;
    let next = null;

    // allData est supposé trié par date croissante
    for (let pt of allData) {
        let ptTs = new Date(pt.date).getTime();
        if (ptTs <= targetTs) prev = pt; // Le dernier point passé
        if (ptTs >= targetTs && !next) { 
            next = pt; // Le premier point futur
            break; // On a trouvé nos deux bornes, on arrête
        }
    }

    // Cas 1 : Exactement sur un point
    if (prev && prev === next) return prev.trophies;

    // Cas 2 : Entre deux points -> Calcul proportionnel
    if (prev && next) {
        const prevTs = new Date(prev.date).getTime();
        const nextTs = new Date(next.date).getTime();
        const totalDiff = nextTs - prevTs;
        const targetDiff = targetTs - prevTs;
        
        if (totalDiff === 0) return prev.trophies; // Sécurité

        const factor = targetDiff / totalDiff;
        // Formule : Valeur = Dep + (Différence * facteur)
        return prev.trophies + (next.trophies - prev.trophies) * factor;
    }

    // Cas 3 : Hors limites (Pas de point avant ou pas de point après)
    // On renvoie la valeur la plus proche connue sans inventer
    if (prev) return prev.trophies; 
    if (next) return next.trophies;
    
    return null; // Aucune donnée
}


// --- LOGIQUE GRAPHIQUE ---

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

function renderChart() {
    // 1. Mise à jour UI Boutons
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode < 0.1 && currentChartMode > 0) btnId = 'btn-1h';
    else if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // 2. Gestion Navigation
    const navBar = document.getElementById('chart-navigation');
    const nextBtn = document.getElementById('btn-nav-next');
    if (currentChartMode === 0) {
        navBar.classList.add('hidden');
    } else {
        navBar.classList.remove('hidden');
        nextBtn.disabled = (currentChartOffset === 0);
    }

    // 3. Calcul des Bornes Temporelles (Start / End)
    let startDate = null;
    let endDate = null;
    let label = "Tout l'historique";

    if (currentChartMode > 0) {
        const now = new Date();
        
        // --- CAS 1 HEURE (Nouveau) ---
        if (currentChartMode < 0.1) { 
            const target = new Date();
            // On recule de X heures
            target.setHours(now.getHours() - currentChartOffset);
            
            // On définit HH:00:00 à HH:59:59
            startDate = new Date(target.setMinutes(0, 0, 0));
            endDate = new Date(target.setMinutes(59, 59, 999));
            
            // Label ex: "14h00 - 15h00"
            const h = startDate.getHours();
            label = `${h}h00 - ${h}h59`;
        }
        
        // --- CAS 24H (Journée) ---
        else if (currentChartMode === 1) { 
            const target = new Date();
            target.setDate(now.getDate() - currentChartOffset);
            startDate = new Date(target.setHours(0,0,0,0));
            endDate = new Date(target.setHours(23,59,59,999));
            if (currentChartOffset === 0) label = "Aujourd'hui";
            else if (currentChartOffset === 1) label = "Hier";
            else label = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        } 
        
        // --- CAS SEMAINE ---
        else if (currentChartMode === 7) { 
            const targetEnd = new Date();
            targetEnd.setDate(now.getDate() - (currentChartOffset * 7));
            endDate = targetEnd;
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetEnd.getDate() - 7);
            startDate = targetStart;
            if(currentChartOffset === 0) label = "7 derniers jours";
            else label = `Semaine du ${startDate.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`;
        } 
        
        // --- CAS MOIS ---
        else if (currentChartMode === 31) { 
            const target = new Date();
            target.setMonth(now.getMonth() - currentChartOffset);
            startDate = new Date(target.getFullYear(), target.getMonth(), 1);
            endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59);
            label = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }

        // --- CAS ANNÉE (Nouveau) ---
        else if (currentChartMode === 365) {
            const targetYear = now.getFullYear() - currentChartOffset;
            startDate = new Date(targetYear, 0, 1); // 1er Janvier
            endDate = new Date(targetYear, 11, 31, 23, 59, 59); // 31 Décembre
            label = targetYear.toString();
        }
    }
    
    document.getElementById('chart-period-label').innerText = label;

    // 4. CONSTRUCTION DU DATASET AVEC POINTS FANTÔMES
    let finalDataPoints = [];

    if (currentChartMode === 0) {
        // Mode "Tout"
        fullHistoryData.forEach(h => finalDataPoints.push({ x: h.date, y: h.trophies, type: 'real' }));
        if (currentLiveTrophies) finalDataPoints.push({ x: new Date().toISOString(), y: currentLiveTrophies, type: 'live' });
    
    } else {
        // Mode Plages
        
        // A. Fantôme DÉBUT
        const startVal = getInterpolatedValue(startDate, fullHistoryData);
        if (startVal !== null) {
            finalDataPoints.push({ x: startDate.toISOString(), y: Math.round(startVal), type: 'ghost' });
        }

        // B. Points RÉELS
        const inRange = fullHistoryData.filter(i => {
            const d = new Date(i.date);
            return d >= startDate && d <= endDate;
        });
        inRange.forEach(h => finalDataPoints.push({ x: h.date, y: h.trophies, type: 'real' }));

        // C. Fantôme FIN ou LIVE
        if (currentChartOffset === 0) {
            // C'est la période actuelle -> Point LIVE si dispo
            if (currentLiveTrophies) {
                finalDataPoints.push({ x: new Date().toISOString(), y: currentLiveTrophies, type: 'live' });
            }
        } else {
            // C'est du passé -> Point Fantôme interpolé
            const endVal = getInterpolatedValue(endDate, fullHistoryData);
            if (endVal !== null) {
                finalDataPoints.push({ x: endDate.toISOString(), y: Math.round(endVal), type: 'ghost' });
            }
        }
    }

    // 5. Calcul Variation
    const varElem = document.getElementById('trophy-variation');
    if (finalDataPoints.length >= 2) {
        const first = finalDataPoints[0];
        const last = finalDataPoints[finalDataPoints.length - 1];
        const diff = last.y - first.y;

        if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
        else if (diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
        else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
    } else {
        varElem.innerHTML = `<span style="color:#888">--</span>`;
    }

    // 6. Style Graphique
    const pointColors = finalDataPoints.map(p => {
        if (p.type === 'live') return '#ff5555'; 
        return '#ffce00';
    });

    const pointRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        if (p.type === 'live') return 5;
        // Points réels visibles uniquement en mode 1H ou 24H pour la précision
        return (currentChartMode <= 1) ? 3 : 0; 
    });

    const hoverRadiuses = finalDataPoints.map(p => {
        if (p.type === 'ghost') return 0;
        return 6; 
    });

    // 7. Rendu Chart.js
    let timeUnit = 'day';
    let displayFmt = 'dd/MM';
    
    // Ajustement de l'axe X selon le mode
    if (currentChartMode < 0.1) { // 1H
        timeUnit = 'minute'; 
        displayFmt = 'HH:mm'; 
    }
    else if (currentChartMode === 1) { // 24H
        timeUnit = 'hour'; 
        displayFmt = 'HH:mm'; 
    }
    else if (currentChartMode === 0 || currentChartMode === 365) { 
        timeUnit = 'month'; 
        displayFmt = 'MMM yy'; 
    }

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
            plugins: { legend: {display:false} },
            interaction: { mode: 'index', intersect: false },
            scales: { 
                x: { 
                    type: 'time', 
                    min: currentChartMode > 0 ? startDate : undefined,
                    max: currentChartMode > 0 ? endDate : undefined,
                    time: { 
                        unit: timeUnit, 
                        displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd/MM', month: 'MMM yy' } 
                    }, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
    });
}
