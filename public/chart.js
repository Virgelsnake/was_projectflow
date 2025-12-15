// Chart Editor - D3.js with Firebase Persistence
// Implements optimistic updates with debounced saves

// ============================================
// STATE MANAGEMENT
// ============================================
let chartId = null;
let chartData = null;
let nodes = {};
let selectedNode = null;
let deleteMode = false;
let isDragging = false;
let collapsedNodes = new Set(); // Track which nodes have collapsed children

// D3 elements
let svg, g, zoom;
let linkGenerator;

// Save management (debounced for performance)
let saveTimeout = null;
let pendingSave = false;
const SAVE_DELAY = 1000; // 1 second debounce

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Get chart ID from URL
  const params = new URLSearchParams(window.location.search);
  chartId = params.get('id');
  
  if (!chartId) {
    showToast('No chart ID provided', 'error');
    setTimeout(() => window.location.href = '/public/dashboard-refined.html', 2000);
    return;
  }
  
  initializeCanvas();
  loadChart();
  setupEventListeners();
  setupKeyboardShortcuts();
});

// Initialize SVG canvas
function initializeCanvas() {
  const container = document.getElementById('canvasContainer');
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  svg = d3.select('#canvas')
    .attr('width', width)
    .attr('height', height);
  
  // Create zoom behavior
  zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      updateZoomIndicator(event.transform.k);
      updateMinimap();
    });
  
  svg.call(zoom);
  
  // Create main group for content
  g = svg.append('g');
  
  // Link generator for connections
  linkGenerator = d3.linkVertical()
    .x(d => d.x)
    .y(d => d.y);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    svg.attr('width', w).attr('height', h);
  });
}

// ============================================
// DATA LOADING
// ============================================
async function loadChart() {
  try {
    const doc = await db.collection('boards').doc(chartId).get();
    
    if (!doc.exists) {
      showToast('Chart not found', 'error');
      setTimeout(() => window.location.href = '/public/dashboard-refined.html', 2000);
      return;
    }
    
    chartData = { id: doc.id, ...doc.data() };
    nodes = chartData.snapshot?.nodes || {};
    
    // Auto-generate positions for nodes that don't have them
    ensureNodePositions();
    
    // Set title
    document.getElementById('chartTitleInput').value = chartData.title || 'Untitled Chart';
    document.title = `${chartData.title || 'Untitled'} - OrgFlow`;
    
    // Render the chart
    render();
    
    // Hide loading overlay
    document.getElementById('loadingOverlay').classList.add('hidden');
    
    // Fit to screen after short delay
    setTimeout(fitToScreen, 100);
    
  } catch (error) {
    console.error('Error loading chart:', error);
    showToast('Failed to load chart', 'error');
  }
}

// ============================================
// AUTO-LAYOUT FOR NODES WITHOUT POSITIONS
// ============================================
function ensureNodePositions() {
  const nodeArray = Object.values(nodes);
  const needsLayout = nodeArray.some(n => !n.pos);
  
  if (!needsLayout) return;
  
  // Find root node (no parent)
  const rootNode = nodeArray.find(n => !n.parentId);
  if (!rootNode) return;
  
  // Build tree structure
  function getChildren(parentId) {
    return nodeArray.filter(n => n.parentId === parentId);
  }
  
  // Calculate positions using tree layout
  const nodeWidth = 160;
  const nodeHeight = 72;
  const horizontalSpacing = 40;
  const verticalSpacing = 80;
  
  function layoutNode(node, x, y, level) {
    node.pos = { x, y };
    node.size = { w: nodeWidth, h: nodeHeight };
    
    const children = getChildren(node.id);
    if (children.length === 0) return nodeWidth;
    
    // Calculate total width needed for children
    let totalChildWidth = 0;
    const childWidths = [];
    
    children.forEach(child => {
      const width = layoutNode(child, 0, y + nodeHeight + verticalSpacing, level + 1);
      childWidths.push(width);
      totalChildWidth += width;
    });
    
    totalChildWidth += (children.length - 1) * horizontalSpacing;
    
    // Position children centered under parent
    let childX = x - (totalChildWidth - nodeWidth) / 2;
    children.forEach((child, i) => {
      const offsetX = childX - child.pos.x;
      shiftSubtree(child, offsetX);
      childX += childWidths[i] + horizontalSpacing;
    });
    
    return Math.max(nodeWidth, totalChildWidth);
  }
  
  function shiftSubtree(node, offsetX) {
    node.pos.x += offsetX;
    getChildren(node.id).forEach(child => shiftSubtree(child, offsetX));
  }
  
  // Start layout from root
  layoutNode(rootNode, 400, 100, 0);
}

