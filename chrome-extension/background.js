// Background script for Web to Context Chrome Extension

class BackgroundScript {
    constructor() {
        this.init();
    }
    
    init() {
        // Listen for extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.onInstall();
            }
        });
        
        // Listen for tab updates to sync auth state
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('localhost:3000')) {
                this.syncAuthState(tabId);
            }
        });
        
        // Listen for messages from content scripts
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'syncAuth') {
                const tabId = request.tabId || sender.tab?.id;
                if (tabId) {
                    this.syncAuthState(tabId);
                }
            } else if (request.action === 'authState') {
                // Store auth state from web app
                console.log('Received authState message:', { 
                    hasToken: !!request.token, 
                    projectCount: request.projects?.length || 0,
                    projects: request.projects
                });
                
                chrome.storage.local.set({
                    authToken: request.token,
                    projects: request.projects
                }, () => {
                    console.log('Auth state stored in chrome.storage');
                    
                    // Notify popup to reload projects if it's open
                    chrome.runtime.sendMessage({
                        action: 'authStateUpdated',
                        token: request.token,
                        projects: request.projects
                    }).catch(() => {
                        // Popup might not be open, that's okay
                    });
                });
            }
        });
    }
    
    onInstall() {
        console.log('Web to Context extension installed');
        
        // Set default preferences
        chrome.storage.local.set({
            scope: 'domain',
            maxDepth: 3,
            maxPages: 100
        });
    }
    
    async syncAuthState(tabId) {
        try {
            // Check if we have the scripting permission
            if (!chrome.scripting) {
                console.log('Scripting permission not available');
                return;
            }

            // Inject script to get auth state from web app
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: this.getAuthStateFromWebApp
            });
            
            if (results && results[0] && results[0].result) {
                const authState = results[0].result;
                
                // Store auth token and projects
                await chrome.storage.local.set({
                    authToken: authState.token,
                    projects: authState.projects
                });
                
                console.log('Auth state synced:', authState);
            }
        } catch (error) {
            console.error('Failed to sync auth state:', error);
        }
    }
    
    // Function to be injected into web app pages
    getAuthStateFromWebApp() {
        try {
            // Try to get auth token from localStorage (Supabase stores it with a specific key)
            let token = null;
            let projects = [];
            
            // Check all localStorage keys for Supabase auth
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
            
            // If no token found, try the specific key format
            if (!token) {
                const authData = localStorage.getItem('sb-mqjvhrfvrdshsdaajgut-auth-token');
                if (authData) {
                    try {
                        const parsed = JSON.parse(authData);
                        token = parsed.access_token;
                    } catch (e) {
                        // Continue
                    }
                }
            }
            
            // Try to get projects from the page
            // Look for project data in the DOM
            const projectElements = document.querySelectorAll('[data-project-id], .project-item, [data-project]');
            projectElements.forEach(element => {
                const projectId = element.getAttribute('data-project-id') || 
                                 element.getAttribute('data-project') ||
                                 element.querySelector('[data-project-id]')?.getAttribute('data-project-id');
                const projectName = element.getAttribute('data-project-name') || 
                                  element.textContent?.trim() ||
                                  element.querySelector('h1, h2, h3, .project-name')?.textContent?.trim() ||
                                  'Unnamed Project';
                
                if (projectId && projectId !== 'undefined') {
                    projects.push({ id: projectId, name: projectName });
                }
            });
            
            // If no projects found in DOM, try to get from global variables or API
            if (projects.length === 0) {
                // Try to find projects in the page content
                const projectLinks = document.querySelectorAll('a[href*="/projects/"]');
                projectLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    const projectId = href.match(/\/projects\/([^\/]+)/)?.[1];
                    const projectName = link.textContent?.trim() || 'Unnamed Project';
                    
                    if (projectId && !projects.find(p => p.id === projectId)) {
                        projects.push({ id: projectId, name: projectName });
                    }
                });
            }
            
            console.log('Extracted auth state:', { hasToken: !!token, projectCount: projects.length });
            
            return {
                token: token,
                projects: projects
            };
            
        } catch (error) {
            console.error('Failed to get auth state:', error);
            return null;
        }
    }
}

// Initialize background script
new BackgroundScript();
