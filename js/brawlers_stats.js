// js/brawlers_stats.js

let brawlerChartInstance = null;
let currentBrawlerHistory = [];
let currentBrawlerMode = 0; // 0=Tout, 1=Jour, etc.

// Fonction appelée quand on clique sur "Stats Brawlers" dans le menu
// (Il faut modifier utils.js pour appeler ça, ou on ajoute un écouteur ici)
document.addEventListener('DOMContentLoaded', () => {
    // On observe les changements de vue pour charger la liste au bon moment
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'view-brawlers' && mutation.target.classList.contains('active')) {
                initBrawlerView();
            }
        });
    });
    
    const target = document.getElementById('view-brawlers');
    if(target) observer.observe(target, { attributes: true, attributeFilter: ['class'] });
});

function initBrawlerView() {
    const select = document.getElementById('brawler-select-dashboard');
    
    // On utilise la liste globale chargée par dashboard.js (globalBrawlersList)
    // Elle contient {id, name, owned, trophies, ...}
    if (typeof globalBrawlersList !== 'undefined' && globalBrawlersList.length > 0) {
        
        // On sauvegarde la sélection actuelle s'il y en a une
        const currentVal = select.value;
        
        select.innerHTML = "";
        
        // On filtre uniquement les brawlers POSSÉDÉS (owned)
        const ownedBrawlers = globalBrawlersList.filter(b => b.owned);
        
        // Tri par trophées décroissant
        ownedBrawlers.sort((a,b) => b.trophies - a.trophies);

        if(ownedBrawlers.length === 0) {
            select.innerHTML = "<option>Aucun brawler possédé</option>";
            return;
        }

        ownedBrawlers.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.innerText = `${b.name} (🏆 ${b.trophies})`;
            select.appendChild(opt);
        });

        // Restaurer ou sélectionner le premier
        if (currentVal && ownedBrawlers.some(b => b.id == currentVal)) {
            select.value = currentVal;
        } else {
            select.value = ownedBrawlers[0].id;
            loadSelectedBrawlerStats(); // Charger le premier par défaut
        }

    } else {
        select.innerHTML = "<option>Erreur chargement liste</option>";
    }
}

async function loadSelectedBrawlerStats() {
    const select = document.getElementById('brawler-select-dashboard');
    const brawlerId = select.value;
    if(!brawlerId) return;

    const token = localStorage.getItem('token');

    try {
        // Appel à la NOUVELLE route API utilisateur
        const res = await fetch(`${API_URL}/api/my-brawler-history/${brawlerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if(res.ok) {
            currentBrawlerHistory = await res.json();
            renderBrawlerChart();
        } else {
            currentBrawlerHistory = [];
            renderBrawlerChart(); // Affichera un graph vide
        }

    } catch(e) {
        console.error("Erreur graph brawler", e);
    }
}

// --- GESTION DES FILTRES (Copie adaptée de dashboard.js) ---
function setBrawlerChartMode(mode) {
    currentBrawlerMode = mode;
    renderBrawlerChart();
}

function renderBrawlerChart() {
    // Gestion Boutons UI
    document.querySelectorAll('.filter-brawler-btn').forEach(btn => btn.classList.remove('active'));
    let btnId = 'btn-brawler-all';
    // Mapping simple pour l'exemple (à affiner selon tes IDs HTML)
    // Ici on suppose que le bouton cliqué gère sa classe active, 
    // ou on le refait logic :
    // (Pour simplifier, on laisse l'utilisateur cliquer, l'UI se mettra à jour via CSS si on ajoute les IDs spécifiques)
    
    // Calcul Date Début / Fin selon le mode
    let startDate = null;
    let endDate = new Date(); // Maintenant
    const now = new Date();

    if (currentBrawlerMode > 0) {
        if (currentBrawlerMode < 0.1) { // 1H
            startDate = new Date(now.getTime() - (60 * 60 * 1000));
        } else {
            startDate = new Date();
            startDate.setDate(now.getDate() - currentBrawlerMode);
        }
    }

    // Filtrage des données
    let filteredData = [];
    if (currentBrawlerMode === 0) {
        filteredData = currentBrawlerHistory;
    } else {
        filteredData = currentBrawlerHistory.filter(pt => {
            const d = new Date(pt.date);
            return d >= startDate && d <= endDate;
        });
    }

    // Transformation pour Chart.js
    const dataset = filteredData.map(pt => ({
        x: pt.date,
        y: pt.trophies
    }));
    
    // Tri chronologique
    dataset.sort((a,b) => new Date(a.x) - new Date(b.x));

    // Calcul Variation
    const varElem = document.getElementById('brawler-trophy-variation');
    if (dataset.length >= 2) {
        const diff = dataset[dataset.length-1].y - dataset[0].y;
        if(diff > 0) varElem.innerHTML = `<span style="color:#28a745">▲ +${diff}</span>`;
        else if(diff < 0) varElem.innerHTML = `<span style="color:#dc3545">▼ ${diff}</span>`;
        else varElem.innerHTML = `<span style="color:#888">= 0</span>`;
    } else {
        varElem.innerHTML = "--";
    }

    // Rendu Chart.js
    const ctx = document.getElementById('brawlerChartCanvas').getContext('2d');
    
    if (brawlerChartInstance) brawlerChartInstance.destroy();

    // Couleur distincte pour le mode Brawler (Cyan/Bleu clair pour changer du Jaune)
    const chartColor = '#00d2ff'; 
    const bgColor = 'rgba(0, 210, 255, 0.1)';

    brawlerChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Trophées',
                data: dataset,
                borderColor: chartColor,
                backgroundColor: bgColor,
                borderWidth: 2,
                tension: 0.2,
                fill: true,
                pointRadius: dataset.length > 50 ? 0 : 3, // Cache points si trop de données
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `🏆 ${context.raw.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: currentBrawlerMode < 1 && currentBrawlerMode > 0 ? 'minute' : 'day' },
                    grid: { color: '#333' }
                },
                y: {
                    grid: { color: '#333' },
                    ticks: { color: '#888' }
                }
            }
        }
    });
}
