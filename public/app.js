/**
 * Search Engine — Frontend Application
 * 
 * Features:
 * - View routing (landing / results / index / stats)
 * - HTML5 History & Hash Navigation (Browser Back / Forward buttons work!)
 * - Search API integration with BM25 score rendering & Query Highlighting
 * - Real-time Autocompletion & Search Suggestions via Trie Prefix Index
 * - Domain Facets & Filtering Pills (e.g. wikipedia.org, geeksforgeeks.org)
 * - Pagination & Dynamic Top-K / Results-per-page selector
 * - Single-Page & Recursive Web Crawling with Live Progress/Summary
 * - Index statistics with animated counters
 * - Keyboard shortcuts ("/" to focus search, "Escape" to go home)
 */

const API_BASE = '';  // Same origin — Express serves static files

let currentSearchState = {
    query: '',
    page: 1,
    limit: 10,
    topK: 50,
    domain: 'all',
    totalPages: 1,
    totalResults: 0
};


// ============================================
// VIEW & ROUTING ENGINE
// ============================================

function showView(viewId, updateHistory = true, query = '', page = 1, limit = 10, domain = 'all') {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });

    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');

        // Re-trigger CSS animation
        target.style.animation = 'none';
        target.offsetHeight; // force reflow
        target.style.animation = '';
    }

    // Update browser history/hash for Back/Forward UX
    if (updateHistory) {
        let hash = viewId.replace('-view', '');
        if (viewId === 'results-view' && query) {
            hash = `search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&domain=${encodeURIComponent(domain)}`;
        }
        if (window.location.hash !== `#${hash}`) {
            history.pushState({ viewId, query, page, limit, domain }, '', `#${hash}`);
        }
    }
}

// Global navigation button delegation
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (btn) {
        const viewId = btn.getAttribute('data-view');
        showView(viewId);

        if (viewId === 'stats-view') {
            loadStats();
        } else if (viewId === 'landing-view') {
            setTimeout(() => {
                const input = document.getElementById('landing-search-input');
                if (input) input.focus();
            }, 100);
        }
    }
});

// Handle Browser Back / Forward buttons (Popstate)
window.addEventListener('popstate', (e) => {
    handleUrlRouting(false);
});

function handleUrlRouting(updateHistory = false) {
    const hash = window.location.hash.replace('#', '');
    const urlParams = new URLSearchParams(window.location.search || (hash.includes('?') ? hash.substring(hash.indexOf('?')) : ''));
    const searchParam = urlParams.get('q');
    const pageParam = parseInt(urlParams.get('page'), 10) || 1;
    const limitParam = parseInt(urlParams.get('limit'), 10) || 10;
    const domainParam = urlParams.get('domain') || 'all';

    if (hash.startsWith('search') || searchParam) {
        const q = searchParam || decodeURIComponent(hash.split('q=')[1]?.split('&')[0] || '');
        if (q) {
            performSearch(q, pageParam, limitParam, domainParam, updateHistory);
            return;
        }
    }

    if (hash === 'index' || hash === 'index-view') {
        showView('index-view', updateHistory);
    } else if (hash === 'stats' || hash === 'stats-view') {
        showView('stats-view', updateHistory);
        loadStats();
    } else {
        showView('landing-view', updateHistory);
    }
}


// ============================================
// SEARCH, FACETS & PAGINATION
// ============================================

