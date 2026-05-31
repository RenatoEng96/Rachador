import { toggleDraftMode, getLevelInfo, getCategoryInfo, getTeamName, getDailyPlayerStats, openMoveModal, showToast, switchView, openConfirmModal, closeConfirmModal, closeVictoryModalOnly, closeMoveModal, closePlayerHistoryModal, updateLiveEloPreview, updateSorteioCounters, changeHistoryPage, openPlayerHistoryModal, exportPlayerHistory, setFormMode, editPlayer, resetForm, toggleAuthMode, setGroupRoleFilter, filterUserGroups, renderUserGroups, renderAll, openPlacarConfigModal, closePlacarConfigModal, savePlacarConfig, playBeepSound, goHome, openTermsModal, closeTermsModal, openPrivacyModal, closePrivacyModal, openSupportModal, closeSupportModal, copySupportEmail } from '../ui.js';

import { state } from '../state.js';
import { calculateEloMatch } from '../services/rankingService.js';
import { settingsRef, updateDoc } from '../firebase.js';
import { domToBlob } from 'https://unpkg.com/modern-screenshot?module';

// ============================================================================
// RENDERIZADORES DE TELA (HTML Injection)
// (Cole aqui o seu código HTML original de formatação das listas)
// ============================================================================

export const renderPublic = () => {
    const grid = document.getElementById('publicGrid');
    if (state.players.length === 0) { 
        grid.innerHTML = `<p class="opacity-50 text-center w-full">Nenhum atleta cadastrado.</p>`; 
        return; 
    }
    
    const { stats, craques, bagres } = getDailyPlayerStats();
    const maxElo = state.players.length > 0 ? Math.max(...state.players.map(p => p.eloRating ?? 0)) : 0;
    const globalEloRank = [...state.players].sort((a, b) => (b.eloRating ?? 0) - (a.eloRating ?? 0) || a.name.localeCompare(b.name));
    
    const sortFn = (a, b) => { 
        const eloDiff = (b.eloRating ?? 0) - (a.eloRating ?? 0); 
        if (eloDiff !== 0) return eloDiff; 
        return (a.name || '').localeCompare(b.name || ''); 
    };
    
    const renderGroup = (title, icon, colorClass, list) => {
        if (list.length === 0) return '';
        
        const cardsHTML = list.map(p => {
            const lvlInfo = getLevelInfo(p.eloRating ?? 0);
            const ptsValue = p.eloRating ?? 0;
            const isDestaque = ptsValue === maxElo && maxElo > 0;
            const vitorias = p.vitorias || 0;
            const derrotas = (p.partidas || 0) - vitorias;
            
            const isCraque = craques.has(p.name);
            const isBagre = bagres.has(p.name);
            const streak = p.streak || 0;
            const pStats = stats[p.name] || { wins: 0, losses: 0 };
            
            // Selos posicionados fora do card. Fogo/Gelo não aparecem se o jogador for Craque ou Bagre.
            const hasBadges = streak >= 3 || streak <= -3 || isCraque || isBagre;
            const badgesHTML = hasBadges ? `
                <div class="absolute -top-2 -left-2 sm:-left-4 flex flex-col gap-1.5 z-40 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] items-start">
                    ${(streak >= 3) ? `<div class="bg-slate-900/90 p-1 sm:p-1.5 rounded-full border border-orange-500/50 flex items-center gap-1" title="${streak} Vitórias Seguidas!"><i data-lucide="flame" class="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 fill-orange-500"></i><span class="text-orange-500 font-black text-xs sm:text-sm pr-1.5">${streak}</span></div>` : ''}
                    ${(streak <= -3) ? `<div class="bg-slate-900/90 p-1 sm:p-1.5 rounded-full border border-blue-500/50 flex items-center gap-1" title="${Math.abs(streak)} Derrotas Seguidas"><i data-lucide="snowflake" class="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 fill-blue-500"></i><span class="text-blue-500 font-black text-xs sm:text-sm pr-1.5">${Math.abs(streak)}</span></div>` : ''}
                    ${isCraque ? `<div class="bg-slate-900/90 p-1 sm:p-1.5 rounded-full border border-yellow-400/50 flex items-center gap-1" title="Craque do Dia!"><i data-lucide="crown" class="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400"></i><span class="text-yellow-400 font-black text-xs sm:text-sm pr-1.5">${pStats.wins}</span></div>` : ''}
                    ${isBagre ? `<div class="bg-slate-900/90 p-1 sm:p-1.5 rounded-full border border-emerald-400/50 flex items-center gap-1" title="Bagre do Dia!"><i data-lucide="fish" class="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400"></i><span class="text-emerald-400 font-black text-xs sm:text-sm pr-1.5">${pStats.losses}</span></div>` : ''}
                </div>
            ` : '';
            
            const rankPosition = globalEloRank.findIndex(x => x.id === p.id) + 1;

            const innerCard = `
                <div onclick="openPlayerHistoryModal('${p.name}')" class="fifa-card cursor-pointer card-${lvlInfo.type} ${isDestaque ? '!w-full !h-full m-0' : 'w-full mx-auto !h-[330px]'} relative">
                    <div class="absolute top-3 right-4 text-sm sm:text-lg font-black italic text-white/50 drop-shadow-md">#${rankPosition}</div>
                        <div class="flex flex-col items-center justify-center">
                            <span class="overall !text-4xl">${ptsValue}</span>
                        <span class="font-bold text-[8px] opacity-90 tracking-[0.15em]">ELO</span>
                    </div>
                    <div class="w-24 h-24 mt-3 mb-1 flex items-center justify-center bg-black/10 rounded-full border-2 ${isDestaque ? 'border-yellow-400/60 text-yellow-200' : 'border-black/10'} shrink-0 overflow-hidden">
                        ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${p.role === 'moderador' ? 'shield-check' : 'user'}" class="w-12 h-12 opacity-80"></i>`}
                    </div>
                    <div class="player-name ${isDestaque ? 'text-yellow-100' : ''}">${p.name}</div>
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
                </div>`;
                
            return `
                <div class="relative flex justify-center w-full sm:w-[210px] mt-4 group ${isDestaque ? 'winner-frame-container' : ''}">
                    ${badgesHTML}
                    ${isDestaque ? `<div class="winner-frame-wrapper !h-[340px]">${innerCard}</div>` : innerCard}
                </div>`;
        }).join('');
        
        return `
            <div class="w-full flex flex-col items-center mb-10">
                <h3 class="text-lg sm:text-2xl font-bold mb-4 flex items-center gap-2 ${colorClass} border-b border-slate-700/50 pb-2 px-8 uppercase tracking-wider">
                    <i data-lucide="${icon}" class="w-5 h-5"></i> ${title}
                </h3>
                <div class="grid grid-cols-[repeat(2,minmax(130px,180px))] sm:flex sm:flex-wrap gap-3 sm:gap-6 justify-center w-full mx-auto px-1 sm:px-0 pt-4">
                    ${cardsHTML}
                </div>
            </div>`;
    };

    grid.innerHTML = 
        renderGroup('Mestre', 'flame', 'text-red-500', state.players.filter(p => (p.eloRating ?? 0) >= 500).sort(sortFn)) + 
        renderGroup('Diamante', 'gem', 'text-fuchsia-500', state.players.filter(p => (p.eloRating ?? 0) >= 400 && (p.eloRating ?? 0) < 500).sort(sortFn)) + 
        renderGroup('Platina', 'shield', 'text-cyan-500', state.players.filter(p => (p.eloRating ?? 0) >= 300 && (p.eloRating ?? 0) < 400).sort(sortFn)) + 
        renderGroup('Ouro', 'award', 'text-yellow-500', state.players.filter(p => (p.eloRating ?? 0) >= 200 && (p.eloRating ?? 0) < 300).sort(sortFn)) + 
        renderGroup('Prata', 'medal', 'text-slate-400', state.players.filter(p => (p.eloRating ?? 0) >= 100 && (p.eloRating ?? 0) < 200).sort(sortFn)) + 
        renderGroup('Bronze', 'medal', 'text-orange-500', state.players.filter(p => (p.eloRating ?? 0) < 100).sort(sortFn));
        
    lucide.createIcons();
};

export const renderRanking = () => {
    const list = document.getElementById('rankingList');
    
    const rankingGroupText = document.getElementById('rankingGroupText');
    if (rankingGroupText && state.currentGroupName) {
        rankingGroupText.innerText = `Os melhores jogadores de ${state.currentGroupName}`;
    }
    
    const sortedPlayers = [...state.players].sort((a,b) => { 
        const eloDiff = (b.eloRating ?? 0) - (a.eloRating ?? 0); 
        if (eloDiff !== 0) return eloDiff; 
        return (a.name || '').localeCompare(b.name || ''); 
    });
    
    if (sortedPlayers.length === 0) { 
        list.innerHTML = `<p class="opacity-50 text-sm text-center py-4">Aguardando resultados...</p>`; 
        return; 
    }
    
    const top3 = sortedPlayers.slice(0, 3);
    let podiumHTML = '<div class="flex justify-center items-end gap-1 sm:gap-6 mb-8 mt-6">';
    
    [1, 0, 2].forEach(pos => {
        if (top3[pos]) {
            const p = top3[pos];
            const heightClass = pos === 0 ? 'h-32' : (pos === 1 ? 'h-24' : 'h-20');
            const isGold = pos === 0;
            const isSilver = pos === 1;
            const bgClass = isGold ? 'bg-gradient-to-t from-yellow-600/20 to-yellow-500/40 border-yellow-500' : (isSilver ? 'bg-gradient-to-t from-slate-500/20 to-slate-400/40 border-slate-400' : 'bg-gradient-to-t from-amber-700/20 to-amber-600/40 border-amber-600');
            const textColor = isGold ? 'text-yellow-500' : (isSilver ? 'text-slate-300' : 'text-amber-600');
            const medal = isGold ? '🥇' : (isSilver ? '🥈' : '🥉');
            
            podiumHTML += `
                <div onclick="openPlayerHistoryModal('${p.name}')" class="flex flex-col items-center w-20 relative group cursor-pointer hover:scale-105 transition-transform">
                    <div class="relative mb-2 flex flex-col items-center">
                        <div class="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border-2 shadow-[0_0_15px_currentColor] ${textColor} z-10 overflow-hidden">
                            ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${p.icon || 'user'}" class="w-5 h-5"></i>`}
                        </div>
                        <span class="font-bold text-[10px] text-center mt-1 text-slate-200 truncate w-full px-1 flex justify-center gap-1">
                            ${medal} <span class="truncate">${p.name}</span>
                        </span>
                    </div>
                    <div class="w-full ${heightClass} ${bgClass} border-t-4 rounded-t-lg flex flex-col items-center pt-2 shadow-[inset_0_10px_20px_rgba(0,0,0,0.3)] relative overflow-hidden">
                        <div class="flex flex-col items-center">
                            <span class="text-xl font-black ${textColor}">${p.eloRating ?? 0}</span>
                            <span class="text-[8px] font-bold text-slate-400 uppercase mt-[-4px]">ELO</span>
                        </div>
                    </div>
                </div>`;
        }
    });
    
    podiumHTML += '</div>';
    list.innerHTML = podiumHTML; 
    lucide.createIcons();
};

export const getNextDueDate = (paidUntilMillis, monthlyDay) => {
    if (paidUntilMillis) {
        return new Date(paidUntilMillis);
    } else {
        const today = new Date();
        let nextDue = new Date(today.getFullYear(), today.getMonth(), monthlyDay);
        if (today > nextDue) {
            nextDue.setMonth(nextDue.getMonth() + 1);
        }
        return nextDue;
    }
};

export const getPlayerLateChargesCount = (player) => {
    let count = 0;
    
    // 1. Cobranças de Mensalidades em atraso
    const settings = state.paymentSettings || {};
    const monthlyValue = parseFloat(settings.monthlyValue) || 0;
    const monthlyDay = parseInt(settings.monthlyDay) || 10;
    
    if (monthlyValue > 0) {
        const now = new Date();
        const nextDue = getNextDueDate(player.paidUntil, monthlyDay);
        if (now > nextDue) {
            let tempDate = new Date(nextDue.getTime());
            while (now > tempDate) {
                count++;
                tempDate.setMonth(tempDate.getMonth() + 1);
            }
        }
    }
    
    // 2. Cobranças Diárias em atraso (status === 'pending' e Date.now() > dueDate)
    if (state.charges && state.charges.length > 0) {
        const playerEmail = player.email ? player.email.toLowerCase().trim() : '';
        const nowMillis = Date.now();
        
        state.charges.forEach(charge => {
            const chargeEmail = charge.playerEmail ? charge.playerEmail.toLowerCase().trim() : '';
            const matchesPlayer = (player.id && charge.playerId === player.id) || (playerEmail && chargeEmail === playerEmail);
            
            if (matchesPlayer && charge.status === 'pending' && nowMillis > charge.dueDate) {
                count++;
            }
        });
    }
    
    return count;
};

export const renderSorteioTable = () => {
    const tbody = document.getElementById('sorteioTableBody');
    if(!tbody) return;
    
    const countElement = document.getElementById('playerCountSorteio');
    if(countElement) {
        countElement.innerText = `${state.selectedPlayerIds.size} / ${state.players.length} Selecionados`;
    }
    
    const selectAllCheckbox = document.getElementById('selectAll');
    if(selectAllCheckbox) {
        selectAllCheckbox.checked = state.players.length > 0 && state.players.every(p => state.selectedPlayerIds.has(p.id));
    }
    
    const searchTerm = document.getElementById('searchSorteio')?.value.toLowerCase() || '';
    const sortMode = document.getElementById('sortSorteio')?.value || 'default';

    let filtered = state.players.filter(p => p.name.toLowerCase().includes(searchTerm));

    const sorted = filtered.sort((a, b) => { 
        if (sortMode === 'alpha') {
            return (a.name || '').localeCompare(b.name || '');
        } else {
            // 1º Critério: Categoria (Maior para menor)
            const catDiff = (parseInt(b.categoria) || 1) - (parseInt(a.categoria) || 1); 
            if(catDiff !== 0) return catDiff; 
            
            // 2º Critério: Elo (Maior para menor)
            const eloDiff = (b.eloRating ?? 0) - (a.eloRating ?? 0);
            if (eloDiff !== 0) return eloDiff;
            
            // 3º Critério: Ordem Alfabética
            return (a.name || '').localeCompare(b.name || ''); 
        }
    });
    
    tbody.innerHTML = sorted.map(p => {
        const lvlInfo = getLevelInfo(p.eloRating ?? 0);
        const catInfo = getCategoryInfo(p.categoria);
        
        // Bloqueio por atraso de pagamento
        const lateCharges = getPlayerLateChargesCount(p);
        const isBlocked = (state.paymentSettings?.blockLatePlayers === true) && (lateCharges >= (state.paymentSettings?.maxLateCharges || 1));
        
        if (isBlocked) {
            state.selectedPlayerIds.delete(p.id);
        }
        
        const isSelected = state.selectedPlayerIds.has(p.id);
        
        const rowClickAction = isBlocked
            ? ""
            : `onclick="const c = document.getElementById('chk-${p.id}'); c.checked = !c.checked; togglePlayerSelection('${p.id}', c.checked); updateSorteioCounters();"`;
            
        const checkboxHTML = isBlocked
            ? `<input type="checkbox" id="chk-${p.id}" disabled class="w-3 h-3 sm:w-4 sm:h-4 cursor-not-allowed opacity-30">`
            : `<input type="checkbox" id="chk-${p.id}" ${isSelected ? 'checked' : ''} onclick="togglePlayerSelection('${p.id}', this.checked); updateSorteioCounters();" class="w-3 h-3 sm:w-4 sm:h-4 accent-green-500 cursor-pointer">`;
            
        const warningIconHTML = isBlocked
            ? `<span class="flex items-center text-red-500 animate-pulse ml-1.5" title="Inelegível por atraso">
                   <i data-lucide="alert-triangle" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
               </span>`
            : "";
        
        return `
            <tr class="hover:bg-slate-700/30 transition-colors cursor-pointer" ${rowClickAction}>
                <td class="px-1 sm:px-2 py-3 text-center" onclick="event.stopPropagation()">
                    ${checkboxHTML}
                </td>
                <td class="px-1 sm:px-3 py-3 font-bold ${catInfo.text} flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                    <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                        ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${p.role === 'moderador' ? 'shield-check' : 'user'}" class="w-3 h-3 text-slate-400"></i>`}
                    </div>
                    <span class="truncate max-w-[80px] sm:max-w-none ${isBlocked ? 'line-through text-slate-500 opacity-60' : ''}">${p.name}</span>
                    ${warningIconHTML}
                </td>
                <td class="px-1 sm:px-3 py-3 text-center">
                    <span class="px-1 sm:px-2 py-1 rounded-md text-[8px] sm:text-[9px] font-bold ${catInfo.bg} ${catInfo.text} opacity-90">${catInfo.label}</span>
                </td>
                <td class="px-1 sm:px-3 py-3 text-center whitespace-nowrap">
                    <div class="flex flex-col items-center justify-center">
                        <span class="font-bold text-white text-xs sm:text-sm">${p.eloRating ?? 0}</span>
                        <span class="px-1 sm:px-2 py-0.5 mt-0.5 rounded-md text-[7px] sm:text-[8px] font-bold ${lvlInfo.bg} ${lvlInfo.text} opacity-70">${lvlInfo.label}</span>
                    </div>
                </td>
            </tr>`;
    }).join('');
    
    lucide.createIcons();
};

