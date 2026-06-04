import { toggleDraftMode, getEloInfo, getLevelInfo, getTeamName, getDailyPlayerStats, openMoveModal, showToast, switchView, openConfirmModal, closeConfirmModal, closeVictoryModalOnly, closeMoveModal, closePlayerHistoryModal, updateLiveEloPreview, setFormMode, editPlayer, resetForm, renderPublic, renderRanking, getNextDueDate, getPlayerLateChargesCount, renderSorteioTable, renderAdminTable, renderTeams, renderPlacarTeams, renderMatchHistory, togglePlacarLock, forceUnlockPlacar, toggleAuthMode, setGroupRoleFilter, filterUserGroups, renderUserGroups, renderAll, openPlacarConfigModal, closePlacarConfigModal, savePlacarConfig, playBeepSound, goHome, openTermsModal, closeTermsModal, openPrivacyModal, closePrivacyModal, openSupportModal, closeSupportModal, copySupportEmail } from '../ui.js';

import { state } from '../state.js';
import { calculateEloMatch } from '../services/rankingService.js';
import { settingsRef, updateDoc } from '../firebase.js';
import { domToBlob } from 'https://unpkg.com/modern-screenshot?module';

// ============================================================================
// HELPERS DE INTERAÇÃO (Tabelas e Paginação)
// ============================================================================

export const updateSorteioCounters = () => {
    const countElement = document.getElementById('playerCountSorteio');
    if(countElement) countElement.innerText = `${state.selectedPlayerIds.size} / ${state.players.length} Selecionados`;
    
    const selectAllCheckbox = document.getElementById('selectAll');
    if(selectAllCheckbox) selectAllCheckbox.checked = state.players.length > 0 && state.selectedPlayerIds.size === state.players.length;
};

export const changeHistoryPage = (idx) => {
    state.historyCurrentPage = idx;
    renderMatchHistory();
};

// Variáveis locais para gerenciar abas de histórico de jogador
let currentSelectedPlayerName = '';
let currentSelectedDayStr = '';
let currentGroupedMatches = {};

// Helper para gerar os selos/badges do jogador
const getPlayerBadgesHTML = (player, stats, craques, bagres, isExport = false) => {
    const streak = player.streak || 0;
    const pStats = stats[player.name] || { wins: 0, losses: 0 };
    const isCraque = craques.has(player.name);
    const isBagre = bagres.has(player.name);
    const hasBadges = streak >= 3 || streak <= -3 || isCraque || isBagre;
    
    if (!hasBadges) return '';
    
    const wrapperClass = isExport
        ? 'position: absolute; top: -8px; left: -8px; display: flex; flex-direction: column; gap: 6px; z-index: 40; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); align-items: flex-start;'
        : 'absolute -top-2 -left-2 sm:-left-4 flex flex-col gap-1.5 z-40 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] items-start';
        
    const badgeStyle = isExport
        ? 'background: rgba(15, 23, 42, 0.95); padding: 4px 8px; border-radius: 9999px; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(71, 85, 105, 0.5);'
        : 'bg-slate-900/90 p-1 sm:p-1.5 rounded-full border border-slate-700/50 flex items-center gap-1';
        
    return `
        <div class="${isExport ? '' : wrapperClass}" style="${isExport ? wrapperClass : ''}">
            ${(streak >= 3) ? `
                <div class="${isExport ? '' : badgeStyle} border-orange-500/50 text-orange-500" style="${isExport ? badgeStyle + ' border-color: rgba(249, 115, 22, 0.5); color: #f97316;' : ''}">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" style="width: 16px; height: 16px; fill: #f97316;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                    <span class="font-black text-xs pr-1.5" style="font-weight: 900; font-size: 12px; font-family: 'Oswald', sans-serif;">${streak}</span>
                </div>
            ` : ''}
            ${(streak <= -3) ? `
                <div class="${isExport ? '' : badgeStyle} border-blue-500/50 text-blue-500" style="${isExport ? badgeStyle + ' border-color: rgba(59, 130, 246, 0.5); color: #3b82f6;' : ''}">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" style="width: 16px; height: 16px;"><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line><path d="m20 4-16 16"></path><path d="m4 4 16 16"></path><path d="m12 4-4 4"></path><path d="m12 4 4 4"></path><path d="m12 20-4-4"></path><path d="m12 20 4-4"></path><path d="m4 12 4-4"></path><path d="m4 12 4 4"></path><path d="m20 12-4-4"></path><path d="m20 12-4 4"></path></svg>
                    <span class="font-black text-xs pr-1.5" style="font-weight: 900; font-size: 12px; font-family: 'Oswald', sans-serif;">${Math.abs(streak)}</span>
                </div>
            ` : ''}
            ${isCraque ? `
                <div class="${isExport ? '' : badgeStyle} border-yellow-400/50 text-yellow-400" style="${isExport ? badgeStyle + ' border-color: rgba(250, 204, 21, 0.5); color: #facc15;' : ''}">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" style="width: 16px; height: 16px; fill: #facc15;"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14a1 1 0 0 0 1-1v-1H4v1a1 1 0 0 0 1 1z"></path></svg>
                    <span class="font-black text-xs pr-1.5" style="font-weight: 900; font-size: 12px; font-family: 'Oswald', sans-serif;">${pStats.wins}</span>
                </div>
            ` : ''}
            ${isBagre ? `
                <div class="${isExport ? '' : badgeStyle} border-emerald-400/50 text-emerald-400" style="${isExport ? badgeStyle + ' border-color: rgba(52, 211, 153, 0.5); color: #34d399;' : ''}">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" style="width: 16px; height: 16px;"><path d="M6.5 12c.98 0 1.9-.37 2.6-1a3 3 0 0 0 2.2 1H15a2 2 0 1 0 0-4h-3.7a3 3 0 0 0-2.2 1c-.7-.63-1.62-1-2.6-1a4 4 0 0 0-4 4 4 4 0 0 0 4 4Z"></path><path d="M18 12a2 2 0 1 1 0-4"></path></svg>
                    <span class="font-black text-xs pr-1.5" style="font-weight: 900; font-size: 12px; font-family: 'Oswald', sans-serif;">${pStats.losses}</span>
                </div>
            ` : ''}
        </div>
    `;
};