// ============================================
// RENDERING
// ============================================
function render() {
  // Clear existing content
  g.selectAll('*').remove();
  
  // Build hierarchy from nodes (only visible ones)
  const nodeArray = getVisibleNodes();
  if (nodeArray.length === 0) return;
  
  // Create links group (render first so nodes appear on top)
  const linksGroup = g.append('g').attr('class', 'links');
  
  // Create nodes group
  const nodesGroup = g.append('g').attr('class', 'nodes');
  
  // Generate links
  const links = [];
  nodeArray.forEach(node => {
    if (node.parentId && nodes[node.parentId]) {
      const parent = nodes[node.parentId];
      // Skip if either node is missing position data
      if (!parent.pos || !node.pos) return;
      links.push({
        source: { x: parent.pos.x + 80, y: parent.pos.y + 36 },
        target: { x: node.pos.x + 80, y: node.pos.y }
      });
    }
  });
  
  // Render links
  linksGroup.selectAll('path.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d => linkGenerator(d));
  
  // Filter out nodes without position data
  const validNodes = nodeArray.filter(n => n.pos);
  
  // Render nodes
  const nodeGroups = nodesGroup.selectAll('g.node')
    .data(validNodes, d => d.id)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('data-id', d => d.id)
    .attr('transform', d => `translate(${d.pos.x}, ${d.pos.y})`)
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded)
    )
    .on('click', handleNodeClick)
    .on('dblclick', handleNodeDoubleClick)
    .on('mouseover', showNodeTooltip)
    .on('mouseout', hideNodeTooltip);
  
  // Node background - Refined styling
  nodeGroups.append('rect')
    .attr('class', 'node-rect')
    .attr('width', d => d.size?.w || 160)
    .attr('height', d => d.size?.h || 72)
    .attr('rx', 12)
    .attr('ry', 12)
    .attr('fill', d => d.content?.color || '#2E90FA')
    .attr('stroke', 'rgba(255,255,255,0.2)')
    .attr('stroke-width', 1)
    .style('filter', 'drop-shadow(0 2px 4px rgba(16, 24, 40, 0.06)) drop-shadow(0 4px 8px rgba(16, 24, 40, 0.1))');
  
  // Node content container
  nodeGroups.each(function(d) {
    const group = d3.select(this);
    const width = d.size?.w || 160;
    const height = d.size?.h || 72;
    const textColor = getContrastColor(d.content?.color || '#3B82F6');
    
    // Name - Refined typography
    group.append('text')
      .attr('class', 'node-name')
      .attr('x', width / 2)
      .attr('y', height / 2 - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', textColor)
      .attr('font-family', 'Inter, -apple-system, BlinkMacSystemFont, sans-serif')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .attr('letter-spacing', '-0.01em')
      .text(d.content?.name || 'Untitled');
    
    // Title - Subtle secondary text
    group.append('text')
      .attr('class', 'node-title')
      .attr('x', width / 2)
      .attr('y', height / 2 + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', textColor)
      .attr('font-family', 'Inter, -apple-system, BlinkMacSystemFont, sans-serif')
      .attr('font-size', '11px')
      .attr('font-weight', '400')
      .attr('opacity', 0.75)
      .text(d.content?.title || '');
    
    // Add collapse/expand toggle button if node has children
    if (hasChildren(d.id)) {
      const isCollapsed = collapsedNodes.has(d.id);
      const toggleGroup = group.append('g')
        .attr('class', 'collapse-toggle')
        .attr('transform', `translate(${width / 2}, ${height})`)
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation();
          toggleNodeCollapse(d.id);
        });
      
      toggleGroup.append('circle')
        .attr('r', 9)
        .attr('fill', '#fff')
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0 1px 2px rgba(16, 24, 40, 0.05))');
      
      toggleGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-family', 'Inter, -apple-system, BlinkMacSystemFont, sans-serif')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .attr('fill', '#667085')
        .text(isCollapsed ? '+' : '−');
    }
  });
  
  updateMinimap();
}

