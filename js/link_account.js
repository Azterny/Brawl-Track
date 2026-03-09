// js/link_account.js
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/pass/index'; // Redirection vers l'accueil/login
        return;
    }

    // Elements
    const step1 = document.getElementById('step-1-form');
    const step2 = document.getElementById('step-2-preview');
    const step3 = document.getElementById('step-3-challenge');
    const step4 = document.getElementById('step-4-success');
    
    let currentTag = "";
    let mainTimerInterval = null;
    let verifyInterval = null;

    // --- INITIALISATION ---
    checkCurrentStatus();

    async function checkCurrentStatus() {
        try {
            const res = await fetch(`${API_URL}/api/link/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.status === 'verified') {
                showStep(step4);
                document.getElementById('linked-tag-display').innerText = data.tag;
            } else if (data.status === 'pending') {
                currentTag = data.tag;
                startChallenge(data.icon_id, 'un Brawler...', data.remaining_seconds);
            } else {
                showStep(step1);
            }
        } catch (e) {
            console.error(e);
            showStep(step1);
        }
    }

    // --- ETAPE 1 : Chercher le joueur ---
    document.getElementById('btn-search-tag').addEventListener('click', async () => {
        const input = document.getElementById('brawl-tag-input').value.trim();
        if (!input) return;

        const btn = document.getElementById('btn-search-tag');
        btn.disabled = true;
        btn.innerText = "Recherche...";
        document.getElementById('step-1-error').innerText = "";

        try {
            // Utilise la route publique pour l'aperçu
            const cleanTag = input.replace('#', '').toUpperCase();
            const res = await fetch(`${API_URL}/api/public/player/${cleanTag}`);
            
            if (!res.ok) throw new Error("Joueur introuvable sur Brawl Stars.");
            
            const playerData = await res.json();
            currentTag = playerData.tag; // Garde le #
            
            // Mise à jour de l'UI Preview
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
        btn.innerText = "Génération du défi...";

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

    // --- GESTION DU DEFI (Chrono 10min) ---
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
                alert("Le temps imparti est écoulé ! Veuillez recommencer la procédure.");
                window.location.reload();
            } else {
                const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                const s = (timeLeft % 60).toString().padStart(2, '0');
                document.getElementById('challenge-timer').innerText = `${m}:${s}`;
            }
        }, 1000);
    }

    // --- BOUCLE DE VERIFICATION API ---
    document.getElementById('btn-start-verify').addEventListener('click', () => {
        const btn = document.getElementById('btn-start-verify');
        const msgBox = document.getElementById('verify-status-msg');
        
        btn.disabled = true;
        btn.innerText = "Vérification en cours...";
        msgBox.innerText = "Interrogation de Supercell... (Jusqu'à 90s)";
        msgBox.style.color = "#fbdc10";
        
        let attempts = 0;
        const maxAttempts = 9;

        checkIconAPI(); // Premier check immédiat

        verifyInterval = setInterval(() => {
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(verifyInterval);
                btn.disabled = false;
                btn.innerText = "J'ai changé mon icône ! Vérifier";
                msgBox.innerText = "Délai de cache dépassé. Assurez-vous d'avoir équipé la bonne icône et réessayez.";
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
            } catch (e) {
                console.log("Erreur silencieuse pendant le ping API :", e);
            }
        }
    });

    // --- ANNULER OU DELIER ---
    document.getElementById('btn-cancel-challenge').addEventListener('click', async () => {
        if(confirm("Êtes-vous sûr de vouloir annuler la procédure ?")) {
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
                window.location.href = '/home';
            }
        }
    });

    function showStep(stepElement) {
        [step1, step2, step3, step4].forEach(el => el.classList.add('hidden'));
        stepElement.classList.remove('hidden');
    }
});
