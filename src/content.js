// Veil - Content Script
// Replaces YouTube thumbnails with minimal typographic cards

(function () {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================

  const CONFIG = {
    enabled: true,
    mode: 'text',           // 'text' | 'film' | 'blur' | 'solid'
    font: 'cormorant',      // 'cormorant' | 'playfair' | 'eb-garamond' | 'times'
    showChannel: true,
    showDuration: true,
    showNoise: true,        // Subtle noise texture
    accentFromHash: false,  // Derive accent color from video ID
    hideChannelAvatars: true, // Replace channel avatars with initials
    debug: false
  };

  // Font stacks for each option
  const FONTS = {
    'cormorant': '"Cormorant Garamond", "Times New Roman", serif',
    'system': '-apple-system, "SF Pro Display", BlinkMacSystemFont, "Segoe UI", sans-serif',
    'futura': '"Jost", Futura, "Century Gothic", sans-serif',
    'cursive': '"Dancing Script", cursive'
  };

  // ============================================
  // STATE
  // ============================================

  const processedThumbnails = new WeakSet();
  const processedAvatars = new WeakSet();

  // ============================================
  // UTILITIES
  // ============================================

  function log(...args) {
    if (CONFIG.debug) console.log('[Veil]', ...args);
  }

  // Generate deterministic color from video ID
  function hashToColor(str) {
    if (!str) return '#ffffff';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 15%, 70%)`;
  }

  // Extract video ID from URL (validated alphanumeric for security)
  function extractVideoId(url) {
    if (!url) return null;
    // YouTube video IDs are exactly 11 characters: alphanumeric, dash, underscore
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
      url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // Truncate text with ellipsis
  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '…';
  }

  // Format duration from YouTube's format
  function formatDuration(durationText) {
    if (!durationText) return null;
    // YouTube shows durations like "12:34" or "1:23:45"
    return durationText.trim();
  }

  // Extract first letter from channel name
  function getInitials(channelName) {
    if (!channelName) return '?';
    const firstChar = channelName.trim().charAt(0);
    // Return uppercase letter if it's a letter, otherwise the original character
    return firstChar.toUpperCase() || '?';
  }

  // Generate deterministic color from channel name
  function hashToAvatarColor(str) {
    if (!str) return 'hsl(0, 0%, 20%)';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 25%, 25%)`;
  }

  // Get the best available thumbnail source
  function getThumbnailSrc(originalImg, videoId) {
    // Try multiple sources for the image
    if (originalImg) {
      // Try src first
      if (originalImg.src && originalImg.src.startsWith('http')) {
        return originalImg.src;
      }
      // Try currentSrc (for srcset images)
      if (originalImg.currentSrc && originalImg.currentSrc.startsWith('http')) {
        return originalImg.currentSrc;
      }
      // Try data-src (lazy loading)
      const dataSrc = originalImg.getAttribute('data-src');
      if (dataSrc && dataSrc.startsWith('http')) {
        return dataSrc;
      }
    }

    // Fallback: construct YouTube thumbnail URL from video ID
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    return '';
  }

  // ============================================
  // CARD GENERATION
  // ============================================

  function createTextCard(videoData) {
    const card = document.createElement('div');
    card.className = 'veil-card veil-text-card';

    // Set font from config
    card.style.fontFamily = FONTS[CONFIG.font] || FONTS['cormorant'];

    // Optional accent color from video ID
    if (CONFIG.accentFromHash && videoData.videoId) {
      card.style.setProperty('--veil-accent', hashToColor(videoData.videoId));
      card.dataset.accent = 'true';
    }

    // Build card HTML
    card.innerHTML = `
      ${CONFIG.showNoise ? '<div class="veil-noise"></div>' : ''}
      <div class="veil-content">
        <h3 class="veil-title">${escapeHtml(videoData.title || 'Untitled')}</h3>
        ${CONFIG.showChannel && videoData.channel ?
        `<span class="veil-channel">${escapeHtml(videoData.channel)}</span>` : ''}
      </div>
      ${CONFIG.showDuration && videoData.duration ?
        `<span class="veil-duration">${escapeHtml(videoData.duration)}</span>` : ''}
    `;

    return card;
  }

  function createFilmCard(videoData, imgSrc) {
    const card = document.createElement('div');
    card.className = 'veil-card veil-film-card';

    log('Film mode - image src:', imgSrc ? imgSrc.substring(0, 50) + '...' : 'none');

    card.innerHTML = `
      <div class="veil-film-frame">
        ${imgSrc ? `<img class="veil-film-img" src="${imgSrc}" alt="" crossorigin="anonymous">` : ''}
        <div class="veil-film-overlay"></div>
        <div class="veil-film-grain"></div>
        <div class="veil-letterbox veil-letterbox-top"></div>
        <div class="veil-letterbox veil-letterbox-bottom"></div>
      </div>
      ${CONFIG.showDuration && videoData.duration ?
        `<span class="veil-timecode">${escapeHtml(videoData.duration)}</span>` : ''}
    `;

    return card;
  }

  function createSolidCard(videoData, imgSrc) {
    const card = document.createElement('div');
    card.className = 'veil-card veil-solid-card';

    // TODO: Extract dominant color from thumbnail
    // For now, use hash-based color or default
    const color = videoData.videoId ? hashToColor(videoData.videoId) : '#1a1a1a';
    card.style.backgroundColor = color;

    return card;
  }

  // ============================================
  // THUMBNAIL PROCESSING
  // ============================================

  function extractVideoData(thumbnailContainer) {
    // Navigate up to find the video renderer element
    // Support both old (ytd-*) and new (yt-*-view-model) YouTube DOM structures
    const renderer = thumbnailContainer.closest(`
      ytd-rich-item-renderer,
      ytd-video-renderer,
      ytd-compact-video-renderer,
      ytd-grid-video-renderer,
      ytd-reel-item-renderer,
      yt-lockup-view-model,
      ytm-shorts-lockup-view-model
    `);

    if (!renderer) return null;

    let title, channel, duration, videoId;

    // Check if it's a new-style view model
    if (renderer.tagName.toLowerCase().includes('view-model')) {
      // New YouTube DOM structure (2024+)
      const titleEl = renderer.querySelector('h3, [id*="video-title"], .yt-lockup-metadata-view-model-wiz__title');
      title = titleEl?.textContent?.trim() || titleEl?.getAttribute('title');

      const channelEl = renderer.querySelector('.yt-lockup-metadata-view-model-wiz__metadata a, [id*="channel-name"]');
      channel = channelEl?.textContent?.trim();

      // Duration might be in different places in new structure
      const durationEl = renderer.querySelector('.badge-shape-wiz__text, [class*="time-status"]');
      duration = durationEl?.textContent?.trim();

      // Extract video ID from link
      const linkEl = renderer.querySelector('a[href*="/watch?v="], a[href*="/shorts/"]');
      videoId = extractVideoId(linkEl?.href);
    } else {
      // Old YouTube DOM structure
      const titleEl = renderer.querySelector('#video-title, #video-title-link, h3 a');
      title = titleEl?.textContent?.trim() || titleEl?.getAttribute('title');

      const channelEl = renderer.querySelector('#channel-name #text, ytd-channel-name #text, #channel-name a');
      channel = channelEl?.textContent?.trim();

      const durationEl = renderer.querySelector('ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer');
      duration = durationEl?.textContent?.trim();

      const linkEl = renderer.querySelector('a#thumbnail, a#video-title, a');
      videoId = extractVideoId(linkEl?.href);
    }

    return { title, channel, duration, videoId };
  }

  function replaceThumbnail(thumbnailContainer) {
    if (processedThumbnails.has(thumbnailContainer)) return;
    processedThumbnails.add(thumbnailContainer);

    const videoData = extractVideoData(thumbnailContainer);
    if (!videoData) {
      log('Could not extract video data');
      return;
    }

    log('Processing:', videoData.title?.substring(0, 40));

    // IMPORTANT: Get original image src BEFORE hiding content
    // This is crucial for film/blur modes
    const originalImg = thumbnailContainer.querySelector('img');
    const imgSrc = getThumbnailSrc(originalImg, videoData.videoId);

    // Create appropriate card based on mode
    let card;
    switch (CONFIG.mode) {
      case 'film':
        card = createFilmCard(videoData, imgSrc);
        break;
      case 'solid':
        card = createSolidCard(videoData, imgSrc);
        break;
      case 'text':
      default:
        card = createTextCard(videoData);
        break;
    }

    // Replace thumbnail content
    // Keep the container for layout, just swap contents
    thumbnailContainer.style.position = 'relative';

    // Hide original content
    Array.from(thumbnailContainer.children).forEach(child => {
      if (!child.classList.contains('veil-card')) {
        child.style.visibility = 'hidden';
      }
    });

    // Insert card
    thumbnailContainer.appendChild(card);
  }

  // ============================================
  // DOM SCANNING
  // ============================================

  function scanForThumbnails() {
    if (!CONFIG.enabled) return;

    // Target thumbnail containers - both old and new YouTube DOM structures
    const selectors = [
      'ytd-thumbnail:not([veil-processed])',
      '#thumbnail:not([veil-processed])',
      // New YouTube DOM structure (2024+)
      'yt-thumbnail-view-model:not([veil-processed])'
    ];

    const thumbnails = document.querySelectorAll(selectors.join(', '));

    thumbnails.forEach(thumbnail => {
      thumbnail.setAttribute('veil-processed', 'true');
      replaceThumbnail(thumbnail);
    });

    if (thumbnails.length > 0) {
      log(`Processed ${thumbnails.length} thumbnails`);
    }
  }

  // ============================================
  // AVATAR REPLACEMENT
  // ============================================

  function createAvatarReplacement(channelName, size) {
    const avatar = document.createElement('div');
    avatar.className = 'veil-avatar';
    avatar.textContent = getInitials(channelName);
    avatar.style.backgroundColor = hashToAvatarColor(channelName);
    avatar.style.width = size + 'px';
    avatar.style.height = size + 'px';
    avatar.style.fontSize = Math.max(10, size * 0.4) + 'px';
    return avatar;
  }

  function replaceAvatar(avatarImg) {
    if (processedAvatars.has(avatarImg)) return;
    processedAvatars.add(avatarImg);

    let channelName = null;

    // Strategy 1: Check aria-label on .yt-spec-avatar-shape parent (most reliable for modern YouTube)
    // The aria-label is formatted as "Go to channel [Channel Name]"
    const avatarShape = avatarImg.closest('.yt-spec-avatar-shape');
    if (avatarShape) {
      const ariaLabel = avatarShape.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.startsWith('Go to channel ')) {
        channelName = ariaLabel.replace('Go to channel ', '').trim();
      }
    }

    // Strategy 2: Look for channel link with @handle in the video renderer
    if (!channelName) {
      const renderer = avatarImg.closest(`
        ytd-rich-item-renderer,
        ytd-video-renderer,
        ytd-compact-video-renderer,
        ytd-grid-video-renderer,
        yt-lockup-view-model,
        ytd-video-owner-renderer,
        ytd-comment-renderer
      `);

      if (renderer) {
        // First try the @handle link which is most reliable
        const handleLink = renderer.querySelector('a[href^="/@"]');
        if (handleLink?.textContent?.trim()) {
          channelName = handleLink.textContent.trim();
        }

        // Fallback to other channel name selectors
        if (!channelName) {
          const channelSelectors = [
            'yt-formatted-string.ytd-channel-name',
            '#channel-name yt-formatted-string',
            '#channel-name #text',
            'ytd-channel-name #text',
            '#text.ytd-channel-name',
            '#owner-text a',
            '#author-text span',
            '#author-text'
          ];

          for (const selector of channelSelectors) {
            const el = renderer.querySelector(selector);
            if (el?.textContent?.trim()) {
              channelName = el.textContent.trim();
              break;
            }
          }
        }
      }
    }

    // Strategy 3: Check parent containers for aria-label or title
    if (!channelName) {
      const container = avatarImg.closest('a, yt-decorated-avatar-view-model, yt-avatar-shape');
      if (container) {
        const label = container.getAttribute('aria-label') || container.getAttribute('title');
        if (label) {
          // Handle "Go to channel X" format
          channelName = label.startsWith('Go to channel ')
            ? label.replace('Go to channel ', '').trim()
            : label;
        }
      }
    }

    // Strategy 4: Fallback to image alt attribute
    if (!channelName) {
      const alt = avatarImg.getAttribute('alt');
      if (alt && alt.trim()) {
        channelName = alt.trim();
      }
    }

    log('Avatar channel name found:', channelName || 'none');

    // Get size from original image
    const size = avatarImg.offsetWidth || avatarImg.width || 40;

    // Create replacement
    const replacement = createAvatarReplacement(channelName, size);

    // Replace the image
    const parent = avatarImg.parentElement;
    if (parent) {
      parent.style.position = 'relative';
      avatarImg.style.visibility = 'hidden';
      avatarImg.style.position = 'absolute';
      parent.appendChild(replacement);
      log('Replaced avatar for:', channelName || 'unknown');
    }
  }

  function scanForAvatars() {
    if (!CONFIG.enabled || !CONFIG.hideChannelAvatars) return;

    // Target avatar images throughout YouTube
    // Includes both classic (ytd-*) and modern (yt-*-view-model) DOM structures
    const selectors = [
      // Classic structure (search results, watch page, older layouts)
      '#avatar-link img:not([veil-avatar-processed])',
      'yt-img-shadow.ytd-channel-name img:not([veil-avatar-processed])',
      '#owner-thumbnail img:not([veil-avatar-processed])',
      '#author-thumbnail img:not([veil-avatar-processed])',
      'ytd-author-comment-badge-renderer img:not([veil-avatar-processed])',
      '#avatar img:not([veil-avatar-processed])',
      'a.ytd-comment-renderer yt-img-shadow img:not([veil-avatar-processed])',
      '#channel-thumbnail img:not([veil-avatar-processed])',
      // Modern structure (home feed, 2024+ layouts)
      'yt-avatar-shape img:not([veil-avatar-processed])',
      'yt-decorated-avatar-view-model img:not([veil-avatar-processed])',
      '.yt-spec-avatar-shape__image:not([veil-avatar-processed])'
    ];

    const avatars = document.querySelectorAll(selectors.join(', '));

    avatars.forEach(avatar => {
      avatar.setAttribute('veil-avatar-processed', 'true');
      replaceAvatar(avatar);
    });

    if (avatars.length > 0) {
      log(`Processed ${avatars.length} avatars`);
    }
  }

  // ============================================
  // OBSERVER
  // ============================================

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        clearTimeout(setupObserver.timeout);
        setupObserver.timeout = setTimeout(() => {
          scanForThumbnails();
          scanForAvatars();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    log('Observer initialized');
  }

  // ============================================
  // CONFIG MANAGEMENT
  // ============================================

  async function loadConfig() {
    try {
      const data = await chrome.storage.sync.get([
        'enabled', 'mode', 'font',
        'showChannel', 'showDuration', 'showNoise', 'accentFromHash', 'hideChannelAvatars'
      ]);

      if (data.enabled !== undefined) CONFIG.enabled = data.enabled;
      if (data.mode) CONFIG.mode = data.mode;
      if (data.font) CONFIG.font = data.font;
      if (data.showChannel !== undefined) CONFIG.showChannel = data.showChannel;
      if (data.showDuration !== undefined) CONFIG.showDuration = data.showDuration;
      if (data.showNoise !== undefined) CONFIG.showNoise = data.showNoise;
      if (data.accentFromHash !== undefined) CONFIG.accentFromHash = data.accentFromHash;
      if (data.hideChannelAvatars !== undefined) CONFIG.hideChannelAvatars = data.hideChannelAvatars;

      log('Config loaded:', CONFIG);
    } catch (e) {
      log('Error loading config:', e);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      // Reload page to apply new settings
      // TODO: Implement live update without reload
      if (changes.enabled || changes.mode || changes.font || changes.hideChannelAvatars) {
        window.location.reload();
      }
    }
  });

  // ============================================
  // HELPERS
  // ============================================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async function init() {
    log('Initializing Veil...');

    await loadConfig();

    if (!CONFIG.enabled) {
      log('Extension disabled');
      return;
    }

    // Initial scan
    scanForThumbnails();
    scanForAvatars();

    // Watch for new content
    setupObserver();

    log('Veil active');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
