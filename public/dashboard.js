// Dashboard Application State
let charts = [];
let selectedTemplate = 'blank';
let chartToDelete = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadCharts();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Template selection
  document.querySelectorAll('.template-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.template-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedTemplate = option.dataset.template;
    });
  });

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      const grid = document.getElementById('chartsGrid');
      if (view === 'list') {
        grid.style.gridTemplateColumns = '1fr';
      } else {
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
      }
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.chart-menu')) {
      document.querySelectorAll('.chart-menu-dropdown').forEach(d => d.classList.remove('show'));
    }
  });

  // Enter key to submit
  document.getElementById('chartTitle').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitCreateChart();
    }
  });
}

// Load charts from Firestore
async function loadCharts() {
  try {
    const snapshot = await db.collection('boards').orderBy('updatedAt', 'desc').get();
    charts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    renderCharts();
    updateStats();
  } catch (error) {
    console.error('Error loading charts:', error);
    showToast('Failed to load charts', 'error');
  }
}

// Render charts grid
function renderCharts() {
  const grid = document.getElementById('chartsGrid');
  
  if (charts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </div>
        <h3>No org charts yet</h3>
        <p>Create your first organizational chart to get started visualizing your team structure.</p>
        <button class="btn btn-primary" onclick="createNewChart()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create Your First Chart
        </button>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = charts.map(chart => {
    const nodeCount = chart.snapshot?.nodes ? Object.keys(chart.snapshot.nodes).length : 0;
    const updatedAt = chart.updatedAt?.toDate ? formatDate(chart.updatedAt.toDate()) : 'Unknown';
    const rootNode = findRootNode(chart.snapshot?.nodes);
    
    return `
      <div class="chart-card" onclick="openChart('${chart.id}')">
        <div class="chart-preview">
          ${renderMiniPreview(chart.snapshot?.nodes)}
        </div>
        <div class="chart-info">
          <div class="chart-title">
            <span>${escapeHtml(chart.title || 'Untitled Chart')}</span>
            <div class="chart-menu" onclick="event.stopPropagation()">
              <button class="chart-menu-btn" onclick="toggleMenu(event, '${chart.id}')" aria-label="Chart options">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
              <div class="chart-menu-dropdown" id="menu-${chart.id}">
                <div class="menu-item" onclick="openChart('${chart.id}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit Chart
                </div>
                <div class="menu-item" onclick="duplicateChart('${chart.id}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Duplicate
                </div>
                <div class="menu-item danger" onclick="deleteChart('${chart.id}', '${escapeHtml(chart.title)}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete
                </div>
              </div>
            </div>
          </div>
          <div class="chart-meta">
            <span class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
              </svg>
              ${nodeCount} nodes
            </span>
            <span class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              ${updatedAt}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render mini preview of org chart
function renderMiniPreview(nodes) {
  if (!nodes || Object.keys(nodes).length === 0) {
    return `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    `;
  }
  
  const nodeArray = Object.values(nodes);
  const rootNode = nodeArray.find(n => !n.parentId);
  const level1Nodes = nodeArray.filter(n => n.parentId === rootNode?.id).slice(0, 3);
  
  return `
    <div class="chart-preview-mini">
      <div class="preview-node">${escapeHtml(rootNode?.content?.name || 'Root')}</div>
      <div class="preview-line"></div>
      <div class="preview-children">
        ${level1Nodes.map(n => `
          <div class="preview-branch">
            <div class="preview-node level-1">${escapeHtml(n.content?.name?.split(' ')[0] || 'Node')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Update dashboard stats
function updateStats() {
  const totalCharts = charts.length;
  const totalNodes = charts.reduce((sum, chart) => {
    return sum + (chart.snapshot?.nodes ? Object.keys(chart.snapshot.nodes).length : 0);
  }, 0);
  
  const latestUpdate = charts.length > 0 && charts[0].updatedAt?.toDate
    ? formatRelativeDate(charts[0].updatedAt.toDate())
    : '-';
  
  document.getElementById('totalCharts').textContent = totalCharts;
  document.getElementById('totalNodes').textContent = totalNodes;
  document.getElementById('lastUpdated').textContent = latestUpdate;
}

// Find root node
function findRootNode(nodes) {
  if (!nodes) return null;
  return Object.values(nodes).find(n => !n.parentId);
}

// Open chart for editing
function openChart(chartId) {
  window.location.href = `/chart.html?id=${chartId}`;
}

// Create new chart
function createNewChart() {
  document.getElementById('createModal').classList.add('show');
  document.getElementById('chartTitle').value = '';
  document.getElementById('chartTitle').focus();
}

// Close modal
function closeModal() {
  document.getElementById('createModal').classList.remove('show');
}

// Submit create chart
async function submitCreateChart() {
  const title = document.getElementById('chartTitle').value.trim() || 'Untitled Org Chart';
  
  closeModal();
  
  try {
    const chartData = createChartFromTemplate(title, selectedTemplate);
    
    const docRef = await db.collection('boards').add(chartData);
    
    showToast('Chart created successfully!', 'success');
    
    // Navigate to the new chart
    window.location.href = `/chart.html?id=${docRef.id}`;
  } catch (error) {
    console.error('Error creating chart:', error);
    showToast('Failed to create chart', 'error');
  }
}

// Create chart data from template
function createChartFromTemplate(title, template) {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  
  const baseChart = {
    title,
    ownerId: 'user-' + Math.random().toString(36).substr(2, 9),
    createdAt: now,
    updatedAt: now,
    version: 1,
    snapshot: {
      meta: {
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      nodes: {}
    }
  };
  
  if (template === 'startup') {
    baseChart.snapshot.nodes = {
      'node-1': {
        id: 'node-1',
        parentId: null,
        pos: { x: 400, y: 80 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'CEO / Founder',
          title: 'Chief Executive Officer',
          department: 'Executive'
        }
      },
      'node-2': {
        id: 'node-2',
        parentId: 'node-1',
        pos: { x: 200, y: 220 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'CTO',
          title: 'Chief Technology Officer',
          department: 'Technology'
        }
      },
      'node-3': {
        id: 'node-3',
        parentId: 'node-1',
        pos: { x: 600, y: 220 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Head of Product',
          title: 'Product Lead',
          department: 'Product'
        }
      },
      'node-4': {
        id: 'node-4',
        parentId: 'node-2',
        pos: { x: 100, y: 360 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Lead Developer',
          title: 'Senior Engineer',
          department: 'Engineering'
        }
      },
      'node-5': {
        id: 'node-5',
        parentId: 'node-2',
        pos: { x: 300, y: 360 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Designer',
          title: 'UX/UI Designer',
          department: 'Design'
        }
      }
    };
  } else if (template === 'enterprise') {
    baseChart.snapshot.nodes = {
      'node-1': {
        id: 'node-1',
        parentId: null,
        pos: { x: 500, y: 60 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Chief Executive Officer',
          title: 'CEO',
          department: 'Executive'
        }
      },
      'node-2': {
        id: 'node-2',
        parentId: 'node-1',
        pos: { x: 150, y: 200 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Chief Technology Officer',
          title: 'CTO',
          department: 'Technology'
        }
      },
      'node-3': {
        id: 'node-3',
        parentId: 'node-1',
        pos: { x: 400, y: 200 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Chief Financial Officer',
          title: 'CFO',
          department: 'Finance'
        }
      },
      'node-4': {
        id: 'node-4',
        parentId: 'node-1',
        pos: { x: 650, y: 200 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Chief Operating Officer',
          title: 'COO',
          department: 'Operations'
        }
      },
      'node-5': {
        id: 'node-5',
        parentId: 'node-1',
        pos: { x: 900, y: 200 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Chief Marketing Officer',
          title: 'CMO',
          department: 'Marketing'
        }
      },
      'node-6': {
        id: 'node-6',
        parentId: 'node-2',
        pos: { x: 50, y: 340 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'VP Engineering',
          title: 'Vice President',
          department: 'Engineering'
        }
      },
      'node-7': {
        id: 'node-7',
        parentId: 'node-2',
        pos: { x: 250, y: 340 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'VP Product',
          title: 'Vice President',
          department: 'Product'
        }
      },
      'node-8': {
        id: 'node-8',
        parentId: 'node-3',
        pos: { x: 400, y: 340 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Finance Director',
          title: 'Director',
          department: 'Finance'
        }
      },
      'node-9': {
        id: 'node-9',
        parentId: 'node-4',
        pos: { x: 650, y: 340 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'HR Director',
          title: 'Director',
          department: 'Human Resources'
        }
      },
      'node-10': {
        id: 'node-10',
        parentId: 'node-5',
        pos: { x: 900, y: 340 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Marketing Director',
          title: 'Director',
          department: 'Marketing'
        }
      }
    };
  } else {
    // Blank template - just one root node
    baseChart.snapshot.nodes = {
      'node-1': {
        id: 'node-1',
        parentId: null,
        pos: { x: 400, y: 100 },
        size: { w: 180, h: 80 },
        manualPosition: false,
        content: {
          name: 'Root Node',
          title: 'Click to edit',
          department: ''
        }
      }
    };
  }
  
  return baseChart;
}

// Toggle menu dropdown
function toggleMenu(event, chartId) {
  event.stopPropagation();
  
  // Close all other menus
  document.querySelectorAll('.chart-menu-dropdown').forEach(d => {
    if (d.id !== `menu-${chartId}`) {
      d.classList.remove('show');
    }
  });
  
  const menu = document.getElementById(`menu-${chartId}`);
  menu.classList.toggle('show');
}

// Duplicate chart
async function duplicateChart(chartId) {
  const chart = charts.find(c => c.id === chartId);
  if (!chart) return;
  
  try {
    const newChart = {
      ...chart,
      title: `${chart.title} (Copy)`,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      version: 1
    };
    delete newChart.id;
    
    await db.collection('boards').add(newChart);
    
    showToast('Chart duplicated successfully!', 'success');
    loadCharts();
  } catch (error) {
    console.error('Error duplicating chart:', error);
    showToast('Failed to duplicate chart', 'error');
  }
}

// Delete chart - show confirmation
function deleteChart(chartId, chartTitle) {
  chartToDelete = chartId;
  document.getElementById('deleteChartName').textContent = chartTitle;
  document.getElementById('deleteModal').classList.add('show');
}

// Close delete modal
function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('show');
  chartToDelete = null;
}

// Confirm delete
async function confirmDelete() {
  if (!chartToDelete) return;
  
  closeDeleteModal();
  
  try {
    await db.collection('boards').doc(chartToDelete).delete();
    
    showToast('Chart deleted successfully!', 'success');
    loadCharts();
  } catch (error) {
    console.error('Error deleting chart:', error);
    showToast('Failed to delete chart', 'error');
  }
}

// Helper: Format date
function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper: Format relative date
function formatRelativeDate(date) {
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' 
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
        : type === 'error'
        ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
        : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
      }
    </svg>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
