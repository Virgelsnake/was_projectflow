const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

// ============================================
// FILE-BASED PERSISTENT STORAGE
// ============================================

const DATA_FILE = path.join(__dirname, 'data', 'charts.json');

// Default chart data
const defaultCharts = {
  'acme-corp': {
    id: 'acme-corp',
    title: 'Acme Corp - Executive Team',
    nextId: 9,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 1, parentId: null, name: 'CEO', description: 'Chief Executive Officer', responsible: 'John Smith', status: 'Active', cost: '$500k', url: '', color: '#003057', textColor: 'white' },
      { id: 2, parentId: 1, name: 'CTO', description: 'Chief Technology Officer', responsible: 'Jane Doe', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
      { id: 3, parentId: 1, name: 'CFO', description: 'Chief Financial Officer', responsible: 'Bob Wilson', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
      { id: 4, parentId: 1, name: 'COO', description: 'Chief Operating Officer', responsible: 'Alice Brown', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
      { id: 5, parentId: 2, name: 'Engineering Lead', description: 'Leads engineering team', responsible: 'Mike Johnson', status: 'Active', cost: '$200k', url: '', color: '#003057', textColor: 'white' },
      { id: 6, parentId: 2, name: 'Product Manager', description: 'Product management', responsible: 'Sarah Lee', status: 'Active', cost: '$180k', url: '', color: '#003057', textColor: 'white' },
      { id: 7, parentId: 3, name: 'Finance Manager', description: 'Finance operations', responsible: 'Tom Davis', status: 'Active', cost: '$150k', url: '', color: '#003057', textColor: 'white' },
      { id: 8, parentId: 5, name: 'Senior Developer', description: 'Senior software engineer', responsible: 'Chris Martinez', status: 'Active', cost: '$120k', url: '', color: '#003057', textColor: 'white' },
    ]
  },
  'techstart-eng': {
    id: 'techstart-eng',
    title: 'TechStart - Engineering Team',
    nextId: 9,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 1, parentId: null, name: 'VP Engineering', description: 'Vice President of Engineering', responsible: 'Maria Garcia', status: 'Active', cost: '$400k', url: '', color: '#6B21A8', textColor: 'white' },
      { id: 2, parentId: 1, name: 'Frontend Lead', description: 'Frontend Development Lead', responsible: 'James Liu', status: 'Active', cost: '$220k', url: '', color: '#2563EB', textColor: 'white' },
      { id: 3, parentId: 1, name: 'Backend Lead', description: 'Backend Development Lead', responsible: 'Sarah Johnson', status: 'Active', cost: '$220k', url: '', color: '#2563EB', textColor: 'white' },
      { id: 4, parentId: 1, name: 'DevOps Lead', description: 'DevOps & Infrastructure Lead', responsible: 'Alex Chen', status: 'Active', cost: '$220k', url: '', color: '#2563EB', textColor: 'white' },
      { id: 5, parentId: 2, name: 'React Developer', description: 'Senior React Developer', responsible: 'Emma Wilson', status: 'Active', cost: '$140k', url: '', color: '#059669', textColor: 'white' },
      { id: 6, parentId: 2, name: 'UI Engineer', description: 'UI/UX Engineer', responsible: 'Ryan Park', status: 'Active', cost: '$130k', url: '', color: '#059669', textColor: 'white' },
      { id: 7, parentId: 3, name: 'API Developer', description: 'Backend API Developer', responsible: 'Nina Patel', status: 'Active', cost: '$135k', url: '', color: '#059669', textColor: 'white' },
      { id: 8, parentId: 4, name: 'SRE Engineer', description: 'Site Reliability Engineer', responsible: 'Tom Anderson', status: 'Active', cost: '$145k', url: '', color: '#059669', textColor: 'white' },
    ]
  },
  'global-marketing': {
    id: 'global-marketing',
    title: 'Global Marketing Division',
    nextId: 9,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 1, parentId: null, name: 'CMO', description: 'Chief Marketing Officer', responsible: 'Jennifer Adams', status: 'Active', cost: '$380k', url: '', color: '#DC2626', textColor: 'white' },
      { id: 2, parentId: 1, name: 'Brand Director', description: 'Brand Strategy Director', responsible: 'Michael Brown', status: 'Active', cost: '$200k', url: '', color: '#D97706', textColor: 'white' },
      { id: 3, parentId: 1, name: 'Digital Marketing', description: 'Digital Marketing Director', responsible: 'Lisa Zhang', status: 'Active', cost: '$200k', url: '', color: '#D97706', textColor: 'white' },
      { id: 4, parentId: 1, name: 'Content Director', description: 'Content Strategy Director', responsible: 'David Kim', status: 'Active', cost: '$190k', url: '', color: '#D97706', textColor: 'white' },
      { id: 5, parentId: 2, name: 'Brand Manager', description: 'Brand Management', responsible: 'Sophie Martin', status: 'Active', cost: '$110k', url: '', color: '#059669', textColor: 'white' },
      { id: 6, parentId: 3, name: 'SEO Specialist', description: 'Search Engine Optimization', responsible: 'Chris Lee', status: 'Active', cost: '$95k', url: '', color: '#059669', textColor: 'white' },
      { id: 7, parentId: 3, name: 'Social Media', description: 'Social Media Manager', responsible: 'Amy Taylor', status: 'Active', cost: '$90k', url: '', color: '#059669', textColor: 'white' },
      { id: 8, parentId: 4, name: 'Content Writer', description: 'Senior Content Writer', responsible: 'Robert Clark', status: 'Active', cost: '$85k', url: '', color: '#059669', textColor: 'white' },
    ]
  }
};

