import type { Metadata } from 'next'
import './globals.css'
import { createClient } from '../lib/supabase/client'

export const metadata: Metadata = {
  title: 'Web to Context Profile',
  description: 'Create context profiles from websites',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize Supabase client globally with localStorage storage
              (function() {
                try {
                  // Import and initialize Supabase client
                  import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/main/index.js').then(({ createClient }) => {
                    window.supabase = createClient(
                      '${process.env.NEXT_PUBLIC_SUPABASE_URL}',
                      '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}',
                      {
                        auth: {
                          storage: {
                            getItem: (key) => {
                              if (typeof window === 'undefined') return null;
                              try {
                                const localStorageValue = localStorage.getItem(key);
                                if (localStorageValue) return localStorageValue;
                              } catch (e) {}
                              try {
                                const cookies = document.cookie.split(';');
                                for (const cookie of cookies) {
                                  const [name, value] = cookie.trim().split('=');
                                  if (name === key) return decodeURIComponent(value);
                                }
                              } catch (e) {}
                              return null;
                            },
                            setItem: (key, value) => {
                              if (typeof window === 'undefined') return;
                              try {
                                localStorage.setItem(key, value);
                              } catch (e) {}
                              try {
                                const cookieString = \`\${key}=\${encodeURIComponent(value)}; Path=/; SameSite=Lax\`;
                                document.cookie = cookieString;
                              } catch (e) {}
                            },
                            removeItem: (key) => {
                              if (typeof window === 'undefined') return;
                              try {
                                localStorage.removeItem(key);
                              } catch (e) {}
                              try {
                                document.cookie = \`\${key}=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT\`;
                              } catch (e) {}
                            }
                          }
                        }
                      }
                    );
                    console.log('Supabase client initialized globally with localStorage storage');
                  }).catch(error => {
                    console.error('Failed to initialize Supabase client:', error);
                  });
                } catch (error) {
                  console.error('Error setting up Supabase client:', error);
                }
              })();
              
              // Manual localStorage sync for Supabase auth tokens
              (function() {
                // Function to sync auth tokens from cookies to localStorage
                function syncAuthTokensToLocalStorage() {
                  try {
                    console.log('🔄 Syncing auth tokens from cookies to localStorage...');
                    
                    // Get all cookies
                    const cookies = document.cookie.split(';');
                    let foundTokens = 0;
                    
                    for (const cookie of cookies) {
                      const [name, value] = cookie.trim().split('=');
                      if (name && name.includes('auth-token')) {
                        try {
                          const decodedValue = decodeURIComponent(value);
                          console.log('Found auth token cookie:', name);
                          
                          // Store in localStorage
                          localStorage.setItem(name, decodedValue);
                          foundTokens++;
                          console.log('✅ Stored token in localStorage:', name);
                        } catch (e) {
                          console.error('Error processing cookie:', name, e);
                        }
                      }
                    }
                    
                    console.log(\`📊 Synced \${foundTokens} auth tokens to localStorage\`);
                    return foundTokens > 0;
                  } catch (error) {
                    console.error('Error syncing auth tokens:', error);
                    return false;
                  }
                }
                
                // Function to get auth state for extension
                async function getAuthState() {
                  try {
                    let token = null;
                    let projects = [];
                    
                    // First try localStorage
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && key.includes('auth-token')) {
                        const authData = localStorage.getItem(key);
                        if (authData) {
                          try {
                            const parsed = JSON.parse(authData);
                            if (parsed.access_token) {
                              token = parsed.access_token;
                              console.log('Found token in localStorage:', key);
                              break;
                            }
                          } catch (e) {
                            // If not JSON, might be URL encoded
                            try {
                              const decoded = decodeURIComponent(authData);
                              const parsed = JSON.parse(decoded);
                              if (parsed.access_token) {
                                token = parsed.access_token;
                                console.log('Found token in localStorage (decoded):', key);
                                break;
                              }
                            } catch (e2) {}
                          }
                        }
                      }
                    }
                    
                    // If no token in localStorage, try to sync from cookies
                    if (!token) {
                      console.log('No token in localStorage, syncing from cookies...');
                      const synced = syncAuthTokensToLocalStorage();
                      if (synced) {
                        // Try again after sync
                        for (let i = 0; i < localStorage.length; i++) {
                          const key = localStorage.key(i);
                          if (key && key.includes('auth-token')) {
                            const authData = localStorage.getItem(key);
                            if (authData) {
                              try {
                                const parsed = JSON.parse(authData);
                                if (parsed.access_token) {
                                  token = parsed.access_token;
                                  console.log('Found token after sync:', key);
                                  break;
                                }
                              } catch (e) {
                                try {
                                  const decoded = decodeURIComponent(authData);
                                  const parsed = JSON.parse(decoded);
                                  if (parsed.access_token) {
                                    token = parsed.access_token;
                                    console.log('Found token after sync (decoded):', key);
                                    break;
                                  }
                                } catch (e2) {}
                              }
                            }
                          }
                        }
                      }
                    }
                    
                    // If we have a token, fetch projects from API
                    if (token) {
                      try {
                        console.log('Fetching projects with token...');
                        const response = await fetch('/api/projects', {
                          headers: {
                            'Authorization': \`Bearer \${token}\`
                          }
                        });
                        
                        if (response.ok) {
                          projects = await response.json();
                          console.log('✅ Fetched projects:', projects.length);
                        } else {
                          console.error('Failed to fetch projects:', response.status);
                        }
                      } catch (error) {
                        console.error('Failed to fetch projects for extension sync:', error);
                      }
                    } else {
                      console.log('❌ No auth token found');
                    }
                    
                    return { token, projects };
                  } catch (error) {
                    console.error('Error in getAuthState:', error);
                    return { token: null, projects: [] };
                  }
                }
                
                // Function to send auth state to extension
                async function sendAuthState() {
                  const authState = await getAuthState();
                  if (authState.token) {
                    console.log('📤 Sending auth state to extension...');
                    chrome.runtime.sendMessage({
                      action: 'authState',
                      token: authState.token,
                      projects: authState.projects
                    });
                  } else {
                    console.log('❌ No auth state to send to extension');
                  }
                }
                
                // Chrome extension sync script
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                  // Initial sync
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                      setTimeout(sendAuthState, 1000); // Wait for page to fully load
                    });
                  } else {
                    setTimeout(sendAuthState, 1000);
                  }
                  
                  // Monitor localStorage changes
                  const originalSetItem = localStorage.setItem;
                  localStorage.setItem = function(key, value) {
                    originalSetItem.apply(this, arguments);
                    if (key.includes('auth-token')) {
                      console.log('🔄 Auth token updated in localStorage:', key);
                      setTimeout(() => sendAuthState(), 100);
                    }
                  };
                  
                  // Monitor cookie changes (periodic sync)
                  setInterval(() => {
                    syncAuthTokensToLocalStorage();
                  }, 5000); // Sync every 5 seconds
                }
                
                // Also sync immediately
                setTimeout(syncAuthTokensToLocalStorage, 1000);
              })();
            `
          }}
        />
      </body>
    </html>
  )
}
