console.log('=== TEST POPUP.JS LOADED ===');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== TEST DOMContentLoaded event fired ===');
    
    // Simple test to see if we can find the select element
    const select = document.getElementById('projectSelect');
    console.log('Select element found:', !!select);
    
    if (select) {
        console.log('Select element found, will update with real projects...');
    } else {
        console.error('Select element not found!');
    }
    
    // Test URL loading
    try {
        console.log('Getting current tab...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Current tab:', tab);
        
        const urlElement = document.getElementById('currentUrl');
        if (urlElement && tab) {
            console.log('Updating URL element with:', tab.url);
            urlElement.textContent = tab.url || 'Unable to get current URL';
        } else {
            console.log('URL element not found or no tab');
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
        const urlElement = document.getElementById('currentUrl');
        if (urlElement) {
            urlElement.textContent = 'Error loading URL';
        }
    }
    
    // Test project loading
    try {
        console.log('Testing project loading...');
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['projects', 'authToken'], resolve);
        });
        
        console.log('Storage result:', result);
        console.log('Has projects:', !!result.projects);
        console.log('Has authToken:', !!result.authToken);
        console.log('Projects length:', result.projects?.length);
        
        if (result.projects && result.projects.length > 0) {
            console.log('Found stored projects:', result.projects);
            updateProjectSelect(result.projects);
        } else if (result.authToken) {
            console.log('No stored projects, but have auth token - trying API...');
            try {
                const response = await fetch('http://localhost:3000/api/projects', {
                    headers: {
                        'Authorization': `Bearer ${result.authToken}`
                    }
                });
                
                console.log('API response status:', response.status);
                
                if (response.ok) {
                    const projects = await response.json();
                    console.log('Fetched projects from API:', projects);
                    
                    // Store projects for future use
                    await new Promise((resolve) => {
                        chrome.storage.local.set({ projects: projects }, resolve);
                    });
                    
                    updateProjectSelect(projects);
                } else {
                    const errorText = await response.text();
                    console.log('API request failed:', response.status, errorText);
                    updateProjectSelect([]);
                }
            } catch (apiError) {
                console.error('API error:', apiError);
                updateProjectSelect([]);
            }
        } else {
            console.log('No auth token found');
            updateProjectSelect([]);
        }
    } catch (error) {
        console.error('Error testing project loading:', error);
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
    console.log('updateProjectSelect called with:', projects);
    const select = document.getElementById('projectSelect');
    
    if (!select) {
        console.error('Select element not found in updateProjectSelect');
        return;
    }
    
    select.innerHTML = '';
    
    if (!projects || projects.length === 0) {
        console.log('No projects to display');
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No projects found. Open web app first.';
        select.appendChild(option);
        return;
    }
    
    console.log('Adding projects to select:', projects);
    projects.forEach((project, index) => {
        console.log(`Adding project ${index}:`, project);
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.appendChild(option);
    });
    
    console.log('Project select updated, total options:', select.options.length);
}

