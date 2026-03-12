const GLOBAL_MAINTENANCE = false;
const isBypassMode = new URLSearchParams(window.location.search).get('bypass') === 'true';

if (GLOBAL_MAINTENANCE && !window.location.pathname.includes('maintenance.html') && !isBypassMode) {
    window.location.replace('/maintenance.html');
}
// Configuration Globale
const API_URL = "https://api.brawl-track.com";

// Variables d'état partagées !
let currentUserTier = 'free';
let globalBrawlersList = [];
let fullHistoryData = [];
let currentLiveTrophies = null;
window.myChart = null;

// --- Tiers d'abonnement ---
const TIER_LABELS = {
    free:       'Free',
    starter:    'Starter',
    subscriber: 'Subscriber',
    premium:    'Premium'
};
const TIER_ORDER = ['free', 'starter', 'subscriber', 'premium'];
