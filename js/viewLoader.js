export async function loadViews() {
    const viewsToLoad = [
        { id: 'nav', file: 'views/nav.html', type: 'replace' },
        { id: 'view-public', file: 'views/public.html', type: 'replace' },
        { id: 'view-sorteio', file: 'views/sorteio.html', type: 'replace' },
        { id: 'view-placar', file: 'views/placar.html', type: 'replace' },
        { id: 'view-landing', file: 'views/landing.html', type: 'replace' },
        { id: 'view-auth', file: 'views/auth.html', type: 'replace' },
        { id: 'view-groups', file: 'views/groups.html', type: 'replace' },
        { id: 'view-admin', file: 'views/admin.html', type: 'replace' },
        { id: 'view-pagamentos', file: 'views/pagamentos.html', type: 'replace' },
        { id: 'modals', file: 'views/modals.html', type: 'append_to_main' } // The modals were placed inside <main>, so we can just append them to main or body
    ];

    try {
        const fetchPromises = viewsToLoad.map(view => fetch(view.file).then(res => {
            if (!res.ok) throw new Error(`Failed to load ${view.file}`);
            return res.text().then(html => ({ ...view, html }));
        }));

        const loadedViews = await Promise.all(fetchPromises);

        let mainContent = document.body.innerHTML;
        
        // As replace might fail if the exact comment is modified, let's just find the comment and replace it.
        // Or better yet, we just inject them in the correct spots.
        // Because innerHTML replacement on document.body wipes out event listeners, 
        // we should create elements or use insertAdjacentHTML.
        
        for (const view of loadedViews) {
            if (view.id === 'nav') {
                document.body.insertAdjacentHTML('afterbegin', view.html);
            } else if (view.id === 'modals') {
                document.querySelector('main').insertAdjacentHTML('beforeend', view.html);
            } else {
                document.querySelector('main').insertAdjacentHTML('beforeend', view.html);
            }
        }
        
        // Limpar os comentários INJECT que ficaram
        document.body.innerHTML = document.body.innerHTML.replace(/<!-- INJECT: .*? -->/g, '');

    } catch (error) {
        console.error("Error loading views:", error);
    }
}
