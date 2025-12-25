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
        
        // ON SAUVEGARDE L'INTERVALLE GLOBALEMENT
        window.currentUpdateInterval = data.internal_interval; 

        document.getElementById('tier-badge').classList.remove('hidden');

        renderProfile(data);
        
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
    document.getElementById('player-name').innerText = data.name;
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

// --- GESTION GRAPHIQUE (LOCK / UNLOCK) ---
function lockChart() {
    document.getElementById('chart-content-wrapper').classList.add('blur-content');
    document.getElementById('chart-lock-overlay').classList.remove('hidden');
}

function unlockChart() {
    document.getElementById('chart-content-wrapper').classList.remove('blur-content');
    document.getElementById('chart-lock-overlay').classList.add('hidden');
}

// --- GRAPHIQUE & LOGIQUE AVANCÉE ---
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
    updateChartFilter(0);

    // --- MISE A JOUR DU TIMER ---
    // On prend la dernière date connue dans l'historique
    let lastDate = null;
    if (fullHistoryData.length > 0) {
        // Le tableau est souvent trié ASC (le plus vieux en premier), donc le dernier est à la fin
        // Mais vérifions ton API : ORDER BY recorded_at ASC
        lastDate = fullHistoryData[fullHistoryData.length - 1].date;
    }
    
    // On appelle la fonction du fichier settings.js
    if(typeof updateNextArchiveTimer === 'function' && window.currentUpdateInterval) {
        updateNextArchiveTimer(lastDate, window.currentUpdateInterval);
    }
}

function manageFilterButtons() {
    // 1. Gestion du bouton 1H (Premium uniquement)
    const btn1h = document.getElementById('btn-1h');
    if (currentUserTier === 'premium') btn1h.classList.remove('hidden');
    else btn1h.classList.add('hidden');

    // 2. Gestion des boutons temporels (Basé sur l'ancienneté des données)
    // On cherche la date la plus vieille
    let oldestDate = new Date();
    if (fullHistoryData.length > 0) {
        oldestDate = new Date(fullHistoryData[0].date);
    }
    
    const now = new Date();
    const diffHours = (now - oldestDate) / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    // Logique demandée :
    // "7J" dispo si archive > 24H (mesure inférieure)
    // "Mois" dispo si archive > 7J
    // "Année" dispo si archive > 1 Mois (31J)
    
    const btn7d = document.getElementById('btn-7d');
    const btn31d = document.getElementById('btn-31d');
    const btn365d = document.getElementById('btn-365d');

    if (diffHours > 24) btn7d.classList.remove('hidden');
    else btn7d.classList.add('hidden');

    if (diffDays > 7) btn31d.classList.remove('hidden');
    else btn31d.classList.add('hidden');

    if (diffDays > 31) btn365d.classList.remove('hidden');
    else btn365d.classList.add('hidden');
}

function updateChartFilter(days) {
    const canvas = document.getElementById('trophyChart');
    if (!canvas) return;

    // 1. GESTION DES BOUTONS ACTIFS
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    // Mapping ID boutons (0.042 = 1H environ)
    let btnId = 'btn-all';
    if(days < 0.1) btnId = 'btn-1h';
    else if(days === 1) btnId = 'btn-24h';
    else if(days === 7) btnId = 'btn-7d';
    else if(days === 31) btnId = 'btn-31d';
    else if(days === 365) btnId = 'btn-365d';
    
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    // 2. FILTRAGE
    let data = [];
    let rawData = [...fullHistoryData];

    if (currentLiveTrophies) {
        rawData.push({ date: new Date().toISOString(), trophies: currentLiveTrophies });
    }

    if (days > 0) {
        const limit = new Date(); 
        if (days < 0.1) {
            // Cas spécial 1H
            limit.setMinutes(new Date().getMinutes() - 60);
        } else if (days === 1) {
            // Cas 24H
            limit.setHours(new Date().getHours() - 24);
        } else {
            // Cas Jours classiques
            limit.setDate(new Date().getDate() - days);
        }
        data = rawData.filter(i => new Date(i.date) >= limit);
    } else {
        data = rawData; 
    }

    const dataset = data.map(h => ({ x: h.date, y: h.trophies }));
    if(dataset.length === 0) return;

    // 3. VARIATION
    const startVal = dataset[0].y;
    const endVal = dataset[dataset.length - 1].y;
    const diff = endVal - startVal;
    
    const varElem = document.getElementById('trophy-variation');
    if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
    else if (diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
    else varElem.innerHTML = `<span style="color:#888">= 0</span>`;

    // 4. CONFIG
    let timeUnit = 'day';
    let displayFmt = 'dd/MM';

    // Ajustement précision selon la plage
    if (days < 0.1) { 
        timeUnit = 'minute'; // Très précis pour 1H
        displayFmt = 'HH:mm';
    } 
    else if (days === 1) { 
        timeUnit = 'hour'; 
        displayFmt = 'HH:mm';
    } 
    else if (days === 365 || days === 0) { 
        timeUnit = 'month'; 
        displayFmt = 'MMM yy'; 
    }

    const pointColors = dataset.map((_, i) => i === dataset.length - 1 ? '#ff5555' : '#ffce00');
    const pointRadiuses = dataset.map((_, i) => i === dataset.length - 1 ? 5 : 3);

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
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointRadius: pointRadiuses,
                pointHoverRadius: 7
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: {display:false} },
            scales: { 
                x: { 
                    type: 'time', 
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

// --- PUBLIC ---
async function loadPublicProfile(tag) {
    document.getElementById('public-actions').classList.remove('hidden');
    document.getElementById('burger-menu').classList.add('hidden');
    try {
        const res = await fetch(`${API_URL}/api/public/player/${tag}`);
        const data = await res.json();
        
        currentUserTier = 'basic'; 
        
        // 2. On MASQUE le badge pour les visiteurs
        document.getElementById('tier-badge').classList.add('hidden');

        renderProfile(data);
        loadBrawlersGrid(data.brawlers);
        
        // Graphique verrouillé
        loadHistoryChart(null, data.trophies);

    } catch (e) { alert("Joueur introuvable"); }
}

function publicSearch() {
    const tag = document.getElementById('public-tag').value.trim().replace('#', '');
    if(tag) window.location.href = `dashboard.html?tag=${tag}`;
}
