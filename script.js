const API_URL = "https://api.brawl-track.com"; 
let fullHistoryData = [];
let currentLiveTrophies = null;
let globalBrawlersList = [];
let currentUserTier = 'basic'; 

// --- NAVIGATION & MENU BURGER ---
function toggleMenu() {
    document.getElementById('menu-dropdown').classList.toggle('active');
}

window.addEventListener('click', function(e) {
    if (!document.getElementById('burger-menu').contains(e.target)) {
        document.getElementById('menu-dropdown').classList.remove('active');
    }
});

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.getElementById('menu-dropdown').classList.remove('active');
}

// --- AUTHENTIFICATION ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = "index.html";
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = "index.html";
    document.getElementById('burger-menu').classList.remove('hidden');
    loadMyStats(); 
}

// --- CHARGEMENT PRINCIPAL ---
async function loadMyStats() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/api/my-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error("Session expirée");

        currentUserTier = data.internal_tier || 'basic';
        
        renderProfile(data);
        setupIntervalUI(data.internal_tier, data.internal_interval);
        loadBrawlersGrid(data.brawlers);
        loadHistoryChart(token, data.trophies);

    } catch (e) {
        console.error(e);
        logout();
    }
}

// --- RENDU PROFIL & BADGE ---
function renderProfile(data) {
    document.getElementById('player-name').innerText = data.name;
    document.getElementById('player-tag').innerText = data.tag;
    
    const badge = document.getElementById('tier-badge');
    badge.className = `badge badge-${currentUserTier}`;
    
    let tierText = "Basic";
    if (currentUserTier === 'subscriber') tierText = "Abonné";
    if (currentUserTier === 'premium') tierText = "Premium";
    badge.innerText = tierText;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
        <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
    `;
}

// --- CONFIGURATION INTERVALLE AUTO ---
function setupIntervalUI(tier, currentInterval) {
    const basicDiv = document.getElementById('interval-basic');
    const customDiv = document.getElementById('interval-custom');
    const msg = document.getElementById('interval-limit-msg');

    basicDiv.classList.add('hidden');
    customDiv.classList.add('hidden');

    if (tier === 'basic') {
        basicDiv.classList.remove('hidden');
        document.getElementById('select-interval-basic').value = currentInterval || 720;
    } else {
        customDiv.classList.remove('hidden');
        const h = Math.floor(currentInterval / 60);
        const m = currentInterval % 60;
        document.getElementById('input-hours').value = h;
        document.getElementById('input-minutes').value = m;

        if (tier === 'subscriber') {
            msg.innerText = "⭐ Abonné : Minimum 1 Heure (Minutes ignorées).";
            document.getElementById('input-minutes').disabled = true;
            document.getElementById('input-minutes').value = 0;
        } else {
            msg.innerText = "👑 Premium : Minimum 15 Minutes.";
            document.getElementById('input-minutes').disabled = false;
        }
    }
}

async function saveInterval() {
    const token = localStorage.getItem('token');
    let minutes = 720;

    if (currentUserTier === 'basic') {
        minutes = parseInt(document.getElementById('select-interval-basic').value);
    } else {
        const h = parseInt(document.getElementById('input-hours').value) || 0;
        const m = parseInt(document.getElementById('input-minutes').value) || 0;
        minutes = (h * 60) + m;
    }

    try {
        const res = await fetch(`${API_URL}/api/settings/interval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ minutes: minutes })
        });
        const data = await res.json();
        if(res.ok) alert("✅ " + data.message);
        else alert("❌ " + data.message);
    } catch(e) { alert("Erreur serveur"); }
}

// --- PARAMÈTRES COMPTE ---
async function updateProfile() {
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    if(!username && !password) return alert("Remplissez au moins un champ.");

    try {
        const res = await fetch(`${API_URL}/api/settings/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        alert(data.message);
    } catch(e) { alert("Erreur serveur"); }
}

async function deleteAccount() {
    if(!confirm("⚠️ Êtes-vous sûr de vouloir supprimer votre compte DÉFINITIVEMENT ?")) return;
    try {
        await fetch(`${API_URL}/api/settings/delete-account`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        alert("Compte supprimé.");
        logout();
    } catch(e) { alert("Erreur serveur"); }
}

// --- BRAWLERS ---
async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    grid.innerHTML = '<p>Chargement...</p>';
    try {
        const res = await fetch(`${API_URL}/api/brawlers`);
        const data = await res.json();
        const allBrawlers = data.items || [];

        globalBrawlersList = allBrawlers.map(b => {
            const owned = playerBrawlers.find(pb => pb.id === b.id);
            return {
                id: b.id, name: b.name, 
                imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png`,
                owned: !!owned, trophies: owned ? owned.trophies : 0
            };
        });
        sortBrawlers();
    } catch(e) { grid.innerHTML = 'Erreur chargement'; }
}

