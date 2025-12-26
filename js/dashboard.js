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

// ... (loadBrawlersGrid, sortBrawlers, renderBrawlersGrid restent IDENTIQUES) ...
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

// --- LOCK CHART ---
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

// --- INITIALISATION CHART ---
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
    
    // Initialisation : Tout afficher
    setChartMode(0);

    // Timer Update
    let lastDate = null;
    if (fullHistoryData.length > 0) {
        lastDate = fullHistoryData[fullHistoryData.length - 1].date;
    }
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

// --- NOUVELLE LOGIQUE DE NAVIGATION ---

// 1. Choix du Mode (Jour, Semaine...)
function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0; // On revient à "Aujourd'hui" quand on change de mode
    renderChart();
}

// 2. Navigation (< ou >)
function navigateChart(direction) {
    // direction: 1 pour reculer (<), -1 pour avancer (>)
    currentChartOffset += direction;
    if (currentChartOffset < 0) currentChartOffset = 0; // Bloquer le futur
    renderChart();
}

// 3. Calculs et Rendu
function renderChart() {
    // A. Gestion des Boutons Actifs
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode < 0.1 && currentChartMode > 0) btnId = 'btn-1h';
    else if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    else if(currentChartMode === 31) btnId = 'btn-31d';
    else if(currentChartMode === 365) btnId = 'btn-365d';
    
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // B. Gestion de la Barre de Navigation
    const navBar = document.getElementById('chart-navigation');
    const nextBtn = document.getElementById('btn-nav-next');
    
    if (currentChartMode === 0) {
        navBar.classList.add('hidden'); // Pas de nav pour "Tout"
    } else {
        navBar.classList.remove('hidden');
        // Désactiver bouton "Suivant" si on est à aujourd'hui (Offset 0)
        nextBtn.disabled = (currentChartOffset === 0);
    }

    // C. Calcul des Dates Bornes (Start & End)
    let startDate = new Date();
    let endDate = new Date();
    let label = "Tout l'historique";

    if (currentChartMode > 0) {
        const now = new Date();

        if (currentChartMode === 1) { // MODE JOUR (00h00 -> 23h59)
            // On recule de X jours
            const targetDate = new Date();
            targetDate.setDate(now.getDate() - currentChartOffset);
            
            startDate = new Date(targetDate.setHours(0,0,0,0));
            endDate = new Date(targetDate.setHours(23,59,59,999));
            
            if (currentChartOffset === 0) label = "Aujourd'hui";
            else if (currentChartOffset === 1) label = "Hier";
            else label = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

        } else if (currentChartMode === 7) { // MODE SEMAINE
            // Recule de X semaines
            const targetEnd = new Date();
            targetEnd.setDate(now.getDate() - (currentChartOffset * 7));
            endDate = targetEnd;
            
            const targetStart = new Date(targetEnd);
            targetStart.setDate(targetEnd.getDate() - 7);
            startDate = targetStart;
            
            if(currentChartOffset === 0) label = "7 derniers jours";
            else label = `Semaine du ${startDate.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`;

        } else if (currentChartMode === 31) { // MODE MOIS
            // Recule de X mois
            const targetDate = new Date();
            targetDate.setMonth(now.getMonth() - currentChartOffset);
            
            // 1er jour du mois
            startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
            // Dernier jour du mois
            endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

            label = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            // Majuscule
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }
    }

    document.getElementById('chart-period-label').innerText = label;

    // D. Filtrage des Données
    let rawData = [...fullHistoryData];
    // Ajout du point LIVE seulement si on est sur la période actuelle (Offset 0)
    if (currentLiveTrophies && currentChartOffset === 0) {
        rawData.push({ date: new Date().toISOString(), trophies: currentLiveTrophies });
    }

    let data = rawData;
    if (currentChartMode > 0) {
        data = rawData.filter(i => {
            const d = new Date(i.date);
            return d >= startDate && d <= endDate;
        });
    }

    // E. Variation sur la période affichée
    const varElem = document.getElementById('trophy-variation');
    if (data.length > 0) {
        const startVal = data[0].trophies || data[0].y; // Gestion double format
        const endVal = data[data.length - 1].trophies || data[data.length - 1].y;
        const diff = endVal - startVal;

        if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
        else if (diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
        else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
    } else {
        varElem.innerHTML = `<span style="color:#888">--</span>`;
    }

    // F. Construction du Dataset Chart.js
    const dataset = data.map(h => ({ x: h.date, y: h.trophies }));
    
    // Config Affichage
    let timeUnit = 'day';
    let displayFmt = 'dd/MM';
    let pointRadiusBase = 0; // Par défaut, pas de points (Ligne pure)
    
    if (currentChartMode === 1) { // Jour : Précision max
        timeUnit = 'hour'; 
        displayFmt = 'HH:mm';
        pointRadiusBase = 3; // On affiche les points en vue Journée
    } else if (currentChartMode === 0 || currentChartMode === 365) {
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
                data: dataset, 
                borderColor: '#ffce00', 
                backgroundColor: 'rgba(255, 206, 0, 0.1)', 
                borderWidth: 2, 
                tension: 0.2, 
                fill: true, 
                
                // Optimisation : Points visibles seulement en 24h ou au survol
                pointRadius: pointRadiusBase,
                pointHoverRadius: 6,
                pointBackgroundColor: '#ffce00',
                pointBorderColor: '#ffce00'
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
                    min: currentChartMode > 0 ? startDate : undefined, // Force les bornes X
                    max: currentChartMode > 0 ? endDate : undefined,
                    time: { 
                        unit: timeUnit, 
                        displayFormats: { hour: 'HH:mm', day: 'dd/MM', month: 'MMM yy' } 
                    }, 
                    grid: {color:'#333'} 
                }, 
                y: { grid: {color:'#333'}, ticks: { color: '#888' } } 
            }
        }
    });
}