async function performSearch(query, page = 1, limit = 10, domain = 'all', updateHistory = true) {
    if (!query || query.trim() === '') return;

    // Close any open suggestion dropdowns
    document.querySelectorAll('.suggestions-dropdown').forEach(d => d.classList.add('hidden'));

    // Sync state
    currentSearchState.query = query.trim();
    currentSearchState.page = Math.max(1, page);
    currentSearchState.limit = limit;
    currentSearchState.domain = domain || 'all';

    // Switch to results view
    showView('results-view', updateHistory, query, currentSearchState.page, currentSearchState.limit, currentSearchState.domain);

    // Sync input fields & select dropdown
    const resultsInput = document.getElementById('results-search-input');
    const landingInput = document.getElementById('landing-search-input');
    const limitSelect = document.getElementById('limit-select');

    if (resultsInput) resultsInput.value = query;
    if (landingInput) landingInput.value = query;
    if (limitSelect) limitSelect.value = String(currentSearchState.limit);

    // Show loading
    const resultsList = document.getElementById('results-list');
    const resultsEmpty = document.getElementById('results-empty');
    const resultsLoading = document.getElementById('results-loading');
    const resultsInfo = document.getElementById('results-info');
    const paginationContainer = document.getElementById('pagination-container');
    const facetsContainer = document.getElementById('facets-container');

    resultsList.innerHTML = '';
    resultsEmpty.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    if (facetsContainer) facetsContainer.classList.add('hidden');
    resultsLoading.classList.remove('hidden');
    resultsInfo.textContent = '';

    try {
        const response = await fetch(
            `${API_BASE}/api/search?q=${encodeURIComponent(query)}&topK=50&page=${currentSearchState.page}&limit=${currentSearchState.limit}&domain=${encodeURIComponent(currentSearchState.domain)}`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        resultsLoading.classList.add('hidden');

        currentSearchState.totalPages = data.totalPages || 1;
        currentSearchState.totalResults = data.totalResults || 0;
        currentSearchState.page = data.page || 1;
        currentSearchState.domain = data.activeDomain || 'all';

        if (data.results && data.results.length > 0) {
            const pageStr = data.totalPages > 1 ? ` (Page ${data.page} of ${data.totalPages})` : '';
            const domainFilterStr = currentSearchState.domain !== 'all' ? ` in ${currentSearchState.domain}` : '';
            resultsInfo.textContent = `About ${data.totalResults} result${data.totalResults !== 1 ? 's' : ''} for "${data.query}"${domainFilterStr}${pageStr}`;

            renderFacets(data.facets, currentSearchState.domain);
            renderResults(data.results, query);
            renderPagination(data.page, data.totalPages);
        } else {
            resultsEmpty.classList.remove('hidden');
            const domainFilterStr = currentSearchState.domain !== 'all' ? ` in ${currentSearchState.domain}` : '';
            resultsInfo.textContent = `No results for "${data.query}"${domainFilterStr}`;
            renderFacets(data.facets, currentSearchState.domain);
        }

    } catch (error) {
        resultsLoading.classList.add('hidden');
        resultsList.innerHTML = `
            <div class="results-empty">
                <p>Something went wrong</p>
                <span>${error.message}</span>
            </div>
        `;
    }
}

function renderFacets(facets, activeDomain = 'all') {
    const container = document.getElementById('facets-container');
    if (!container || !facets || facets.length <= 1) {
        if (container) container.classList.add('hidden');
        return;
    }

    container.innerHTML = '';
    container.classList.remove('hidden');

    facets.forEach(f => {
        const pill = document.createElement('button');
        const isActive = (f.domain === activeDomain) || (!activeDomain && f.domain === 'all');
        pill.className = `facet-pill ${isActive ? 'active' : ''}`;

        const label = f.domain === 'all' ? 'All' : f.domain;
        pill.innerHTML = `
            <span>${escapeHtml(label)}</span>
            <span class="facet-count">(${f.count})</span>
        `;

        pill.addEventListener('click', () => {
            performSearch(currentSearchState.query, 1, currentSearchState.limit, f.domain, true);
        });

        container.appendChild(pill);
    });
}

function highlightQuery(text, query) {
    if (!text) return '';
    const safeText = escapeHtml(text);
    if (!query || !query.trim()) return safeText;

    const terms = query.trim().toLowerCase().replace(/"/g, '').split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return safeText;

    // Escape regex special characters
    const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

    return safeText.replace(regex, '<mark class="highlight">$1</mark>');
}

function renderResults(results, query = '') {
    const container = document.getElementById('results-list');
    container.innerHTML = '';

    results.forEach((result, i) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.animationDelay = `${i * 0.06}s`;

        const rawTitle = result.title || result.documentId;
        const url = result.documentId;
        const rawSnippet = result.snippet || 'No preview available';
        const score = Number(result.score).toFixed(3);

        const highlightedTitle = highlightQuery(rawTitle, query);
        const highlightedSnippet = highlightQuery(rawSnippet, query);

        // Extract domain for display
        let displayUrl = url;
        try {
            const urlObj = new URL(url);
            displayUrl = urlObj.hostname + urlObj.pathname;
        } catch (_) {
            // Not a valid URL, use as-is
        }

        // Get first letter for favicon placeholder
        let faviconLetter = '?';
        try {
            faviconLetter = new URL(url).hostname.charAt(0).toUpperCase();
        } catch (_) {
            faviconLetter = url.charAt(0).toUpperCase();
        }

        card.innerHTML = `
            <div class="result-header-row">
                <a class="result-url" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Visit ${escapeAttr(url)}">
                    <span class="result-url-favicon">${faviconLetter}</span>
                    <span class="result-url-text">${escapeHtml(displayUrl)}</span>
                </a>
            </div>
            <a class="result-title" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Open ${escapeAttr(url)} in new tab">
                ${highlightedTitle}
            </a>
            <div class="result-snippet">${highlightedSnippet}</div>
            <div class="result-footer">
                <div class="result-score">
                    <span class="result-score-dot"></span>
                    Score: ${score}
                </div>
                <div class="result-actions">
                    <a class="result-action-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Visit original web page in a new tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Visit Page ↗
                    </a>
                    <button type="button" class="result-action-btn view-cached-btn" data-url="${escapeAttr(url)}" title="View page snapshot stored in search engine database">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        Cached View
                    </button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function renderPagination(currentPage, totalPages) {
    const paginationContainer = document.getElementById('pagination-container');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const numbersContainer = document.getElementById('pagination-numbers');

    if (!paginationContainer || totalPages <= 1) {
        if (paginationContainer) paginationContainer.classList.add('hidden');
        return;
    }

    paginationContainer.classList.remove('hidden');

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    if (numbersContainer) {
        numbersContainer.innerHTML = '';

        for (let p = 1; p <= totalPages; p++) {
            const numBtn = document.createElement('button');
            numBtn.className = `page-num-btn ${p === currentPage ? 'active' : ''}`;
            numBtn.textContent = p;
            numBtn.addEventListener('click', () => {
                performSearch(currentSearchState.query, p, currentSearchState.limit, currentSearchState.domain, true);
            });
            numbersContainer.appendChild(numBtn);
        }
    }
}

// Pagination & Limit Event Listeners
const prevBtn = document.getElementById('prev-page-btn');
if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        if (currentSearchState.page > 1) {
            performSearch(currentSearchState.query, currentSearchState.page - 1, currentSearchState.limit, currentSearchState.domain, true);
        }
    });
}

const nextBtn = document.getElementById('next-page-btn');
if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        if (currentSearchState.page < currentSearchState.totalPages) {
            performSearch(currentSearchState.query, currentSearchState.page + 1, currentSearchState.limit, currentSearchState.domain, true);
        }
    });
}

const limitSelect = document.getElementById('limit-select');
if (limitSelect) {
    limitSelect.addEventListener('change', (e) => {
        const newLimit = parseInt(e.target.value, 10) || 10;
        performSearch(currentSearchState.query, 1, newLimit, currentSearchState.domain, true);
    });
}


// ============================================
// AUTOCOMPLETE & SEARCH SUGGESTIONS
// ============================================

function setupAutocomplete(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();

        if (!query || query.length < 2) {
            dropdown.innerHTML = '';
            dropdown.classList.add('hidden');
            return;
        }

        const words = query.split(/\s+/);
        const lastWord = words[words.length - 1];

        if (!lastWord || lastWord.length < 2) {
            dropdown.innerHTML = '';
            dropdown.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(lastWord)}&limit=5`);
                const data = await res.json();

                if (data.suggestions && data.suggestions.length > 0) {
                    dropdown.innerHTML = '';

                    data.suggestions.forEach(suggestion => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';

                        const prefixWords = words.slice(0, words.length - 1);
                        const fullQuery = [...prefixWords, suggestion].join(' ');

                        item.innerHTML = `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                            <span>${escapeHtml(fullQuery)}</span>
                        `;

                        item.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            input.value = fullQuery;
                            dropdown.classList.add('hidden');
                            performSearch(fullQuery, 1, currentSearchState.limit, currentSearchState.domain, true);
                        });

                        dropdown.appendChild(item);
                    });

                    dropdown.classList.remove('hidden');
                } else {
                    dropdown.classList.add('hidden');
                }
            } catch (_) {
                dropdown.classList.add('hidden');
            }
        }, 150);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    input.addEventListener('focus', () => {
        if (dropdown.children.length > 0 && input.value.trim().length >= 2) {
            dropdown.classList.remove('hidden');
        }
    });
}

