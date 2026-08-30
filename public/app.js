/**
 * Search Engine — Frontend Application
 * 
 * Features:
 * - View routing (landing / results / index / stats)
 * - HTML5 History & Hash Navigation (Browser Back / Forward buttons work!)
 * - Search API integration with BM25 score rendering & Query Highlighting
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
    totalPages: 1,
    totalResults: 0
};


// ============================================
// VIEW & ROUTING ENGINE
// ============================================

function showView(viewId, updateHistory = true, query = '', page = 1, limit = 10) {
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
            hash = `search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
        }
        if (window.location.hash !== `#${hash}`) {
            history.pushState({ viewId, query, page, limit }, '', `#${hash}`);
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

    if (hash.startsWith('search') || searchParam) {
        const q = searchParam || decodeURIComponent(hash.split('q=')[1]?.split('&')[0] || '');
        if (q) {
            performSearch(q, pageParam, limitParam, updateHistory);
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
// SEARCH & PAGINATION
// ============================================

async function performSearch(query, page = 1, limit = 10, updateHistory = true) {
    if (!query || query.trim() === '') return;

    // Sync state
    currentSearchState.query = query.trim();
    currentSearchState.page = Math.max(1, page);
    currentSearchState.limit = limit;

    // Switch to results view
    showView('results-view', updateHistory, query, currentSearchState.page, currentSearchState.limit);

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

    resultsList.innerHTML = '';
    resultsEmpty.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    resultsLoading.classList.remove('hidden');
    resultsInfo.textContent = '';

    try {
        const response = await fetch(
            `${API_BASE}/api/search?q=${encodeURIComponent(query)}&topK=50&page=${currentSearchState.page}&limit=${currentSearchState.limit}`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        resultsLoading.classList.add('hidden');

        currentSearchState.totalPages = data.totalPages || 1;
        currentSearchState.totalResults = data.totalResults || 0;
        currentSearchState.page = data.page || 1;

        if (data.results && data.results.length > 0) {
            const pageStr = data.totalPages > 1 ? ` (Page ${data.page} of ${data.totalPages})` : '';
            resultsInfo.textContent = `About ${data.totalResults} result${data.totalResults !== 1 ? 's' : ''} for "${data.query}"${pageStr}`;

            renderResults(data.results, query);
            renderPagination(data.page, data.totalPages);
        } else {
            resultsEmpty.classList.remove('hidden');
            resultsInfo.textContent = `No results for "${data.query}"`;
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

function highlightQuery(text, query) {
    if (!text) return '';
    const safeText = escapeHtml(text);
    if (!query || !query.trim()) return safeText;

    const terms = query.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
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
            <div class="result-url">
                <span class="result-url-favicon">${faviconLetter}</span>
                ${escapeHtml(displayUrl)}
            </div>
            <div class="result-title" onclick="window.open('${escapeAttr(url)}', '_blank')">${highlightedTitle}</div>
            <div class="result-snippet">${highlightedSnippet}</div>
            <div class="result-score">
                <span class="result-score-dot"></span>
                Score: ${score}
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
                performSearch(currentSearchState.query, p, currentSearchState.limit, true);
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
            performSearch(currentSearchState.query, currentSearchState.page - 1, currentSearchState.limit, true);
        }
    });
}

const nextBtn = document.getElementById('next-page-btn');
if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        if (currentSearchState.page < currentSearchState.totalPages) {
            performSearch(currentSearchState.query, currentSearchState.page + 1, currentSearchState.limit, true);
        }
    });
}

const limitSelect = document.getElementById('limit-select');
if (limitSelect) {
    limitSelect.addEventListener('change', (e) => {
        const newLimit = parseInt(e.target.value, 10) || 10;
        performSearch(currentSearchState.query, 1, newLimit, true);
    });
}


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
        performSearch(query, 1, currentSearchState.limit, true);
    });
}

// Results search form (re-search)
const resultsForm = document.getElementById('results-search-form');
if (resultsForm) {
    resultsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('results-search-input').value.trim();
        performSearch(query, 1, currentSearchState.limit, true);
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
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}


// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
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

    // Escape goes home
    if (e.key === 'Escape') {
        showView('landing-view');
        const input = document.getElementById('landing-search-input');
        if (input) input.focus();
    }
});


// ============================================
// INIT
// ============================================

window.addEventListener('load', () => {
    handleUrlRouting(false);
});
