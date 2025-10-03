console.log('=== CLEAN POPUP.JS LOADED ===');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== CLEAN DOMContentLoaded event fired ===');
    
    // Load current URL
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const urlElement = document.getElementById('currentUrl');
        if (urlElement && tab) {
            urlElement.textContent = tab.url || 'Unable to get current URL';
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
        const urlElement = document.getElementById('currentUrl');
        if (urlElement) {
            urlElement.textContent = 'Error loading URL';
        }
    }
    
    // Load projects from storage
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['projects', 'authToken'], resolve);
        });
        
        if (result.projects && result.projects.length > 0) {
            updateProjectSelect(result.projects);
        } else {
            updateProjectSelect([]);
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        updateProjectSelect([]);
    }
    
    // Set up button event handlers
    setupEventHandlers();
    
    // Automatically inject content script and sync projects
    autoInjectAndSync();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Popup received message:', request);
        if (request.action === 'authStateUpdated') {
            console.log('Auth state updated:', request);
            if (request.projects) {
                updateProjectSelect(request.projects);
                showStatus('Projects updated!', 'success');
            }
        }
    });
});

function updateProjectSelect(projects) {
    console.log('Updating project select with:', projects);
    const select = document.getElementById('projectSelect');
    if (!select) {
        console.error('Project select element not found');
        return;
    }
    
    // Clear existing options
    select.innerHTML = '';
    
    if (projects && projects.length > 0) {
        projects.forEach((project, index) => {
            console.log(`Adding project ${index + 1}:`, project);
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
        });
        console.log(`Updated project select with ${projects.length} projects`);
        
        // Set first project as selected by default
        if (projects.length > 0) {
            select.value = projects[0].id;
            console.log('Set default project:', projects[0].name);
        }
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No projects found';
        select.appendChild(option);
        console.log('No projects to display');
    }
}

function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }, 3000);
        }
    }
}

async function autoInjectAndSync() {
    console.log('Auto-injecting content script and syncing projects...');
    
    try {
        // Find web app tab
        const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
        console.log('Found web app tabs:', tabs.length);
        
        if (tabs.length > 0) {
            const tab = tabs[0];
            console.log('Auto-injecting content script into tab:', tab.id);
            
            try {
                // Try to inject content script
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                console.log('Content script injected successfully');
            } catch (injectError) {
                console.log('Content script injection failed (may already be injected):', injectError);
            }
            
            // Wait a moment for injection to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to get auth token and sync projects
            try {
                const authResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getAuthToken' });
                console.log('Auth response:', authResponse);
                
                if (authResponse && authResponse.token) {
                    console.log('Found auth token, syncing projects...');
                    
                    // Store token
                    await new Promise((resolve) => {
                        chrome.storage.local.set({ authToken: authResponse.token }, resolve);
                    });
                    
                    // Fetch projects
                    const response = await fetch('http://localhost:3000/api/projects', {
                        headers: {
                            'Authorization': `Bearer ${authResponse.token}`
                        }
                    });
                    
                    if (response.ok) {
                        const projects = await response.json();
                        console.log('Projects fetched successfully:', projects);
                        console.log('Number of projects:', projects.length);
                        
                        // Store projects
                        await new Promise((resolve) => {
                            chrome.storage.local.set({ projects: projects }, resolve);
                        });
                        
                        updateProjectSelect(projects);
                        showStatus(`Projects synced automatically! Found ${projects.length} projects.`, 'success');
                    } else {
                        const errorText = await response.text();
                        console.error('Failed to fetch projects:', response.status, errorText);
                        showStatus(`Auto-sync failed - API error: ${response.status}`, 'error');
                    }
                } else {
                    console.log('No auth token found, user may need to log in');
                    showStatus('Please log in to the web app first', 'info');
                }
            } catch (messageError) {
                console.log('Content script communication failed:', messageError);
                showStatus('Auto-sync failed - content script not responding', 'error');
            }
        } else {
            console.log('No web app tabs found');
            showStatus('Please open the web app first', 'info');
        }
    } catch (error) {
        console.error('Auto-inject and sync error:', error);
        showStatus('Auto-sync failed', 'error');
    }
}

function setupEventHandlers() {
    console.log('Setting up event handlers...');
    
    // Open Web App button
    const openWebAppBtn = document.getElementById('openWebApp');
    if (openWebAppBtn) {
        openWebAppBtn.addEventListener('click', () => {
            console.log('Open Web App button clicked');
            chrome.tabs.create({ url: 'http://localhost:3000' });
        });
    }
    
    // Start Crawl button
    const startCrawlBtn = document.getElementById('startCrawl');
    if (startCrawlBtn) {
        startCrawlBtn.addEventListener('click', startCrawl);
    }
    
    // Show Preview checkbox
    const showPreviewCheckbox = document.getElementById('showPreview');
    if (showPreviewCheckbox) {
        showPreviewCheckbox.addEventListener('change', (e) => {
            const previewDiv = document.getElementById('pagePreview');
            if (previewDiv) {
                if (e.target.checked) {
                    previewDiv.classList.remove('hidden');
                    loadPagePreview();
                } else {
                    previewDiv.classList.add('hidden');
                }
            }
        });
    }
    
    // View Project button
    const viewProjectBtn = document.getElementById('viewProject');
    if (viewProjectBtn) {
        viewProjectBtn.addEventListener('click', () => {
            console.log('View Project button clicked');
            chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
        });
    }
}

