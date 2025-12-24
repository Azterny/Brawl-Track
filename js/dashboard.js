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

        renderProfile(data);
        
        if(typeof setupIntervalUI === 'function') setupIntervalUI(data.internal_tier, data.internal_interval);
        
        loadBrawlersGrid(data.brawlers);
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

// === C'EST ICI QUE LA MAGIE OPÈRE ===
function sortBrawlers() {
    const criteria = document.getElementById('sort-brawlers').value;
    
    globalBrawlersList.sort((a, b) => {
        // 1. TRI PRIMAIRE : Possession (Les possédés d'abord)
        if (a.owned !== b.owned) {
            return a.owned ? -1 : 1; // Si a est possédé, il passe devant b
        }

        // 2. TRI SECONDAIRE : Critère choisi (si statut de possession identique)
        if (criteria === 'trophies') {
            return b.trophies - a.trophies;
        } else if (criteria === 'name') {
            return a.name.localeCompare(b.name);
        } else {
            return a.id - b.id; // Par défaut : ID
        }
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

// --- GRAPHIQUE ---
async function loadHistoryChart(token, liveTrophies) {
    currentLiveTrophies = liveTrophies;
    try {
        const res = await fetch(`${API_URL}/api/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) fullHistoryData = await res.json();
        else fullHistoryData = [];
    } catch(e) { fullHistoryData = []; }
    updateChartFilter(0);
}

function updateChartFilter(days) {
    const canvas = document.getElementById('trophyChart');
    if (!canvas) return;

    let data = [...fullHistoryData];
    if (days > 0) {
        const limit = new Date(); 
        limit.setDate(new Date().getDate() - days);
        data = fullHistoryData.filter(i => new Date(i.date) >= limit);
    }

    const dataset = data.map(h => ({ x: h.date, y: h.trophies }));
    if (currentLiveTrophies) dataset.push({ x: new Date().toISOString(), y: currentLiveTrophies });
    
    if(dataset.length === 0) return;

    const ctx = canvas.getContext('2d');
    if(window.myChart) window.myChart.destroy();
    
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: { 
            datasets: [{ 
                label: 'Trophées', data: dataset, 
                borderColor: '#ffce00', backgroundColor: 'rgba(255, 206, 0, 0.1)', 
                borderWidth: 2, tension: 0.1, fill: true, pointRadius: 3 
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: {display:false} },
            scales: { 
                x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'dd/MM' } }, grid: {color:'#333'} }, 
                y: { grid: {color:'#333'} } 
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
        renderProfile(data);
        loadBrawlersGrid(data.brawlers);
    } catch (e) { alert("Joueur introuvable"); }
}

function publicSearch() {
    const tag = document.getElementById('public-tag').value.trim().replace('#', '');
    if(tag) window.location.href = `dashboard.html?tag=${tag}`;
}
