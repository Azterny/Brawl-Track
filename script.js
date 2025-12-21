const API_URL = "https://api.brawl-track.com"; 

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
        loadBrawlersGrid(data.brawlers); // On passe la liste des brawlers du joueur

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

        // 3. Graphique
        loadHistoryChart(token);

    } catch (e) {
        console.error(e);
        logout();
    }
}

// --- RENDU UI ---
function renderProfile(data) {
    const nameEl = document.getElementById('player-name');
    nameEl.innerText = data.name;
    // Gestion couleur nom (ex: 0xffffffff -> #ffffff)
    if(data.nameColor) {
        nameEl.style.color = "#" + data.nameColor.replace('0x', '').slice(2);
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

    // Récupérer TOUS les brawlers du jeu
    const res = await fetch(`${API_URL}/api/brawlers`);
    const globalData = await res.json();
    const allBrawlers = globalData.items;

    grid.innerHTML = '';

    allBrawlers.forEach(brawler => {
        // Le joueur possède-t-il ce brawler ?
        const owned = playerBrawlers.find(pb => pb.id === brawler.id);

        const div = document.createElement('div');
        div.className = 'brawler-card';
        
        // Style Grisé ou Normal
        if (!owned) {
            div.style.filter = "grayscale(100%) opacity(0.4)";
        } else {
            div.style.border = "1px solid #ffce00";
        }
        const formattedName = brawler.name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');

        const imgUrl = `https://cdn.brawlify.com/brawlers/${formattedName}.png`; 
        
        const trophiesInfo = isOwned 
            ? `<div style="font-size:0.7em; color:#ffce00;">🏆 ${isOwned.trophies}</div>` 
            : '<div style="font-size:0.7em;">🔒</div>';
        
        card.innerHTML = `
            <img src="${imgUrl}" 
                 style="width: 100%; border-radius: 5px; border: 2px solid #333; aspect-ratio: 1/1; object-fit: cover;" 
                 onerror="this.onerror=null; this.src='https://cdn-old.brawlify.com/icon/Bit.png';">
            <div style="font-size: 0.8em; margin-top: 2px; overflow:hidden; text-overflow:ellipsis; white-space: nowrap;">${brawler.name}</div>
            ${trophiesInfo}
        `;
        grid.appendChild(card);
    });
    }

async function loadHistoryChart(token) {
    const res = await fetch(`${API_URL}/api/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const history = await res.json();

    const ctx = document.getElementById('trophyChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.date).toLocaleDateString(undefined, {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'})),
            datasets: [{
                label: 'Trophées',
                data: history.map(h => h.trophies),
                borderColor: '#ffce00',
                backgroundColor: 'rgba(255, 206, 0, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#333' } },
                x: { display: false }
            }
        }
    });
}
