// js/link_account.js

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

    const modal        = document.getElementById('link-account-modal');
    const btnClose     = document.getElementById('close-link-modal');
    const btnCloseSucc = document.getElementById('btn-close-success');

    let currentTag         = "";
    let mainTimerInterval  = null;
    let verifyInterval     = null;

    // Fix #6 — Nettoyage systématique des intervalles à la fermeture de la modale,
    // Peu importe l'étape active, les timers sont toujours stoppés.
    function stopAllIntervals() {
        if (verifyInterval)    { clearInterval(verifyInterval);   verifyInterval   = null; }
        if (mainTimerInterval) { clearInterval(mainTimerInterval); mainTimerInterval = null; }
    }

    const closeModal = () => {
        stopAllIntervals();
        modal.classList.add('hidden');
        if (!document.getElementById('step-4-success').classList.contains('hidden')) {
            window.location.reload();
        }
    };

    if (btnClose)     btnClose.addEventListener('click', closeModal);
    if (btnCloseSucc) btnCloseSucc.addEventListener('click', closeModal);

    // Fermeture sur fond de modale
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const step1 = document.getElementById('step-1-form');
    const step2 = document.getElementById('step-2-preview');
    const step3 = document.getElementById('step-3-challenge');
    const step4 = document.getElementById('step-4-success');

    function showStep(stepElement) {
        [step1, step2, step3, step4].forEach(el => el.classList.add('hidden'));
        stepElement.classList.remove('hidden');
    }

    // --- VÉRIFICATION DU STATUT ---
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
                modal.classList.remove('hidden');
                currentTag = data.tag || '';
                startChallenge(data.icon_id, data.brawler_name, data.seconds_left || 300);
            } else {
                showStep(step1);
            }
        } catch (e) {
            showStep(step1);
        }
    };

    // --- ÉTAPE 1 : RECHERCHE DU TAG ---
    const btnSearch = document.getElementById('btn-search-tag');
    if (btnSearch) {
        btnSearch.addEventListener('click', async () => {
            const rawTag = document.getElementById('input-tag').value.trim().toUpperCase().replace('#', '');
            if (!rawTag) return;

            btnSearch.disabled = true;
            btnSearch.innerText = "Recherche...";

            try {
                const res = await fetch(`${API_URL}/api/public/player/${rawTag}`);
                if (!res.ok) throw new Error("Joueur introuvable");
                const data = await res.json();

                currentTag = data.tag;

                let nameColor = data.nameColor || '#ffffff';
                if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

                document.getElementById('preview-icon').src     = `https://cdn.brawlify.com/profile-icons/regular/${data.icon?.id || 28000000}.png`;
                document.getElementById('preview-name').innerText = data.name;
                document.getElementById('preview-name').style.color = nameColor;
                document.getElementById('preview-tag').innerText  = data.tag;
                document.getElementById('preview-trophies').innerText = (data.trophies || 0).toLocaleString('fr-FR');

                showStep(step2);
            } catch (e) {
                alert("Joueur introuvable. Vérifiez le tag.");
            } finally {
                btnSearch.disabled = false;
                btnSearch.innerText = "Rechercher";
            }
        });
    }

    // --- ÉTAPE 2 : CONFIRMATION ---
    const btnConfirm = document.getElementById('btn-confirm-tag');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            btnConfirm.disabled = true;
            btnConfirm.innerText = "Initialisation...";

            try {
                const res = await fetch(`${API_URL}/api/link/init`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ tag: currentTag })
                });
                const data = await res.json();

                if (res.ok && data.icon_id) {
                    startChallenge(data.icon_id, data.brawler_name, data.seconds_left || 300);
                } else {
                    alert(data.message || "Erreur d'initialisation.");
                    showStep(step1);
                }
            } catch (e) {
                alert("Erreur de connexion avec le serveur.");
                showStep(step1);
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.innerText = "Oui, c'est moi";
            }
        });
    }

    // --- GESTION DU DÉFI ---
    function startChallenge(iconId, brawlerName, secondsLeft) {
        showStep(step3);

        const challengeIcon = document.getElementById('challenge-icon');
        if (challengeIcon) challengeIcon.src = `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`;
        if (brawlerName) {
            const el = document.getElementById('challenge-brawler');
            if (el) el.innerText = brawlerName;
        }

        stopAllIntervals(); // Stoppe tout timer précédent avant d'en créer de nouveaux
        let timeLeft = secondsLeft;

        mainTimerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                stopAllIntervals();
                alert("Le temps est écoulé. Vous pourrez recommencer quand vous serez prêt.");
                window.location.reload();
            } else {
                const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                const s = (timeLeft % 60).toString().padStart(2, '0');
                const timerEl = document.getElementById('challenge-timer');
                if (timerEl) timerEl.innerText = `${m}:${s}`;
            }
        }, 1000);
    }

    // --- BOUCLE DE VÉRIFICATION ---
    const btnVerify = document.getElementById('btn-start-verify');
    if (btnVerify) {
        btnVerify.addEventListener('click', () => {
            const msgBox = document.getElementById('verify-status-msg');

            btnVerify.disabled = true;
            btnVerify.innerText = "Vérification en cours...";
            if (msgBox) {
                msgBox.innerText = "Interrogation de Supercell... (Jusqu'à 90s)";
                msgBox.style.color = "#fbdc10";
            }

            let attempts   = 0;
            const maxAttempts = 9;

            checkIconAPI();

            verifyInterval = setInterval(() => {
                attempts++;
                if (attempts >= maxAttempts) {
                    stopAllIntervals();
                    btnVerify.disabled = false;
                    btnVerify.innerText = "J'ai changé mon icône ! Vérifier";
                    if (msgBox) {
                        msgBox.innerText = "Délai dépassé. Assurez-vous d'avoir équipé l'icône et réessayez.";
                        msgBox.style.color = "#ff4757";
                    }
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
                        stopAllIntervals();
                        const display = document.getElementById('linked-tag-display');
                        if (display) display.innerText = currentTag;
                        showStep(step4);
                    } else if (data.status === 'expired') {
                        stopAllIntervals();
                        alert("Le temps est écoulé !");
                        window.location.reload();
                    }
                } catch (e) {
                    // Erreur réseau silencieuse — le prochain tick réessaiera
                }
            }
        });
    }

    // --- ANNULER OU DÉLIER ---
    const btnCancel = document.getElementById('btn-cancel-challenge');
    if (btnCancel) {
        btnCancel.addEventListener('click', async () => {
            if (confirm("Voulez-vous annuler la vérification pour le moment ?")) {
                stopAllIntervals();
                await fetch(`${API_URL}/api/link/cancel`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => {});
                window.location.reload();
            }
        });
    }

    const btnUnclaim = document.getElementById('btn-unclaim-account');
    if (btnUnclaim) {
        btnUnclaim.addEventListener('click', async () => {
            if (confirm("Attention : Délier ce compte arrêtera la collecte de vos statistiques. Continuer ?")) {
                const tagEl = document.getElementById('linked-tag-display');
                const res = await fetch(`${API_URL}/api/unclaim-tag`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ tag: tagEl ? tagEl.innerText : '' })
                });
                if (res.ok) {
                    alert("Compte délié avec succès.");
                    window.location.reload();
                }
            }
        });
    }
});
