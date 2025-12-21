// js/app.js
const API_BASE = "https://api.brawl-track.com/api";
// On utilise Brawlify pour les images (ils utilisent les IDs officiels)
const CDN_BRAWLER = "https://cdn.brawlify.com/brawler/"; 

async function searchPlayer() {
    let tag = document.getElementById('tagInput').value.trim().toUpperCase().replace('#', '');
    if (!tag) return;

    // UI Reset
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('error-msg').classList.add('hidden');

    try {
        // 1. Récupérer le Profil
        const profileRes = await fetch(`${API_BASE}/players/%23${tag}`);
        const profileData = await profileRes.json();

        if (!profileRes.ok) throw new Error(profileData.error || "Joueur introuvable");

        displayProfile(profileData);

        // 2. Récupérer l'historique des combats (Battle Log)
        // Note: Votre RPi gère ça automatiquement via /api/players/.../battlelog
        const battleRes = await fetch(`${API_BASE}/players/%23${tag}/battlelog`);
        const battleData = await battleRes.json();
        
        if (battleRes.ok) {
            displayBattleLog(battleData.items);
        }

        // Afficher le tout
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');

    } catch (error) {
        console.error(error);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error-msg').innerText = "Erreur : " + error.message;
        document.getElementById('error-msg').classList.remove('hidden');
    }
}

function displayProfile(data) {
    document.getElementById('pName').innerText = data.name;
    document.getElementById('pName').style.color = "#" + data.nameColor.substring(4);
    document.getElementById('pTag').innerText = data.tag;
    
    document.getElementById('statTrophies').innerText = data.trophies.toLocaleString();
    document.getElementById('statHighest').innerText = data.highestTrophies.toLocaleString();
    document.getElementById('stat3v3').innerText = data['3vs3Victories'].toLocaleString();
    
    // Affichage des Brawlers
    const grid = document.getElementById('brawlersGrid');
    grid.innerHTML = "";
    
    // Tri par trophées
    data.brawlers.sort((a, b) => b.trophies - a.trophies);

    data.brawlers.forEach(b => {
        const div = document.createElement('div');
        div.className = 'brawler-card';
        // Astuce Image : on utilise l'ID du brawler pour trouver son image sur Brawlify
        div.innerHTML = `
            <img src="${CDN_BRAWLER}${b.id}.png" class="brawler-img" onerror="this.src='https://cdn.brawlify.com/brawler/16000000.png'">
            <div style="font-weight:bold; font-size:0.9em">${b.name}</div>
            <div style="color:#f1c40f">🏆 ${b.trophies}</div>
            <div class="rank-badge">Rang ${b.rank}</div>
        `;
        grid.appendChild(div);
    });
}

function displayBattleLog(battles) {
    const list = document.getElementById('battleList');
    list.innerHTML = "";

    // On prend les 10 derniers combats seulement pour ne pas surcharger
    battles.slice(0, 10).forEach(battle => {
        const div = document.createElement('div');
        
        // Logique pour déterminer Victoire/Défaite
        let result = "Égalité";
        let className = "draw";
        let change = battle.battle.trophyChange || 0;

        if (change > 0) { result = "VICTOIRE"; className = "victory"; }
        else if (change < 0) { result = "DÉFAITE"; className = "defeat"; }
        else if (battle.battle.result === "victory") { result = "VICTOIRE"; className = "victory"; } // Cas spécial (Map Maker, etc.)

        // Formatage de l'heure (C'est un format bizarre "YYYYMMDDTHHMMSS.000Z")
        const dateStr = battle.battleTime;
        // On fait simple pour l'affichage
        const timeDisplay = dateStr.substring(9, 11) + "h" + dateStr.substring(11, 13);

        div.className = `battle-item ${className}`;
        div.innerHTML = `
            <div class="battle-info">
                <span class="battle-result">${result} <small>(${change > 0 ? '+' : ''}${change} 🏆)</small></span>
                <span class="battle-mode">${battle.battle.mode} - ${battle.map ? battle.map.name : 'Map inconnue'}</span>
            </div>
            <div style="font-size: 0.9em; color: #aaa;">${timeDisplay}</div>
        `;
        list.appendChild(div);
    });
}