// Update a single node visually (for optimistic updates)
function updateNodeVisual(nodeId) {
  const node = nodes[nodeId];
  if (!node) return;
  
  const nodeGroup = g.select(`g.node[data-id="${nodeId}"]`);
  if (nodeGroup.empty()) return;
  
  const width = node.size?.w || 180;
  const textColor = getContrastColor(node.content?.color || '#3B82F6');
  
  nodeGroup.select('rect')
    .attr('fill', node.content?.color || '#3B82F6');
  
  nodeGroup.select('.node-name')
    .attr('fill', textColor)
    .text(node.content?.name || 'Untitled');
  
  nodeGroup.select('.node-title')
    .attr('fill', textColor)
    .text(node.content?.title || '');
}

// ============================================
// DRAG AND DROP
// ============================================
function dragStarted(event, d) {
  isDragging = true;
  d3.select(this).raise().classed('dragging', true);
  hideNodeTooltip();
}

function dragged(event, d) {
  // Update position (optimistic)
  d.pos.x = event.x;
  d.pos.y = event.y;
  
  // Move the node
  d3.select(this).attr('transform', `translate(${d.pos.x}, ${d.pos.y})`);
  
  // Update links in real-time
  updateLinksForNode(d.id);
  
  // Check for drop targets
  highlightDropTarget(d);
}

function dragEnded(event, d) {
  isDragging = false;
  d3.select(this).classed('dragging', false);
  
  // Check for reparenting
  const dropTarget = findDropTarget(d);
  if (dropTarget && canReparent(d, dropTarget)) {
    reparentNode(d.id, dropTarget.id);
  }
  
  // Clear drop target highlights
  g.selectAll('.node').classed('drop-target', false).classed('invalid-drop', false);
  
  // Mark position as manual
  d.manualPosition = true;
  
  // Schedule save
  scheduleSave();
}

function updateLinksForNode(nodeId) {
  const nodeArray = Object.values(nodes);
  const links = [];
  
  nodeArray.forEach(node => {
    if (node.parentId && nodes[node.parentId]) {
      const parent = nodes[node.parentId];
      links.push({
        id: `${parent.id}-${node.id}`,
        source: { x: parent.pos.x + 90, y: parent.pos.y + 40 },
        target: { x: node.pos.x + 90, y: node.pos.y }
      });
    }
  });
  
  g.select('.links').selectAll('path.link')
    .data(links, d => d.id)
    .join('path')
    .attr('class', 'link')
    .attr('d', d => linkGenerator(d));
}

function highlightDropTarget(draggedNode) {
  const nodeArray = Object.values(nodes);
  
  g.selectAll('.node').each(function(d) {
    const group = d3.select(this);
    
    if (d.id === draggedNode.id) return;
    
    if (detectCollision(draggedNode, d)) {
      if (canReparent(draggedNode, d)) {
        group.classed('drop-target', true).classed('invalid-drop', false);
      } else {
        group.classed('drop-target', false).classed('invalid-drop', true);
      }
    } else {
      group.classed('drop-target', false).classed('invalid-drop', false);
    }
  });
}

function findDropTarget(draggedNode) {
  const nodeArray = Object.values(nodes);
  
  for (const node of nodeArray) {
    if (node.id === draggedNode.id) continue;
    if (detectCollision(draggedNode, node)) {
      return node;
    }
  }
  
  return null;
}

function detectCollision(nodeA, nodeB) {
  const a = {
    x: nodeA.pos.x,
    y: nodeA.pos.y,
    w: nodeA.size?.w || 180,
    h: nodeA.size?.h || 80
  };
  const b = {
    x: nodeB.pos.x,
    y: nodeB.pos.y,
    w: nodeB.size?.w || 180,
    h: nodeB.size?.h || 80
  };
  
  return !(
    a.x > b.x + b.w ||
    a.x + a.w < b.x ||
    a.y > b.y + b.h ||
    a.y + a.h < b.y
  );
}

function canReparent(draggedNode, targetNode) {
  // Can't drop on self
  if (draggedNode.id === targetNode.id) return false;
  
  // Can't drop on own descendant (cycle prevention)
  if (isDescendant(draggedNode.id, targetNode.id)) return false;
  
  // Can't drop on current parent (no-op)
  if (draggedNode.parentId === targetNode.id) return false;
  
  return true;
}

function isDescendant(ancestorId, descendantId) {
  const children = Object.values(nodes).filter(n => n.parentId === ancestorId);
  for (const child of children) {
    if (child.id === descendantId) return true;
    if (isDescendant(child.id, descendantId)) return true;
  }
  return false;
}

function reparentNode(nodeId, newParentId) {
  const node = nodes[nodeId];
  if (!node) return;
  
  // Update parent reference
  node.parentId = newParentId;
  
  // Re-render to update links
  render();
  
  showToast('Node moved', 'success');
}

