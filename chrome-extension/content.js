// Content script for Web to Context Chrome Extension

class ContentScript {
    constructor() {
        this.init();
    }
    
    init() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'getPagePreview') {
                this.getPagePreview().then(sendResponse);
                return true; // Keep message channel open for async response
            } else if (request.action === 'getAuthToken') {
                this.getAuthToken().then(sendResponse);
                return true; // Keep message channel open for async response
            } else if (request.action === 'ping') {
                sendResponse({ status: 'pong', url: window.location.href });
                return true;
            }
        });
    }
    
    async getPagePreview() {
        try {
            // Get page title
            const title = document.title || 'Untitled';
            
            // Get page description
            const description = this.getPageDescription();
            
            // Get main content (simplified)
            const content = this.getMainContent();
            
            // Get links
            const links = this.getPageLinks();
            
            return {
                preview: this.formatPreview(title, description, content, links)
            };
            
        } catch (error) {
            console.error('Failed to get page preview:', error);
            return {
                preview: 'Failed to generate preview'
            };
        }
    }
    
    getPageDescription() {
        // Try to get description from meta tags
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            return metaDescription.getAttribute('content');
        }
        
        // Try Open Graph description
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            return ogDescription.getAttribute('content');
        }
        
        // Try to get first paragraph
        const firstP = document.querySelector('p');
        if (firstP && firstP.textContent.trim()) {
            return firstP.textContent.trim().substring(0, 200) + '...';
        }
        
        return 'No description available';
    }
    
    getMainContent() {
        // Try to find main content area
        const main = document.querySelector('main');
        const article = document.querySelector('article');
        const content = document.querySelector('.content, #content, .main, #main');
        
        const contentElement = main || article || content;
        
        if (contentElement) {
            return contentElement.textContent.trim().substring(0, 300) + '...';
        }
        
        // Fallback to body content
        const body = document.body;
        if (body) {
            return body.textContent.trim().substring(0, 300) + '...';
        }
        
        return 'No content available';
    }
    
    getPageLinks() {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links
            .map(link => ({
                text: link.textContent.trim(),
                href: link.href
            }))
            .filter(link => link.text && link.href)
            .slice(0, 10); // Limit to first 10 links
    }
    
    formatPreview(title, description, content, links) {
        let html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #1f2937; font-weight: 600;">${this.escapeHtml(title)}</h3>
        `;
        
        if (description) {
            html += `<p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${this.escapeHtml(description)}</p>`;
        }
        
        if (content) {
            html += `<p style="margin: 0 0 8px 0; font-size: 11px; color: #374151; line-height: 1.4;">${this.escapeHtml(content)}</p>`;
        }
        
        if (links.length > 0) {
            html += `<div style="margin-top: 8px;">
                <strong style="font-size: 11px; color: #374151;">Links found:</strong>
                <ul style="margin: 4px 0 0 0; padding-left: 16px; font-size: 10px; color: #6b7280;">
            `;
            
            links.slice(0, 5).forEach(link => {
                html += `<li style="margin-bottom: 2px;">${this.escapeHtml(link.text)}</li>`;
            });
            
            if (links.length > 5) {
                html += `<li style="margin-bottom: 2px; color: #9ca3af;">... and ${links.length - 5} more</li>`;
            }
            
            html += `</ul></div>`;
        }
        
        html += `</div>`;
        
        return html;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
        async getAuthToken() {
            try {
                console.log('Content script: getAuthToken requested');
                console.log('Content script: Current URL:', window.location.href);
                console.log('Content script: localStorage length:', localStorage.length);
                
                // Look for Supabase auth token in localStorage
                let token = null;
                const allKeys = [];
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    allKeys.push(key);
                    console.log('Content script: Checking localStorage key:', key);
                    
                    // Look for keys that contain 'auth-token' (Supabase uses this pattern)
                    if (key && key.includes('auth-token')) {
                        console.log('Content script: Found auth-token key:', key);
                        const authData = localStorage.getItem(key);
                        if (authData) {
                            try {
                                const parsed = JSON.parse(authData);
                                console.log('Content script: Parsed auth data:', parsed);
                                if (parsed.access_token) {
                                    token = parsed.access_token;
                                    console.log('Content script: Found auth token from key:', key);
                                    console.log('Content script: Token length:', token.length);
                                    break;
                                }
                            } catch (e) {
                                console.log('Content script: Failed to parse auth data:', e);
                            }
                        }
                    }
                }
                
                console.log('Content script: All localStorage keys:', allKeys);
                console.log('Content script: Returning token:', token ? 'Token exists' : 'No token');
                return { token: token, allKeys: allKeys };
                
            } catch (error) {
                console.error('Content script: Error getting auth token:', error);
                return { token: null, error: error.message };
            }
        }
}

// Initialize content script
new ContentScript();
