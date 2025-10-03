// Script to be injected into the web app to sync auth state with extension
// This should be added to the web app's pages

(function() {
    // Check if we're in a Chrome extension context
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        return;
    }
    
    // Function to extract auth state and projects
    function getAuthState() {
        try {
            let token = null;
            let projects = [];
            
            // Try to get auth token from localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('supabase') && key.includes('auth-token')) {
                    const authData = localStorage.getItem(key);
                    if (authData) {
                        try {
                            const parsed = JSON.parse(authData);
                            if (parsed.access_token) {
                                token = parsed.access_token;
                                break;
                            }
                        } catch (e) {
                            // Continue searching
                        }
                    }
                }
            }
            
            // Try to get projects from the page
            const projectLinks = document.querySelectorAll('a[href*="/projects/"]');
            projectLinks.forEach(link => {
                const href = link.getAttribute('href');
                const projectId = href.match(/\/projects\/([^\/]+)/)?.[1];
                const projectName = link.textContent?.trim() || 'Unnamed Project';
                
                if (projectId && !projects.find(p => p.id === projectId)) {
                    projects.push({ id: projectId, name: projectName });
                }
            });
            
            return { token, projects };
        } catch (error) {
            console.error('Failed to get auth state:', error);
            return { token: null, projects: [] };
        }
    }
    
    // Function to send auth state to extension
    function sendAuthState() {
        const authState = getAuthState();
        if (authState.token) {
            chrome.runtime.sendMessage({
                action: 'authState',
                token: authState.token,
                projects: authState.projects
            });
        }
    }
    
    // Send auth state when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sendAuthState);
    } else {
        sendAuthState();
    }
    
    // Send auth state when localStorage changes (login/logout)
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        if (key.includes('supabase') && key.includes('auth-token')) {
            setTimeout(sendAuthState, 100); // Small delay to ensure data is saved
        }
    };
    
    // Send auth state when projects are loaded (if using a SPA)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const hasProjectLinks = document.querySelector('a[href*="/projects/"]');
                if (hasProjectLinks) {
                    sendAuthState();
                }
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
})();
