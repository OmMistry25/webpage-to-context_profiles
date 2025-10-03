// Popup script for Web to Context Chrome Extension

console.log('=== POPUP.JS LOADED ===');

class CrawlPopup {
    constructor() {
        console.log('=== CrawlPopup constructor called ===');
        this.currentTab = null;
        this.projects = [];
        this.crawlId = null;
        this.pollInterval = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
            
            // Update UI
            this.updateCurrentUrl();
            await this.loadProjects();
            this.setupEventListeners();
            this.loadPreferences();
            
            // Debug: Check stored data
            chrome.storage.local.get(['authToken', 'projects'], (result) => {
                console.log('Stored data:', result);
            });
            
            // Test: Verify select element exists
            const selectElement = document.getElementById('projectSelect');
            console.log('Select element found:', !!selectElement);
            console.log('Select element:', selectElement);
            
            // Test: Try to update select with test data
            if (selectElement) {
                console.log('Testing select update with dummy data...');
                selectElement.innerHTML = '<option value="test">Test Project</option>';
                console.log('Select updated, options count:', selectElement.options.length);
            }
            
            // Listen for auth state updates from background script
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'authStateUpdated') {
                    console.log('Received auth state update:', request);
                    console.log('Setting this.projects to:', request.projects);
                    this.projects = request.projects;
                    console.log('this.projects is now:', this.projects);
                    this.updateProjectSelect();
                    this.showStatus('Projects updated!', 'success');
                }
            });
            
        } catch (error) {
            console.error('Failed to initialize popup:', error);
            this.showStatus('Failed to initialize extension', 'error');
        }
    }
    
    updateCurrentUrl() {
        const urlElement = document.getElementById('currentUrl');
        if (this.currentTab && this.currentTab.url) {
            urlElement.textContent = this.currentTab.url;
        } else {
            urlElement.textContent = 'Unable to get current URL';
        }
    }
    
    async loadProjects() {
        try {
            console.log('Loading projects...');
            const projects = await this.getStoredProjects();
            console.log('Loaded projects from getStoredProjects:', projects);
            console.log('Projects type:', typeof projects);
            console.log('Projects length:', projects?.length);
            
            this.projects = projects;
            console.log('Set this.projects to:', this.projects);
            
            this.updateProjectSelect();
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.showStatus('Failed to load projects. Please open the web app first.', 'error');
        }
    }
    
    addSyncButton() {
        const projectGroup = document.querySelector('.form-group');
        const syncButton = document.createElement('button');
        syncButton.type = 'button';
        syncButton.textContent = '🔄 Sync from Web App';
        syncButton.style.cssText = `
            margin-top: 8px;
            padding: 6px 12px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            color: #374151;
        `;
        
        syncButton.addEventListener('click', async () => {
            console.log('Sync button clicked');
            syncButton.textContent = '🔄 Syncing...';
            syncButton.disabled = true;
            
            try {
                // Find the web app tab and sync auth
                const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
                console.log('Found web app tabs:', tabs.length);
                
                if (tabs.length > 0) {
                    console.log('Sending sync message to tab:', tabs[0].id);
                    // Try to send message to content script first
                    try {
                        await chrome.tabs.sendMessage(tabs[0].id, { action: 'syncAuth' });
                        console.log('Message sent to content script');
                    } catch (messageError) {
                        console.log('Content script not available, using background sync:', messageError);
                        // Fallback to background script sync
                        await chrome.runtime.sendMessage({ action: 'syncAuth', tabId: tabs[0].id });
                        console.log('Message sent to background script');
                    }
                    
                    // Wait a bit for sync to complete
                    console.log('Waiting for sync to complete...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    console.log('Reloading projects after sync...');
                    await this.loadProjects();
                    this.showStatus('Successfully synced from web app!', 'success');
                    
                    // Also try direct API sync as backup
                    setTimeout(async () => {
                        const directSyncSuccess = await this.tryDirectAPISync();
                        if (directSyncSuccess) {
                            console.log('Direct API sync also successful');
                        }
                    }, 500);
                } else {
                    console.log('No web app tabs found, trying direct API sync');
                    // Try direct API sync as fallback
                    const directSyncSuccess = await this.tryDirectAPISync();
                    if (!directSyncSuccess) {
                        this.showStatus('Please open the web app first', 'error');
                    }
                }
            } catch (error) {
                console.error('Sync failed:', error);
                this.showStatus('Sync failed. Please refresh the web app and try again.', 'error');
            } finally {
                syncButton.textContent = '🔄 Sync from Web App';
                syncButton.disabled = false;
            }
        });
        
        projectGroup.appendChild(syncButton);
    }
    
    async getStoredProjects() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['projects', 'authToken'], async (result) => {
                console.log('getStoredProjects - chrome.storage result:', result);
                console.log('Has projects:', !!result.projects);
                console.log('Has authToken:', !!result.authToken);
                console.log('Projects value:', result.projects);
                
                if (result.projects && result.authToken) {
                    console.log('Using stored projects:', result.projects);
                    resolve(result.projects);
                } else if (result.authToken) {
                    console.log('No stored projects, fetching from API...');
                    // Try to fetch projects from API
                    try {
                        const projects = await this.fetchProjectsFromAPI(result.authToken);
                        console.log('Fetched projects from API:', projects);
                        resolve(projects);
                    } catch (error) {
                        console.error('Failed to fetch projects from API:', error);
                        resolve([]);
                    }
                } else {
                    console.log('No auth token, returning empty array');
                    resolve([]);
                }
            });
        });
    }
    
    async fetchProjectsFromAPI(authToken) {
        try {
            console.log('Fetching projects from API with token:', authToken ? 'Token exists' : 'No token');
            
            const response = await fetch('http://localhost:3000/api/projects', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            console.log('API response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API error response:', errorText);
                throw new Error(`Failed to fetch projects: ${response.status} ${errorText}`);
            }
            
            const projects = await response.json();
            console.log('Fetched projects from API:', projects);
            
            // Store projects for future use
            await new Promise((resolve) => {
                chrome.storage.local.set({ projects: projects }, () => {
                    console.log('Stored projects in chrome.storage:', projects);
                    resolve();
                });
            });
            
            return projects;
        } catch (error) {
            console.error('API fetch failed:', error);
            throw error;
        }
    }
    
    async tryDirectAPISync() {
        try {
            console.log('Trying direct API sync...');
            // Try to get auth token from storage
            const result = await new Promise((resolve) => {
                chrome.storage.local.get(['authToken'], resolve);
            });
            
            console.log('Auth token from storage:', result.authToken ? 'Token exists' : 'No token');
            
            if (result.authToken) {
                const projects = await this.fetchProjectsFromAPI(result.authToken);
                this.projects = projects;
                this.updateProjectSelect();
                this.showStatus('Successfully synced projects!', 'success');
                return true;
            }
            console.log('No auth token found in storage');
            return false;
        } catch (error) {
            console.error('Direct API sync failed:', error);
            return false;
        }
    }
    
    updateProjectSelect() {
        console.log('=== updateProjectSelect called ===');
        const select = document.getElementById('projectSelect');
        console.log('Select element found:', !!select);
        
        if (!select) {
            console.error('Select element not found!');
            return;
        }
        
        select.innerHTML = '';
        
        console.log('Updating project select with projects:', this.projects);
        console.log('Projects type:', typeof this.projects);
        console.log('Projects length:', this.projects?.length);
        
        if (!this.projects || this.projects.length === 0) {
            console.log('No projects found, showing default message');
            select.innerHTML = '<option value="">No projects found. Open web app first.</option>';
            return;
        }
        
        console.log('Adding projects to select:', this.projects);
        this.projects.forEach((project, index) => {
            console.log(`Adding project ${index}:`, project);
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
        });
        
        console.log('Project select updated, total options:', select.options.length);
    }
    
    setupEventListeners() {
        // Form submission
        document.getElementById('crawlForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.startCrawl();
        });
        
        // Preview toggle
        document.getElementById('showPreview').addEventListener('change', (e) => {
            this.togglePreview(e.target.checked);
        });
        
        // Open web app button
        document.getElementById('openWebApp').addEventListener('click', () => {
            chrome.tabs.create({ url: 'http://localhost:3000' });
        });
        
        // Add manual sync button
        this.addSyncButton();
    }
    
    async loadPreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['scope', 'maxDepth', 'maxPages'], (result) => {
                if (result.scope) document.getElementById('scope').value = result.scope;
                if (result.maxDepth) document.getElementById('maxDepth').value = result.maxDepth;
                if (result.maxPages) document.getElementById('maxPages').value = result.maxPages;
                resolve();
            });
        });
    }
    
    async savePreferences() {
        const preferences = {
            scope: document.getElementById('scope').value,
            maxDepth: document.getElementById('maxDepth').value,
            maxPages: document.getElementById('maxPages').value
        };
        
        return new Promise((resolve) => {
            chrome.storage.local.set(preferences, resolve);
        });
    }
    
    async togglePreview(show) {
        const previewContent = document.getElementById('previewContent');
        
        if (show) {
            previewContent.classList.add('show');
            await this.loadPagePreview();
        } else {
            previewContent.classList.remove('show');
        }
    }
    
    async loadPagePreview() {
        const previewContent = document.getElementById('previewContent');
        previewContent.textContent = 'Loading preview...';
        
        try {
            // Get page content from content script
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'getPagePreview'
            });
            
            if (response && response.preview) {
                previewContent.innerHTML = response.preview;
            } else {
                previewContent.textContent = 'Preview not available';
            }
        } catch (error) {
            console.error('Failed to get page preview:', error);
            previewContent.textContent = 'Failed to load preview';
        }
    }
    
    async startCrawl() {
        const form = document.getElementById('crawlForm');
        const formData = new FormData(form);
        
        const crawlData = {
            projectId: formData.get('projectSelect'),
            rootUrl: this.currentTab.url,
            scope: formData.get('scope'),
            maxDepth: parseInt(formData.get('maxDepth')),
            maxPages: parseInt(formData.get('maxPages'))
        };
        
        // Validate form
        if (!crawlData.projectId) {
            this.showStatus('Please select a project', 'error');
            return;
        }
        
        if (!crawlData.rootUrl || crawlData.rootUrl.startsWith('chrome://') || crawlData.rootUrl.startsWith('chrome-extension://')) {
            this.showStatus('Cannot crawl this type of page', 'error');
            return;
        }
        
        // Save preferences
        await this.savePreferences();
        
        // Disable form
        this.setFormEnabled(false);
        this.showStatus('Starting crawl...', 'info');
        
        try {
            // Get auth token
            const authToken = await this.getAuthToken();
            if (!authToken) {
                this.showStatus('Please log in to the web app first', 'error');
                this.setFormEnabled(true);
                return;
            }
            
            // Start crawl
            const response = await fetch('http://localhost:3000/api/crawl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(crawlData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start crawl');
            }
            
            const result = await response.json();
            this.crawlId = result.crawlId;
            
            this.showStatus('Crawl started successfully!', 'success');
            this.startPolling();
            
        } catch (error) {
            console.error('Failed to start crawl:', error);
            this.showStatus(`Failed to start crawl: ${error.message}`, 'error');
            this.setFormEnabled(true);
        }
    }
    
    async getAuthToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['authToken'], (result) => {
                resolve(result.authToken);
            });
        });
    }
    
    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        
        this.pollInterval = setInterval(async () => {
            await this.checkCrawlStatus();
        }, 2000);
    }
    
    async checkCrawlStatus() {
        if (!this.crawlId) return;
        
        try {
            const authToken = await this.getAuthToken();
            const response = await fetch(`http://localhost:3000/api/crawl/${this.crawlId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to check crawl status');
            }
            
            const crawl = await response.json();
            
            if (crawl.status === 'completed') {
                this.showStatus(`Crawl completed! ${crawl.pages_crawled} pages crawled.`, 'success');
                this.stopPolling();
                this.setFormEnabled(true);
            } else if (crawl.status === 'failed') {
                this.showStatus(`Crawl failed: ${crawl.error_message || 'Unknown error'}`, 'error');
                this.stopPolling();
                this.setFormEnabled(true);
            } else {
                this.showStatus(`Crawling... ${crawl.pages_crawled} pages crawled`, 'info');
            }
            
        } catch (error) {
            console.error('Failed to check crawl status:', error);
            this.showStatus('Failed to check crawl status', 'error');
            this.stopPolling();
            this.setFormEnabled(true);
        }
    }
    
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    setFormEnabled(enabled) {
        const form = document.getElementById('crawlForm');
        const inputs = form.querySelectorAll('input, select, button');
        
        inputs.forEach(input => {
            input.disabled = !enabled;
        });
        
        const startButton = document.getElementById('startCrawl');
        if (enabled) {
            startButton.textContent = 'Start Crawl';
        } else {
            startButton.innerHTML = '<span class="loading"></span>Processing...';
        }
    }
    
    showStatus(message, type) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status';
            }, 3000);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOMContentLoaded event fired ===');
    new CrawlPopup();
});
