window.openLinkModal = function() {
    const modal = document.getElementById('link-account-modal');
    if (modal) {
        modal.classList.remove('hidden');
        window.checkCurrentStatus(false);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const modal = document.getElementById('link-account-modal');
    const btnClose = document.getElementById('close-link-modal');
    const btnCloseSuccess = document.getElementById('btn-close-success');

    // --- FERMETURE DE LA POPUP ---
    const closeModal = () => {
        modal.classList.add('hidden');
        // Si on ferme sur l'étape de succès, on rafraîchit la page pour voir le compte lié
        if (!document.getElementById('step-4-success').classList.contains('hidden')) {
            window.location.reload();
        }
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCloseSuccess) btnCloseSuccess.addEventListener('click', closeModal);
    
    // Fermer si on clique sur le fond noir
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const step1 = document.getElementById('step-1-form');
    const step2 = document.getElementById('step-2-preview');
    const step3 = document.getElementById('step-3-challenge');
    const step4 = document.getElementById('step-4-success');
    
    let currentTag = "";
    let mainTimerInterval = null;
    let verifyInterval = null;

    function showStep(stepElement) {
        [step1, step2, step3, step4].forEach(el => el.classList.add('hidden'));
        stepElement.classList.remove('hidden');
    }

    // --- VERIFICATION DU STATUT ---
    window.checkCurrentStatus = async function(isInitialLoad = false) {
        try {
            const res = await fetch(`${API_URL}/api/link/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.status === 'verified') {
                showStep(step4);
                document.getElementById('linked-tag-display').innerText = data.tag;
            } else if (data.status === 'pending') {
                modal.classList.remove('hidden'); // Force l'ouverture si défi en cours
                currentTag = data.tag;
                startChallenge(data.icon_id, data.brawler_name || 'un Brawler...', data.remaining_seconds);
            } else {
                showStep(step1);
            }
        } catch (e) {
            console.error(e);
            showStep(step1);
        }
    };

    // Auto-check silencieux au chargement de userhome
    window.checkCurrentStatus(true);

    // --- ETAPE 1 : Chercher le joueur ---
    document.getElementById('btn-search-tag').addEventListener('click', async () => {
        const input = document.getElementById('brawl-tag-input').value.trim();
        if (!input) return;

        const btn = document.getElementById('btn-search-tag');
        btn.disabled = true;
        btn.innerText = "Recherche...";
        document.getElementById('step-1-error').innerText = "";

        try {
            const cleanTag = input.replace('#', '').toUpperCase();
            const res = await fetch(`${API_URL}/api/public/player/${cleanTag}`);
            
            if (!res.ok) throw new Error("Joueur introuvable sur Brawl Stars.");
            
            const playerData = await res.json();
            currentTag = playerData.tag; 
            
            document.getElementById('preview-name').innerText = playerData.name;
            document.getElementById('preview-name').style.color = `#${playerData.nameColor.replace('0xff', '')}`;
            document.getElementById('preview-trophies').innerText = `🏆 ${playerData.trophies}`;
            document.getElementById('preview-icon').src = `https://cdn.brawlify.com/profile-icons/regular/${playerData.icon.id}.png`;
            
            showStep(step2);
        } catch (e) {
            document.getElementById('step-1-error').innerText = e.message;
        } finally {
            btn.disabled = false;
            btn.innerText = "Chercher";
        }
    });

    document.getElementById('btn-confirm-no').addEventListener('click', () => {
        showStep(step1);
        document.getElementById('brawl-tag-input').value = "";
    });

    // --- ETAPE 2 -> 3 : Initialiser le défi ---
    document.getElementById('btn-confirm-yes').addEventListener('click', async () => {
        const btn = document.getElementById('btn-confirm-yes');
        btn.disabled = true;
        btn.innerText = "Génération...";

        try {
            const res = await fetch(`${API_URL}/api/link/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tag: currentTag })
            });
            const data = await res.json();
            
            if (res.ok) {
                startChallenge(data.icon_id, data.brawler_name, data.remaining_seconds);
            } else {
                alert(data.message || "Erreur lors de l'initialisation.");
                showStep(step1);
            }
        } catch (e) {
            alert("Erreur de connexion avec le serveur.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Oui, c'est moi";
        }
    });

    // --- GESTION DU DEFI ---
    function startChallenge(iconId, brawlerName, secondsLeft) {
        showStep(step3);
        document.getElementById('challenge-icon').src = `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`;
        if (brawlerName) document.getElementById('challenge-brawler').innerText = brawlerName;
        
        clearInterval(mainTimerInterval);
        let timeLeft = secondsLeft;
        
        mainTimerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(mainTimerInterval);
                alert("Le temps est écoulé. Vous pourrez recommencer quand vous serez prêt !");
                window.location.reload();
            } else {
                const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                const s = (timeLeft % 60).toString().padStart(2, '0');
                document.getElementById('challenge-timer').innerText = `${m}:${s}`;
            }
        }, 1000);
    }

    // --- BOUCLE DE VERIFICATION ---
    document.getElementById('btn-start-verify').addEventListener('click', () => {
        const btn = document.getElementById('btn-start-verify');
        const msgBox = document.getElementById('verify-status-msg');
        
        btn.disabled = true;
        btn.innerText = "Vérification en cours...";
        msgBox.innerText = "Interrogation de Supercell... (Jusqu'à 90s)";
        msgBox.style.color = "#fbdc10";
        
        let attempts = 0;
        const maxAttempts = 9;

        checkIconAPI();

        verifyInterval = setInterval(() => {
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(verifyInterval);
                btn.disabled = false;
                btn.innerText = "J'ai changé mon icône ! Vérifier";
                msgBox.innerText = "Délai dépassé. Assurez-vous d'avoir équipé l'icône et réessayez.";
                msgBox.style.color = "#ff4757";
                return;
            }
            checkIconAPI();
        }, 10000);

        async function checkIconAPI() {
            try {
                const res = await fetch(`${API_URL}/api/link/verify`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.status === 'success') {
                    clearInterval(verifyInterval);
                    clearInterval(mainTimerInterval);
                    document.getElementById('linked-tag-display').innerText = currentTag;
                    showStep(step4);
                } else if (data.status === 'expired') {
                    clearInterval(verifyInterval);
                    alert("Le temps est écoulé !");
                    window.location.reload();
                }
            } catch (e) {}
        }
    });

    // --- ANNULER OU DELIER ---
    document.getElementById('btn-cancel-challenge').addEventListener('click', async () => {
        if(confirm("Voulez-vous annuler la vérification pour le moment ?")) {
            await fetch(`${API_URL}/api/link/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            window.location.reload();
        }
    });

    document.getElementById('btn-unclaim-account').addEventListener('click', async () => {
        if(confirm("Attention : Délier ce compte arrêtera la collecte de vos statistiques. Continuer ?")) {
            const res = await fetch(`${API_URL}/api/unclaim-tag`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tag: document.getElementById('linked-tag-display').innerText })
            });
            if (res.ok) {
                alert("Compte délié avec succès.");
                window.location.reload(); // Au lieu de renvoyer sur /home, on actualise la popup
            }
        }
    });
});