// ============================================
// NODE OPERATIONS
// ============================================
function addNode() {
  // Find root or first node as parent
  const nodeArray = Object.values(nodes);
  const rootNode = nodeArray.find(n => !n.parentId) || nodeArray[0];
  
  // Generate new ID
  const existingIds = Object.keys(nodes).map(id => {
    const match = id.match(/node-(\d+)/);
    return match ? parseInt(match[1]) : 0;
  });
  const maxId = Math.max(0, ...existingIds);
  const newId = `node-${maxId + 1}`;
  
  // Calculate position
  let posX = 400;
  let posY = 100;
  
  if (rootNode) {
    const siblings = nodeArray.filter(n => n.parentId === rootNode.id);
    posX = rootNode.pos.x + (siblings.length * 200);
    posY = rootNode.pos.y + 140;
  }
  
  // Create new node
  nodes[newId] = {
    id: newId,
    parentId: rootNode?.id || null,
    pos: { x: posX, y: posY },
    size: { w: 180, h: 80 },
    manualPosition: false,
    content: {
      name: 'New Node',
      title: 'Click to edit',
      department: '',
      color: '#3B82F6'
    }
  };
  
  // Re-render
  render();
  
  // Select the new node
  selectNode(newId);
  
  // Schedule save
  scheduleSave();
  
  showToast('Node added', 'success');
}

function deleteNodeById(nodeId) {
  const node = nodes[nodeId];
  if (!node) return;
  
  // Can't delete root if it has children
  if (!node.parentId) {
    const children = Object.values(nodes).filter(n => n.parentId === nodeId);
    if (children.length > 0) {
      showToast('Cannot delete root node with children', 'error');
      return;
    }
  }
  
  // Delete descendants recursively
  function deleteDescendants(parentId) {
    const children = Object.values(nodes).filter(n => n.parentId === parentId);
    children.forEach(child => {
      deleteDescendants(child.id);
      delete nodes[child.id];
    });
  }
  
  deleteDescendants(nodeId);
  delete nodes[nodeId];
  
  // Close editor if this node was selected
  if (selectedNode?.id === nodeId) {
    closeEditorPanel();
  }
  
  // Re-render
  render();
  
  // Schedule save
  scheduleSave();
  
  showToast('Node deleted', 'success');
}

function handleNodeClick(event, d) {
  event.stopPropagation();
  
  if (deleteMode) {
    deleteNodeById(d.id);
    return;
  }
  
  selectNode(d.id);
}

function handleNodeDoubleClick(event, d) {
  event.stopPropagation();
  selectNode(d.id);
  openEditorPanel();
}

function selectNode(nodeId) {
  selectedNode = nodes[nodeId];
  
  // Update visual selection
  g.selectAll('.node').classed('selected', false);
  g.select(`g.node[data-id="${nodeId}"]`).classed('selected', true);
  
  // Open editor panel
  openEditorPanel();
}

// ============================================
// EDITOR PANEL
// ============================================
function openEditorPanel() {
  if (!selectedNode) return;
  
  const panel = document.getElementById('editorPanel');
  panel.classList.add('open');
  
  // Populate form
  document.getElementById('nodeName').value = selectedNode.content?.name || '';
  document.getElementById('nodeTitle').value = selectedNode.content?.title || '';
  document.getElementById('nodeDepartment').value = selectedNode.content?.department || '';
  document.getElementById('nodeNotes').value = selectedNode.content?.notes || '';
  
  // Set color selection
  const color = selectedNode.content?.color || '#3B82F6';
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === color);
  });
}

function closeEditorPanel() {
  document.getElementById('editorPanel').classList.remove('open');
  selectedNode = null;
  g.selectAll('.node').classed('selected', false);
}

function updateNodeFromEditor() {
  if (!selectedNode) return;
  
  // Update node data (optimistic)
  selectedNode.content = {
    ...selectedNode.content,
    name: document.getElementById('nodeName').value,
    title: document.getElementById('nodeTitle').value,
    department: document.getElementById('nodeDepartment').value,
    notes: document.getElementById('nodeNotes').value
  };
  
  // Update visual
  updateNodeVisual(selectedNode.id);
  
  // Schedule save
  scheduleSave();
}

// ============================================
// PERSISTENCE
// ============================================
function scheduleSave() {
  // Show saving indicator
  const indicator = document.getElementById('saveIndicator');
  indicator.classList.add('saving');
  indicator.querySelector('.save-text').textContent = 'Saving...';
  pendingSave = true;
  
  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Schedule new save (debounced)
  saveTimeout = setTimeout(saveChart, SAVE_DELAY);
}

