import { getLevelInfo, getCategoryInfo, getTeamName, getDailyPlayerStats, openMoveModal, showToast, switchView, openConfirmModal, closeConfirmModal, closeVictoryModalOnly, closeMoveModal, closePlayerHistoryModal, updateSorteioCounters, changeHistoryPage, openPlayerHistoryModal, exportPlayerHistory, renderPublic, renderRanking, getNextDueDate, getPlayerLateChargesCount, renderSorteioTable, renderAdminTable, renderTeams, renderPlacarTeams, renderMatchHistory, togglePlacarLock, forceUnlockPlacar } from '../ui.js';

import { state } from '../state.js';
import { calculateEloMatch } from '../services/rankingService.js';
import { settingsRef, updateDoc } from '../firebase.js';
import { domToBlob } from 'https://unpkg.com/modern-screenshot?module';


// ============================================================================
// HELPERS DE UI ADICIONAIS
// ============================================================================
export const toggleDraftMode = () => {
    const draftMode = document.getElementById('draftMode')?.value;
    const draftStrategy = document.getElementById('draftStrategy');
    const btnDrawTeams = document.getElementById('btnDrawTeams');
    const teamSizeContainer = document.getElementById('teamSizeContainer');
    
    if (draftMode === 'manual') {
        if (draftStrategy) draftStrategy.classList.add('hidden');
        if (teamSizeContainer) teamSizeContainer.classList.add('hidden');
        if (btnDrawTeams) {
            btnDrawTeams.innerHTML = '<i data-lucide="users" class="w-4 h-4"></i> CRIAR TIME';
            btnDrawTeams.className = "flex-[2] sm:flex-none bg-blue-500 hover:bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-colors h-full";
        }
    } else {
        if (draftMode === 'balanceado') {
            if (draftStrategy) draftStrategy.classList.remove('hidden');
        } else {
            if (draftStrategy) draftStrategy.classList.add('hidden');
        }
        
        if (teamSizeContainer) teamSizeContainer.classList.remove('hidden');
        if (btnDrawTeams) {
            btnDrawTeams.innerHTML = '<i data-lucide="shuffle" class="w-4 h-4"></i> SORTEAR TIMES';
            btnDrawTeams.className = "flex-[2] sm:flex-none bg-green-500 hover:bg-green-600 text-slate-900 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-colors h-full";
        }
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

window.toggleDraftMode = toggleDraftMode;

// ============================================================================
// ATUALIZAÇÕES ESPECÍFICAS DE TELA
// ============================================================================

/**
 * Atualiza o painel visual com a previsão de pontos da partida atual,
 * utilizando o serviço de matemática.
 */
export const updateLiveEloPreview = () => {
    const previewDiv = document.getElementById('liveEloPreview');
    const select1 = document.getElementById('team1Select');
    const select2 = document.getElementById('team2Select');
    
    if (!previewDiv || !select1 || !select2 || !select1.value || !select2.value || select1.value === select2.value) {
        if(previewDiv) {
            previewDiv.classList.add('hidden');
            previewDiv.classList.remove('flex');
        }
        return null;
    }

    const team1 = state.drawnTeams.find(t => t.label === select1.value);
    const team2 = state.drawnTeams.find(t => t.label === select2.value);
    if (!team1 || !team2) return null;

    const getTeamElo = (team) => {
        if (team.players.length === 0) return 150;
        const sum = team.players.reduce((acc, p) => {
            const dbPlayer = state.players.find(x => x.id === p.id);
            return acc + (dbPlayer?.eloRating ?? 0);
        }, 0);
        return sum / team.players.length;
    };

    const eloT1 = getTeamElo(team1);
    const eloT2 = getTeamElo(team2);
    
    // Chama o serviço puramente matemático
    const matchPreview = calculateEloMatch(eloT1, eloT2);
    const isFutebol = (state.matchConfig.sportMode || 'volei') === 'futebol';
    // Futebol: empate pode ocorrer inclusive no 0x0. Vôlei: empate nunca ocorre.
    const isTie = isFutebol && state.score1 === state.score2;

    if (isFutebol) {
        // Futebol: sempre mostra vitória, derrota E empate de cada lado
        const drawT1Sign = matchPreview.drawT1 >= 0 ? '+' : '';
        const drawT2Sign = matchPreview.drawT2 >= 0 ? '+' : '';
        const drawT1Color = matchPreview.drawT1 > 0 ? 'text-green-400' : (matchPreview.drawT1 < 0 ? 'text-red-400' : 'text-slate-400');
        const drawT2Color = matchPreview.drawT2 > 0 ? 'text-green-400' : (matchPreview.drawT2 < 0 ? 'text-red-400' : 'text-slate-400');
        previewDiv.innerHTML = `
            <div class="flex-1 text-center">
                <p class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase mb-1">Se Vencer</p>
                <p class="text-green-400 font-black text-lg sm:text-xl">+${matchPreview.winT1} ELO</p>
                <p class="text-red-400 font-bold text-xs sm:text-sm">${matchPreview.loseT1} ELO se perder</p>
                <p class="${drawT1Color} font-bold text-[10px] sm:text-xs mt-1 opacity-80">${drawT1Sign}${matchPreview.drawT1} ELO se empatar</p>
            </div>
            <div class="shrink-0 bg-slate-800 p-2 sm:p-3 rounded-full border border-slate-700">
                <i data-lucide="swords" class="w-4 h-4 sm:w-6 sm:h-6 text-slate-400"></i>
            </div>
            <div class="flex-1 text-center">
                <p class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase mb-1">Se Vencer</p>
                <p class="text-green-400 font-black text-lg sm:text-xl">+${matchPreview.winT2} ELO</p>
                <p class="text-red-400 font-bold text-xs sm:text-sm">${matchPreview.loseT2} ELO se perder</p>
                <p class="${drawT2Color} font-bold text-[10px] sm:text-xs mt-1 opacity-80">${drawT2Sign}${matchPreview.drawT2} ELO se empatar</p>
            </div>
        `;
    } else {
        // Vôlei (sem empate): mostra somente vitória e derrota
        previewDiv.innerHTML = `
            <div class="flex-1 text-center">
                <p class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase mb-1">Se Vencer</p>
                <p class="text-green-400 font-black text-lg sm:text-xl">+${matchPreview.winT1} ELO</p>
                <p class="text-red-400 font-bold text-xs sm:text-sm">${matchPreview.loseT1} ELO se perder</p>
            </div>
            <div class="shrink-0 bg-slate-800 p-2 sm:p-3 rounded-full border border-slate-700">
                <i data-lucide="swords" class="w-4 h-4 sm:w-6 sm:h-6 text-slate-400"></i>
            </div>
            <div class="flex-1 text-center">
                <p class="text-[10px] sm:text-xs text-slate-400 font-bold uppercase mb-1">Se Vencer</p>
                <p class="text-green-400 font-black text-lg sm:text-xl">+${matchPreview.winT2} ELO</p>
                <p class="text-red-400 font-bold text-xs sm:text-sm">${matchPreview.loseT2} ELO se perder</p>
            </div>
        `;
    }
    
    previewDiv.classList.remove('hidden');
    previewDiv.classList.add('flex');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Retorna os dados para que o matchController possa usá-los se o utilizador clicar em "Salvar"
    return {
        ...matchPreview,
        team1,
        team2,
        changeT1: isTie ? matchPreview.drawT1 : (state.score1 > state.score2 ? matchPreview.winT1 : matchPreview.loseT1),
        changeT2: isTie ? matchPreview.drawT2 : (state.score1 > state.score2 ? matchPreview.loseT2 : matchPreview.winT2),
        isTeam1Winner: state.score1 > state.score2,
        isTie: isTie
    };
};

// ============================================================================
// CONTROLE DO FORMULÁRIO DE ATLETAS (ADMIN)
// ============================================================================

export const setFormMode = (mode) => {
    const modeInput = document.getElementById('formMode');
    if (modeInput) modeInput.value = mode;

    const btnManual = document.getElementById('btnModeManual');
    const btnEmail = document.getElementById('btnModeEmail');
    const manualFields = document.getElementById('manualFields');
    const emailFields = document.getElementById('emailFields');

    if (mode === 'manual') {
        btnManual.className = "flex-1 py-2 text-xs font-bold rounded-md bg-slate-800 text-white transition-all shadow";
        btnEmail.className = "flex-1 py-2 text-xs font-bold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all";
        manualFields.classList.remove('hidden');
        emailFields.classList.add('hidden');
    } else {
        btnEmail.className = "flex-1 py-2 text-xs font-bold rounded-md bg-slate-800 text-white transition-all shadow";
        btnManual.className = "flex-1 py-2 text-xs font-bold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all";
        emailFields.classList.remove('hidden');
        manualFields.classList.add('hidden');
    }
};

export const editPlayer = (id) => {
    // 1. Busca o jogador no estado global
    const p = state.players.find(x => x.id === id);
    if (!p) return;

    // 2. Preenche TODOS os campos do formulário
    document.getElementById('editId').value = p.id;
    document.getElementById('playerName').value = p.name;
    document.getElementById('statCategoria').value = p.categoria || 1;
    document.getElementById('statJogos').value = p.partidas || 0;
    document.getElementById('statVit').value = p.vitorias || 0;
    document.getElementById('statBonus').value = p.eloRating ?? 0;
    const roleSelect = document.getElementById('playerRole');
    if (roleSelect) roleSelect.value = p.role || 'jogador';
    
    // Puxa o e-mail para edição, se existir
    const emailInput = document.getElementById('playerEmail');
    if(emailInput) emailInput.value = p.email || '';

    // Define o modo de formulário com base na existência de e-mail
    if (p.email) {
        setFormMode('email');
    } else {
        setFormMode('manual');
    }

    // 3. Trata a foto de perfil
    if (p.photo) {
        document.getElementById('photoPreview').src = p.photo;
        document.getElementById('photoPreview').classList.remove('hidden');
        document.getElementById('photoPlaceholder').classList.add('hidden');
        document.getElementById('photoData').value = p.photo;
        document.getElementById('btnRemovePhoto').classList.remove('hidden');
    } else {
        if (window.removePhoto) window.removePhoto();
    }

    // 4. Muda o visual do formulário para "Modo Edição"
    document.getElementById('formTitle').innerHTML = '<i data-lucide="edit" class="w-5 h-5"></i> Editar Atleta';
    document.getElementById('btnSave').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> ATUALIZAR';

    // 5. GARANTE QUE O FORMULÁRIO ABRA AUTOMATICAMENTE
    const formContent = document.getElementById('formContent');
    const formIcon = document.getElementById('formToggleIcon');
    if (formContent) formContent.classList.remove('hidden');
    if (formIcon) formIcon.classList.add('rotate-180');

    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // 6. Rola a tela suavemente para o formulário
    document.getElementById('view-admin').scrollIntoView({ behavior: 'smooth' });
};

export const resetForm = () => {
    // 1. Limpa os campos de texto
    document.getElementById('editId').value = '';
    document.getElementById('playerName').value = '';
    document.getElementById('statCategoria').value = '1';
    document.getElementById('statJogos').value = '0';
    document.getElementById('statVit').value = '0';
    document.getElementById('statBonus').value = '0';
    const roleSelect = document.getElementById('playerRole');
    if (roleSelect) roleSelect.value = 'jogador';
    
    const emailInput = document.getElementById('playerEmail');
    if(emailInput) emailInput.value = '';

    // Reseta o modo do formulário para manual
    setFormMode('manual');

    // 2. Limpa a Foto APENAS VISUALMENTE (Sem deletar do Storage)
    document.getElementById('photoPreview').src = '';
    document.getElementById('photoPreview').classList.add('hidden');
    document.getElementById('photoPlaceholder').classList.remove('hidden');
    document.getElementById('photoData').value = ''; 
    document.getElementById('btnRemovePhoto').classList.add('hidden');
    const fileInput = document.getElementById('playerPhoto');
    if(fileInput) fileInput.value = '';

    // 3. Restaura o visual do botão
    document.getElementById('formTitle').innerHTML = '<i data-lucide="user-plus" class="w-5 h-5"></i> Novo Atleta';
    document.getElementById('btnSave').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> SALVAR';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 4. Fecha o formulário
    const formContent = document.getElementById('formContent');
    const formIcon = document.getElementById('formToggleIcon');
    if (formContent) formContent.classList.add('hidden');
    if (formIcon) formIcon.classList.remove('rotate-180');
};

// ============================================================================
// HELPERS DE UI PARA AUTENTICAÇÃO E GRUPOS
// ============================================================================

export const toggleAuthMode = (mode) => {
    const isRegister = mode === 'register';
    
    // Altera os títulos
    document.getElementById('authTitle').innerText = isRegister ? 'Criar Conta' : 'Bem-vindo';
    document.getElementById('authSubtitle').innerText = isRegister ? 'Preencha seus dados para começar.' : 'Faça login para acessar seus grupos.';
    
    // Mostra/Esconde o campo de Nome
    const nameContainer = document.getElementById('registerNameContainer');
    if(isRegister) {
        nameContainer.classList.remove('hidden');
    } else {
        nameContainer.classList.add('hidden');
    }

    // Atualiza os botões principais
    const btnMain = document.getElementById('btnAuthMain');
    btnMain.innerHTML = isRegister ? '<i data-lucide="user-plus" class="w-5 h-5"></i> CADASTRAR' : '<i data-lucide="log-in" class="w-5 h-5"></i> ENTRAR';
    
    // Atualiza o texto do rodapé (alternar entre login e registro)
    const btnToggle = document.getElementById('btnToggleAuth');
    if (isRegister) {
        btnToggle.innerHTML = 'Já tem conta? <span class="font-bold underline text-blue-400">Faça login</span>';
        btnToggle.setAttribute('onclick', "toggleAuthMode('login')");
    } else {
        btnToggle.innerHTML = 'Ainda não tem conta? <span class="font-bold underline text-blue-400">Cadastre-se</span>';
        btnToggle.setAttribute('onclick', "toggleAuthMode('register')");
    }

    // Se a função existir, recria os ícones Lucide recém-injetados
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Salva na memória da página (num atributo do botão) em qual modo estamos para o main.js saber o que fazer
    btnMain.setAttribute('data-mode', isRegister ? 'register' : 'login');
};

// Filtro global de grupos por cargo
window.currentGroupRoleFilter = 'all';

export const setGroupRoleFilter = (role) => {
    window.currentGroupRoleFilter = role;
    
    // Atualiza o visual dos botões de filtro
    const roles = ['all', 'admin', 'moderador', 'jogador'];
    roles.forEach(r => {
        const btn = document.getElementById(`btnFilterRole-${r}`);
        if (btn) {
            if (r === role) {
                btn.className = "flex-1 sm:flex-none px-3.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all bg-blue-600 text-white shadow";
            } else {
                btn.className = "flex-1 sm:flex-none px-3.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-800/30";
            }
        }
    });

    renderUserGroups();
};

export const filterUserGroups = () => {
    renderUserGroups();
};

export const renderUserGroups = () => {
    const grid = document.getElementById('userGroupsGrid');
    const msg = document.getElementById('noGroupsMessage');
    
    if (!grid || !msg) return;

    if (!state.userGroups || state.userGroups.length === 0) {
        grid.innerHTML = '';
        msg.classList.remove('hidden');
        msg.classList.add('flex');
        return;
    }

    msg.classList.add('hidden');
    msg.classList.remove('flex');

    // Filtragem de grupos por nome e cargo
    const searchTerm = document.getElementById('searchGroupInput')?.value.trim().toLowerCase() || '';
    const activeRole = window.currentGroupRoleFilter || 'all';

    let filteredGroups = state.userGroups || [];

    // 1. Filtro por Nome
    if (searchTerm) {
        filteredGroups = filteredGroups.filter(g => g.name && g.name.toLowerCase().includes(searchTerm));
    }

    // 2. Filtro por Cargo
    if (activeRole !== 'all') {
        filteredGroups = filteredGroups.filter(group => {
            const isCreatorOrAdmin = state.isMaster || (group.adminUids && group.adminUids.includes(state.user?.uid));
            const isModerator = group.moderatorEmails && group.moderatorEmails.includes(state.user?.email);
            
            if (activeRole === 'admin') {
                return isCreatorOrAdmin;
            } else if (activeRole === 'moderador') {
                return isModerator;
            } else if (activeRole === 'jogador') {
                return !isCreatorOrAdmin && !isModerator;
            }
            return true;
        });
    }

    if (filteredGroups.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <div class="bg-slate-800 p-4 rounded-full mb-4 border border-slate-700">
                    <i data-lucide="search" class="w-10 h-10 text-slate-500"></i>
                </div>
                <h3 class="text-lg font-bold text-white mb-1">Nenhum grupo encontrado</h3>
                <p class="text-slate-400 text-sm max-w-xs">Não encontramos nenhum racha com o nome ou cargo selecionado.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    grid.innerHTML = filteredGroups.map(group => {
        const isCreatorOrAdmin = state.isMaster || (group.adminUids && group.adminUids.includes(state.user?.uid));
        const isModerator = group.moderatorEmails && group.moderatorEmails.includes(state.user?.email);
        
        let roleTag = '';
        let roleBg = '';
        let menuDots = '';

        if (isCreatorOrAdmin) {
            roleTag = '<i data-lucide="shield-check" class="w-3 h-3"></i> Admin';
            roleBg = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            
            // Adiciona os três pontinhos para admins
            menuDots = `
                <div class="relative z-20" onclick="event.stopPropagation();">
                    <button onclick="document.getElementById('menu-${group.id}').classList.toggle('hidden')" class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition-colors">
                        <i data-lucide="more-vertical" class="w-5 h-5"></i>
                    </button>
                    <div id="menu-${group.id}" class="hidden absolute right-0 top-8 w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                        <button onclick="renameGroup('${group.id}', '${group.name}'); document.getElementById('menu-${group.id}').classList.add('hidden')" class="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"><i data-lucide="edit-2" class="w-4 h-4"></i> Renomear</button>
                        <button onclick="deleteGroup('${group.id}'); document.getElementById('menu-${group.id}').classList.add('hidden')" class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-800"><i data-lucide="trash-2" class="w-4 h-4"></i> Excluir</button>
                    </div>
                </div>
            `;
        } else if (isModerator) {
            roleTag = '<i data-lucide="shield" class="w-3 h-3"></i> Moderador';
            roleBg = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            
            // Moderadores também recebem os três pontinhos (mesmas permissões que admin por agora)
            menuDots = `
                <div class="relative z-20" onclick="event.stopPropagation();">
                    <button onclick="document.getElementById('menu-${group.id}').classList.toggle('hidden')" class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition-colors">
                        <i data-lucide="more-vertical" class="w-5 h-5"></i>
                    </button>
                    <div id="menu-${group.id}" class="hidden absolute right-0 top-8 w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                        <button onclick="renameGroup('${group.id}', '${group.name}'); document.getElementById('menu-${group.id}').classList.add('hidden')" class="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"><i data-lucide="edit-2" class="w-4 h-4"></i> Renomear</button>
                        <button onclick="deleteGroup('${group.id}'); document.getElementById('menu-${group.id}').classList.add('hidden')" class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-800"><i data-lucide="trash-2" class="w-4 h-4"></i> Excluir</button>
                    </div>
                </div>
            `;
        } else {
            roleTag = '<i data-lucide="user" class="w-3 h-3"></i> Jogador';
            roleBg = 'bg-slate-700/50 text-slate-300 border-slate-600/50';
        }

        const dateStr = group.createdAt ? new Date(group.createdAt).toLocaleDateString('pt-BR') : '--/--/----';

        return `
            <div onclick="selectGroup('${group.id}', '${group.name}')" class="bg-slate-900/50 hover:bg-slate-800 border border-slate-700 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 group-card flex flex-col justify-between h-full min-h-[140px] relative">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-white group-card-hover:text-blue-400 transition-colors pr-6">${group.name}</h3>
                        ${menuDots}
                    </div>
                    <span class="inline-block px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 w-max ${roleBg}">${roleTag}</span>
                    <p class="text-xs text-slate-500 mt-3 flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> Criado em ${dateStr}</p>
                </div>
                <div class="mt-4 flex justify-end">
                    <span class="text-sm font-bold text-blue-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">ENTRAR <i data-lucide="arrow-right" class="w-4 h-4"></i></span>
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

export const renderAll = () => { 
    renderPublic(); 
    renderSorteioTable(); 
    renderAdminTable(); 
    renderTeams(); 
    renderRanking(); 
    renderPlacarTeams(); 
    renderMatchHistory(); 

    // Controle dinâmico de visibilidade para o "Placar Aberto" na aba placar
    const placarAbertoContainer = document.getElementById('placarAbertoContainer');
    const placarToolbarSpacer = document.getElementById('placarToolbarSpacer');
    if (placarAbertoContainer && placarToolbarSpacer) {
        const isAdminOrMod = state.currentUserRole === 'admin' || state.isMaster;
        if (isAdminOrMod) {
            placarAbertoContainer.classList.remove('hidden');
            placarAbertoContainer.classList.add('flex');
            placarToolbarSpacer.classList.add('hidden');
        } else {
            placarAbertoContainer.classList.add('hidden');
            placarAbertoContainer.classList.remove('flex');
            placarToolbarSpacer.classList.remove('hidden');
        }
    }
};

//updateSorteioCounters 
// changeHistoryPage 
// openPlayerHistoryModal 

// ============================================================================
// CONFIGURAÇÕES DE PLACAR E TEMPORIZADOR
// ============================================================================

/**
 * Aplica a visibilidade das seções de configuração com base no modo esportivo.
 * - Vôlei: esconde timer, esconde checkbox "diferença de 2 pontos" (aplicada automaticamente), mostra capote.
 * - Futebol: mostra timer, mostra vitória normal, esconde capote e diferença de 2 pontos.
 * - Basquete: mostra timer e pontos, sem capote, sem diferença de 2 pontos, botões +3/+2/+1.
 */
const applySportModeVisibility = (sportMode, resetDefaults = false) => {
    const timeSection = document.getElementById('cfgTimeSection');
    const twoPointsRow = document.getElementById('cfgTwoPointsRow');
    const capoteSection = document.getElementById('cfgCapoteSection');

    // Botões de pontuação do placar
    const scoreButtons1 = document.getElementById('scoreButtons1');
    const scoreButtons2 = document.getElementById('scoreButtons2');
    const scoreButtonsBasket1 = document.getElementById('scoreButtonsBasket1');
    const scoreButtonsBasket2 = document.getElementById('scoreButtonsBasket2');

    const isBasquete = sportMode === 'basquete';
    const isFutebol = sportMode === 'futebol';
    const isVolei = sportMode === 'volei' || (!isFutebol && !isBasquete);

    // Alterna botões de pontuação
    if (scoreButtons1) scoreButtons1.classList.toggle('hidden', isBasquete);
    if (scoreButtons2) scoreButtons2.classList.toggle('hidden', isBasquete);
    if (scoreButtonsBasket1) scoreButtonsBasket1.classList.toggle('hidden', !isBasquete);
    if (scoreButtonsBasket2) scoreButtonsBasket2.classList.toggle('hidden', !isBasquete);

    if (resetDefaults) {
        if (isVolei) {
            if (document.getElementById('cfgUseTime')) document.getElementById('cfgUseTime').checked = false;
            if (document.getElementById('cfgUsePoints1')) document.getElementById('cfgUsePoints1').checked = true;
            if (document.getElementById('cfgPoints1')) document.getElementById('cfgPoints1').value = 25;
            if (document.getElementById('cfgTwoPointsDiff')) document.getElementById('cfgTwoPointsDiff').checked = true;
            if (document.getElementById('cfgUsePoints2')) document.getElementById('cfgUsePoints2').checked = false;
            if (document.getElementById('cfgPoints2')) document.getElementById('cfgPoints2').value = 8;
        } else if (isFutebol) {
            if (document.getElementById('cfgUseTime')) document.getElementById('cfgUseTime').checked = true;
            if (document.getElementById('cfgTimeMinutes')) document.getElementById('cfgTimeMinutes').value = 10;
            if (document.getElementById('cfgUsePoints1')) document.getElementById('cfgUsePoints1').checked = false;
            if (document.getElementById('cfgPoints1')) document.getElementById('cfgPoints1').value = 2;
            if (document.getElementById('cfgTwoPointsDiff')) document.getElementById('cfgTwoPointsDiff').checked = false;
            if (document.getElementById('cfgUsePoints2')) document.getElementById('cfgUsePoints2').checked = false;
        } else if (isBasquete) {
            if (document.getElementById('cfgUseTime')) document.getElementById('cfgUseTime').checked = true;
            if (document.getElementById('cfgTimeMinutes')) document.getElementById('cfgTimeMinutes').value = 10;
            if (document.getElementById('cfgUsePoints1')) document.getElementById('cfgUsePoints1').checked = false;
            if (document.getElementById('cfgPoints1')) document.getElementById('cfgPoints1').value = 21;
            if (document.getElementById('cfgTwoPointsDiff')) document.getElementById('cfgTwoPointsDiff').checked = false;
            if (document.getElementById('cfgUsePoints2')) document.getElementById('cfgUsePoints2').checked = false;
        }
    }

    if (isFutebol) {
        // Futebol: mostrar timer, esconder capote e diferença de 2 pontos
        if (timeSection) timeSection.classList.remove('hidden');
        if (twoPointsRow) twoPointsRow.classList.add('hidden');
        if (capoteSection) capoteSection.classList.add('hidden');

        // Desmarcar capote e diferença de 2 pontos
        const cfgUsePoints2 = document.getElementById('cfgUsePoints2');
        if (cfgUsePoints2) cfgUsePoints2.checked = false;
        const cfgTwoPointsDiff = document.getElementById('cfgTwoPointsDiff');
        if (cfgTwoPointsDiff) cfgTwoPointsDiff.checked = false;
    } else if (isBasquete) {
        // Basquete: mostrar timer e pontos, sem capote e sem diferença de 2 pontos
        if (timeSection) timeSection.classList.remove('hidden');
        if (twoPointsRow) twoPointsRow.classList.add('hidden');
        if (capoteSection) capoteSection.classList.add('hidden');

        const cfgUsePoints2 = document.getElementById('cfgUsePoints2');
        if (cfgUsePoints2) cfgUsePoints2.checked = false;
        const cfgTwoPointsDiff = document.getElementById('cfgTwoPointsDiff');
        if (cfgTwoPointsDiff) cfgTwoPointsDiff.checked = false;
    } else {
        // Vôlei: esconder timer, esconder checkbox de 2 pontos (auto), mostrar capote
        if (timeSection) timeSection.classList.add('hidden');
        if (twoPointsRow) twoPointsRow.classList.add('hidden');
        if (capoteSection) capoteSection.classList.remove('hidden');

        // Forçar: timer desligado, diferença de 2 pontos ligada automaticamente
        const cfgUseTime = document.getElementById('cfgUseTime');
        if (cfgUseTime) cfgUseTime.checked = false;
        const cfgTwoPointsDiff = document.getElementById('cfgTwoPointsDiff');
        if (cfgTwoPointsDiff) cfgTwoPointsDiff.checked = true;
    }

    // Toggle opacity for divs based on checkboxes (so it updates visually if resetDefaults fired)
    const timeChk = document.getElementById('cfgUseTime');
    const pts1Chk = document.getElementById('cfgUsePoints1');
    const pts2Chk = document.getElementById('cfgUsePoints2');
    if (timeChk && document.getElementById('cfgTimeDiv')) document.getElementById('cfgTimeDiv').classList.toggle('opacity-50', !timeChk.checked);
    if (pts1Chk && document.getElementById('cfgPoints1Div')) document.getElementById('cfgPoints1Div').classList.toggle('opacity-50', !pts1Chk.checked);
    if (pts2Chk && document.getElementById('cfgPoints2Div')) document.getElementById('cfgPoints2Div').classList.toggle('opacity-50', !pts2Chk.checked);

    // Alterna visual do divisor do placar
    const divider = document.getElementById('placar-divider');
    if (divider) {
        divider.className = 'absolute z-30 flex items-center justify-center pointer-events-none left-1/2 top-0 bottom-0 -translate-x-1/2 h-full transition-all ' + 
            (isVolei ? 'divider-volei w-4 sm:w-6 md:w-8' : (isFutebol ? 'divider-futebol' : 'divider-basquete'));
    }
};

window.onSportModeChange = applySportModeVisibility;
window.applySportModeVisibility = applySportModeVisibility;

export const openPlacarConfigModal = () => {
    if (state.isPlacarLocked) return;
    
    const c = state.matchConfig;
    document.getElementById('cfgUseTime').checked = c.useTime;
    document.getElementById('cfgTimeDiv').classList.toggle('opacity-50', !c.useTime);
    document.getElementById('cfgTimeMinutes').value = c.timeMinutes;

    document.getElementById('cfgUsePoints1').checked = c.usePoints1;
    document.getElementById('cfgPoints1Div').classList.toggle('opacity-50', !c.usePoints1);
    document.getElementById('cfgPoints1').value = c.points1;
    document.getElementById('cfgTwoPointsDiff').checked = c.twoPointsDiff;

    document.getElementById('cfgUsePoints2').checked = c.usePoints2;
    document.getElementById('cfgPoints2Div').classList.toggle('opacity-50', !c.usePoints2);
    document.getElementById('cfgPoints2').value = c.points2;

    // Modalidade esportiva
    const sportMode = c.sportMode || 'volei';
    document.getElementById('cfgSportMode').value = sportMode;
    const activeClass = 'flex-1 py-2.5 text-xs font-bold rounded-md bg-green-600 text-white transition-all shadow flex items-center justify-center gap-1';
    const inactiveClass = 'flex-1 py-2.5 text-xs font-bold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all flex items-center justify-center gap-1';
    ['cfgSportVolei', 'cfgSportFutebol', 'cfgSportBasquete'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = inactiveClass;
    });
    const activeBtn = document.getElementById(
        sportMode === 'futebol' ? 'cfgSportFutebol' : (sportMode === 'basquete' ? 'cfgSportBasquete' : 'cfgSportVolei')
    );
    if (activeBtn) activeBtn.className = activeClass;

    // Aplica visibilidade baseada no modo esportivo
    applySportModeVisibility(sportMode);

    const modal = document.getElementById('placarConfigModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

export const closePlacarConfigModal = () => {
    const modal = document.getElementById('placarConfigModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

export const savePlacarConfig = async () => {
    const sportMode = document.getElementById('cfgSportMode').value || 'volei';
    const isVolei = sportMode === 'volei';
    const isFutebol = sportMode === 'futebol';
    const isBasquete = sportMode === 'basquete';

    state.matchConfig = {
        sportMode: sportMode,
        // Vôlei: sem timer; Futebol/Basquete: respeita checkbox
        useTime: isVolei ? false : document.getElementById('cfgUseTime').checked,
        timeMinutes: parseInt(document.getElementById('cfgTimeMinutes').value) || 10,
        usePoints1: document.getElementById('cfgUsePoints1').checked,
        points1: parseInt(document.getElementById('cfgPoints1').value) || 21,
        // Vôlei: sempre exige diferença de 2 pontos; Futebol/Basquete: nunca
        twoPointsDiff: isVolei ? true : false,
        // Vôlei: respeita checkbox; Futebol/Basquete: sem capote
        usePoints2: (isFutebol || isBasquete) ? false : document.getElementById('cfgUsePoints2').checked,
        points2: parseInt(document.getElementById('cfgPoints2').value) || 8
    };

    localStorage.setItem('tc_matchConfig', JSON.stringify(state.matchConfig));
    
    // ATUALIZA NO CACHE DO GRUPO PARA NÃO VAZAR
    if (state.currentGroupId && state.groupMatchStates[state.currentGroupId]) {
        state.groupMatchStates[state.currentGroupId].matchConfig = state.matchConfig;
    }
    
    try {
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        await setDoc(settingsRef, { matchConfig: state.matchConfig }, { merge: true });
        showToast("Configurações salvas e aplicadas para o grupo!", "success");
    } catch (e) {
        console.error(e);
        showToast("Erro ao salvar regras no servidor.", "error");
    }
    
    // Aplica visibilidade de botões no placar após salvar
    applySportModeVisibility(sportMode);
    
    closePlacarConfigModal();
    
    if (typeof window.resetTimer === 'function') {
        window.resetTimer();
    }
};

export const playBeepSound = () => {
    try {
        const audio = new Audio('Apito.wav');
        audio.play().catch(err => {
            console.warn("Could not play Apito.wav, falling back to synthesizer beeps:", err);
            playSynthesizedBeep();
        });
    } catch (e) {
        console.warn("Audio element failed, falling back to synthesizer:", e);
        playSynthesizedBeep();
    }
};

const playSynthesizedBeep = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const playOsc = (timeOffset, duration) => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + timeOffset);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + timeOffset + duration);
            
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + timeOffset);
            gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + timeOffset + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + timeOffset + duration);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start(audioCtx.currentTime + timeOffset);
            oscillator.stop(audioCtx.currentTime + timeOffset + duration);
        };

        playOsc(0, 0.4);
        playOsc(0.6, 0.4);
        playOsc(1.2, 0.8);
    } catch(e) {
        console.error("Audio API not supported", e);
    }
};

export const goHome = () => {
    if (state.isAuthenticated) {
        switchView('groups');
    } else {
        switchView('landing');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const openTermsModal = (event) => {
    if (event) event.preventDefault();
    const modal = document.getElementById('termsModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

export const closeTermsModal = () => {
    const modal = document.getElementById('termsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

export const openPrivacyModal = (event) => {
    if (event) event.preventDefault();
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

export const closePrivacyModal = () => {
    const modal = document.getElementById('privacyModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

export const openSupportModal = (event) => {
    if (event) event.preventDefault();
    const modal = document.getElementById('supportModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

export const closeSupportModal = () => {
    const modal = document.getElementById('supportModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

export const copySupportEmail = () => {
    navigator.clipboard.writeText("contato.compost949@slmails.com")
        .then(() => {
            showToast("E-mail de suporte copiado!", "success");
        })
        .catch(() => {
            showToast("Erro ao copiar e-mail.", "error");
        });
};

// Funções para controle e toggle de dropdowns de exportação (Click-to-Toggle robusto)
window.toggleDropdown = (event, id) => {
    if (event) {
        event.stopPropagation(); // Evita fechamento imediato no clique
        event.preventDefault();
    }
    const dropdowns = ['share-dropdown', 'download-dropdown'];
    dropdowns.forEach(dId => {
        const d = document.getElementById(dId);
        if (d) {
            if (dId === id) {
                d.classList.toggle('hidden');
            } else {
                d.classList.add('hidden');
            }
        }
    });
};

// Fechar os dropdowns ao clicar em qualquer lugar fora deles
document.addEventListener('click', (event) => {
    const dropdowns = ['share-dropdown', 'download-dropdown'];
    dropdowns.forEach(dId => {
        const d = document.getElementById(dId);
        if (d && !d.classList.contains('hidden')) {
            d.classList.add('hidden');
        }
    });
});