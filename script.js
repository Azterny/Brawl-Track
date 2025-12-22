const API_URL = "https://api.brawl-track.com"; 
let fullHistoryData = [];
let currentLiveTrophies = null; // Stocke le score actuel en temps réel

// --- GESTION NAVIGATION ---
function toggleForms() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
    document.getElementById('message').innerText = "";
}

function publicSearch() {
    const tag = document.getElementById('public-tag').value.trim().replace('#', '');
    if(tag) {
        window.location.href = `dashboard.html?tag=${tag}`;
    }
}

// --- AUTHENTIFICATION ---
async function register() {
    const username = document.getElementById('reg-username').value;
    const tag = document.getElementById('reg-tag').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, tag, password })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Compte créé ! Connecte-toi.");
            toggleForms();
        } else {
            document.getElementById('message').innerText = data.message;
        }
    } catch (e) { document.getElementById('message').innerText = "Erreur serveur"; }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = "dashboard.html";
        } else {
            document.getElementById('message').innerText = data.message;
        }
    } catch (e) { document.getElementById('message').innerText = "Erreur serveur"; }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = "index.html";
}

// --- CHARGEMENT MODES ---

// Mode Privé
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = "index.html";
    
    document.getElementById('auth-actions').classList.remove('hidden');
    document.getElementById('chart-container').classList.remove('hidden');
    
    loadMyStats(); 
}

// Mode Public
async function loadPublicProfile(tag) {
    document.getElementById('public-actions').classList.remove('hidden');
    document.getElementById('dashboard-msg').innerText = "Mode Public (Lecture seule)";
    
    try {
        const res = await fetch(`${API_URL}/api/public/player/${tag}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message);

        renderProfile(data);
        loadBrawlersGrid(data.brawlers);

    } catch (e) {
        alert("Joueur introuvable !");
        window.location.href = "index.html";
    }
}

async function loadMyStats() {
    const token = localStorage.getItem('token');
    document.getElementById('dashboard-msg').innerText = "Actualisation...";
    
    try {
        // 1. Stats
        const res = await fetch(`${API_URL}/api/my-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error("Erreur auth");

        renderProfile(data);
        document.getElementById('dashboard-msg').innerText = "Dernière synchro : À l'instant";

        // 2. Brawlers
        loadBrawlersGrid(data.brawlers);

        // 3. Graphique (On passe les trophées actuels pour le point rouge)
        loadHistoryChart(token, data.trophies);

    } catch (e) {
        console.error(e);
        logout();
    }
}

// --- RENDU UI ---
function renderProfile(data) {
    const nameEl = document.getElementById('player-name');
    nameEl.innerText = data.name;
    
    if(data.nameColor && data.nameColor.length > 4) {
        try {
            nameEl.style.color = "#" + data.nameColor.replace('0x', '').slice(2);
        } catch(e) { console.warn("Erreur couleur", e); }
    }

    document.getElementById('player-tag').innerText = data.tag;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>Record</div><div class="stat-value">📈 ${data.highestTrophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
        <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
    `;
}

// --- GRILLE BRAWLERS ---
async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    grid.innerHTML = '<p>Chargement collection...</p>';

    const res = await fetch(`${API_URL}/api/brawlers`);
    const globalData = await res.json();
    const allBrawlers = globalData.items;

    grid.innerHTML = '';

    allBrawlers.forEach(brawler => {
        const owned = playerBrawlers.find(pb => pb.id === brawler.id);

        const div = document.createElement('div');
        div.className = 'brawler-card';
        
        if (!owned) {
            div.style.filter = "grayscale(100%) opacity(0.4)";
        } else {
            div.style.border = "1px solid #ffce00";
        }
        
        const formattedName = brawler.name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
        const imgUrl = `https://cdn.brawlify.com/brawlers/${formattedName}.png`; 
        
        const trophiesInfo = owned 
            ? `<div style="font-size:0.7em; color:#ffce00;">🏆 ${owned.trophies}</div>` 
            : '<div style="font-size:0.7em;">🔒</div>';
        
        div.innerHTML = `
            <img src="${imgUrl}" 
                 style="width: 100%; border-radius: 5px; border: 2px solid #333; aspect-ratio: 1/1; object-fit: cover;" 
                 onerror="this.onerror=null; this.src='https://cdn-old.brawlify.com/icon/Bit.png';">
            <div style="font-size: 0.8em; margin-top: 2px; overflow:hidden; text-overflow:ellipsis; white-space: nowrap;">${brawler.name}</div>
            ${trophiesInfo}
        `;
        grid.appendChild(div);
    });
}