function sortBrawlers() {
    const criteria = document.getElementById('sort-brawlers').value;
    if (criteria === 'trophies') globalBrawlersList.sort((a, b) => b.trophies - a.trophies);
    else if (criteria === 'name') globalBrawlersList.sort((a, b) => a.name.localeCompare(b.name));
    else globalBrawlersList.sort((a, b) => a.id - b.id);
    renderBrawlersGrid();
}

function renderBrawlersGrid() {
    const grid = document.getElementById('brawlers-grid');
    grid.innerHTML = '';
    globalBrawlersList.forEach(b => {
        const div = document.createElement('div');
        div.className = 'brawler-card';
        if (!b.owned) div.style.filter = "grayscale(100%) opacity(0.3)";
        else div.style.border = "1px solid #ffce00";
        
        div.innerHTML = `
            <img src="${b.imageUrl}" style="width:100%; aspect-ratio:1/1; object-fit:contain;" loading="lazy">
            <div style="font-size:0.8em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.name}</div>
            ${b.owned ? `<div style="color:#ffce00;font-size:0.7em;">🏆 ${b.trophies}</div>` : ''}
        `;
        grid.appendChild(div);
    });
}

// --- GRAPHIQUE HISTORIQUE (RESTAURÉ VERSION SIMPLE) ---
async function loadHistoryChart(token, liveTrophies) {
    currentLiveTrophies = liveTrophies;
    const res = await fetch(`${API_URL}/api/history`, { headers: { 'Authorization': `Bearer ${token}` } });
    fullHistoryData = await res.json(); 
    updateChartFilter(0);
}

function updateChartFilter(days) {
    if(!fullHistoryData.length && currentLiveTrophies === null) return;
    
    let filteredData = [...fullHistoryData];
    if (days > 0) {
        const limitDate = new Date();
        limitDate.setDate(new Date().getDate() - days);
        filteredData = fullHistoryData.filter(item => new Date(item.date) >= limitDate);
    }
    
    // RESTAURATION : Labels et Data séparés (pas d'objet x/y)
    const labels = filteredData.map(h => new Date(h.date).toLocaleDateString());
    const dataPoints = filteredData.map(h => h.trophies);
    
    const pointColors = new Array(dataPoints.length).fill('#ffce00');
    const pointRadius = new Array(dataPoints.length).fill(3);

    if (currentLiveTrophies !== null) {
        labels.push("Maintenant");
        dataPoints.push(currentLiveTrophies);
        pointColors.push('#ff0000');
        pointRadius.push(5);
    }

    const ctx = document.getElementById('trophyChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, // Utilisation de labels simples
            datasets: [{
                label: 'Trophées', 
                data: dataPoints, // Utilisation de data simple
                borderColor: '#ffce00', 
                backgroundColor: 'rgba(255, 206, 0, 0.1)',
                borderWidth: 2, 
                tension: 0.3, // Courbe plus douce (style initial)
                fill: true, 
                pointBackgroundColor: pointColors, 
                pointBorderColor: pointColors,
                pointRadius: pointRadius, 
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true, 
            plugins: { 
                legend: {display:false},
                tooltip: { mode: 'index', intersect: false }
            },
            scales: { 
                x: { 
                    grid: { display: false }, 
                    ticks: { display: false } // On cache les dates pour faire propre
                }, 
                y: { grid: {color:'#333'} } 
            }
        }
    });
}

// --- MODE PUBLIC & ARCHIVES ---
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

async function manualArchive() {
    const token = localStorage.getItem('token');
    if(!confirm("Créer un point de sauvegarde maintenant ?")) return;
    try {
        const res = await fetch(`${API_URL}/api/archive/manual`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        loadMyStats(); 
    } catch(e) { alert("Erreur"); }
}

async function deleteArchives() {
    const token = localStorage.getItem('token');
    const select = document.getElementById('delete-select');
    if(!confirm("Supprimer l'historique sélectionné ?")) return;
    try {
        const res = await fetch(`${API_URL}/api/archive/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ mode: select.value === 'all' ? 'all' : 'older_than', days: select.value })
        });
        const data = await res.json();
        alert(data.message);
        loadMyStats();
    } catch(e) { alert("Erreur"); }
}
