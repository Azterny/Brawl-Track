// js/mailbox.js

let messagesData = [];
const API_BASE = (typeof API_URL !== 'undefined') ? API_URL : '';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/pass/index';
        return;
    }
    fetchMessages(token);
});

async function fetchMessages(token) {
    try {
        const res = await fetch(`${API_BASE}/api/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            messagesData = await res.json();
            renderMessageList();
        } else {
            document.getElementById('messages-container').innerHTML = `<div style="padding: 20px; color: #ff5555; text-align: center;">Erreur lors du chargement.</div>`;
        }
    } catch (e) {
        console.error(e);
        document.getElementById('messages-container').innerHTML = `<div style="padding: 20px; color: #ff5555; text-align: center;">Impossible de contacter le serveur.</div>`;
    }
}

function renderMessageList() {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    if (messagesData.length === 0) {
        container.innerHTML = `<div style="padding: 30px 20px; text-align: center; color: #888;">📭 Votre boîte de réception est vide.</div>`;
        return;
    }

    messagesData.forEach(msg => {
        // Formater la date proprement
        const dateObj = new Date(msg.date_envoi.replace(' ', 'T') + 'Z');
        const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = `message-item ${msg.is_read ? 'read' : 'unread'}`;
        div.id = `msg-item-${msg.id}`;
        
        // Rendu miniature
        div.innerHTML = `
            <div class="msg-item-subject">${msg.objet}</div>
            <div class="msg-item-preview">${msg.contenu.substring(0, 40).replace(/[#*`_]/g, '')}...</div>
            <div class="msg-item-date">${dateStr}</div>
        `;

        div.onclick = () => openMessage(msg.id, div);
        container.appendChild(div);
    });
}

async function openMessage(id, element) {
    const msg = messagesData.find(m => m.id === id);
    if (!msg) return;

    // Gestion de l'UI (Surbrillance de l'élément cliqué)
    document.querySelectorAll('.message-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Affichage des données dans le panneau de droite
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('active-message-state').classList.remove('hidden');
    
    document.getElementById('msg-subject').innerText = msg.objet;
    
    const dateObj = new Date(msg.date_envoi.replace(' ', 'T') + 'Z');
    document.getElementById('msg-date').innerText = "Envoyé le " + dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    // Parse le Markdown et injecte dans le body
    document.getElementById('msg-body').innerHTML = DOMPurify.sanitize(marked.parse(msg.contenu));

    // --- GESTION RESPONSIVE MOBILE ---
    // Sur mobile, cacher la liste et afficher le panneau de lecture
    if (window.innerWidth <= 768) {
        document.getElementById('inbox-list-panel').classList.add('mobile-hidden');
        document.getElementById('inbox-read-panel').classList.remove('mobile-hidden');
    }

    // --- MARQUER COMME LU ---
    if (!msg.is_read) {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE}/api/messages/${id}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                msg.is_read = 1; // Mise à jour locale
                if (element) {
                    element.classList.remove('unread');
                    element.classList.add('read');
                }
            }
        } catch(e) { console.error("Erreur read:", e); }
    }
}

// Fonction appelée par le bouton "Retour" sur mobile
window.closeMessageMobile = function() {
    document.getElementById('inbox-list-panel').classList.remove('mobile-hidden');
    document.getElementById('inbox-read-panel').classList.add('mobile-hidden');
    document.querySelectorAll('.message-item').forEach(el => el.classList.remove('active'));
};