// Load charts from file or use defaults
function loadCharts() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      console.log('📂 Loaded charts from file');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading charts:', err);
  }
  
  // Save defaults and return
  console.log('📝 Creating new charts file with defaults');
  saveCharts(defaultCharts);
  return { ...defaultCharts };
}

// Save charts to file
function saveCharts(charts) {
  try {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(charts, null, 2));
  } catch (err) {
    console.error('Error saving charts:', err);
  }
}

// Load charts on startup
let charts = loadCharts();

// Default chart for legacy API
const DEFAULT_CHART = 'acme-corp';

// ============================================
// CHART MANAGEMENT APIs
// ============================================

app.get("/api/charts", (req, res) => {
  const chartList = Object.values(charts).map(c => ({
    id: c.id,
    title: c.title,
    nodeCount: c.nodes.length,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));
  res.json(chartList);
});

app.post("/api/charts", (req, res) => {
  const { title, nodes } = req.body;
  const id = 'chart-' + Date.now();
  
  charts[id] = {
    id,
    title: title || 'Untitled Chart',
    nextId: (nodes?.length || 0) + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: nodes || [
      { id: 1, parentId: null, name: 'CEO', description: 'Chief Executive', responsible: '', status: 'Active', cost: '', url: '', color: '#003057', textColor: 'white' }
    ]
  };
  
  saveCharts(charts);
  res.json({ id, title: charts[id].title });
});

app.delete("/api/charts/:chartId", (req, res) => {
  const { chartId } = req.params;
  if (charts[chartId]) {
    delete charts[chartId];
    saveCharts(charts);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Chart not found' });
  }
});

// ============================================
// LEGACY APIs (backward compatible with original client.js)
// ============================================

app.get("/api/tree", (req, res) => {
  const chartId = req.query.chart || DEFAULT_CHART;
  const chart = charts[chartId];
  
  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }
  
  const tree = buildTree(chart.nodes)[0] || {};
  res.json(tree);
});

app.post("/api/update-node", (req, res) => {
  const chartId = req.query.chart || DEFAULT_CHART;
  const chart = charts[chartId];
  
  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }
  
  const { id } = req.body;
  const node = chart.nodes.find(n => n.id === id);
  
  if (node) {
    const dataKeys = ["parentId", "name", "url", "description", "responsible", "status", "cost"];
    dataKeys.forEach(key => {
      if (req.body[key] !== undefined) {
        node[key] = req.body[key];
      }
    });
    chart.updatedAt = new Date().toISOString();
    saveCharts(charts);
  }
  
  res.json({ success: true });
});

