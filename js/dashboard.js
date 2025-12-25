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
        
        // Sauvegarde intervalle pour le timer
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
        // Format reçu API : "0xFF123456" (ARGB)
        // On veut CSS : "#123456"
        let color = data.nameColor;
        if (color.startsWith('0x')) {
            // On retire '0x' (2 chars) + 'FF' (2 chars d'opacité) = 4 chars
            // Si la chaîne est assez longue (ex: 0xFFRRGGBB)
            if (color.length >= 10) {
                color = '#' + color.slice(4);
            } else {
                color = '#' + color.slice(2); // Cas rare sans alpha
            }
        }
        nameElem.style.color = color;
        // Petit effet néon avec la couleur du joueur
        nameElem.style.textShadow = `0 0 15px ${color}66`; 
    } else {
        nameElem.style.color = '#ffffff';
        nameElem.style.textShadow = 'none';
    }

    document.getElementById('player-tag').innerText = data.tag;
    
    // Note : Le badge est recréé ici, mais masqué/affiché ensuite par la fonction appelante
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
    if (fullHistoryData.length > 0) {
        oldestDate = new Date(fullHistoryData[0].date);
    }
    
    const now = new Date();
    const diffHours = (now - oldestDate) / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

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

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    let btnId = 'btn-all';
    if(days < 0.1) btnId = 'btn-1h';
    else if(days === 1) btnId = 'btn-24h';
    else if(days === 7) btnId = 'btn-7d';
    else if(days === 31) btnId = 'btn-31d';
    else if(days === 365) btnId = 'btn-365d';
    
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');

    let data = [];
    let rawData = [...fullHistoryData];

    if (currentLiveTrophies) {
        rawData.push({ date: new Date().toISOString(), trophies: currentLiveTrophies });
    }

    if (days > 0) {
        const limit = new Date(); 
        if (days < 0.1) {
            limit.setMinutes(new Date().getMinutes() - 60);
        } else if (days === 1) {
            limit.setHours(new Date().getHours() - 24);
        } else {
            limit.setDate(new Date().getDate() - days);
        }
        data = rawData.filter(i => new Date(i.date) >= limit);
    } else {
        data = rawData; 
    }

    const dataset = data.map(h => ({ x: h.date, y: h.trophies }));
    if(dataset.length === 0) return;

    const startVal = dataset[0].y;
    const endVal = dataset[dataset.length - 1].y;
    const diff = endVal - startVal;
    
    const varElem = document.getElementById('trophy-variation');
    if(varElem) {
        if (diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
        else if (diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
        else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
    }

    let timeUnit = 'day';
    let displayFmt = 'dd/MM';

    if (days < 0.1) { timeUnit = 'minute'; displayFmt = 'HH:mm'; } 
    else if (days === 1) { timeUnit = 'hour'; displayFmt = 'HH:mm'; } 
    else if (days === 365 || days === 0) { timeUnit = 'month'; displayFmt = 'MMM yy'; }

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
        
        // Mode public = Grade Basic par défaut pour le style, mais on va le cacher
        currentUserTier = 'basic'; 
        renderProfile(data);

        // MODE PUBLIC : On FORCE le masquage du grade (overwrite le renderProfile)
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