async function saveChart() {
  if (!chartId || !pendingSave) return;
  
  try {
    const updateData = {
      'snapshot.nodes': nodes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      version: firebase.firestore.FieldValue.increment(1)
    };
    
    // Also save title if changed
    const titleInput = document.getElementById('chartTitleInput');
    if (titleInput.value !== chartData.title) {
      updateData.title = titleInput.value;
      chartData.title = titleInput.value;
    }
    
    await db.collection('boards').doc(chartId).update(updateData);
    
    // Update indicator
    const indicator = document.getElementById('saveIndicator');
    indicator.classList.remove('saving');
    indicator.querySelector('.save-text').textContent = 'Saved';
    pendingSave = false;
    
  } catch (error) {
    console.error('Error saving chart:', error);
    
    // Show error indicator
    const indicator = document.getElementById('saveIndicator');
    indicator.classList.remove('saving');
    indicator.classList.add('error');
    indicator.querySelector('.save-text').textContent = 'Error saving';
    
    showToast('Failed to save changes', 'error');
  }
}

// ============================================
// EXPAND / COLLAPSE
// ============================================
function getVisibleNodes() {
  // Returns nodes that should be visible (not hidden by collapsed ancestors)
  const nodeArray = Object.values(nodes);
  const hiddenNodes = new Set();
  
  // For each collapsed node, hide all its descendants
  collapsedNodes.forEach(collapsedId => {
    function hideDescendants(parentId) {
      nodeArray.forEach(node => {
        if (node.parentId === parentId) {
          hiddenNodes.add(node.id);
          hideDescendants(node.id);
        }
      });
    }
    hideDescendants(collapsedId);
  });
  
  return nodeArray.filter(node => !hiddenNodes.has(node.id));
}

function hasChildren(nodeId) {
  return Object.values(nodes).some(node => node.parentId === nodeId);
}

function expandAll() {
  collapsedNodes.clear();
  render();
  showToast('All branches expanded', 'success');
}

function collapseAll() {
  // Collapse all nodes that have children (except leaves)
  Object.values(nodes).forEach(node => {
    if (hasChildren(node.id)) {
      collapsedNodes.add(node.id);
    }
  });
  render();
  showToast('All branches collapsed', 'success');
}

function toggleNodeCollapse(nodeId) {
  if (collapsedNodes.has(nodeId)) {
    collapsedNodes.delete(nodeId);
  } else {
    collapsedNodes.add(nodeId);
  }
  render();
}

// ============================================
// ZOOM & PAN
// ============================================
function updateZoomIndicator(scale) {
  document.getElementById('zoomIndicator').textContent = `${Math.round(scale * 100)}%`;
}

function zoomIn() {
  svg.transition().duration(300).call(zoom.scaleBy, 1.3);
}

function zoomOut() {
  svg.transition().duration(300).call(zoom.scaleBy, 0.7);
}

function fitToScreen() {
  const nodeArray = Object.values(nodes);
  if (nodeArray.length === 0) return;
  
  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  nodeArray.forEach(node => {
    minX = Math.min(minX, node.pos.x);
    minY = Math.min(minY, node.pos.y);
    maxX = Math.max(maxX, node.pos.x + (node.size?.w || 180));
    maxY = Math.max(maxY, node.pos.y + (node.size?.h || 80));
  });
  
  const width = maxX - minX;
  const height = maxY - minY;
  const containerWidth = svg.node().clientWidth;
  const containerHeight = svg.node().clientHeight;
  
  const scale = Math.min(
    (containerWidth - 100) / width,
    (containerHeight - 100) / height,
    1.5
  );
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  svg.transition().duration(500).call(
    zoom.transform,
    d3.zoomIdentity
      .translate(containerWidth / 2, containerHeight / 2)
      .scale(scale)
      .translate(-centerX, -centerY)
  );
}

