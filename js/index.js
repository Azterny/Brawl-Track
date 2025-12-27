// --- LOGIQUE SPECIFIQUE ACCUEIL ---

// 1. Recherche Publique
function publicSearch() {
    const tagInput = document.getElementById('public-tag');
    if (!tagInput) return;
    
    const tag = tagInput.value.trim().replace('#', '');
    if(tag) window.location.href = `dashboard.html?tag=${tag}`;
}

// 2. Vérif si déjà connecté (au chargement)
window.onload = function() {
    const token = localStorage.getItem('token');
    if (token) {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.innerHTML = `
                <h2 style="color: #28a745;">Bon retour !</h2>
                <p>Tu es déjà connecté.</p>
                <button onclick="window.location.href='dashboard.html'">ACCÉDER AU DASHBOARD</button>
                <button onclick="logout()" style="background: #444; margin-top: 10px;">Se Déconnecter</button>
            `;
        }
    }
    // On lance le chargement des événements
    loadEvents();
};

// 3. Charger les événements (Rotation Maps)
async function loadEvents() {
    const container = document.getElementById('events-list');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/api/events`);
        if(!res.ok) throw new Error("Erreur API");
        const events = await res.json();

        container.innerHTML = '';

        // On prend tous les événements
        events.forEach(evt => {
            const mode = evt.event.mode;
            const map = evt.event.map;
            
            // CORRECTION DATE : Conversion format Brawl Stars -> ISO
            const rawTime = evt.endTime;
            const isoTime = rawTime.replace(
                /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
                '$1-$2-$3T$4:$5:$6'
            );
            
            const endTime = new Date(isoTime);
            const now = new Date();
            
            // Calcul temps restant
            const diffMs = endTime - now;
            let diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            let diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            if (diffHrs < 0) diffHrs = 0;
            if (diffMins < 0) diffMins = 0;

            const card = document.createElement('div');
            card.className = 'event-card';

            const header = document.createElement('div');
            header.className = 'event-header';
            
            const modeSpan = document.createElement('span');
            modeSpan.textContent = mode.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
            
            const timerSpan = document.createElement('span');
            timerSpan.style.fontSize = '0.8em';
            timerSpan.style.opacity = '0.8';
            timerSpan.textContent = `Fin : ${diffHrs}h ${diffMins}m`;

            header.appendChild(modeSpan);
            header.appendChild(timerSpan);

            const body = document.createElement('div');
            body.className = 'event-body';

            const mapDiv = document.createElement('div');
            mapDiv.className = 'map-name';
            mapDiv.textContent = map;

            const timerDiv = document.createElement('div');
            timerDiv.className = 'event-timer';
            
            const statusSpan = document.createElement('span');
            statusSpan.style.color = diffHrs < 1 ? '#ff5555' : '#28a745';
            statusSpan.textContent = `● ${diffHrs < 1 ? 'Bientôt terminé' : 'Actif'}`;

            timerDiv.appendChild(statusSpan);
            body.appendChild(mapDiv);
            body.appendChild(timerDiv);

            card.appendChild(header);
            card.appendChild(body);

            container.appendChild(card);
        });

    } catch(e) {
        console.error(e);
        container.innerHTML = `<div style="color:#ff5555; padding:20px;">Impossible de charger les événements.</div>`;
    }
}
