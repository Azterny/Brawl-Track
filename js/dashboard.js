// --- VARIABLES GLOBALES ---
let currentChartMode = 0;   // 0=Tout, 1=Jour, 7=Semaine
let currentChartOffset = 0;
let currentTagString = null; // Le tag affiché (ex: #XXXX)

// Variables spécifiques Brawlers
let currentBrawlerHistory = [];
let currentBrawlerMode = 0;
let brawlerChartInstance = null;

// --- INITIALISATION DU DASHBOARD ---
async function initDashboard() {
    const urlParams = new URLSearchParams(window.location.search);
    const tag = urlParams.get('tag');

    if (!tag) {
        // Pas de tag ? Retour accueil
        window.location.href = "index.html";
        return;
    }

    currentTagString = tag.toUpperCase().replace('#', '');
    
    // Charger les données publiques du Tag
    await loadTagData(currentTagString);
    
    // Vérifier si l'utilisateur connecté peut claim ce tag
    checkClaimStatus();
}

// --- CHARGEMENT DONNÉES ---
async function loadTagData(tag) {
    try {
        // On utilise l'endpoint public (défini dans js/index.js précédemment)
        // Note: Assurez-vous que votre backend (app_api.py) supporte /api/public/player/{tag}
        // ou adaptez l'URL ici selon votre route backend réelle.
        const res = await fetch(`${API_URL}/api/public/player/${tag}`);
        
        if (!res.ok) throw new Error("Joueur introuvable");
        
        const data = await res.json();
        
        // 1. Rendu Profil
        renderProfile(data);
        
        // 2. Grille Brawlers
        await loadBrawlersGrid(data.brawlers);
        
        // 3. Graphique Principal (Historique)
        // En mode public/basic, on passe les trophées actuels
        // Si l'API renvoie un historique partiel, on l'utilise
        loadHistoryChart(data.history || [], data.trophies);

    } catch (e) {
        console.error(e);
        document.getElementById('player-name').innerText = "Erreur / Introuvable";
        alert("Impossible de charger ce tag.");
        window.location.href = "index.html";
    }
}

function renderProfile(data) {
    const nameElem = document.getElementById('player-name');
    nameElem.innerText = data.name;
    
    // Gestion couleur nom
    if (data.nameColor) {
        let color = data.nameColor;
        if (color.startsWith('0x')) color = '#' + (color.length >= 10 ? color.slice(4) : color.slice(2));
        nameElem.style.color = color;
        nameElem.style.textShadow = `0 0 15px ${color}66`;
    } else {
        nameElem.style.color = '#ffffff';
        nameElem.style.textShadow = 'none';
    }

    document.getElementById('player-tag').innerText = '#' + currentTagString;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
        <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
    `;
}

// --- LOGIQUE CLAIM (Connexion requise) ---
function checkClaimStatus() {
    const token = localStorage.getItem('token');
    if (!token) return; // Pas connecté, rien à faire

    // Ici, on pourrait faire un appel API pour savoir si ce tag appartient déjà
    // à l'utilisateur connecté ou à quelqu'un d'autre.
    // Pour l'instant, on affiche juste un bouton "CLAIM" visuel qui déclenchera l'action.
    
    const actionsDiv = document.getElementById('header-actions');
    
    const claimBtn = document.createElement('button');
    claimBtn.innerText = "⚡ CLAIM";
    claimBtn.style.background = "linear-gradient(to bottom, #ffce00, #e6b800)";
    claimBtn.style.color = "black";
    claimBtn.style.width = "auto";
    claimBtn.style.margin = "0";
    claimBtn.style.padding = "5px 15px";
    claimBtn.style.fontWeight = "bold";
    
    claimBtn.onclick = () => claimTagAction();
    
    // On l'ajoute au début des actions
    actionsDiv.prepend(claimBtn);
}

async function claimTagAction() {
    if(!confirm("Voulez-vous lier ce Tag à votre compte ?")) return;
    
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/api/claim-tag`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tag: currentTagString })
        });
        
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            // Redirection vers userhome (future page)
            window.location.href = "userhome.html";
        } else {
            alert("⚠️ " + data.message);
        }
    } catch (e) {
        alert("Erreur de connexion");
    }
}