// ============================================
// MINIMAP
// ============================================
function updateMinimap() {
  const minimapSvg = d3.select('#minimapSvg');
  minimapSvg.selectAll('*').remove();
  
  // Filter to only nodes with valid position data
  const nodeArray = Object.values(nodes).filter(n => n.pos);
  if (nodeArray.length === 0) return;
  
  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  nodeArray.forEach(node => {
    minX = Math.min(minX, node.pos.x);
    minY = Math.min(minY, node.pos.y);
    maxX = Math.max(maxX, node.pos.x + (node.size?.w || 160));
    maxY = Math.max(maxY, node.pos.y + (node.size?.h || 72));
  });
  
  const padding = 20;
  const mapWidth = 180;
  const mapHeight = 120;
  
  const scaleX = (mapWidth - padding * 2) / (maxX - minX || 1);
  const scaleY = (mapHeight - padding * 2) / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);
  
  // Draw nodes
  nodeArray.forEach(node => {
    minimapSvg.append('rect')
      .attr('x', padding + (node.pos.x - minX) * scale)
      .attr('y', padding + (node.pos.y - minY) * scale)
      .attr('width', Math.max(4, (node.size?.w || 160) * scale))
      .attr('height', Math.max(3, (node.size?.h || 72) * scale))
      .attr('fill', node.content?.color || '#2E90FA')
      .attr('rx', 1);
  });
}

// ============================================
// TOOLTIPS
// ============================================
function showNodeTooltip(event, d) {
  if (isDragging) return;
  
  const tooltip = document.getElementById('tooltip');
  tooltip.innerHTML = `
    <strong>${d.content?.name || 'Untitled'}</strong>
    ${d.content?.title ? `<div>${d.content.title}</div>` : ''}
    ${d.content?.department ? `<div class="meta">${d.content.department}</div>` : ''}
  `;
  
  tooltip.style.left = (event.pageX + 15) + 'px';
  tooltip.style.top = (event.pageY + 15) + 'px';
  tooltip.classList.add('show');
}

function hideNodeTooltip() {
  document.getElementById('tooltip').classList.remove('show');
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Add node button
  document.getElementById('addNodeBtn').addEventListener('click', addNode);
  
  // Zoom buttons
  document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('fitBtn').addEventListener('click', fitToScreen);
  
  // Expand/Collapse buttons
  document.getElementById('expandAllBtn').addEventListener('click', expandAll);
  document.getElementById('collapseAllBtn').addEventListener('click', collapseAll);
  
  // Delete mode button
  document.getElementById('deleteBtn').addEventListener('click', () => {
    deleteMode = !deleteMode;
    document.body.classList.toggle('delete-mode', deleteMode);
    document.getElementById('deleteBtn').classList.toggle('active', deleteMode);
  });
  
  // Export button
  document.getElementById('exportBtn').addEventListener('click', exportChart);
  
  // Close editor panel
  document.getElementById('closePanel').addEventListener('click', closeEditorPanel);
  
  // Delete node from panel
  document.getElementById('deleteNodeBtn').addEventListener('click', () => {
    if (selectedNode) {
      deleteNodeById(selectedNode.id);
    }
  });
  
  // Editor form inputs (with debounced updates)
  const formInputs = ['nodeName', 'nodeTitle', 'nodeDepartment', 'nodeNotes'];
  formInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', debounce(updateNodeFromEditor, 300));
  });
  
  // Color buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!selectedNode) return;
      
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      
      selectedNode.content.color = btn.dataset.color;
      updateNodeVisual(selectedNode.id);
      scheduleSave();
    });
  });
  
  // Title input
  document.getElementById('chartTitleInput').addEventListener('input', debounce(() => {
    scheduleSave();
    document.title = `${document.getElementById('chartTitleInput').value || 'Untitled'} - OrgFlow`;
  }, 500));
  
  // Click on canvas to deselect
  svg.on('click', () => {
    if (!isDragging) {
      closeEditorPanel();
    }
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch (e.key.toLowerCase()) {
      case 'a':
        addNode();
        break;
      case 'd':
        deleteMode = !deleteMode;
        document.body.classList.toggle('delete-mode', deleteMode);
        document.getElementById('deleteBtn').classList.toggle('active', deleteMode);
        break;
      case 'e':
        expandAll();
        break;
      case 'c':
        collapseAll();
        break;
      case 'f':
        fitToScreen();
        break;
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
        zoomOut();
        break;
      case 'escape':
        closeEditorPanel();
        deleteMode = false;
        document.body.classList.remove('delete-mode');
        document.getElementById('deleteBtn').classList.remove('active');
        break;
      case 'delete':
      case 'backspace':
        if (selectedNode) {
          deleteNodeById(selectedNode.id);
        }
        break;
    }
  });
}

// ============================================
// EXPORT
// ============================================
function exportChart() {
  const data = {
    title: chartData.title,
    nodes: nodes,
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chartData.title || 'org-chart'}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('Chart exported', 'success');
}

// ============================================
// UTILITIES
// ============================================
function getContrastColor(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#111827' : '#FFFFFF';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
