# Web to Context Chrome Extension

A Chrome extension that allows you to crawl websites and create context profiles directly from any webpage.

## Features

- **One-click crawling**: Start crawls from any webpage without opening the web app
- **Project selection**: Choose which project to add the crawl to
- **Configurable settings**: Set scope, depth, and page limits
- **Page preview**: See a preview of the current page before crawling
- **Real-time progress**: Monitor crawl progress directly in the extension
- **Auto-sync**: Automatically syncs with your web app authentication

## Installation

### Development Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension should now appear in your extensions list

### Usage

1. **First time setup**: Open the web app (`http://localhost:3000`) and log in
2. **Navigate to any webpage** you want to crawl
3. **Click the extension icon** in your browser toolbar
4. **Configure crawl settings**:
   - Select a project
   - Choose scope (domain, subdomain, or path)
   - Set max depth and page limits
   - Optionally preview the page content
5. **Click "Start Crawl"** to begin crawling
6. **Monitor progress** in the extension popup
7. **View results** in the web app when complete

## Configuration

The extension automatically saves your preferences:
- **Scope**: How broadly to crawl (domain, subdomain, path)
- **Max Depth**: How many levels deep to crawl
- **Max Pages**: Maximum number of pages to crawl

## Permissions

The extension requires minimal permissions:
- **activeTab**: To get the current page URL and content
- **storage**: To save your preferences and auth state
- **tabs**: To open the web app in new tabs
- **host_permissions**: Only for localhost:3000 and Supabase

## Development

### File Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── content.js            # Content script for page interaction
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md
```

### Key Components

- **Popup**: Main UI for configuring and starting crawls
- **Content Script**: Extracts page preview and content
- **Background Script**: Handles auth sync and extension lifecycle
- **API Integration**: Communicates with the web app's crawl API

## Troubleshooting

### Extension not loading
- Make sure the web app is running on `http://localhost:3000`
- Check that you're logged in to the web app
- Refresh the extension in `chrome://extensions/`

### No projects available
- Open the web app and create a project first
- Make sure you're logged in
- Refresh the extension popup

### Crawl not starting
- Check that the current page URL is valid (not chrome:// or extension pages)
- Ensure you have a project selected
- Verify the web app is running and accessible

## Security

- The extension only communicates with your local web app
- No data is sent to external servers except Supabase (for your web app)
- All crawl data is stored in your own Supabase instance
- Authentication tokens are stored locally in Chrome's storage

## Future Enhancements

- [ ] Batch crawling multiple pages
- [ ] Crawl scheduling
- [ ] Export bundles directly from extension
- [ ] Advanced filtering options
- [ ] Crawl templates and presets