// Helper para selecionar aba do histórico do jogador
window.selectHistoryTab = (day, playerName) => {
    const tabs = document.querySelectorAll('#playerHistoryTabs .history-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    
    const activeTab = document.getElementById(`tab-btn-${day.replace(/\//g, '-')}`);
    if (activeTab) activeTab.classList.add('active');
    
    currentSelectedDayStr = day;
    currentSelectedPlayerName = playerName;
    
    renderHistoryMatchesOfDate(day, playerName);
};

const renderHistoryMatchesOfDate = (day, playerName) => {
    const list = document.getElementById('playerHistoryList');
    const matches = currentGroupedMatches[day] || [];
    
    if (matches.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-500 py-6 text-sm">Nenhuma partida registrada neste dia.</p>';
        return;
    }
    
    list.innerHTML = matches.map((m, idx) => {
        const inT1 = m.team1.players && m.team1.players.includes(playerName);
        const myTeam = inT1 ? 1 : 2;
        const isTieMatch = m.winner === 0;
        const isWin = !isTieMatch && m.winner === myTeam;
        
        const t1Color = isTieMatch ? 'text-slate-300' : (m.winner === 1 ? 'text-blue-400' : 'text-slate-400');
        const t2Color = isTieMatch ? 'text-slate-300' : (m.winner === 2 ? 'text-red-400' : 'text-slate-400');
        
        const eloGain = m.eloGain || 0;
        const eloLoss = Math.round(eloGain * 0.7);
        const t1EloChange = m.eloChangeT1 ?? (m.winner === 1 ? eloGain : -eloLoss);
        const t2EloChange = m.eloChangeT2 ?? (m.winner === 2 ? eloGain : -eloLoss);
        const myEloChange = inT1 ? t1EloChange : t2EloChange;
        const myEloDisplay = `${myEloChange >= 0 ? '+' : ''}${myEloChange}`;
        
        let statusLabel, eloColor;
        if (isTieMatch) {
            statusLabel = 'EMPATE';
            eloColor = myEloChange > 0 ? 'text-green-400' : (myEloChange < 0 ? 'text-red-400' : 'text-slate-400');
        } else if (isWin) {
            statusLabel = 'VITÓRIA';
            eloColor = 'text-green-400';
        } else {
            statusLabel = 'DERROTA';
            eloColor = 'text-red-400';
        }

        const t1EloDisplay = `${t1EloChange >= 0 ? '+' : ''}${t1EloChange}`;
        const t2EloDisplay = `${t2EloChange >= 0 ? '+' : ''}${t2EloChange}`;
        const t1DetailColor = isTieMatch ? (t1EloChange > 0 ? 'text-green-400' : (t1EloChange < 0 ? 'text-red-400' : 'text-slate-400')) : (m.winner === 1 ? 'text-green-400' : 'text-red-400');
        const t2DetailColor = isTieMatch ? (t2EloChange > 0 ? 'text-green-400' : (t2EloChange < 0 ? 'text-red-400' : 'text-slate-400')) : (m.winner === 2 ? 'text-green-400' : 'text-red-400');

        return `
            <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden mb-2">
                <div class="p-3 cursor-pointer hover:bg-slate-800 transition-colors" onclick="document.getElementById('p-match-det-${idx}').classList.toggle('hidden')">
                    <div class="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                        <span class="text-slate-400 font-bold">${day}</span>
                        <span class="font-black ${eloColor} bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-[10px]">${statusLabel} (${myEloDisplay} ELO)</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="flex-1 text-right font-bold text-[11px] ${t1Color} truncate">${m.team1.name}</div>
                        <div class="px-3 font-black text-sm">${m.team1.score} x ${m.team2.score}</div>
                        <div class="flex-1 text-left font-bold text-[11px] ${t2Color} truncate">${m.team2.name}</div>
                    </div>
                </div>
                <div id="p-match-det-${idx}" class="hidden p-3 bg-slate-950/80 border-t border-slate-800/50 text-[10px] text-slate-300">
                    <div class="flex justify-between gap-4">
                        <div class="flex-1 text-right">
                            <p class="text-slate-500 font-bold uppercase mb-1">Time Azul</p>
                            <p>${(m.team1.players || []).join('<br>')}</p>
                            <p class="mt-2 font-bold ${t1DetailColor}">${t1EloDisplay} ELO</p>
                        </div>
                        <div class="flex-1 text-left">
                            <p class="text-slate-500 font-bold uppercase mb-1">Time Vermelho</p>
                            <p>${(m.team2.players || []).join('<br>')}</p>
                            <p class="mt-2 font-bold ${t2DetailColor}">${t2EloDisplay} ELO</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

export const openPlayerHistoryModal = (playerName) => {
    const modal = document.getElementById('playerHistoryModal');
    const tabsContainer = document.getElementById('playerHistoryTabs');
    const list = document.getElementById('playerHistoryList');
    
    const player = state.players.find(x => x.name === playerName);
    if (!player) return;

    document.getElementById('playerHistoryTitle').innerHTML = `<i data-lucide="user" class="text-green-500 inline w-5 h-5 mr-1 mt-[-2px]"></i> Histórico de ${playerName}`;

    // 1. Renderizar a cartinha FIFA do Atleta na esquerda
    const maxElo = state.players.length > 0 ? Math.max(...state.players.map(p => p.eloRating ?? 0)) : 0;
    const globalEloRank = [...state.players].sort((a, b) => (b.eloRating ?? 0) - (a.eloRating ?? 0) || a.name.localeCompare(b.name));
    const rankPosition = globalEloRank.findIndex(x => x.id === player.id) + 1;
    const lvlInfo = getEloInfo(player.eloRating ?? 0);
    const ptsValue = player.eloRating ?? 0;
    const isDestaque = ptsValue === maxElo && maxElo > 0;
    const vitorias = player.vitorias || 0;
    const derrotas = (player.partidas || 0) - vitorias;

    // Calcular Badges para o Modal
    const { stats, craques, bagres } = getDailyPlayerStats();
    const badgesHtml = getPlayerBadgesHTML(player, stats, craques, bagres, false);

    const cardHtml = `
        <div class="relative flex justify-center w-[210px] group ${isDestaque ? 'winner-frame-container' : ''}">
            ${badgesHtml}
            ${isDestaque ? `
                <div class="winner-frame-wrapper !h-[310px]">
                    <div class="fifa-card card-${lvlInfo.type} relative" style="margin: 0; box-shadow: 0 8px 20px rgba(0,0,0,0.5);">
                        <div class="absolute top-3 right-4 text-sm sm:text-lg font-black italic text-white/50 drop-shadow-md">#${rankPosition}</div>
                        <div class="flex flex-col items-center justify-center">
                            <span class="overall !text-4xl">${ptsValue}</span>
                            <span class="font-bold text-[8px] opacity-90 tracking-[0.15em]">ELO</span>
                        </div>
                        <div class="w-24 h-24 mt-3 mb-1 flex items-center justify-center bg-black/10 rounded-full border-2 border-yellow-400/60 text-yellow-200 shrink-0 overflow-hidden">
                            ${player.photo ? `<img src="${player.photo}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="w-12 h-12 opacity-80"></i>`}
                        </div>
                        <div class="player-name text-yellow-100">${player.name}</div>
                        <div class="w-full mt-2 flex justify-evenly items-center px-4">
                            <div class="flex flex-col items-center">
                                <span class="text-base font-black text-white">${vitorias}</span>
                                <span class="text-[8px] font-bold uppercase opacity-80">Vit</span>
                            </div>
                            <div class="w-px h-6 bg-white/30"></div>
                            <div class="flex flex-col items-center">
                                <span class="text-base font-black text-white">${derrotas}</span>
                                <span class="text-[8px] font-bold uppercase opacity-80">Der</span>
                            </div>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="fifa-card card-${lvlInfo.type} w-full mx-auto !h-[300px] relative" style="box-shadow: 0 8px 20px rgba(0,0,0,0.5);">
                    <div class="absolute top-3 right-4 text-sm sm:text-lg font-black italic text-white/50 drop-shadow-md">#${rankPosition}</div>
                    <div class="flex flex-col items-center justify-center">
                        <span class="overall !text-4xl">${ptsValue}</span>
                        <span class="font-bold text-[8px] opacity-90 tracking-[0.15em]">ELO</span>
                    </div>
                    <div class="w-24 h-24 mt-3 mb-1 flex items-center justify-center bg-black/10 rounded-full border-2 border-black/10 shrink-0 overflow-hidden">
                        ${player.photo ? `<img src="${player.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${player.role === 'moderador' ? 'shield-check' : 'user'}" class="w-12 h-12 opacity-80"></i>`}
                    </div>
                    <div class="player-name">${player.name}</div>
                    <div class="w-full mt-2 flex justify-evenly items-center px-4">
                        <div class="flex flex-col items-center">
                            <span class="text-base font-black text-white">${vitorias}</span>
                            <span class="text-[8px] font-bold uppercase opacity-80">Vit</span>
                        </div>
                        <div class="w-px h-6 bg-white/30"></div>
                        <div class="flex flex-col items-center">
                            <span class="text-base font-black text-white">${derrotas}</span>
                            <span class="text-[8px] font-bold uppercase opacity-80">Der</span>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
    
    document.getElementById('playerHistoryCardContainer').innerHTML = cardHtml;

    // 2. Agrupar partidas por dia
    const pMatches = state.matchHistory.filter(m =>
        (m.team1.players && m.team1.players.includes(playerName)) ||
        (m.team2.players && m.team2.players.includes(playerName))
    ).sort((a,b) => b.timestamp - a.timestamp);

    currentSelectedPlayerName = playerName;
    currentGroupedMatches = {};
    
    pMatches.forEach(m => {
        const dString = m.dateString || new Date(m.timestamp).toLocaleDateString('pt-BR');
        if (!currentGroupedMatches[dString]) {
            currentGroupedMatches[dString] = [];
        }
        currentGroupedMatches[dString].push(m);
    });

    const days = Object.keys(currentGroupedMatches).sort((a, b) => {
        const [da, ma, ya] = a.split('/');
        const [db, mb, yb] = b.split('/');
        return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
    });

    if (days.length === 0) {
        tabsContainer.innerHTML = '';
        list.innerHTML = '<p class="text-center text-slate-500 py-8 text-sm font-bold">Nenhuma partida registrada para este atleta.</p>';
        currentSelectedDayStr = '';
    } else {
        // Renderizar Abas de Dias
        tabsContainer.innerHTML = days.map((day, idx) => {
            const isActive = idx === 0;
            return `
                <button onclick="window.selectHistoryTab('${day}', '${playerName}')" id="tab-btn-${day.replace(/\//g, '-')}" class="history-tab-btn ${isActive ? 'active' : ''}">
                    ${day.substring(0, 5)}
                </button>
            `;
        }).join('');
        
        // Selecionar o primeiro dia por padrão
        window.selectHistoryTab(days[0], playerName);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

const prepareExportTemplates = (type, playerName, day) => {
    const player = state.players.find(x => x.name === playerName);
    if (!player) return;

    const maxElo = state.players.length > 0 ? Math.max(...state.players.map(p => p.eloRating ?? 0)) : 0;
    const globalEloRank = [...state.players].sort((a, b) => (b.eloRating ?? 0) - (a.eloRating ?? 0) || a.name.localeCompare(b.name));
    const rankPosition = globalEloRank.findIndex(x => x.id === player.id) + 1;
    const lvlInfo = getEloInfo(player.eloRating ?? 0);
    const ptsValue = player.eloRating ?? 0;
    const isDestaque = ptsValue === maxElo && maxElo > 0;
    const pWins = player.vitorias || 0;
    const pLosses = (player.partidas || 0) - pWins;

    // Obter badges do jogador
    const { stats, craques, bagres } = getDailyPlayerStats();
    const badgesHtml = getPlayerBadgesHTML(player, stats, craques, bagres, true);

    // FIFA Card de Alta Resolução preservando o estilo oficial e classes do site
    const cardHtml = `
        <div style="position: relative; width: 210px; height: 300px; box-sizing: border-box; display: flex; justify-content: center; align-items: center;">
            ${badgesHtml}
            ${isDestaque ? `
                <div class="winner-frame-wrapper" style="width: 210px; height: 300px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                    <div class="fifa-card card-${lvlInfo.type} relative" style="margin: 0; width: 200px; height: 290px; box-sizing: border-box;">
                        <div class="absolute top-3 right-4 text-base font-black italic text-white/50" style="z-index: 10;">#${rankPosition}</div>
                        <div class="flex flex-col items-center justify-center" style="z-index: 10;">
                            <span class="overall" style="font-size: 42px; font-weight: 700; line-height: 0.9; margin: 0; font-family: 'Oswald', sans-serif;">${ptsValue}</span>
                            <span class="font-bold text-[8px] opacity-90 tracking-[0.15em]" style="font-family: 'Roboto Condensed', sans-serif;">ELO</span>
                        </div>
                        <div class="w-20 h-20 mt-3 mb-1 flex items-center justify-center bg-black/10 rounded-full border-2 border-yellow-400/60 text-yellow-200 shrink-0 overflow-hidden" style="z-index: 10;">
                            ${player.photo ? `<img src="${player.photo}" class="w-full h-full object-cover">` : `<svg viewBox="0 0 24 24" width="40" height="40" stroke="#fef08a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 opacity-80" style="width: 40px; height: 40px; color: #fef08a;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`}
                        </div>
                        <div class="player-name text-yellow-100" style="z-index: 10; font-size: 16px; font-weight: bold; font-family: 'Oswald', sans-serif; text-transform: uppercase; width: 90%; text-align: center; border-bottom: 2px solid currentColor; padding-bottom: 2px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${player.name}</div>
                        <div class="w-full mt-2 flex justify-evenly items-center px-4" style="z-index: 10; font-family: 'Roboto Condensed', sans-serif;">
                            <div class="flex flex-col items-center">
                                <span class="text-base font-black text-white" style="font-size: 14px;">${pWins}</span>
                                <span class="text-[8px] font-bold uppercase opacity-80" style="color: inherit;">Vit</span>
                            </div>
                            <div class="w-px h-6 bg-white/30"></div>
                            <div class="flex flex-col items-center">
                                <span class="text-base font-black text-white" style="font-size: 14px;">${pLosses}</span>
                                <span class="text-[8px] font-bold uppercase opacity-80" style="color: inherit;">Der</span>
                            </div>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="fifa-card card-${lvlInfo.type} relative" style="margin: 0; width: 210px; height: 300px; box-sizing: border-box;">
                    <div class="absolute top-3 right-4 text-base font-black italic text-white/50" style="z-index: 10;">#${rankPosition}</div>
                    <div class="flex flex-col items-center justify-center" style="z-index: 10;">
                        <span class="overall" style="font-size: 42px; font-weight: 700; line-height: 0.9; margin: 0; font-family: 'Oswald', sans-serif;">${ptsValue}</span>
                        <span class="font-bold text-[8px] opacity-90 tracking-[0.15em]" style="font-family: 'Roboto Condensed', sans-serif;">ELO</span>
                    </div>
                    <div class="w-20 h-20 mt-3 mb-1 flex items-center justify-center bg-black/10 rounded-full border-2 border-black/10 shrink-0 overflow-hidden" style="z-index: 10;">
                        ${player.photo ? `<img src="${player.photo}" class="w-full h-full object-cover">` : (player.role === 'moderador' ? `
                            <svg viewBox="0 0 24 24" width="40" height="40" stroke="#cbd5e1" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 opacity-80" style="width: 40px; height: 40px; color: #cbd5e1;"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
                        ` : `
                            <svg viewBox="0 0 24 24" width="40" height="40" stroke="#cbd5e1" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 opacity-80" style="width: 40px; height: 40px; color: #cbd5e1;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        `)}
                    </div>
                    <div class="player-name" style="z-index: 10; font-size: 16px; font-weight: bold; font-family: 'Oswald', sans-serif; text-transform: uppercase; width: 90%; text-align: center; border-bottom: 2px solid currentColor; padding-bottom: 2px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${player.name}</div>
                    <div class="w-full mt-2 flex justify-evenly items-center px-4" style="z-index: 10; font-family: 'Roboto Condensed', sans-serif;">
                        <div class="flex flex-col items-center">
                            <span class="text-base font-black text-white" style="font-size: 14px;">${pWins}</span>
                            <span class="text-[8px] font-bold uppercase opacity-80" style="color: inherit;">Vit</span>
                        </div>
                        <div class="w-px h-6 bg-white/30"></div>
                        <div class="flex flex-col items-center">
                            <span class="text-base font-black text-white" style="font-size: 14px;">${pLosses}</span>
                            <span class="text-[8px] font-bold uppercase opacity-80" style="color: inherit;">Der</span>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;

    // Partidas formatadas
    const matches = currentGroupedMatches[day] || [];
    let dayEloChange = 0;
    
    // Ajuste dinâmico de fontes e paddings com base na quantidade de partidas para evitar esticar excessivamente a imagem
    const numMatches = matches.length;
    let matchPadding = '10px';
    let matchMargin = '8px';
    let matchHeaderFontSize = '11px';
    let matchHeaderPadding = '6px';
    let matchHeaderMargin = '6px';
    let teamFontSize = '13px';
    let scoreFontSize = '14px';
    let scorePadding = '0 16px';
    
    if (numMatches > 6) {
        // Redução acentuada para muitas partidas (ex: 7 ou mais)
        matchPadding = '6px';
        matchMargin = '4px';
        matchHeaderFontSize = '9px';
        matchHeaderPadding = '3px';
        matchHeaderMargin = '4px';
        teamFontSize = '11px';
        scoreFontSize = '11px';
        scorePadding = '0 8px';
    } else if (numMatches > 3) {
        // Redução moderada para 4 a 6 partidas
        matchPadding = '8px';
        matchMargin = '6px';
        matchHeaderFontSize = '10px';
        matchHeaderPadding = '4px';
        matchHeaderMargin = '5px';
        teamFontSize = '12px';
        scoreFontSize = '12px';
        scorePadding = '0 12px';
    }
    
    const matchesListHtml = matches.map(m => {
        const inT1 = m.team1.players && m.team1.players.includes(playerName);
        const myTeam = inT1 ? 1 : 2;
        const isTieMatch = m.winner === 0;
        const isWin = !isTieMatch && m.winner === myTeam;
        
        const t1Color = isTieMatch ? 'color: #cbd5e1;' : (m.winner === 1 ? 'color: #60a5fa; font-weight: bold;' : 'color: #94a3b8;');
        const t2Color = isTieMatch ? 'color: #cbd5e1;' : (m.winner === 2 ? 'color: #f87171; font-weight: bold;' : 'color: #94a3b8;');
        
        const eloGain = m.eloGain || 0;
        const eloLoss = Math.round(eloGain * 0.7);
        const t1EloChange = m.eloChangeT1 ?? (m.winner === 1 ? eloGain : -eloLoss);
        const t2EloChange = m.eloChangeT2 ?? (m.winner === 2 ? eloGain : -eloLoss);
        const myEloChange = inT1 ? t1EloChange : t2EloChange;
        
        dayEloChange += myEloChange;
        
        const myEloDisplay = `${myEloChange >= 0 ? '+' : ''}${myEloChange}`;
        const eloColor = isTieMatch ? (myEloChange > 0 ? 'color: #4ade80;' : (myEloChange < 0 ? 'color: #f87171;' : 'color: #94a3b8;')) : (isWin ? 'color: #4ade80;' : 'color: #f87171;');
        const statusLabel = isTieMatch ? 'EMPATE' : (isWin ? 'VITÓRIA' : 'DERROTA');

        return `
            <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(71, 85, 105, 0.3); border-radius: 12px; padding: ${matchPadding}; margin-bottom: ${matchMargin}; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${matchHeaderMargin}; border-bottom: 1px solid rgba(71, 85, 105, 0.2); padding-bottom: ${matchHeaderPadding}; font-size: ${matchHeaderFontSize};">
                    <span style="font-weight: bold; color: #94a3b8; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${m.team1.name} vs ${m.team2.name}</span>
                    <span style="${eloColor} font-weight: 900; background: #0f172a; padding: 2px 8px; border-radius: 6px; white-space: nowrap; flex-shrink: 0;">${statusLabel} (${myEloDisplay} ELO)</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${teamFontSize}; font-weight: bold; gap: 4px;">
                    <span style="${t1Color} flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.team1.name}</span>
                    <span style="padding: ${scorePadding}; font-size: ${scoreFontSize}; font-weight: 900; color: #fff; font-family: 'Oswald', sans-serif; white-space: nowrap; flex-shrink: 0; text-align: center;">${m.team1.score} x ${m.team2.score}</span>
                    <span style="${t2Color} flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.team2.name}</span>
                </div>
            </div>
        `;
    }).join('');

    const dayEloDisplay = `${dayEloChange >= 0 ? '+' : ''}${dayEloChange}`;
    const dayEloColor = dayEloChange > 0 ? 'color: #4ade80;' : (dayEloChange < 0 ? 'color: #f87171;' : 'color: #94a3b8;');

    // Obter o nome dinâmico do site (Grupo ativo)
    const activeGroupName = state.currentGroupName || "TURMA DO VÔLEI";

    // 1. Apenas a Cartinha
    if (type === 'card') {
        document.getElementById('shareableCardOnly').innerHTML = cardHtml;
    }

    // 2. Apenas o Histórico
    if (type === 'history') {
        document.getElementById('shareableHistoryOnly').innerHTML = `
            <div style="display: flex; flex-direction: column; min-height: 336px; justify-content: space-between; width: 100%; box-sizing: border-box; flex-grow: 1;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 16px; gap: 16px;">
                        <div style="flex: 1; min-width: 0;">
                            <h2 class="export-header-title" style="margin: 0; font-family: 'Oswald', sans-serif; text-transform: uppercase; word-wrap: break-word; overflow-wrap: break-word; font-size: 24px; line-height: 1.2;">${activeGroupName}</h2>
                            <p style="font-size: 10px; font-weight: bold; color: #64748b; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;">Histórico do Dia</p>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <h3 style="font-size: 18px; font-weight: 900; color: #fff; margin: 0; text-transform: uppercase; font-family: 'Oswald', sans-serif; white-space: nowrap;">${playerName}</h3>
                            <p style="font-size: 11px; font-weight: bold; color: #22c55e; margin: 2px 0 0 0; white-space: nowrap;">Partidas de ${day}</p>
                        </div>
                    </div>
                    
                    <div style="padding-right: 4px; margin-bottom: 12px;">
                        ${matchesListHtml}
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-t: 2px solid #334155; padding-top: 12px; margin-top: 12px; flex-shrink: 0; white-space: nowrap; gap: 8px;">
                    <div style="flex-shrink: 0;">
                        <span class="export-watermark">rachador.app</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; white-space: nowrap;">
                        <span style="font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; white-space: nowrap;">Saldo do Dia:</span>
                        <span style="${dayEloColor} font-size: 16px; font-weight: 900; background: #0f172a; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-family: 'Oswald', sans-serif; white-space: nowrap; flex-shrink: 0;">${dayEloDisplay} ELO</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 3. Combinado (Cartinha + Histórico)
    if (type === 'combined') {
        document.getElementById('shareableCombined').innerHTML = `
            <!-- Lado Esquerdo: Card -->
            <div style="width: 230px; display: flex; justify-content: center; align-items: center; flex-shrink: 0; box-sizing: border-box;">
                ${cardHtml}
            </div>
            
            <!-- Lado Direito: Histórico -->
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-height: 332px; box-sizing: border-box; flex-grow: 1; min-width: 0;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 16px; gap: 16px;">
                        <div style="flex: 1; min-width: 0;">
                            <h2 class="export-header-title" style="margin: 0; font-size: 24px; font-family: 'Oswald', sans-serif; text-transform: uppercase; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.2;">${activeGroupName}</h2>
                            <span class="export-watermark" style="white-space: nowrap;">rachador.app</span>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <h3 style="font-size: 16px; font-weight: 900; color: #fff; margin: 0; text-transform: uppercase; font-family: 'Oswald', sans-serif; white-space: nowrap;">${playerName}</h3>
                            <p style="font-size: 11px; font-weight: bold; color: #22c55e; margin: 2px 0 0 0; white-space: nowrap;">Partidas de ${day}</p>
                        </div>
                    </div>
                    
                    <div style="padding-right: 4px; margin-bottom: 12px;">
                        ${matchesListHtml}
                    </div>
                </div>
                
                <div style="display: flex; justify-content: flex-end; align-items: center; border-t: 2px solid #334155; padding-top: 10px; margin-top: 10px; flex-shrink: 0; white-space: nowrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; white-space: nowrap;">
                        <span style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; white-space: nowrap;">Saldo do Dia:</span>
                        <span style="${dayEloColor} font-size: 14px; font-weight: 900; background: #0f172a; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-family: 'Oswald', sans-serif; white-space: nowrap; flex-shrink: 0;">${dayEloDisplay} ELO</span>
                    </div>
                </div>
            </div>
        `;
    }
};

// Helper para converter imagens remotas para Base64 usando múltiplos proxies CORS resilientes (resolvendo problemas de CORS/502)
const convertImagesToBase64 = async (containerElement) => {
    const images = containerElement.querySelectorAll('img');
    const promises = Array.from(images).map(async (img) => {
        const originalSrc = img.src;
        if (originalSrc && originalSrc.startsWith('http') && !originalSrc.startsWith(window.location.origin) && !originalSrc.startsWith('data:')) {
            // Proxies CORS múltiplos para alta disponibilidade e resiliência total a falhas 502/bloqueios
            const proxies = [
                `https://images.weserv.nl/?url=${encodeURIComponent(originalSrc)}`,
                `https://corsproxy.io/?${encodeURIComponent(originalSrc)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(originalSrc)}`
            ];
            
            let loaded = false;
            for (const url of proxies) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const blob = await res.blob();
                        const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        img.src = base64;
                        console.log(`Imagem remota convertida com sucesso usando o proxy: ${url.split('/')[2]}`);
                        loaded = true;
                        break;
                    } else {
                        console.warn(`Proxy ${url.split('/')[2]} retornou status ${res.status}. Tentando próximo...`);
                    }
                } catch (err) {
                    console.warn(`Erro no proxy ${url.split('/')[2]}:`, err);
                }
            }
            
            if (!loaded) {
                console.error("Todas as tentativas de proxy CORS falharam para a imagem:", originalSrc);
            }
        }
    });
    await Promise.all(promises);
};

