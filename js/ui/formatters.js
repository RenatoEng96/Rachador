import { toggleDraftMode, openMoveModal, showToast, switchView, openConfirmModal, closeConfirmModal, closeVictoryModalOnly, closeMoveModal, closePlayerHistoryModal, updateLiveEloPreview, updateSorteioCounters, changeHistoryPage, openPlayerHistoryModal, exportPlayerHistory, setFormMode, editPlayer, resetForm, renderPublic, renderRanking, getNextDueDate, getPlayerLateChargesCount, renderSorteioTable, renderAdminTable, renderTeams, renderPlacarTeams, renderMatchHistory, togglePlacarLock, forceUnlockPlacar, toggleAuthMode, setGroupRoleFilter, filterUserGroups, renderUserGroups, renderAll, openPlacarConfigModal, closePlacarConfigModal, savePlacarConfig, playBeepSound, goHome, openTermsModal, closeTermsModal, openPrivacyModal, closePrivacyModal, openSupportModal, closeSupportModal, copySupportEmail } from '../ui.js';

import { state } from '../state.js';
import { calculateEloMatch } from '../services/rankingService.js';
import { settingsRef, updateDoc } from '../firebase.js';
import { domToBlob } from 'https://unpkg.com/modern-screenshot?module';

// ============================================================================
// HELPERS DE FORMATAÇÃO VISUAL
// ============================================================================

export const getLevelInfo = (elo) => {
    const e = elo ?? 0;
    if (e < 100) return { type: 'nivel1', label: 'BRONZE', bg: 'bg-orange-900/40', text: 'text-orange-400', dot: 'bg-orange-500' };
    if (e < 200) return { type: 'nivel2', label: 'PRATA', bg: 'bg-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400' };
    if (e < 300) return { type: 'nivel3', label: 'OURO', bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500' };
    if (e < 400) return { type: 'nivel4', label: 'PLATINA', bg: 'bg-cyan-500/20', text: 'text-cyan-400', dot: 'bg-cyan-500' };
    if (e < 500) return { type: 'nivel5', label: 'DIAMANTE', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', dot: 'bg-fuchsia-500' };
    return { type: 'nivel6', label: 'MESTRE', bg: 'bg-red-600/20', text: 'text-red-500', dot: 'bg-red-600' };
};

const getStarArrangement = (stars) => {
    let starsHtml = '';
    const starClass = "absolute leading-none drop-shadow-sm";

    if (stars === 1) {
        starsHtml = `<span class="${starClass} text-[14px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-[52%]">★</span>`;
    } else if (stars === 2) {
        starsHtml = `
            <span class="${starClass} text-[10px] top-[15%] left-[5%]">★</span>
            <span class="${starClass} text-[10px] bottom-[15%] right-[5%]">★</span>
        `;
    } else if (stars === 3) {
        starsHtml = `
            <span class="${starClass} text-[9px] top-[10%] left-1/2 -translate-x-1/2">★</span>
            <span class="${starClass} text-[9px] bottom-[15%] left-[10%]">★</span>
            <span class="${starClass} text-[9px] bottom-[15%] right-[10%]">★</span>
        `;
    } else if (stars === 4) {
        starsHtml = `
            <span class="${starClass} text-[8px] top-[15%] left-[15%]">★</span>
            <span class="${starClass} text-[8px] top-[15%] right-[15%]">★</span>
            <span class="${starClass} text-[8px] bottom-[15%] left-[15%]">★</span>
            <span class="${starClass} text-[8px] bottom-[15%] right-[15%]">★</span>
        `;
    } else if (stars === 5) {
        starsHtml = `
            <span class="${starClass} text-[8px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-[52%]">★</span>
            <span class="${starClass} text-[8px] top-[10%] left-[10%]">★</span>
            <span class="${starClass} text-[8px] top-[10%] right-[10%]">★</span>
            <span class="${starClass} text-[8px] bottom-[10%] left-[10%]">★</span>
            <span class="${starClass} text-[8px] bottom-[10%] right-[10%]">★</span>
        `;
    }

    return `<div class="relative w-5 h-5 mx-auto inline-block align-middle">${starsHtml}</div>`;
};

export const getCategoryInfo = (cat) => {
    const c = parseInt(cat) || 1;
    const noBg = '!bg-transparent !p-0 !m-0 !border-0';
    if (c === 5) return { label: getStarArrangement(5), bg: noBg, text: 'text-indigo-400', border: noBg, dot: 'bg-indigo-500' };
    if (c === 4) return { label: getStarArrangement(4), bg: noBg, text: 'text-teal-400', border: noBg, dot: 'bg-teal-500' };
    if (c === 3) return { label: getStarArrangement(3), bg: noBg, text: 'text-lime-400', border: noBg, dot: 'bg-lime-500' };
    if (c === 2) return { label: getStarArrangement(2), bg: noBg, text: 'text-pink-400', border: noBg, dot: 'bg-pink-500' };
    return { label: getStarArrangement(1), bg: noBg, text: 'text-stone-400', border: noBg, dot: 'bg-stone-500' };
};

export const getTeamName = (team) => {
    if (!team.players || team.players.length === 0) return `EQUIPE ${team.label}`;
    const headPlayer = team.players.reduce((max, p) => (parseInt(p.categoria) || 1) > (parseInt(max.categoria) || 1) ? p : max, team.players[0]);
    return `TIME DE ${headPlayer.name.split(' ')[0].toUpperCase()}`;
};

export const getDailyPlayerStats = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    const todaysMatches = (state.matchHistory || []).filter(m => m.dateString === today);
    
    const stats = {};
    todaysMatches.forEach(m => {
        const t1Won = m.winner === 1; 
        const t2Won = m.winner === 2;
        const isTie = m.winner === 0;
        
        if (m.team1?.players) m.team1.players.forEach(name => { 
            if (!stats[name]) stats[name] = { wins: 0, losses: 0 }; 
            if (t1Won) stats[name].wins++;
            else if (!isTie) stats[name].losses++;
        });
        if (m.team2?.players) m.team2.players.forEach(name => { 
            if (!stats[name]) stats[name] = { wins: 0, losses: 0 }; 
            if (t2Won) stats[name].wins++;
            else if (!isTie) stats[name].losses++;
        });
    });
    
    let maxWins = 0, maxLosses = 0;
    Object.values(stats).forEach(s => { 
        if (s.wins > maxWins) maxWins = s.wins; 
        if (s.losses > maxLosses) maxLosses = s.losses; 
    });
    
    const craques = new Set(), bagres = new Set();
    if (maxWins >= 3) Object.keys(stats).forEach(name => { if (stats[name].wins === maxWins) craques.add(name); });
    if (maxLosses >= 3) Object.keys(stats).forEach(name => { if (stats[name].losses === maxLosses) bagres.add(name); });
    
    return { stats, craques, bagres };
};