function addSyncButton() {
    console.log('Adding sync button...');
    const projectGroup = document.querySelector('.form-group');
    if (!projectGroup) {
        console.error('Project group not found');
        return;
    }
    
    const syncButton = document.createElement('button');
    syncButton.type = 'button';
    syncButton.textContent = '🔄 Sync Projects';
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
            // Try to find web app tab and sync auth
            const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            console.log('Found web app tabs:', tabs.length);
            
            if (tabs.length > 0) {
                console.log('Sending sync message to tab:', tabs[0].id);
                try {
                    await chrome.tabs.sendMessage(tabs[0].id, { action: 'syncAuth' });
                    console.log('Message sent to content script');
                } catch (messageError) {
                    console.log('Content script not available, using background sync:', messageError);
                    await chrome.runtime.sendMessage({ action: 'syncAuth', tabId: tabs[0].id });
                    console.log('Message sent to background script');
                }
                
                // Wait for sync to complete
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Reload projects
                console.log('Reloading projects after sync...');
                const result = await new Promise((resolve) => {
                    chrome.storage.local.get(['projects', 'authToken'], resolve);
                });
                
                console.log('After sync - Storage result:', result);
                
                if (result.projects && result.projects.length > 0) {
                    updateProjectSelect(result.projects);
                    showStatus('Projects synced successfully!', 'success');
                } else if (result.authToken) {
                    // Try direct API call
                    try {
                        console.log('Sync button - Direct API call with stored token length:', result.authToken.length);
                        console.log('Sync button - Stored token preview:', result.authToken.substring(0, 50) + '...');
                        
                        const response = await fetch('http://localhost:3000/api/projects', {
                            headers: {
                                'Authorization': `Bearer ${result.authToken}`
                            }
                        });
                        
                        if (response.ok) {
                            const projects = await response.json();
                            console.log('Direct API fetch successful:', projects);
                            
                            // Store projects
                            await new Promise((resolve) => {
                                chrome.storage.local.set({ projects: projects }, resolve);
                            });
                            
                            updateProjectSelect(projects);
                            showStatus('Projects synced successfully!', 'success');
                        } else {
                            const errorText = await response.text();
                            console.log('Direct API failed:', response.status, errorText);
                            showStatus(`Sync failed - API error: ${response.status}`, 'error');
                        }
                    } catch (apiError) {
                        console.error('Direct API error:', apiError);
                        showStatus('Sync failed - API error', 'error');
                    }
                } else {
                    // No auth token in storage, try to get it from content script
                    console.log('No auth token in storage, trying content script...');
                    try {
                        // First, try to refresh the page to get a fresh token
                        console.log('Refreshing web app page to get fresh token...');
                        await chrome.tabs.reload(tabs[0].id);
                        
                        // Wait for page to load
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const authResponse = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getAuthToken' });
                        console.log('Content script response:', authResponse);
                        if (authResponse && authResponse.token) {
                            console.log('Got token from content script, storing it...');
                            console.log('Token length:', authResponse.token.length);
                            console.log('Token preview:', authResponse.token.substring(0, 50) + '...');
                            
                            // Store token
                            await new Promise((resolve) => {
                                chrome.storage.local.set({ authToken: authResponse.token }, resolve);
                            });
                            
                            // Try API call with the token
                            console.log('Sync button - Sending API request with token length:', authResponse.token.length);
                            console.log('Sync button - Token preview for API:', authResponse.token.substring(0, 50) + '...');
                            
                            const response = await fetch('http://localhost:3000/api/projects', {
                                headers: {
                                    'Authorization': `Bearer ${authResponse.token}`
                                }
                            });
                            
                            if (response.ok) {
                                const projects = await response.json();
                                console.log('API call successful with content script token:', projects);
                                
                                // Store projects
                                await new Promise((resolve) => {
                                    chrome.storage.local.set({ projects: projects }, resolve);
                                });
                                
                                updateProjectSelect(projects);
                                showStatus('Projects synced successfully!', 'success');
                            } else {
                                const errorText = await response.text();
                                console.log('API call failed with content script token:', response.status, errorText);
                                showStatus(`Sync failed - API error: ${response.status}`, 'error');
                            }
                        } else {
                            showStatus('No auth token found in web app', 'error');
                        }
                    } catch (contentError) {
                        console.error('Content script error:', contentError);
                        showStatus('No auth token found', 'error');
                    }
                }
            } else {
                showStatus('Please open the web app first', 'error');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            showStatus('Sync failed', 'error');
        } finally {
            syncButton.textContent = '🔄 Sync Projects';
            syncButton.disabled = false;
        }
    });
    
    projectGroup.appendChild(syncButton);
    console.log('Sync button added');
    
    // Add clear cache button
    const clearCacheButton = document.createElement('button');
    clearCacheButton.type = 'button';
    clearCacheButton.textContent = '🗑️ Clear Cache';
    clearCacheButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #991b1b;
    `;
    
    clearCacheButton.addEventListener('click', async () => {
        console.log('Clearing extension cache...');
        try {
            // Clear all extension storage
            await new Promise((resolve) => {
                chrome.storage.local.clear(resolve);
            });
            
            // Clear project select
            const projectSelect = document.getElementById('projectSelect');
            if (projectSelect) {
                projectSelect.innerHTML = '<option value="">Loading projects...</option>';
            }
            
            // Also try to refresh the web app page to get a fresh token
            try {
                const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
                if (tabs.length > 0) {
                    console.log('Refreshing web app page for fresh token...');
                    await chrome.tabs.reload(tabs[0].id);
                    showStatus('Cache cleared and page refreshed! Wait 3 seconds then try sync.', 'success');
                } else {
                    showStatus('Cache cleared! Open web app and try sync.', 'success');
                }
            } catch (refreshError) {
                console.log('Could not refresh page:', refreshError);
                showStatus('Cache cleared! Try syncing again.', 'success');
            }
            
            console.log('Extension cache cleared successfully');
        } catch (error) {
            console.error('Error clearing cache:', error);
            showStatus('Error clearing cache', 'error');
        }
    });
    
    projectGroup.appendChild(clearCacheButton);
    
    // Add force refresh button
    const forceRefreshButton = document.createElement('button');
    forceRefreshButton.type = 'button';
    forceRefreshButton.textContent = '🔄 Force Refresh';
    forceRefreshButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #dbeafe;
        border: 1px solid #93c5fd;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #1e40af;
    `;
    
    forceRefreshButton.addEventListener('click', async () => {
        console.log('Force refreshing session...');
        try {
            // Clear cache first
            await new Promise((resolve) => {
                chrome.storage.local.clear(resolve);
            });
            
            // Find web app tab
            const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            if (tabs.length > 0) {
                // Clear localStorage in the web app tab
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: () => {
                            console.log('Clearing localStorage...');
                            localStorage.clear();
                            console.log('localStorage cleared');
                        }
                    });
                    console.log('Cleared localStorage in web app');
                } catch (scriptError) {
                    console.log('Could not clear localStorage:', scriptError);
                }
                
                // Navigate to login page to force fresh session
                await chrome.tabs.update(tabs[0].id, { url: 'http://localhost:3000/auth/login' });
                showStatus('Cleared all data and redirected to login. Please log in again, then try sync.', 'info');
            } else {
                showStatus('Please open the web app first', 'error');
            }
        } catch (error) {
            console.error('Error force refreshing:', error);
            showStatus('Error force refreshing', 'error');
        }
    });
    
    projectGroup.appendChild(forceRefreshButton);
    
    // Add manual localStorage clear button
    const clearLocalStorageButton = document.createElement('button');
    clearLocalStorageButton.type = 'button';
    clearLocalStorageButton.textContent = '🧹 Clear Web App Storage';
    clearLocalStorageButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #92400e;
    `;
    
    clearLocalStorageButton.addEventListener('click', async () => {
        console.log('Clearing web app localStorage...');
        try {
            const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            if (tabs.length > 0) {
                await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        console.log('Clearing all localStorage...');
                        localStorage.clear();
                        console.log('localStorage cleared completely');
                        return 'localStorage cleared';
                    }
                });
                showStatus('Web app localStorage cleared! Refresh the page and log in again.', 'success');
            } else {
                showStatus('Please open the web app first', 'error');
            }
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            showStatus('Error clearing localStorage', 'error');
        }
    });
    
    // Add debug localStorage button
    const debugLocalStorageButton = document.createElement('button');
    debugLocalStorageButton.type = 'button';
    debugLocalStorageButton.textContent = '🔍 Debug Web App Storage';
    debugLocalStorageButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #f0f9ff;
        border: 1px solid #0ea5e9;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #0c4a6e;
    `;
    
    debugLocalStorageButton.addEventListener('click', async () => {
        console.log('Debugging web app localStorage...');
        try {
            const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            if (tabs.length > 0) {
                const result = await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        const keys = [];
                        const allData = {};
                        
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            keys.push(key);
                            allData[key] = localStorage.getItem(key);
                        }
                        
                        return {
                            keys: keys,
                            data: allData,
                            length: localStorage.length,
                            currentUrl: window.location.href,
                            hasSupabase: typeof window.supabase !== 'undefined'
                        };
                    }
                });
                
                if (result && result[0] && result[0].result) {
                    const debugInfo = result[0].result;
                    console.log('Web app localStorage debug:', debugInfo);
                    
                    let message = `Web app debug:\n`;
                    message += `URL: ${debugInfo.currentUrl}\n`;
                    message += `localStorage keys: ${debugInfo.keys.length}\n`;
                    message += `Keys: ${debugInfo.keys.join(', ')}\n`;
                    message += `Has Supabase: ${debugInfo.hasSupabase}`;
                    
                    showStatus(message, 'info');
                } else {
                    showStatus('Could not debug web app storage', 'error');
                }
            } else {
                showStatus('Please open the web app first', 'error');
            }
        } catch (error) {
            console.error('Error debugging localStorage:', error);
            showStatus('Error debugging localStorage', 'error');
        }
    });
    
    projectGroup.appendChild(debugLocalStorageButton);
    
    projectGroup.appendChild(clearLocalStorageButton);
    
    // Add direct API test button
    const testApiButton = document.createElement('button');
    testApiButton.type = 'button';
    testApiButton.textContent = '🧪 Test API Direct';
    testApiButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #92400e;
    `;
    
    testApiButton.addEventListener('click', async () => {
        console.log('Test API button clicked');
        testApiButton.textContent = '🧪 Testing...';
        testApiButton.disabled = true;
        
        try {
            // Try to get auth token from localStorage directly
            console.log('Checking localStorage for auth token...');
            
            // Get current tab
            const [tab] = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            if (tab && tab.id) {
                console.log('Found web app tab, trying to get auth from it...');
                
                try {
                    console.log('Attempting to execute script in web app tab...');
                    
                    // Try to execute script in web app tab to get auth token
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            console.log('Script executing in web app tab...');
                            // Look for Supabase auth token in localStorage
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                console.log('Checking localStorage key:', key);
                                if (key && key.includes('supabase') && key.includes('auth-token')) {
                                    const authData = localStorage.getItem(key);
                                    console.log('Found auth data for key:', key);
                                    if (authData) {
                                        try {
                                            const parsed = JSON.parse(authData);
                                            if (parsed.access_token) {
                                                console.log('Found access token!');
                                                return { token: parsed.access_token, key: key };
                                            }
                                        } catch (e) {
                                            console.log('Failed to parse auth data:', e);
                                        }
                                    }
                                }
                            }
                            console.log('No auth token found in localStorage');
                            return null;
                        }
                    });
                    
                    console.log('Script execution results:', results);
                    
                    if (results && results[0] && results[0].result) {
                        const result = results[0].result;
                        console.log('Script result:', result);
                        
                        if (result && result.token) {
                            const token = result.token;
                            console.log('Found auth token from key:', result.key);
                            
                            // Store token in extension storage
                            await new Promise((resolve) => {
                                chrome.storage.local.set({ authToken: token }, resolve);
                            });
                            
                            console.log('Token stored in extension storage');
                            
                            // Try to fetch projects with this token
                            const response = await fetch('http://localhost:3000/api/projects', {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            console.log('API response status:', response.status);
                            
                            if (response.ok) {
                                const projects = await response.json();
                                console.log('Fetched projects:', projects);
                                
                                // Store projects
                                await new Promise((resolve) => {
                                    chrome.storage.local.set({ projects: projects }, resolve);
                                });
                                
                                updateProjectSelect(projects);
                                showStatus('API test successful! Projects loaded.', 'success');
                            } else {
                                const errorText = await response.text();
                                console.log('API failed:', response.status, errorText);
                                showStatus(`API test failed: ${response.status} - ${errorText}`, 'error');
                            }
                        } else {
                            showStatus('No auth token found in web app localStorage', 'error');
                        }
                    } else {
                        console.log('No results from script execution');
                        showStatus('Could not access web app localStorage - try refreshing the web app', 'error');
                    }
                } catch (scriptError) {
                    console.error('Script execution error:', scriptError);
                    console.error('Error details:', scriptError.message);
                    
                    // Try alternative approach - check if we can access the tab at all
                    try {
                        const tabInfo = await chrome.tabs.get(tab.id);
                        console.log('Tab info:', tabInfo);
                        showStatus(`Script execution failed: ${scriptError.message}. Try refreshing the web app.`, 'error');
                    } catch (tabError) {
                        console.error('Cannot access tab:', tabError);
                        showStatus('Cannot access web app tab. Make sure the web app is open.', 'error');
                    }
                }
            } else {
                showStatus('Please open the web app first', 'error');
            }
        } catch (error) {
            console.error('Test API failed:', error);
            showStatus('Test API failed', 'error');
        } finally {
            testApiButton.textContent = '🧪 Test API Direct';
            testApiButton.disabled = false;
        }
    });
    
    projectGroup.appendChild(testApiButton);
    console.log('Test API button added');
    
    // Add content script test button
    const contentScriptButton = document.createElement('button');
    contentScriptButton.type = 'button';
    contentScriptButton.textContent = '📡 Test Content Script';
    contentScriptButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #ecfdf5;
        border: 1px solid #10b981;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #047857;
    `;
    
    contentScriptButton.addEventListener('click', async () => {
        console.log('Content script test button clicked');
        contentScriptButton.textContent = '📡 Testing...';
        contentScriptButton.disabled = true;
        
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            if (tab && tab.id) {
                console.log('Found web app tab, trying content script approach...');
                
                try {
                    // Try to send message to content script
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAuthToken' });
                    console.log('Content script response:', response);
                    
                    if (response && response.token) {
                        console.log('Got token from content script:', response.token ? 'Token exists' : 'No token');
                        
                        // Store token in extension storage
                        await new Promise((resolve) => {
                            chrome.storage.local.set({ authToken: response.token }, resolve);
                        });
                        
                        // Try to fetch projects with this token
                        const apiResponse = await fetch('http://localhost:3000/api/projects', {
                            headers: {
                                'Authorization': `Bearer ${response.token}`
                            }
                        });
                        
                        console.log('API response status:', apiResponse.status);
                        
                        if (apiResponse.ok) {
                            const projects = await apiResponse.json();
                            console.log('Fetched projects:', projects);
                            
                            // Store projects
                            await new Promise((resolve) => {
                                chrome.storage.local.set({ projects: projects }, resolve);
                            });
                            
                            updateProjectSelect(projects);
                            showStatus('Content script test successful! Projects loaded.', 'success');
                        } else {
                            const errorText = await apiResponse.text();
                            console.log('API failed:', apiResponse.status, errorText);
                            showStatus(`API test failed: ${apiResponse.status} - ${errorText}`, 'error');
                        }
                    } else {
                        showStatus('No auth token found via content script', 'error');
                    }
                } catch (messageError) {
                    console.error('Content script message error:', messageError);
                    showStatus('Content script not available. Try refreshing the web app.', 'error');
                }
            } else {
                showStatus('Please open the web app first', 'error');
            }
        } catch (error) {
            console.error('Content script test failed:', error);
            showStatus('Content script test failed', 'error');
        } finally {
            contentScriptButton.textContent = '📡 Test Content Script';
            contentScriptButton.disabled = false;
        }
    });
    
    projectGroup.appendChild(contentScriptButton);
    console.log('Content script test button added');
    
    // Add simple diagnostic button
    const diagnosticButton = document.createElement('button');
    diagnosticButton.type = 'button';
    diagnosticButton.textContent = '🔍 Run Diagnostics';
    diagnosticButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #f3f4f6;
        border: 1px solid #6b7280;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #374151;
    `;
    
    diagnosticButton.addEventListener('click', async () => {
        console.log('=== RUNNING DIAGNOSTICS ===');
        diagnosticButton.textContent = '🔍 Running...';
        diagnosticButton.disabled = true;
        
        let diagnosticResults = [];
        
        try {
            // Test 1: Check if we can access chrome APIs
            diagnosticResults.push('✅ Chrome APIs accessible');
            
            // Test 2: Check if we can query tabs
            const tabs = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            diagnosticResults.push(`✅ Found ${tabs.length} web app tabs`);
            
            if (tabs.length === 0) {
                diagnosticResults.push('❌ No web app tabs found - please open http://localhost:3000');
                showStatus('No web app tabs found. Please open the web app first.', 'error');
                return;
            }
            
            const tab = tabs[0];
            diagnosticResults.push(`✅ Web app tab ID: ${tab.id}`);
            
            // Test 3: Check if we can access the tab
            try {
                const tabInfo = await chrome.tabs.get(tab.id);
                diagnosticResults.push(`✅ Tab accessible: ${tabInfo.url}`);
            } catch (tabError) {
                diagnosticResults.push(`❌ Cannot access tab: ${tabError.message}`);
            }
            
            // Test 4: Check if content script is available
            try {
                const contentResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                diagnosticResults.push('✅ Content script responding');
            } catch (contentError) {
                diagnosticResults.push(`❌ Content script not responding: ${contentError.message}`);
                
                // Try to inject content script dynamically
                try {
                    console.log('Attempting to inject content script...');
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    diagnosticResults.push('✅ Content script injected successfully');
                    
                    // Wait a moment for the script to initialize
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Try ping again
                    try {
                        const retryResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                        diagnosticResults.push('✅ Content script responding after injection');
                    } catch (retryError) {
                        diagnosticResults.push(`❌ Content script still not responding after injection: ${retryError.message}`);
                    }
                } catch (injectError) {
                    diagnosticResults.push(`❌ Failed to inject content script: ${injectError.message}`);
                }
            }
            
            // Test 5: Try to get auth token via content script
            try {
                const authResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getAuthToken' });
                if (authResponse && authResponse.token) {
                    diagnosticResults.push('✅ Auth token found via content script');
                    
                    // Store token in extension storage for other buttons to use
                    await new Promise((resolve) => {
                        chrome.storage.local.set({ authToken: authResponse.token }, resolve);
                    });
                    diagnosticResults.push('✅ Auth token stored in extension storage');
                    
                    // Test 6: Try API call with token
                    try {
                        console.log('Sending API request with token length:', authResponse.token.length);
                        console.log('Token preview for API:', authResponse.token.substring(0, 50) + '...');
                        
                        const apiResponse = await fetch('http://localhost:3000/api/projects', {
                            headers: {
                                'Authorization': `Bearer ${authResponse.token}`
                            }
                        });
                        
                        if (apiResponse.ok) {
                            const projects = await apiResponse.json();
                            diagnosticResults.push(`✅ API call successful: ${projects.length} projects found`);
                            
                            // Store projects
                            await new Promise((resolve) => {
                                chrome.storage.local.set({ projects: projects }, resolve);
                            });
                            
                            updateProjectSelect(projects);
                            showStatus('Diagnostics successful! Projects loaded.', 'success');
                        } else {
                            const errorData = await apiResponse.json();
                            if (errorData.code === 'TOKEN_EXPIRED') {
                                diagnosticResults.push(`⚠️ Token expired - need to refresh session`);
                                diagnosticResults.push(`💡 Try refreshing the web app page or logging in again`);
                            } else {
                                diagnosticResults.push(`❌ API call failed: ${apiResponse.status} - ${errorData.error}`);
                            }
                        }
                    } catch (apiError) {
                        diagnosticResults.push(`❌ API call error: ${apiError.message}`);
                    }
                } else {
                    diagnosticResults.push('❌ No auth token found in web app');
                }
            } catch (authError) {
                diagnosticResults.push(`❌ Auth token retrieval failed: ${authError.message}`);
            }
            
            // Test 7: Check localStorage directly (if possible)
            try {
                const scriptResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const keys = [];
                        const allKeys = [];
                        const supabaseKeys = [];
                        
                        // Get all localStorage keys
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            allKeys.push(key);
                            
                            if (key && key.includes('supabase')) {
                                supabaseKeys.push(key);
                                keys.push(key);
                            }
                        }
                        
                        // Also check for any auth-related keys
                        const authKeys = allKeys.filter(key => 
                            key && (
                                key.includes('auth') || 
                                key.includes('token') || 
                                key.includes('session') ||
                                key.includes('user')
                            )
                        );
                        
                        return {
                            allKeys: allKeys,
                            supabaseKeys: supabaseKeys,
                            authKeys: authKeys,
                            localStorageLength: localStorage.length
                        };
                    }
                });
                
                if (scriptResults && scriptResults[0] && scriptResults[0].result) {
                    const result = scriptResults[0].result;
                    diagnosticResults.push(`✅ Found ${result.localStorageLength} total localStorage keys`);
                    diagnosticResults.push(`✅ Found ${result.supabaseKeys.length} Supabase keys: ${result.supabaseKeys.join(', ') || 'none'}`);
                    diagnosticResults.push(`✅ Found ${result.authKeys.length} auth-related keys: ${result.authKeys.join(', ') || 'none'}`);
                    
                    console.log('All localStorage keys:', result.allKeys);
                    console.log('Supabase keys:', result.supabaseKeys);
                    console.log('Auth keys:', result.authKeys);
                    
                        // If we have auth keys, try to get the auth token
                        if (result.authKeys.length > 0) {
                            const tokenScript = await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                func: () => {
                                    for (let i = 0; i < localStorage.length; i++) {
                                        const key = localStorage.key(i);
                                        if (key && key.includes('auth-token')) {
                                            const authData = localStorage.getItem(key);
                                            if (authData) {
                                                try {
                                                    const parsed = JSON.parse(authData);
                                                    return {
                                                        key: key,
                                                        hasAccessToken: !!parsed.access_token,
                                                        hasRefreshToken: !!parsed.refresh_token,
                                                        expiresAt: parsed.expires_at,
                                                        tokenType: parsed.token_type,
                                                        tokenPreview: parsed.access_token ? parsed.access_token.substring(0, 20) + '...' : null
                                                    };
                                                } catch (e) {
                                                    return { key: key, error: 'Failed to parse' };
                                                }
                                            }
                                        }
                                    }
                                    return null;
                                }
                            });
                        
                        if (tokenScript && tokenScript[0] && tokenScript[0].result) {
                            const tokenInfo = tokenScript[0].result;
                            if (tokenInfo && tokenInfo.hasAccessToken) {
                                diagnosticResults.push(`✅ Found valid auth token in key: ${tokenInfo.key}`);
                                diagnosticResults.push(`✅ Token preview: ${tokenInfo.tokenPreview}`);
                                diagnosticResults.push(`✅ Token expires at: ${new Date(tokenInfo.expiresAt * 1000).toLocaleString()}`);
                            } else if (tokenInfo) {
                                diagnosticResults.push(`❌ Auth token found but invalid: ${tokenInfo.key}`);
                            }
                        }
                    }
                } else {
                    diagnosticResults.push('❌ No localStorage data found');
                }
            } catch (scriptError) {
                diagnosticResults.push(`❌ Script execution failed: ${scriptError.message}`);
            }
            
            // Test 8: Check if web app has Supabase client and session
            try {
                const supabaseScript = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        // Check if Supabase client is available
                        const hasSupabase = typeof window.supabase !== 'undefined';
                        const hasCreateClient = typeof window.createClient !== 'undefined';
                        
                        // Try to get session from Supabase if available
                        let sessionInfo = null;
                        if (hasSupabase && window.supabase.auth) {
                            try {
                                const session = window.supabase.auth.getSession();
                                sessionInfo = {
                                    hasSession: !!session,
                                    sessionType: typeof session
                                };
                            } catch (e) {
                                sessionInfo = { error: e.message };
                            }
                        }
                        
                        return {
                            hasSupabase: hasSupabase,
                            hasCreateClient: hasCreateClient,
                            sessionInfo: sessionInfo,
                            windowKeys: Object.keys(window).filter(key => key.includes('supabase') || key.includes('createClient'))
                        };
                    }
                });
                
                if (supabaseScript && supabaseScript[0] && supabaseScript[0].result) {
                    const result = supabaseScript[0].result;
                    diagnosticResults.push(`✅ Supabase client available: ${result.hasSupabase}`);
                    diagnosticResults.push(`✅ CreateClient function available: ${result.hasCreateClient}`);
                    diagnosticResults.push(`✅ Supabase-related window keys: ${result.windowKeys.join(', ') || 'none'}`);
                    
                    if (result.sessionInfo) {
                        if (result.sessionInfo.error) {
                            diagnosticResults.push(`❌ Session check error: ${result.sessionInfo.error}`);
                        } else {
                            diagnosticResults.push(`✅ Session available: ${result.sessionInfo.hasSession}`);
                        }
                    }
                }
            } catch (supabaseError) {
                diagnosticResults.push(`❌ Supabase check failed: ${supabaseError.message}`);
            }
            
        } catch (error) {
            diagnosticResults.push(`❌ Diagnostic error: ${error.message}`);
        }
        
        // Display results
        console.log('=== DIAGNOSTIC RESULTS ===');
        diagnosticResults.forEach(result => console.log(result));
        
        const resultText = diagnosticResults.join('\n');
        showStatus(`Diagnostics complete. Check console for details.`, 'info');
        
        // Show results in a simple alert for now
        alert('Diagnostic Results:\n\n' + resultText);
        
        diagnosticButton.textContent = '🔍 Run Diagnostics';
        diagnosticButton.disabled = false;
    });
    
    projectGroup.appendChild(diagnosticButton);
    console.log('Diagnostic button added');
    
    // Add inject content script button
    const injectButton = document.createElement('button');
    injectButton.type = 'button';
    injectButton.textContent = '💉 Inject Content Script';
    injectButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #fef2f2;
        border: 1px solid #ef4444;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: #dc2626;
    `;
    
    injectButton.addEventListener('click', async () => {
        console.log('Inject content script button clicked');
        injectButton.textContent = '💉 Injecting...';
        injectButton.disabled = true;
        
        try {
            const [tab] = await chrome.tabs.query({ url: 'http://localhost:3000/*' });
            if (tab && tab.id) {
                console.log('Injecting content script into tab:', tab.id);
                
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    console.log('Content script injected successfully');
                    showStatus('Content script injected! Try the other buttons now.', 'success');
                    
                    // Wait a moment and test if it's working
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                        console.log('Content script is now responding:', response);
                        showStatus('Content script injected and responding!', 'success');
                    } catch (testError) {
                        console.log('Content script still not responding:', testError);
                        showStatus('Content script injected but not responding yet. Try refreshing the web app.', 'error');
                    }
                    
                } catch (injectError) {
                    console.error('Failed to inject content script:', injectError);
                    showStatus(`Failed to inject content script: ${injectError.message}`, 'error');
                }
            } else {
                showStatus('Please open the web app first', 'error');
            }
        } catch (error) {
            console.error('Inject failed:', error);
            showStatus('Inject failed', 'error');
        } finally {
            injectButton.textContent = '💉 Inject Content Script';
            injectButton.disabled = false;
        }
    });
    
    projectGroup.appendChild(injectButton);
    console.log('Inject content script button added');
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
        console.log('Open Web App button handler set');
    } else {
        console.error('Open Web App button not found');
    }
    
    // Start Crawl button
    const startCrawlBtn = document.getElementById('startCrawl');
    if (startCrawlBtn) {
        startCrawlBtn.addEventListener('click', async () => {
            console.log('Start Crawl button clicked');
            await handleStartCrawl();
        });
        console.log('Start Crawl button handler set');
    } else {
        console.error('Start Crawl button not found');
    }
    
    // Show Preview checkbox
    const showPreviewCheckbox = document.getElementById('showPreview');
    if (showPreviewCheckbox) {
        showPreviewCheckbox.addEventListener('change', (e) => {
            console.log('Show preview checkbox changed:', e.target.checked);
            const preview = document.getElementById('pagePreview');
            if (preview) {
                if (e.target.checked) {
                    preview.classList.remove('hidden');
                    loadPagePreview();
                } else {
                    preview.classList.add('hidden');
                }
            }
        });
        console.log('Show preview checkbox handler set');
    }
}

async function handleStartCrawl() {
    console.log('Handling start crawl...');
    
    try {
        // Get form values
        const projectId = document.getElementById('projectSelect').value;
        const scope = document.getElementById('scopeSelect').value;
        const maxDepth = parseInt(document.getElementById('maxDepth').value);
        const maxPages = parseInt(document.getElementById('maxPages').value);
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!projectId) {
            showStatus('Please select a project', 'error');
            return;
        }
        
        if (!tab || !tab.url) {
            showStatus('Unable to get current page URL', 'error');
            return;
        }
        
        console.log('Starting crawl with:', { projectId, scope, maxDepth, maxPages, url: tab.url });
        
        // Get auth token
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['authToken'], resolve);
        });
        
        if (!result.authToken) {
            showStatus('Please sync with web app first', 'error');
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
        startPolling(crawlData.id);
        
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
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000);
}

function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        // Clear after 5 seconds
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status-message';
        }, 5000);
    }
}
