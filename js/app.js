const API_BASE = "https://api.brawl-track.com/api";
// On remet la bonne adresse d'images corrigée
const CDN_BRAWLER = "https://cdn.brawlify.com/brawlers/borderless/";

// --- 1. GESTION DU ROUTING (Navigation) ---

// Se lance au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
    // Cas A : On arrive depuis une redirection 404 (Lien direct)
    if (sessionStorage.redirect) {
        const path = sessionStorage.redirect;
        delete sessionStorage.redirect;
        
        // On remet la belle URL dans la barre
        history.replaceState(null, null, path);
        
        // On extrait le TAG de l'URL (/stats/player/V8LLPPC)
        if (path.includes('/stats/player/')) {
            const tag = path.split('/stats/player/')[1];
            if (tag) {
                document.getElementById('tagInput').value = tag;
                searchPlayer(tag, false); // false = ne pas repousser l'historique
            }
        }
    }
    
    // Cas B : Gestion du bouton "Précédent" du navigateur
    window.onpopstate = function() {
        // Si on revient en arrière, on recharge pour remettre l'accueil ou le bon joueur
        location.reload();
    };
});


// --- 2. FONCTION PRINCIPALE ---

async function searchPlayer(tagOverride = null, updateUrl = true) {
    // Soit on prend le tag passé en paramètre, soit celui du champ input
    let tag = tagOverride || document.getElementById('tagInput').value.trim().toUpperCase().replace('#', '');
    
    if (!tag) return;

    // Mise à jour de l'URL (si demandé)
    if (updateUrl) {
        const newUrl = `/stats/player/${tag}`;
        history.pushState(null, '', newUrl);
    }

    // UI Reset
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('error-msg').classList.add('hidden');

    try {
        // Appel API
        const profileRes = await fetch(`${API_BASE}/players/%23${tag}`);
        const profileData = await profileRes.json();

        if (!profileRes.ok) throw new Error(profileData.error || "Joueur introuvable");

        displayProfile(profileData);

        // Appel BattleLog
        const battleRes = await fetch(`${API_BASE}/players/%23${tag}/battlelog`);
        const battleData = await battleRes.json();
        
        if (battleRes.ok) {
            displayBattleLog(battleData.items);
        }

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');

    } catch (error) {
        console.error(error);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error-msg').innerText = "Erreur : " + error.message;
        document.getElementById('error-msg').classList.remove('hidden');
    }
}

// --- 3. FONCTIONS D'AFFICHAGE (Identiques à avant) ---

function displayProfile(data) {
    document.getElementById('pName').innerText = data.name;
    document.getElementById('pName').style.color = "#" + data.nameColor.substring(4);
    document.getElementById('pTag').innerText = data.tag;
    
    document.getElementById('statTrophies').innerText = data.trophies.toLocaleString();
    document.getElementById('statHighest').innerText = data.highestTrophies.toLocaleString();
    document.getElementById('stat3v3').innerText = data['3vs3Victories'].toLocaleString();
    
    const grid = document.getElementById('brawlersGrid');
    grid.innerHTML = "";
    
    data.brawlers.sort((a, b) => b.trophies - a.trophies);

    data.brawlers.forEach(b => {
        const div = document.createElement('div');
        div.className = 'brawler-card';
        div.innerHTML = `
            <img src="${CDN_BRAWLER}${b.id}.png" class="brawler-img" loading="lazy">
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

    battles.slice(0, 10).forEach(battle => {
        const div = document.createElement('div');
        let result = "Égalité";
        let className = "draw";
        let change = battle.battle.trophyChange || 0;

        if (change > 0) { result = "VICTOIRE"; className = "victory"; }
        else if (change < 0) { result = "DÉFAITE"; className = "defeat"; }
        else if (battle.battle.result === "victory") { result = "VICTOIRE"; className = "victory"; }

        const dateStr = battle.battleTime;
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