export const exportPlayerHistory = async (type, action) => {
    const playerName = currentSelectedPlayerName;
    const day = currentSelectedDayStr;
    
    if (!playerName) {
        showToast("Selecione um atleta primeiro.", "error");
        return;
    }

    if (type !== 'card' && !day) {
        showToast("Este atleta não possui histórico de partidas para exportar.", "error");
        return;
    }

    // Fechar os dropdowns imediatamente ao iniciar a exportação
    ['share-dropdown', 'download-dropdown'].forEach(dId => {
        const d = document.getElementById(dId);
        if (d) d.classList.add('hidden');
    });

    const overlay = document.getElementById('share-loading-overlay');
    const loadingText = document.getElementById('share-loading-text');
    
    if (overlay) {
        loadingText.innerText = action === 'share' ? "Preparando compartilhamento..." : "Gerando imagem para download...";
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }

    try {
        // 1. Preparar e alimentar o template oculto correspondente
        prepareExportTemplates(type, playerName, day);
        
        let targetId = 'shareableCombined';
        if (type === 'card') targetId = 'shareableCardOnly';
        else if (type === 'history') targetId = 'shareableHistoryOnly';
        
        const targetElement = document.getElementById(targetId);
        
        // Converter todas as imagens remotas do contêiner para Base64 antes da captura
        await convertImagesToBase64(targetElement);
        
        // Inicializar os ícones Lucide no elemento oculto antes da captura
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({
                attrs: {
                    'stroke-width': 2.5
                },
                nameAttr: 'data-lucide',
                node: targetElement
            });
        }
        
        // Timeout curto para garantir o reflow e carregamento perfeito das imagens em base64
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 2. Renderizar o elemento com modern-screenshot (suporta clip-path, gradientes, pseudo-elementos nativamente)
        const blob = await domToBlob(targetElement, {
            backgroundColor: '#0f172a',
            scale: 2,
            fetch: {
                requestInit: { mode: 'cors' }
            }
        });
        
        if (!blob) {
            showToast("Erro ao processar imagem.", "error");
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
            }
            return;
        }
        
        const fileSlug = playerName.toLowerCase().replace(/\s+/g, '_');
        const fileName = type === 'card'
            ? `${fileSlug}_cartinha.png`
            : `${fileSlug}_${type}_${day.replace(/\//g, '-')}.png`;
        
        if (action === 'share') {
            const file = new File([blob], fileName, { type: 'image/png' });
            
            // Valida suporte ao compartilhamento nativo de arquivos via Web Share API
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: `Cartinha de ${playerName}`,
                        text: `Confira minha cartinha e histórico no Rachador!`,
                        files: [file]
                    });
                    showToast("Compartilhado com sucesso!", "success");
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        console.error("Compartilhamento nativo falhou:", e);
                        downloadBlob(blob, fileName);
                    }
                }
            } else {
                // Fallback: Tenta copiar para área de transferência e faz o download automático
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showToast("Imagem copiada para a área de transferência! Baixando arquivo...", "success");
                } catch (e) {
                    showToast("Formato não suportado. Baixando imagem...", "info");
                }
                downloadBlob(blob, fileName);
            }
        } else {
            // Ação é download direta
            downloadBlob(blob, fileName);
            showToast("Imagem baixada com sucesso!", "success");
        }
        
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
        
    } catch (e) {
        console.error("Erro ao gerar imagem:", e);
        showToast("Erro ao gerar imagem.", "error");
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    }
};

const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Vincula a nova lógica de exportação ao escopo global do navegador
window.exportPlayerHistory = exportPlayerHistory;