// --- GRAPHIQUE HISTORIQUE ---
async function loadHistoryChart(token, liveTrophies) {
    document.getElementById('archive-manager').classList.remove('hidden');
    
    // On sauvegarde le score actuel pour l'utiliser dans le filtre
    currentLiveTrophies = liveTrophies;

    const res = await fetch(`${API_URL}/api/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    fullHistoryData = await res.json(); 

    updateChartFilter(0);
}

function updateChartFilter(days) {
    if(!fullHistoryData.length && currentLiveTrophies === null) return;

    let filteredData = [];
    const now = new Date();

    // 1. Filtrer l'historique
    if (days === 0) {
        filteredData = [...fullHistoryData]; // Copie
    } else {
        const limitDate = new Date();
        limitDate.setDate(now.getDate() - days);
        filteredData = fullHistoryData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= limitDate;
        });
    }

    // 2. Préparer les données pour le Graph
    const labels = filteredData.map(h => new Date(h.date).toLocaleDateString());
    const dataPoints = filteredData.map(h => h.trophies);
    
    // Créer un tableau de couleurs (Jaune par défaut)
    const pointColors = new Array(dataPoints.length).fill('#ffce00');
    const pointRadius = new Array(dataPoints.length).fill(3);

    // 3. Ajouter le point "LIVE" (Rouge) si disponible
    if (currentLiveTrophies !== null) {
        labels.push("Maintenant");
        dataPoints.push(currentLiveTrophies);
        pointColors.push('#ff0000'); // Rouge pour le dernier point
        pointRadius.push(5);         // Un peu plus gros
    }

    // Calcul du GAIN (Différence entre Live et le plus vieux point affiché)
    if (dataPoints.length > 0) {
        const first = dataPoints[0];
        const last = dataPoints[dataPoints.length - 1]; // Le live
        const gain = last - first;
        const sign = gain >= 0 ? '+' : '';
        document.getElementById('trophy-gain').innerText = `Gain: ${sign}${gain} 🏆`;
    } else {
        document.getElementById('trophy-gain').innerText = "Pas de données";
    }

    // Mise à jour du Graphique
    const ctx = document.getElementById('trophyChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Trophées',
                data: dataPoints,
                borderColor: '#ffce00',
                backgroundColor: 'rgba(255, 206, 0, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                // Configuration des points
                pointBackgroundColor: pointColors, 
                pointBorderColor: pointColors,
                pointRadius: pointRadius,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#333' } },
                x: { grid: { display: false }, ticks: { display: false } } 
            }
        }
    });
}

// --- ARCHIVE ET DELETE --- (Reste identique)
async function manualArchive() {
    const token = localStorage.getItem('token');
    if(!confirm("Voulez-vous forcer la création d'un point de sauvegarde maintenant ?")) return;

    try {
        const res = await fetch(`${API_URL}/api/archive/manual`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        // On relance la fonction, mais comme on n'a pas les trophées "live" sous la main facilement ici,
        // on recharge toute la page ou on refait un loadMyStats.
        // Option simple : loadMyStats()
        loadMyStats(); 
    } catch(e) { alert("Erreur connexion"); }
}

const deleteSelect = document.getElementById('delete-select');
if (deleteSelect) {
    deleteSelect.addEventListener('change', function() {
        const input = document.getElementById('custom-days');
        if(this.value === 'custom') input.style.display = 'inline-block';
        else input.style.display = 'none';
    });
}

async function deleteArchives() {
    const token = localStorage.getItem('token');
    const select = document.getElementById('delete-select');
    let mode = 'older_than';
    let days = select.value;

    if (days === 'all') mode = 'all';
    if (days === 'custom') days = document.getElementById('custom-days').value;

    if(!days && mode !== 'all') return alert("Veuillez entrer un nombre de jours.");

    if(!confirm("⚠️ Attention, cette action est irréversible. Confirmer la suppression ?")) return;

    try {
        const res = await fetch(`${API_URL}/api/archive/delete`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ mode: mode, days: days })
        });
        const data = await res.json();
        alert(data.message);
        loadMyStats(); // Recharger tout pour avoir le live à jour
    } catch(e) { alert("Erreur suppression"); }
}
