const API_BASE = (typeof API_URL !== 'undefined') ? API_URL : '';
let currentClubTag = null;

async function initClub() {
    // Récupération du Tag
    const urlParams = new URLSearchParams(window.location.search);
    let tag = urlParams.get('tag');

    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts[0] === 'club' && pathParts[1]) {
        tag = pathParts[1];
    }

    if (!tag) {
        window.location.href = "/";
        return;
    }

    currentClubTag = tag.toUpperCase().replace('#', '');
    document.title = `Brawl Track - Club #${currentClubTag}`;

    // Restauration de l'URL propre
    if (window.location.pathname.includes('club.html')) {
        window.history.replaceState({}, '', `/club/${currentClubTag}`);
    }

    await loadClubData(currentClubTag);
}

async function loadClubData(tag) {
    try {
        const res = await fetch(`${API_BASE}/api/public/club/${tag}`);
        if (!res.ok) throw new Error("Club introuvable");
        const data = await res.json();
        renderClub(data);
    } catch (e) {
        console.error(e);
        window.location.href = `/404.html?target=${currentClubTag}`;
    }
}

function renderClub(club) {
    // 1. En-tête
    document.getElementById('club-name').innerText = club.name;
    document.getElementById('club-tag').innerText = club.tag;

    const badgeId = club.badgeId || 8000000;
    const iconUrl = `https://brawlify.com/images/club-badges/96/${badgeId}.webp`;
    document.getElementById('club-icon').src = iconUrl;

    // 2. Statistiques
    const membersCount = club.members ? club.members.length : 0;
    document.getElementById('members-count').innerText = membersCount;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées du Club</div><div class="stat-value" style="color:#ffce00; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/trophy_normal.png" style="height:0.9em;"> ${club.trophies.toLocaleString('fr-FR')}</div></div>
        <div class="stat-card"><div>Joueurs</div><div class="stat-value" style="color:#00d2ff; display:flex; align-items:center; justify-content:center; gap:5px;">👥 ${membersCount} / 30</div></div>
    `;

    // 3. Membres
    renderMembers(club.members || []);
}

function renderMembers(members) {
    const container = document.getElementById('members-list');
    container.innerHTML = '';

    members.forEach((m, index) => {
        // Dictionnaires de traduction et de styles
        const roleLabels = { 'member': '', 'senior': 'Senior', 'vicePresident': 'Vice-Président', 'president': 'Président' };
        const roleClasses = { 'member': '', 'senior': 'role-senior', 'vicePresident': 'role-vice', 'president': 'role-president' };

        const roleName = roleLabels[m.role] || '';
        const roleClass = roleClasses[m.role] || '';

        // Formatage de la couleur du nom du joueur
        let nameColor = m.nameColor || '#ffffff';
        if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

        const row = document.createElement('div');
        row.className = 'member-row';
        // Redirection vers le profil du joueur au clic
        row.onclick = () => window.location.href = `/player/${m.tag.replace('#', '')}`;

        row.innerHTML = `
            <div class="member-rank">${index + 1}</div>
            <img src="https://cdn.brawlify.com/profile-icons/regular/${m.icon.id}.png" class="member-icon" onerror="this.src='/assets/default_icon.png'">
            <div class="member-info">
                <div class="member-name" style="color: ${nameColor};">${m.name}</div>
                <div class="member-tag">${m.tag}</div>
            </div>
            <div class="member-role-container">
                ${roleName ? `<span class="member-role ${roleClass}">${roleName}</span>` : ''}
            </div>
            <div class="member-trophies">
                ${m.trophies.toLocaleString('fr-FR')} <img src="/assets/trophy_normal.png">
            </div>
        `;
        container.appendChild(row);
    });
}

// Lancement
document.addEventListener('DOMContentLoaded', initClub);
