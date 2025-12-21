// Remplace par ton URL API
const API_URL = "https://api.brawl-track.com"; 

// --- GESTION NAVIGATION ---
function toggleForms() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
}

// --- RECHERCHE PUBLIQUE ---
function publicSearch() {
    const tag = document.getElementById('public-tag').value.replace('#', '');
    if(tag) {
        window.location.href = `dashboard.html?tag=${tag}`;
    }
}

// --- AUTHENTIFICATION (Login/Register) ---
// ... (Garde tes fonctions login() et register() existantes ici) ...
// Pour gagner de la place, je ne les recopie pas si tu les as déjà, 
// sinon demande-moi et je te remets le bloc entier.
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = "dashboard.html";
        } else {
            document.getElementById('message').innerText = data.message;
        }
    } catch (error) { console.error(error); }
}

async function register() {
     const username = document.getElementById('reg-username').value;
    const tag = document.getElementById('reg-tag').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, tag, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert("Compte créé ! Connecte-toi maintenant.");
            toggleForms();
        } else {
            document.getElementById('message').innerText = "Erreur: " + data.message;
        }
    } catch (error) {
        document.getElementById('message').innerText = "Erreur de connexion au serveur.";
        console.error(error);
    }
}

// --- LOGOUT ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = "index.html";
}

// --- MODE PRIVÉ : CHECK AUTH ---
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = "index.html";
    
    // Affichage des boutons membres
    document.getElementById('auth-actions').classList.remove('hidden');
    document.getElementById('chart-container').classList.remove('hidden');
    loadMyStats();
}

// --- CHARGEMENT PROFIL PUBLIC ---
async function loadPublicProfile(tag) {
    document.getElementById('public-actions').classList.remove('hidden');
    
    try {
        // 1. Infos Joueur
        const res = await fetch(`${API_URL}/api/public/player/${tag}`);
        const data = await res.json();
        renderProfile(data);

        // 2. Liste Brawlers (pour l'affichage gris/couleur)
        loadBrawlersGrid(data.brawlers); // On passe les brawlers possédés
    } catch (e) {
        alert("Joueur introuvable !");
        window.location.href = "index.html";
    }
}

// --- CHARGEMENT PROFIL PRIVÉ ---
async function loadMyStats() {
    const token = localStorage.getItem('token');
    try {
        // 1. Infos & Update DB
        const res = await fetch(`${API_URL}/api/my-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        renderProfile(data);

        // 2. Brawlers
        loadBrawlersGrid(data.brawlers);

        // 3. Graphique Historique
        loadHistoryChart(token);

    } catch (e) { console.error(e); }
}

// --- RENDU HTML COMMUN (Stats) ---
function renderProfile(data) {
    document.getElementById('player-name').innerText = data.name;
    document.getElementById('player-name').style.color = "#" + data.nameColor.replace('0xff', '');
    document.getElementById('player-tag').innerText = data.tag;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>Record</div><div class="stat-value">📈 ${data.highestTrophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
    `;
}

// --- LOGIQUE BRAWLERS (Grisés vs Débloqués) ---
async function loadBrawlersGrid(ownedBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    grid.innerHTML = '<p style="color:#888">Chargement des brawlers...</p>';

    // 1. On récupère la liste complète des brawlers du jeu
    const res = await fetch(`${API_URL}/api/brawlers`);
    const allBrawlersData = await res.json();
    const allBrawlers = allBrawlersData.items; [span_0](start_span)// L'API renvoie { items: [...] }[span_0](end_span)

    grid.innerHTML = ''; // Vide le chargement

    // 2. On trie par rareté ou ID (optionnel, ici par ID implicite)
    
    // 3. On génère les cartes
    allBrawlers.forEach(brawler => {
        // Est-ce que le joueur possède ce brawler ?
        const isOwned = ownedBrawlers.find(b => b.id === brawler.id);

        const card = document.createElement('div');
        card.style.textAlign = 'center';
        card.style.opacity = isOwned ? '1' : '0.3'; // Grisé si pas possédé
        card.style.filter = isOwned ? 'none' : 'grayscale(100%)';

        // URL image (On utilise Brawlify CDN qui est fiable)
        const imgUrl = `https://cdn.brawlify.com/brawlers/${brawler.id}.png`; 
        
        // Si possédé, on affiche les trophées
        const trophiesInfo = isOwned ? `<div style="font-size:0.7em; color:#ffce00;">🏆 ${isOwned.trophies}</div>` : '<div style="font-size:0.7em;">🔒</div>';

        card.innerHTML = `
            <img src="${imgUrl}" style="width: 100%; border-radius: 5px; border: 2px solid #333;" onerror="this.src='https://cdn.brawlify.com/brawlers/16000000.png'">
            <div style="font-size: 0.8em; margin-top: 2px; overflow:hidden; text-overflow:ellipsis;">${brawler.name}</div>
            ${trophiesInfo}
        `;
        grid.appendChild(card);
    });
}

// --- LOGIQUE GRAPHIQUE (Chart.js) ---
async function loadHistoryChart(token) {
    const res = await fetch(`${API_URL}/api/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const historyData = await res.json();

    // Préparation des données pour Chart.js
    const labels = historyData.map(h => new Date(h.date).toLocaleDateString());
    const dataPoints = historyData.map(h => h.trophies);

    const ctx = document.getElementById('trophyChart').getContext('2d');
    
    // Si un graph existe déjà, on le détruit pour éviter les bugs d'affichage
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
                tension: 0.3, // Courbe un peu arrondie
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false } // Pas besoin de légende
            },
            scales: {
                y: {
                    beginAtZero: false, // On zoome sur les valeurs
                    grid: { color: '#333' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}