async function startCrawl() {
    console.log('Starting crawl...');
    
    try {
        // Get form values
        const projectSelect = document.getElementById('projectSelect');
        const scopeSelect = document.getElementById('scopeSelect');
        const maxDepthInput = document.getElementById('maxDepth');
        const maxPagesInput = document.getElementById('maxPages');
        
        console.log('Form elements found:', {
            projectSelect: !!projectSelect,
            scopeSelect: !!scopeSelect,
            maxDepthInput: !!maxDepthInput,
            maxPagesInput: !!maxPagesInput
        });
        
        if (!projectSelect || !scopeSelect || !maxDepthInput || !maxPagesInput) {
            throw new Error('Form elements not found');
        }
        
        const projectId = projectSelect.value;
        const scope = scopeSelect.value;
        const maxDepth = parseInt(maxDepthInput.value);
        const maxPages = parseInt(maxPagesInput.value);
        
        console.log('Form values:', {
            projectId,
            scope,
            maxDepth,
            maxPages
        });
        
        if (!projectId || projectId === '') {
            showStatus('Please select a project', 'error');
            return;
        }
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            showStatus('Unable to get current page URL', 'error');
            return;
        }
        
        // Get auth token
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['authToken'], resolve);
        });
        
        if (!result.authToken) {
            showStatus('No auth token found. Please log in to the web app first.', 'error');
            return;
        }
        
        showStatus('Starting crawl...', 'info');
        
        // Call API
        const response = await fetch('http://localhost:3000/api/crawl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${result.authToken}`
            },
            body: JSON.stringify({
                project_id: projectId,
                root_url: tab.url,
                scope: scope,
                max_depth: maxDepth,
                max_pages: maxPages
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} ${errorText}`);
        }
        
        const crawlData = await response.json();
        console.log('Crawl started:', crawlData);
        
        showStatus('Crawl started successfully!', 'success');
        
        // Show progress section
        const progressSection = document.getElementById('crawlProgress');
        if (progressSection) {
            progressSection.classList.remove('hidden');
        }
        
        // Start polling for status
        startPolling(crawlData.crawl_id);
        
    } catch (error) {
        console.error('Crawl start failed:', error);
        showStatus(`Crawl failed: ${error.message}`, 'error');
    }
}

async function loadPagePreview() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.id) {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSanitizedDom' });
            
            if (response) {
                const previewContent = document.getElementById('previewContent');
                if (previewContent) {
                    previewContent.innerHTML = `
                        <h4>${response.title}</h4>
                        <p><strong>Description:</strong> ${response.description || 'No description'}</p>
                        <p><strong>Links found:</strong> ${response.links ? response.links.length : 0}</p>
                        <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
                            ${response.sanitizedHtml.substring(0, 1000)}${response.sanitizedHtml.length > 1000 ? '...' : ''}
                        </div>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Failed to load page preview:', error);
        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
            previewContent.innerHTML = '<p>Unable to load page preview</p>';
        }
    }
}

function startPolling(crawlId) {
    console.log('Starting polling for crawl:', crawlId);
    
    const pollInterval = setInterval(async () => {
        try {
            const result = await new Promise((resolve) => {
                chrome.storage.local.get(['authToken'], resolve);
            });
            
            if (!result.authToken) {
                clearInterval(pollInterval);
                return;
            }
            
            const response = await fetch(`http://localhost:3000/api/crawl/${crawlId}`, {
                headers: {
                    'Authorization': `Bearer ${result.authToken}`
                }
            });
            
            if (response.ok) {
                const crawlData = await response.json();
                
                // Update progress
                document.getElementById('crawlStatus').textContent = crawlData.status;
                document.getElementById('pagesCrawled').textContent = crawlData.pages_crawled || 0;
                document.getElementById('pagesFailed').textContent = crawlData.pages_failed || 0;
                
                if (crawlData.status === 'completed' || crawlData.status === 'failed') {
                    clearInterval(pollInterval);
                    
                    if (crawlData.status === 'completed') {
                        showStatus('Crawl completed successfully!', 'success');
                    } else {
                        showStatus('Crawl failed', 'error');
                    }
                }
            } else {
                console.error('Failed to get crawl status:', response.status);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}
