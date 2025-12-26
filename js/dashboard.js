// --- VARIABLES GLOBALES CHART ---
let currentChartMode = 0; // 0=Tout, 1=Jour, 31=Mois...
let currentChartOffset = 0; // Décalage temporel (Unité dépend du mode)

// --- CHARGEMENT PRINCIPAL ---
async function loadMyStats() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/my-stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        
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
        const totalDiff = new Date(next.date).getTime() - new Date(prev.date).getTime();
        if (totalDiff === 0) return prev.trophies;
        return prev.trophies + (next.trophies - prev.trophies) * ((targetTs - new Date(prev.date).getTime()) / totalDiff);
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

// --- NAVIGATION CHART ---

function navigateChart(direction) {
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0;
    renderChart();
}

function navigateUpper(direction) {
    // direction: 1 (Reculer), -1 (Avancer)
    
    // Récupération de la limite absolue pour ne pas reculer trop loin
    let absoluteStartDate = null;
    if (typeof fullHistoryData !== 'undefined' && fullHistoryData.length > 0) {
        absoluteStartDate = new Date(fullHistoryData[0].date);
    }
    const now = new Date();

    if (currentChartMode === 1) { 
        // --- MODE JOUR : Upper = Mois ---
        const currentDate = new Date();
        currentDate.setDate(now.getDate() - currentChartOffset); // Date au centre de la vue actuelle

        // Cible : Le même jour, 1 mois avant/après
        const targetDate = new Date(currentDate);
        targetDate.setMonth(targetDate.getMonth() - direction);

        // Vérif Limite Futur
        if (direction === -1 && targetDate > now) {
            // On ne peut pas aller dans le futur, on remet à "Aujourd'hui"
            currentChartOffset = 0;
        } else {
            // Calcul du nouvel offset en JOURS
            const diffTime = Math.abs(now - targetDate);
            const newOffset = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Si on recule et qu'on dépasse le début absolu, on bloque au début
            if (direction === 1 && absoluteStartDate && targetDate < absoluteStartDate) {
                // On pourrait calculer l'offset exact vers le start, mais ici on laisse faire la limite visuelle
            }
            
            currentChartOffset = (direction === 1) ? Math.floor((now - targetDate) / (1000 * 60 * 60 * 24)) : newOffset;
            if(currentChartOffset < 0) currentChartOffset = 0;
        }

    } else if (currentChartMode === 31) {
        // --- MODE MOIS : Upper = Année ---
        // Ici l'offset est en MOIS. Donc on saute de 12.
        currentChartOffset += (direction * 12);
        if (currentChartOffset < 0) currentChartOffset = 0;
        
        // Vérif Start (Approximative en mois)
        if (direction === 1 && absoluteStartDate) {
           // Si on est allé trop loin dans le passé, on peut ajuster, 
           // mais le rendu gérera l'affichage "Fantôme".
        }
    }

    renderChart();
}

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    renderChart();
}


// --- CHARGEMENT DONNÉES ---