// --- GRILLE BRAWLERS (Similaire à avant) ---
async function loadBrawlersGrid(playerBrawlers) {
    const grid = document.getElementById('brawlers-grid');
    if(!grid) return;
    
    // On charge la liste globale des brawlers (noms, images)
    if (globalBrawlersList.length === 0) {
        try {
            const res = await fetch(`${API_URL}/api/brawlers`);
            const data = await res.json();
            globalBrawlersList = data.items || [];
        } catch(e) { console.error("Err brawlers list", e); }
    }
    
    // Fusion des données
    // playerBrawlers contient {id, trophies, ...} pour le joueur
    const displayList = globalBrawlersList.map(b => {
        const owned = playerBrawlers.find(pb => pb.id === b.id);
        return { 
            id: b.id, 
            name: b.name, 
            imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png`, 
            owned: !!owned, 
            trophies: owned ? owned.trophies : 0,
            change24h: owned ? (owned.trophy_change_24h || 0) : 0
        };
    });

    // Sauvegarde pour le tri
    window.currentBrawlersDisplay = displayList;
    sortBrawlers();
}

function sortBrawlers() {
    if (!window.currentBrawlersDisplay) return;
    
    const criteria = document.getElementById('sort-brawlers').value;
    window.currentBrawlersDisplay.sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? -1 : 1; 
        if (criteria === 'trophies') return b.trophies - a.trophies;
        else if (criteria === 'name') return a.name.localeCompare(b.name);
        else return a.id - b.id; 
    });
    renderBrawlersGrid();
}

function renderBrawlersGrid() {
    const grid = document.getElementById('brawlers-grid');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    window.currentBrawlersDisplay.forEach(b => {
        const card = document.createElement('div');
        card.className = 'brawler-card';

        if (!b.owned) {
            card.style.filter = "grayscale(100%) opacity(0.3)";
            card.style.cursor = "default";
        } else {
            card.style.border = "1px solid #ffce00";
            card.style.cursor = "pointer";
            card.onclick = () => goToBrawlerStats(b.id, b.name);
        }

        const img = document.createElement('img');
        img.src = b.imageUrl;
        img.style.width = '100%';
        img.style.aspectRatio = '1/1';
        img.style.objectFit = 'contain';
        img.loading = 'lazy';
        img.alt = b.name;

        const nameDiv = document.createElement('div');
        nameDiv.style.fontSize = '0.8em';
        nameDiv.style.overflow = 'hidden';
        nameDiv.style.textOverflow = 'ellipsis';
        nameDiv.style.whiteSpace = 'nowrap';
        nameDiv.textContent = b.name; 

        card.appendChild(img);
        card.appendChild(nameDiv);

        if (b.owned) {
            const trophyDiv = document.createElement('div');
            trophyDiv.style.color = '#ffce00';
            trophyDiv.style.fontSize = '0.7em';
            trophyDiv.style.marginTop = '2px';
            trophyDiv.textContent = `🏆 ${b.trophies}`;
            
            if (b.change24h !== 0) {
                 const arrow = document.createElement('span');
                 arrow.textContent = b.change24h > 0 ? ' ↗' : ' ↘';
                 arrow.style.color = b.change24h > 0 ? '#28a745' : '#ff5555';
                 trophyDiv.appendChild(arrow);
            }
            card.appendChild(trophyDiv);
        }
        grid.appendChild(card);
    });
}

function goToBrawlerStats(id, name) {
    switchView('brawlers');
    document.getElementById('selected-brawler-id').value = id;
    document.getElementById('selected-brawler-name').textContent = name;
    
    // Image
    const b = window.currentBrawlersDisplay.find(x => x.id == id);
    if(b) document.getElementById('selected-brawler-img').src = b.imageUrl;

    // Charger historique brawler (Via API publique si dispo, sinon vide pour l'instant)
    // TODO: Adapter endpoint pour historique brawler public
    renderBrawlerChart([]); 
}


// --- GRAPHIQUES (Moteur Générique) ---

// Charge l'historique principal
function loadHistoryChart(historyData, currentTrophies) {
    fullHistoryData = historyData || [];
    currentLiveTrophies = currentTrophies;
    
    // On débloque le graphique (pas de lockChart)
    manageGenericFilters(fullHistoryData, 'btn');
    setChartMode(0); // Vue "Tout" par défaut
}

function setChartMode(mode) {
    currentChartMode = mode;
    currentChartOffset = 0;
    renderMainChart();
}

function renderMainChart() {
    // UI Boutons
    document.querySelectorAll('.filter-btn:not(.filter-brawler-btn)').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-all';
    if(currentChartMode === 1) btnId = 'btn-24h';
    else if(currentChartMode === 7) btnId = 'btn-7d';
    const activeBtn = document.getElementById(btnId);
    if(activeBtn) activeBtn.classList.add('active');
    
    if(window.myChart) window.myChart.destroy();

    // APPEL GÉNÉRIQUE
    window.myChart = renderGenericChart({
        canvasId: 'trophyChart',
        rawData: fullHistoryData,
        mode: currentChartMode,
        offset: currentChartOffset,
        liveValue: currentLiveTrophies,
        color: '#ffce00',
        variationId: 'trophy-variation'
    });
}

// Wrapper pour Brawler Chart (Vide pour l'instant en mode public basic)
function setBrawlerChartMode(mode) {
    currentBrawlerMode = mode;
    renderBrawlerChart([]); // Pas de data brawler spécifique pour le moment
}

function renderBrawlerChart(data) {
    if(brawlerChartInstance) brawlerChartInstance.destroy();
    
    brawlerChartInstance = renderGenericChart({
        canvasId: 'brawlerChartCanvas',
        rawData: data || [],
        mode: currentBrawlerMode,
        offset: 0,
        liveValue: null,
        color: '#00d2ff',
        variationId: 'brawler-trophy-variation',
        isBrawler: true
    });
}

// --- UTILITAIRES GRAPHIQUES ---
// (Identiques à l'ancien code, simplifiés)
function manageGenericFilters(data, idPrefix) {
    // Active/Désactive boutons selon la quantité de données
    // ... (Logique simplifiée pour Basic)
}

function renderGenericChart(config) {
    let { rawData, mode, offset, liveValue, color, canvasId, variationId, isBrawler } = config;
    
    // Construction des points (Simplifiée pour l'exemple)
    let finalDataPoints = [];
    
    if (rawData && rawData.length > 0) {
        rawData.forEach(pt => {
             finalDataPoints.push({ x: pt.date || pt.recorded_at, y: pt.trophies });
        });
    }
    // Ajout point Live
    if (liveValue) {
        finalDataPoints.push({ x: new Date().toISOString(), y: liveValue, type: 'live' });
    }

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
        type: 'line',
        data: { 
            datasets: [{ 
                label: 'Trophées', 
                data: finalDataPoints, 
                borderColor: color, 
                backgroundColor: color + '1A', 
                borderWidth: 2, 
                fill: true,
                pointRadius: 3
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { type: 'time', time: { unit: 'day' }, grid: {color:'#333'} }, 
                y: { grid: {color:'#333'} } 
            },
            plugins: { legend: {display:false} }
        }
    });
}