export const renderAdminTable = () => {
    const tbody = document.getElementById('adminTableBody');
    if(!tbody) return;
    
    const countElement = document.getElementById('adminPlayerCount');
    if (countElement) countElement.innerText = state.players.length;
    
    const searchTerm = document.getElementById('searchAdmin')?.value.toLowerCase() || '';
    const sortMode = document.getElementById('sortAdmin')?.value || 'alpha';
    
    let filtered = state.players.filter(p => p.name.toLowerCase().includes(searchTerm));

    const sorted = filtered.sort((a, b) => { 
        if (sortMode === 'level') {
            const c = (parseInt(b.categoria)||1) - (parseInt(a.categoria)||1); 
            if(c !== 0) return c; 
            const eloDiff = (b.eloRating ?? 0) - (a.eloRating ?? 0);
            if(eloDiff !== 0) return eloDiff;
            return (a.name || '').localeCompare(b.name || '');
        } else {
            return (a.name || '').localeCompare(b.name || '');
        }
    });
    
    tbody.innerHTML = sorted.map(p => {
        const lvlInfo = getLevelInfo(p.eloRating ?? 0);
        const catInfo = getCategoryInfo(p.categoria);
        
        return `
            <tr class="hover:bg-slate-700/30 transition-colors">
                <td class="px-1 sm:px-3 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-1 sm:gap-3">
                        <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border-2 ${catInfo.border}">
                            ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${p.role === 'moderador' ? 'shield-check' : 'user'}" class="w-3 h-3 sm:w-4 sm:h-4 ${catInfo.text}"></i>`}
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold ${catInfo.text} truncate max-w-[70px] sm:max-w-[150px]">${p.name}</span>
                            <span class="text-[8px] sm:text-[9px] font-black ${catInfo.text} tracking-wider uppercase mt-0.5 truncate max-w-[70px] sm:max-w-none">${catInfo.label}</span>
                        </div>
                    </div>
                </td>
                <td class="px-1 sm:px-3 py-3 text-center font-bold text-yellow-500 whitespace-nowrap">
                    ${p.vitorias || 0} <span class="text-slate-500 text-[10px] sm:text-xs">/ ${p.partidas || 0}</span>
                </td>
                <td class="px-1 sm:px-3 py-3 text-center whitespace-nowrap">
                    <div class="flex flex-col items-center justify-center">
                        <span class="font-bold text-white text-xs sm:text-sm">${p.eloRating ?? 0}</span>
                        <span class="px-1 sm:px-2 py-0.5 mt-0.5 rounded-md text-[7px] sm:text-[8px] font-bold ${lvlInfo.bg} ${lvlInfo.text} opacity-70">${lvlInfo.label}</span>
                    </div>
                </td>
                <td class="px-1 sm:px-3 py-3 text-right">
                    <div class="flex justify-end gap-1">
                        <button onclick="editPlayer('${p.id}')" class="p-1 sm:p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg">
                            <i data-lucide="edit-2" class="w-3 h-3"></i>
                        </button>
                        <button onclick="deletePlayer('${p.id}')" class="p-1 sm:p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');
    
    lucide.createIcons();
};

export const renderTeams = () => {
    const adminGrid = document.getElementById('adminTeamsGrid');
    const placarGrid = document.getElementById('placarTeamsGrid'); 
    const sections = [document.getElementById('adminTeamsSection'), document.getElementById('placarTeamsSection')]; 
    
    if (state.drawnTeams.length === 0) { 
        sections.forEach(s => { if(s) s.classList.add('hidden'); }); 
        return; 
    }
    
    sections.forEach(s => { if(s) s.classList.remove('hidden'); });
    
    const sortedTeams = state.drawnTeams.sort((a,b) => a.isWaitlist ? 1 : (b.isWaitlist ? -1 : parseInt(a.label) - parseInt(b.label)));
    
    const { stats, craques, bagres } = getDailyPlayerStats();
    const maxElo = state.players.length > 0 ? Math.max(...state.players.map(p => p.eloRating ?? 0)) : 0;
    
    const content = sortedTeams.map(t => {
        const teamName = t.isWaitlist ? '<i data-lucide="clock" class="inline w-4 h-4 mr-1"></i> Time Fora' : getTeamName(t);
        const pSorted = [...t.players].sort((a,b) => { 
            const c = (parseInt(b.categoria)||1) - (parseInt(a.categoria)||1); 
            if(c !== 0) return c; 
            return a.name.localeCompare(b.name); 
        });
        
        const controlsHTML = !t.isWaitlist ? `
            <div class="flex gap-1 shrink-0">
                <button onclick="redrawTeamWithWaitlist('${t.id}')" class="p-1.5 flex items-center gap-1 text-[10px] font-black rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 transition-colors hover:bg-blue-500/20" title="Substituir Pela Espera">
                    <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                    <span>Mesclar com Time Fora</span>
                </button>
                <button onclick="deleteTeam('${t.id}')" class="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20" title="Excluir Equipe">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>` : `
            <div class="flex gap-1 shrink-0">
                <button onclick="promoteWaitlistToTeam('${t.id}')" class="p-1.5 flex items-center gap-1 text-[10px] font-black rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 transition-colors hover:bg-green-500/20" title="Formar Novo Time com a Espera">
                    <i data-lucide="arrow-up-circle" class="w-3 h-3"></i>
                    <span>Montar Time</span>
                </button>
                <button onclick="deleteTeam('${t.id}')" class="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20" title="Excluir Time Fora">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>`;

        const playersHTML = pSorted.map(p => {
            const dbPlayer = state.players.find(x => x.id === p.id) || p;
            const catInfo = getCategoryInfo(dbPlayer.categoria);
            const ptsValue = dbPlayer.eloRating ?? 0;
            
            const pStats = stats[dbPlayer.name] || { wins: 0, losses: 0 };
            const isCraque = craques.has(dbPlayer.name);
            const isBagre = bagres.has(dbPlayer.name);
            const isDestaque = ptsValue === maxElo && maxElo > 0;
            const waitlistBadge = (t.isWaitlist && p.waitlistRounds > 0) ? `<span class="bg-blue-500/20 text-blue-400 text-[8px] font-black px-1.5 py-0.5 rounded ml-1" title="Rodadas na Espera">${p.waitlistRounds}R</span>` : '';

            return `
                <div class="flex justify-between items-center text-xs sm:text-sm border-b border-slate-700/50 pb-1.5 last:border-0 last:pb-0 group">
                    <span class="flex items-center gap-1 sm:gap-2">
                        <span class="w-2 h-2 rounded-full ${catInfo.dot} shrink-0"></span>
                        <div class="w-5 h-5 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                            ${dbPlayer.photo ? `<img src="${dbPlayer.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${dbPlayer.icon || 'user'}" class="w-3 h-3 ${catInfo.text} opacity-80"></i>`}
                        </div>
                        <span class="font-bold ${catInfo.text} truncate max-w-[110px] sm:max-w-[130px] ml-1">${dbPlayer.name}</span>
                        <span class="text-[9px] font-bold text-slate-500 shrink-0 mx-0.5" title="Vitórias/Derrotas Diárias">(${pStats.wins}V ${pStats.losses}D)</span>
                        ${waitlistBadge}
                        ${((dbPlayer.streak || 0) >= 3) ? `<span class="flex items-center" title="${dbPlayer.streak} Vitórias Seguidas!"><i data-lucide="flame" class="w-3 h-3 text-orange-500 fill-orange-500 shrink-0"></i><span class="text-[9px] font-black text-orange-500 ml-0.5">${dbPlayer.streak}</span></span>` : ''}
                        ${((dbPlayer.streak || 0) <= -3) ? `<span class="flex items-center" title="${Math.abs(dbPlayer.streak)} Derrotas Seguidas"><i data-lucide="snowflake" class="w-3 h-3 text-blue-500 fill-blue-500 shrink-0"></i><span class="text-[9px] font-black text-blue-500 ml-0.5">${Math.abs(dbPlayer.streak)}</span></span>` : ''}
                        ${isCraque ? `<span class="flex items-center" title="Craque do Dia!"><i data-lucide="crown" class="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-yellow-400 shrink-0"></i><span class="text-[9px] font-black text-yellow-400 ml-0.5">${pStats.wins}</span></span>` : ''}
                       ${isBagre ? `<span class="flex items-center" title="Bagre do Dia"><i data-lucide="fish" class="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 shrink-0"></i><span class="text-[9px] font-black text-emerald-400 ml-0.5">${pStats.losses}</span></span>` : ''}
                    </span>
                    <div class="flex items-center gap-1 sm:gap-2">
                        <span class="opacity-60 text-[10px] sm:text-xs whitespace-nowrap shrink-0">${ptsValue} ELO</span>
                        <button onclick="openMoveModal('${t.id}', '${p.id}')" class="p-1 text-slate-400 hover:text-blue-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus:opacity-100" title="Transferir Jogador">
                            <i data-lucide="arrow-right-left" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');

        const cleanTeamName = teamName.replace(/<[^>]*>/g, '').trim();
        const teamNameLength = cleanTeamName.length;
        let fontSizeClass = 'text-base';
        if (teamNameLength > 20) {
            fontSizeClass = 'text-[10px] sm:text-xs';
        } else if (teamNameLength > 15) {
            fontSizeClass = 'text-xs sm:text-sm';
        } else if (teamNameLength > 10) {
            fontSizeClass = 'text-sm sm:text-base';
        }

        return `
            <div class="team-container w-full p-4 rounded-xl border relative shadow-lg ${t.isWaitlist ? 'bg-slate-800/40 border-slate-600' : 'border-slate-700 bg-slate-800/80'}">
                <div class="flex justify-between items-center gap-2 mb-3 w-full min-w-0">
                    <h3 class="font-bold ${t.isWaitlist ? 'text-slate-400' : 'text-green-500'} ${fontSizeClass} uppercase truncate min-w-0 flex-1 leading-tight" title="${cleanTeamName}">${teamName}</h3>
                    ${controlsHTML}
                </div>
                <div class="space-y-2 mt-2">
                    ${playersHTML}
                </div>
            </div>`;
    }).join('');
    
    if (adminGrid) adminGrid.innerHTML = content;
    if (placarGrid) placarGrid.innerHTML = content; 
    
    lucide.createIcons();
};

export const renderPlacarTeams = () => {
    const select1 = document.getElementById('team1Select');
    const select2 = document.getElementById('team2Select');
    
    if (!select1 || !select2) return;
    
    // Puxa o estado atualizado da nuvem, se existir, senão usa o local
    const val1 = state.currentTeam1 !== undefined ? state.currentTeam1 : select1.value;
    const val2 = state.currentTeam2 !== undefined ? state.currentTeam2 : select2.value;
    
    let optHTML = '<option value="" class="bg-slate-800 text-sm text-slate-400">SELECIONE</option>';
    
    state.drawnTeams
        .filter(t => !t.isWaitlist)
        .sort((a,b) => parseInt(a.label) - parseInt(b.label))
        .forEach(t => { 
            optHTML += `<option value="${t.label}" class="bg-slate-800 text-sm text-white">${getTeamName(t)}</option>`; 
        });
        
    select1.innerHTML = optHTML; 
    select2.innerHTML = optHTML;
    
    select1.value = val1; 
    select2.value = val2;
};

export const renderMatchHistory = () => {
    const container = document.getElementById('historyList');
    const btnClear = document.getElementById('btnClearHistory');
    
    if (btnClear) {
        if (state.isAuthenticated && state.matchHistory && state.matchHistory.length > 0 && (state.currentUserRole === 'admin' || state.isMaster)) {
            btnClear.classList.remove('hidden'); btnClear.classList.add('flex');
        } else {
            btnClear.classList.add('hidden'); btnClear.classList.remove('flex');
        }
    }
    if (!container) return;
    if (!state.matchHistory || state.matchHistory.length === 0) { 
        container.innerHTML = `<p class="text-slate-500 text-center text-sm py-4">Nenhuma partida registrada.</p>`; 
        return; 
    }
    
    const matches = [...state.matchHistory].sort((a,b) => b.timestamp - a.timestamp);
    const groups = [];
    let currentGroup = null;

    matches.forEach(m => {
        const dString = m.dateString || new Date(m.timestamp).toLocaleDateString('pt-BR');
        if (!currentGroup || currentGroup.date !== dString) {
            currentGroup = { date: dString, matches: [] };
            groups.push(currentGroup);
        }
        currentGroup.matches.push(m);
    });

    if (state.historyCurrentPage >= groups.length) state.historyCurrentPage = Math.max(0, groups.length - 1);
    const activeGroup = groups[state.historyCurrentPage];

    let paginationHTML = '<div class="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-2 border-b border-slate-700/50">';
    groups.forEach((g, idx) => {
        const isActive = idx === state.historyCurrentPage;
        paginationHTML += `<button onclick="changeHistoryPage(${idx})" class="px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}">${g.date}</button>`;
    });
    paginationHTML += '</div>';

    let matchesHTML = activeGroup.matches.map((m, mIdx) => {
        const isTieMatch = m.winner === 0;
        const t1Color = isTieMatch ? 'text-slate-300' : (m.winner === 1 ? 'text-blue-400' : 'text-slate-400');
        const t2Color = isTieMatch ? 'text-slate-300' : (m.winner === 2 ? 'text-red-400' : 'text-slate-400');
        
        const eloGain = m.eloGain || 0;
        const eloLoss = Math.round(eloGain * 0.7);
        const t1EloChange = m.eloChangeT1 ?? (m.winner === 1 ? eloGain : -eloLoss);
        const t2EloChange = m.eloChangeT2 ?? (m.winner === 2 ? eloGain : -eloLoss);
        const t1EloDisplay = `${t1EloChange >= 0 ? '+' : ''}${t1EloChange}`;
        const t2EloDisplay = `${t2EloChange >= 0 ? '+' : ''}${t2EloChange}`;
        const t1DetailColor = isTieMatch ? (t1EloChange > 0 ? 'text-green-400' : (t1EloChange < 0 ? 'text-red-400' : 'text-slate-400')) : (m.winner === 1 ? 'text-green-400' : 'text-red-400');
        const t2DetailColor = isTieMatch ? (t2EloChange > 0 ? 'text-green-400' : (t2EloChange < 0 ? 'text-red-400' : 'text-slate-400')) : (m.winner === 2 ? 'text-green-400' : 'text-red-400');
        const resultLabel = isTieMatch ? '<span class="text-slate-400 text-[9px] font-bold">EMPATE</span>' : '';

        return `
            <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden mb-3">
                <div class="p-3 cursor-pointer hover:bg-slate-800 transition-colors group" onclick="document.getElementById('match-details-${mIdx}').classList.toggle('hidden')">
                    <div class="flex justify-between items-center">
                        <div class="flex-1 text-right font-bold text-sm ${t1Color}">${m.team1.name}</div>
                        <div class="px-3 text-center">
                            <div class="font-black text-lg">${m.team1.score} x ${m.team2.score}</div>
                            ${resultLabel}
                        </div>
                        <div class="flex-1 text-left font-bold text-sm ${t2Color}">${m.team2.name}</div>
                    </div>
                </div>
                <div id="match-details-${mIdx}" class="hidden p-3 bg-slate-950/80 border-t border-slate-800/50 text-xs text-slate-300">
                    <div class="flex justify-between gap-4">
                        <div class="flex-1 text-right border-r border-slate-800 pr-4">
                            <p class="text-[10px] text-blue-400 font-bold uppercase mb-2">Time Azul</p>
                            <p class="mb-3">${(m.team1.players || []).join('<br>')}</p>
                            <p class="font-black text-sm ${t1DetailColor}">
                                ${t1EloDisplay} ELO
                            </p>
                        </div>
                        <div class="flex-1 text-left pl-4">
                            <p class="text-[10px] text-red-400 font-bold uppercase mb-2">Time Vermelho</p>
                            <p class="mb-3">${(m.team2.players || []).join('<br>')}</p>
                            <p class="font-black text-sm ${t2DetailColor}">
                                ${t2EloDisplay} ELO
                            </p>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = paginationHTML + matchesHTML;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const togglePlacarLock = (isLocked) => {
    const overlay = document.getElementById('placar-lock-overlay');
    if (overlay) {
        overlay.classList.toggle('hidden', !isLocked);
        // Garante que o ícone do Lucide seja renderizado se o elemento for mostrado
        if (isLocked && typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Lista de controles que devem ser desativados visualmente
    const controlsToDisable = [
        'btnPlacarConfig',
        'btnSaveResult', 
        'btnClearHistory',
        'teamSize', 
        'draftStrategy',
        'waitlistStrategy',
        'waitlistStrategyPlacar'
    ];

    controlsToDisable.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = isLocked;
            el.style.opacity = isLocked ? "0.5" : "1";
            el.style.cursor = isLocked ? "not-allowed" : "default";
        }
    });

    // Oculta botões de ação nas cartinhas (remover/mover) para evitar cliques acidentais
    const actionButtons = document.querySelectorAll('.remove-player-btn, .move-player-btn');
    actionButtons.forEach(btn => {
        btn.style.visibility = isLocked ? 'hidden' : 'visible';
    });
};

export const forceUnlockPlacar = async () => {
    openConfirmModal("Forçar Desbloqueio", "Isto interromperá a partida que está a ser marcada no outro aparelho. Tem a certeza?", async () => {
        try { 
            await updateDoc(settingsRef, { matchInProgress: false, matchOwner: null }); 
            showToast("Placar desbloqueado à força.", "info");
        } catch(e) {}
    });
};