async function loadHistoryChart(token, liveTrophies) {
    if (!token) { lockChart(); fullHistoryData = []; return; }
    currentLiveTrophies = liveTrophies;
    try {
        const res = await fetch(`${API_URL}/api/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) fullHistoryData = await res.json();
        else fullHistoryData = [];
    } catch(e) { fullHistoryData = []; }
    
    manageFilterButtons();
    setChartMode(0);

    let lastDate = null;
    if (fullHistoryData.length > 0) lastDate = fullHistoryData[fullHistoryData.length - 1].date;
    if(typeof updateNextArchiveTimer === 'function' && window.currentUpdateInterval) {
        updateNextArchiveTimer(lastDate, window.currentUpdateInterval);
    }
}

function manageFilterButtons() {
    const btn1h = document.getElementById('btn-1h');
    if (currentUserTier === 'premium') btn1h.classList.remove('hidden'); else btn1h.classList.add('hidden');
    let oldestDate = new Date();
    if (fullHistoryData.length > 0) oldestDate = new Date(fullHistoryData[0].date);
    const diffDays = (new Date() - oldestDate) / (1000 * 60 * 60 * 24);
    
    const showBtn = (id, cond) => document.getElementById(id).classList[cond ? 'remove' : 'add']('hidden');
    showBtn('btn-7d', diffDays > 1);
    showBtn('btn-31d', diffDays > 7);
    showBtn('btn-365d', diffDays > 31);
}


// --- RENDU CHART ---

function renderChart() {
    // 1. Boutons UI
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode < 0.1 && currentChartMode > 0) btnId = 'btn-1h';
    else if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // Start Absolu
    let absoluteStartDate = null;
    if (fullHistoryData.length > 0) absoluteStartDate = new Date(fullHistoryData[0].date);
    const now = new Date();

    // 2. Bornes Temporelles
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
        else if (currentChartMode === 1) { // 24H
            const target = new Date();
            target.setDate(now.getDate() - currentChartOffset);
            startDate = new Date(target.setHours(0,0,0,0));
            endDate = new Date(target.setHours(23,59,59,999));
            
            if (currentChartOffset === 0) label = "Aujourd'hui";
            else if (currentChartOffset === 1) label = "Hier";
            else label = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });

            // UPPER LABEL (Mois)
            let mLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            upperLabel = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);
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
            
            let mLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            label = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);

            // UPPER LABEL (Année)
            upperLabel = startDate.getFullYear().toString();
        }
        else if (currentChartMode === 365) { // Année
            const targetYear = now.getFullYear() - currentChartOffset;
            startDate = new Date(targetYear, 0, 1);
            endDate = new Date(targetYear, 11, 31, 23, 59, 59);
            label = targetYear.toString();
        }
    }
    
    document.getElementById('chart-period-label').innerText = label;
    if(upperLabel) document.getElementById('chart-upper-label').innerText = upperLabel;

    // 3. Gestion Visibilité Navigations
    const navBarMain = document.getElementById('chart-navigation');
    const navBarUpper = document.getElementById('chart-nav-upper');
    
    // Boutons Main
    const prevBtn = navBarMain.querySelector('.nav-arrow:first-child');
    const nextBtn = document.getElementById('btn-nav-next');
    
    // Boutons Upper
    const prevUpper = navBarUpper.querySelector('.nav-arrow:first-child');
    const nextUpper = navBarUpper.querySelector('.nav-arrow:last-child');

    if (currentChartMode === 0) {
        navBarMain.classList.add('hidden');
        navBarUpper.classList.add('hidden');
    } else {
        navBarMain.classList.remove('hidden');
        nextBtn.disabled = (currentChartOffset === 0);
        
        // Bloquage Micro (Si début absolu dépassé)
        if (absoluteStartDate && startDate <= absoluteStartDate) prevBtn.disabled = true;
        else prevBtn.disabled = false;

        // Gestion Upper Nav
        if (currentChartMode === 1 || currentChartMode === 31) {
            navBarUpper.classList.remove('hidden');
            
            // Bloquage Upper Next (Futur)
            nextUpper.disabled = (currentChartOffset === 0);

            // Bloquage Upper Prev (Passé Absolu)
            // On vérifie si la fin de la période Upper précédente est avant le début absolu
            let checkDate = new Date(startDate);
            if(currentChartMode === 1) checkDate.setMonth(checkDate.getMonth() - 1);
            if(currentChartMode === 31) checkDate.setFullYear(checkDate.getFullYear() - 1);
            
            // Si la période ciblée finit avant le début de nos données, on désactive
            // Note: C'est une vérif simplifiée. 
            if (absoluteStartDate && checkDate < absoluteStartDate && startDate < absoluteStartDate) {
                prevUpper.disabled = true;
            } else {
                prevUpper.disabled = false;
            }

        } else {
            navBarUpper.classList.add('hidden');
        }
    }

    // 4. CONSTRUCTION DATASET
    let finalDataPoints = [];
    const shouldDecimate = (currentChartMode === 0 || currentChartMode === 365);
    const shouldHidePoints = shouldDecimate;

    if (currentChartMode === 0) {
        // Mode TOUT
        let sourceData = shouldDecimate ? decimateDataPoints(fullHistoryData) : fullHistoryData;
        sourceData.forEach((h) => {
            let type = 'real';
            if (absoluteStartDate && new Date(h.date).getTime() === absoluteStartDate.getTime()) type = 'start';
            finalDataPoints.push({ x: h.date, y: h.trophies, type: type });
        });
        if (currentLiveTrophies) finalDataPoints.push({ x: new Date().toISOString(), y: currentLiveTrophies, type: 'live' });
    
    } else {
        // Mode PLAGES
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

        // Fantôme Début
        if (startDate > absoluteStartDate) {
            const hasPointAtStart = finalDataPoints.some(p => new Date(p.x).getTime() === startDate.getTime());
            if (!hasPointAtStart) {
                const startVal = getInterpolatedValue(startDate, fullHistoryData);
                if (startVal !== null) finalDataPoints.unshift({ x: startDate.toISOString(), y: Math.round(startVal), type: 'ghost' });
            }
        }
        // Fantôme Fin
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

    // 6. Styles
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

    // 7. Rendu Canvas
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
                y: { 
                    grid: {color:'#333'}, 
                    ticks: { 
                        color: '#888',
                        precision: 0 // <--- ICI : Force les entiers sur l'axe Y
                    } 
                } 
            }
        }
    });
}