app.post("/api/update-node-color", (req, res) => {
  const chartId = req.query.chart || DEFAULT_CHART;
  const chart = charts[chartId];
  
  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }
  
  const { id, color, textColor } = req.body;
  const node = chart.nodes.find(n => n.id === id);
  
  if (node) {
    node.color = color;
    node.textColor = textColor;
    chart.updatedAt = new Date().toISOString();
    saveCharts(charts);
  }
  
  res.json({ success: true });
});

app.post("/api/add-node", (req, res) => {
  const chartId = req.query.chart || DEFAULT_CHART;
  const chart = charts[chartId];
  
  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }
  
  const { parentId, name } = req.body;
  const id = chart.nextId++;
  
  const newNode = {
    id,
    parentId: parentId || null,
    name,
    description: '',
    responsible: '',
    status: '',
    cost: '',
    url: '',
    color: '#003057',
    textColor: 'white'
  };
  
  chart.nodes.push(newNode);
  chart.updatedAt = new Date().toISOString();
  saveCharts(charts);
  
  res.json({ id, name, children: [] });
});

// Import WBS structure (replaces all nodes in chart)
app.post("/api/import-wbs", (req, res) => {
  const chartId = req.query.chart || DEFAULT_CHART;
  const chart = charts[chartId];
  
  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }
  
  const { nodes: importedNodes } = req.body;
  
  if (!importedNodes || Object.keys(importedNodes).length === 0) {
    return res.status(400).json({ error: 'No nodes provided' });
  }
  
  // Convert imported nodes object to array format
  const newNodes = Object.values(importedNodes).map(node => ({
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    description: '',
    responsible: '',
    status: '',
    cost: '',
    url: '',
    color: node.color || '#2A3565',
    textColor: 'white'
  }));
  
  // Replace chart nodes
  chart.nodes = newNodes;
  chart.nextId = newNodes.length + 1;
  chart.updatedAt = new Date().toISOString();
  saveCharts(charts);
  
  res.json({ success: true, count: newNodes.length });
});

app.delete("/api/delete-node", (req, res) => {
  const chartId = req.query.chart || DEFAULT_CHART;
  const chart = charts[chartId];
  
  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }
  
  const { id } = req.body;
  
  function getDescendantIds(parentId) {
    const children = chart.nodes.filter(n => n.parentId === parentId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = ids.concat(getDescendantIds(c.id));
    });
    return ids;
  }
  
  const idsToDelete = [id, ...getDescendantIds(id)];
  chart.nodes = chart.nodes.filter(n => !idsToDelete.includes(n.id));
  chart.updatedAt = new Date().toISOString();
  saveCharts(charts);
  
  res.json({ success: true });
});

app.get("/export-json", (req, res) => {
  const chartId = req.query.chart || DEFAULT_CHART;
  const chart = charts[chartId];
  
  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }
  
  const tree = buildTree(chart.nodes)[0] || {};
  
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=${chart.title.replace(/\s+/g, '-')}.json`);
  res.send(tree);
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildTree(nodes, parentId = null) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .map((node) => ({
      id: node.id,
      parentId: parentId,
      name: node.name,
      url: node.url,
      additionalInfo: node.description,
      personName: node.responsible,
      status: node.status,
      cost: node.cost,
      color: node.color,
      textColor: node.textColor,
      children: buildTree(nodes, node.id),
    }));
}

// ============================================
// START SERVER
// ============================================

app.listen(port, () => {
  console.log(`🚀 OrgFlow server running at http://localhost:${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}/dashboard.html`);
  console.log(`💾 Data file: ${DATA_FILE}`);
  console.log(`📈 Charts loaded: ${Object.keys(charts).length}`);
  Object.values(charts).forEach(c => {
    console.log(`   - ${c.title} (${c.nodes.length} nodes)`);
  });
});