setupAutocomplete('landing-search-input', 'landing-suggestions');
setupAutocomplete('results-search-input', 'results-suggestions');


// ============================================
// INDEX URL (Single Page & Recursive Crawling)
// ============================================

const indexForm = document.getElementById('index-form');
const indexResult = document.getElementById('index-result');
const indexLoading = document.getElementById('index-loading');
const indexSubmitBtn = document.getElementById('index-submit-btn');

const recursiveToggle = document.getElementById('recursive-toggle');
const recursiveParams = document.getElementById('recursive-params');

if (recursiveToggle && recursiveParams) {
    recursiveToggle.addEventListener('change', () => {
        if (recursiveToggle.checked) {
            recursiveParams.classList.remove('hidden');
        } else {
            recursiveParams.classList.add('hidden');
        }
    });
}

if (indexForm) {
    indexForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const urlInput = document.getElementById('url-input');
        const url = urlInput.value.trim();

        if (!url) return;

        const isRecursive = recursiveToggle ? recursiveToggle.checked : false;
        const maxDepth = isRecursive ? (parseInt(document.getElementById('depth-input').value, 10) || 2) : 1;
        const maxPages = isRecursive ? (parseInt(document.getElementById('pages-input').value, 10) || 10) : 1;

        indexResult.classList.add('hidden');
        indexLoading.classList.remove('hidden');
        indexSubmitBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/api/index`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, maxDepth, maxPages })
            });

            const data = await response.json();

            indexLoading.classList.add('hidden');
            indexSubmitBtn.disabled = false;
            indexResult.classList.remove('hidden');

            if (response.ok && (data.status === 'indexed' || data.summary)) {
                indexResult.className = 'index-result success';

                if (data.summary) {
                    const pagesListHtml = data.indexedPages.map(p => 
                        `<div style="margin-bottom:6px;">• <strong>${escapeHtml(p.title || 'Untitled')}</strong> (Depth ${p.depth}) — ${p.tokensIndexed} tokens<br><span style="opacity:0.75; font-size:11px;">${escapeHtml(p.url)}</span></div>`
                    ).join('');

                    let reasonText = '';
                    if (data.summary.stoppedReason === 'max_pages_reached') {
                        reasonText = ` — Reached Max Pages limit (${data.summary.requestedMaxPages}) at Depth ${data.summary.maxDepthReached} of requested Depth ${data.summary.requestedMaxDepth}`;
                    } else {
                        reasonText = ` — Reached Depth ${data.summary.maxDepthReached} of ${data.summary.requestedMaxDepth}`;
                    }

                    indexResult.innerHTML = `
                        <div class="index-result-title">✓ Recursive Crawl Complete!</div>
                        <div class="index-result-detail">
                            <strong>Indexed ${data.summary.totalPagesIndexed} page(s), skipped ${data.summary.totalPagesSkipped}${reasonText}</strong><br><br>
                            ${pagesListHtml}
                        </div>
                    `;
                } else {
                    indexResult.innerHTML = `
                        <div class="index-result-title">✓ Successfully indexed & persisted!</div>
                        <div class="index-result-detail">
                            <strong>${escapeHtml(data.title || 'Untitled')}</strong><br>
                            ${escapeHtml(data.url)}<br>
                            ${data.tokensIndexed} tokens indexed (${data.childLinksFound || 0} links discovered)
                        </div>
                    `;
                }
                urlInput.value = '';

            } else if (data.status === 'already_indexed') {
                indexResult.className = 'index-result info';
                indexResult.innerHTML = `
                    <div class="index-result-title">ℹ Already indexed</div>
                    <div class="index-result-detail">${escapeHtml(data.message)}</div>
                `;

            } else {
                indexResult.className = 'index-result error';
                indexResult.innerHTML = `
                    <div class="index-result-title">✗ Error</div>
                    <div class="index-result-detail">${escapeHtml(data.error || data.message || 'Unknown error')}</div>
                `;
            }

        } catch (error) {
            indexLoading.classList.add('hidden');
            indexSubmitBtn.disabled = false;
            indexResult.classList.remove('hidden');
            indexResult.className = 'index-result error';
            indexResult.innerHTML = `
                <div class="index-result-title">✗ Connection Error</div>
                <div class="index-result-detail">${escapeHtml(error.message)}</div>
            `;
        }
    });
}


// ============================================
// STATS
// ============================================

async function loadStats() {
    const statsLoading = document.getElementById('stats-loading');
    if (!statsLoading) return;

    statsLoading.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();

        statsLoading.classList.add('hidden');

        animateStatValue('stat-docs-value', data.totalDocuments || 0);
        animateStatValue('stat-terms-value', data.totalTerms || 0);
        animateStatValue('stat-avg-value', Math.round(data.averageDocumentLength || 0));
        animateStatValue('stat-db-value', data.documentsInDatabase || 0);

    } catch (error) {
        statsLoading.classList.add('hidden');
        document.getElementById('stat-docs-value').textContent = '—';
        document.getElementById('stat-terms-value').textContent = '—';
        document.getElementById('stat-avg-value').textContent = '—';
        document.getElementById('stat-db-value').textContent = '—';
    }
}

function animateStatValue(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const duration = 800;
    const startTime = performance.now();
    const startValue = 0;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * eased);

        element.textContent = currentValue.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}


// ============================================
// SEARCH FORM HANDLERS
// ============================================

// Landing search form
const landingForm = document.getElementById('landing-search-form');
if (landingForm) {
    landingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('landing-search-input').value.trim();
        performSearch(query, 1, currentSearchState.limit, currentSearchState.domain, true);
    });
}

// Results search form (re-search)
const resultsForm = document.getElementById('results-search-form');
if (resultsForm) {
    resultsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('results-search-input').value.trim();
        performSearch(query, 1, currentSearchState.limit, currentSearchState.domain, true);
    });
}


// ============================================
// CACHED DOCUMENT PREVIEW MODAL
// ============================================

async function openCachedModal(url) {
    const modal = document.getElementById('cached-modal');
    const titleEl = document.getElementById('modal-doc-title');
    const urlEl = document.getElementById('modal-doc-url');
    const urlText = document.getElementById('modal-url-text');
    const liveLink = document.getElementById('modal-live-link');
    const dateEl = document.getElementById('modal-doc-date');
    const tokensEl = document.getElementById('modal-doc-tokens');
    const contentEl = document.getElementById('modal-content');
    const loadingEl = document.getElementById('modal-loading');

    if (!modal) return;

    modal.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.innerHTML = '';
    if (titleEl) titleEl.textContent = 'Loading...';
    if (urlText) urlText.textContent = url;
    if (urlEl) urlEl.href = url;
    if (liveLink) liveLink.href = url;
    if (dateEl) dateEl.textContent = 'Indexed: ...';
    if (tokensEl) tokensEl.textContent = 'Tokens: ...';

    try {
        const res = await fetch(`${API_BASE}/api/document?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(`Document not found in index (${res.status})`);

        const doc = await res.json();
        if (loadingEl) loadingEl.classList.add('hidden');

        if (titleEl) titleEl.textContent = doc.title || 'Untitled Document';
        if (urlText) urlText.textContent = doc.url || url;
        if (urlEl) urlEl.href = doc.url || url;
        if (liveLink) liveLink.href = doc.url || url;

        if (dateEl) {
            if (doc.indexedAt) {
                const date = new Date(doc.indexedAt);
                dateEl.textContent = `Indexed: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            } else {
                dateEl.textContent = 'Indexed: Recently';
            }
        }

        if (tokensEl) {
            tokensEl.textContent = `${(doc.tokenLength || 0).toLocaleString()} tokens indexed`;
        }

        // Highlight active query keywords in cached text
        const highlightedContent = highlightQuery(doc.content, currentSearchState.query);
        if (contentEl) {
            contentEl.innerHTML = highlightedContent || '<em>(No text content stored)</em>';
        }

    } catch (err) {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Error Loading Document';
        if (contentEl) {
            contentEl.innerHTML = `<p style="color:var(--error);">${escapeHtml(err.message)}</p>`;
        }
    }
}

function closeCachedModal() {
    const modal = document.getElementById('cached-modal');
    if (modal) modal.classList.add('hidden');
}

// Delegate cached view button clicks
document.addEventListener('click', (e) => {
    const cachedBtn = e.target.closest('.view-cached-btn');
    if (cachedBtn) {
        const url = cachedBtn.getAttribute('data-url');
        if (url) openCachedModal(url);
    }
});

// Modal close button
const modalCloseBtn = document.getElementById('modal-close-btn');
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeCachedModal);
}

// Click outside modal card to close
const cachedModalOverlay = document.getElementById('cached-modal');
if (cachedModalOverlay) {
    cachedModalOverlay.addEventListener('click', (e) => {
        if (e.target === cachedModalOverlay) {
            closeCachedModal();
        }
    });
}


// ============================================
// UTILITIES
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}


// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
    // Escape closes modal first, or goes home
    if (e.key === 'Escape') {
        const modal = document.getElementById('cached-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeCachedModal();
            return;
        }

        showView('landing-view');
        const input = document.getElementById('landing-search-input');
        if (input) input.focus();
        return;
    }

    // "/" focuses search input
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();

        const landingView = document.getElementById('landing-view');
        if (landingView && landingView.classList.contains('active')) {
            document.getElementById('landing-search-input').focus();
        } else {
            const resultsView = document.getElementById('results-view');
            if (resultsView && resultsView.classList.contains('active')) {
                document.getElementById('results-search-input').focus();
            }
        }
    }
});


// ============================================
// INIT
// ============================================

window.addEventListener('load', () => {
    handleUrlRouting(false);
});
