const express = require("express");
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'wbs-orgflow',
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

// ============================================
// CHART MANAGEMENT APIs
// ============================================

// List all charts
app.get("/api/charts", async (req, res) => {
  try {
    const snapshot = await db.collection('charts').orderBy('updatedAt', 'desc').get();
    const charts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null
    }));
    res.json(charts);
  } catch (err) {
    console.error('Error listing charts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new chart
app.post("/api/charts", async (req, res) => {
  try {
    const { title, nodes } = req.body;
    
    const chartRef = db.collection('charts').doc();
    const chartData = {
      title: title || 'Untitled Chart',
      nextId: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await chartRef.set(chartData);
    
    // Add nodes if provided
    if (nodes && nodes.length > 0) {
      const batch = db.batch();
      let maxId = 0;
      
      nodes.forEach(node => {
        const nodeId = node.id;
        if (typeof nodeId === 'number' && nodeId > maxId) maxId = nodeId;
        
        const nodeData = { ...node };
        delete nodeData.id;
        batch.set(chartRef.collection('nodes').doc(String(nodeId)), nodeData);
      });
      
      batch.update(chartRef, { nextId: maxId + 1 });
      await batch.commit();
    }
    
    res.json({ id: chartRef.id, ...chartData });
  } catch (err) {
    console.error('Error creating chart:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a chart
app.delete("/api/charts/:chartId", async (req, res) => {
  try {
    const { chartId } = req.params;
    
    // Delete all nodes first
    const nodesSnapshot = await db.collection('charts').doc(chartId).collection('nodes').get();
    const batch = db.batch();
    nodesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('charts').doc(chartId));
    await batch.commit();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting chart:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// NODE APIs (for specific chart)
// ============================================

// Get tree for a chart
app.get("/api/charts/:chartId/tree", async (req, res) => {
  try {
    const { chartId } = req.params;
    const nodesSnapshot = await db.collection('charts').doc(chartId).collection('nodes').get();
    
    const nodes = nodesSnapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    
    const tree = buildTree(nodes)[0] || {};
    res.json(tree);
  } catch (err) {
    console.error('Error getting tree:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a node
app.post("/api/charts/:chartId/update-node", async (req, res) => {
  try {
    const { chartId } = req.params;
    const { id } = req.body;
    
    const dataKeys = ["parentId", "name", "url", "description", "responsible", "status", "cost"];
    const changes = Object.fromEntries(
      Object.entries(req.body).filter(([k, _]) => dataKeys.includes(k))
    );
    
    await db.collection('charts').doc(chartId).collection('nodes').doc(String(id)).update(changes);
    await db.collection('charts').doc(chartId).update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating node:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update node color
app.post("/api/charts/:chartId/update-node-color", async (req, res) => {
  try {
    const { chartId } = req.params;
    const { id, color, textColor } = req.body;
    
    await db.collection('charts').doc(chartId).collection('nodes').doc(String(id)).update({ color, textColor });
    await db.collection('charts').doc(chartId).update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating node color:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a node
app.post("/api/charts/:chartId/add-node", async (req, res) => {
  try {
    const { chartId } = req.params;
    const { parentId, name } = req.body;
    
    const chartRef = db.collection('charts').doc(chartId);
    const chartDoc = await chartRef.get();
    const nextId = chartDoc.data()?.nextId || 1;
    
    const newNode = {
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
    
    await chartRef.collection('nodes').doc(String(nextId)).set(newNode);
    await chartRef.update({ 
      nextId: nextId + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ id: nextId, name, children: [] });
  } catch (err) {
    console.error('Error adding node:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a node
app.delete("/api/charts/:chartId/delete-node", async (req, res) => {
  try {
    const { chartId } = req.params;
    const { id } = req.body;
    
    const nodesRef = db.collection('charts').doc(chartId).collection('nodes');
    const nodesSnapshot = await nodesRef.get();
    const nodes = nodesSnapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    
    // Find descendants
    function getDescendantIds(parentId) {
      const children = nodes.filter(n => n.parentId === parentId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
        ids = ids.concat(getDescendantIds(c.id));
      });
      return ids;
    }
    
    const idsToDelete = [id, ...getDescendantIds(id)];
    
    const batch = db.batch();
    idsToDelete.forEach(nodeId => {
      batch.delete(nodesRef.doc(String(nodeId)));
    });
    batch.update(db.collection('charts').doc(chartId), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting node:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export chart as JSON
app.get("/api/charts/:chartId/export", async (req, res) => {
  try {
    const { chartId } = req.params;
    const chartDoc = await db.collection('charts').doc(chartId).get();
    const nodesSnapshot = await db.collection('charts').doc(chartId).collection('nodes').get();
    
    const nodes = nodesSnapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    
    const tree = buildTree(nodes)[0] || {};
    
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=${chartDoc.data()?.title || 'chart'}.json`);
    res.send(tree);
  } catch (err) {
    console.error('Error exporting:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// LEGACY APIs (for backward compatibility with current client.js)
// Uses 'default' chart
// ============================================

const DEFAULT_CHART_ID = 'acme-corp';

app.get("/api/tree", async (req, res) => {
  try {
    const nodesSnapshot = await db.collection('charts').doc(DEFAULT_CHART_ID).collection('nodes').get();
    
    if (nodesSnapshot.empty) {
      // Return empty tree structure
      res.json({});
      return;
    }
    
    const nodes = nodesSnapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    
    const tree = buildTree(nodes)[0] || {};
    res.json(tree);
  } catch (err) {
    console.error('Error getting tree:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/update-node", async (req, res) => {
  try {
    const { id } = req.body;
    const dataKeys = ["parentId", "name", "url", "description", "responsible", "status", "cost"];
    const changes = Object.fromEntries(
      Object.entries(req.body).filter(([k, _]) => dataKeys.includes(k))
    );
    
    await db.collection('charts').doc(DEFAULT_CHART_ID).collection('nodes').doc(String(id)).update(changes);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating node:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/update-node-color", async (req, res) => {
  try {
    const { id, color, textColor } = req.body;
    await db.collection('charts').doc(DEFAULT_CHART_ID).collection('nodes').doc(String(id)).update({ color, textColor });
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating node color:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/add-node", async (req, res) => {
  try {
    const { parentId, name } = req.body;
    
    const chartRef = db.collection('charts').doc(DEFAULT_CHART_ID);
    const chartDoc = await chartRef.get();
    const nextId = chartDoc.data()?.nextId || 1;
    
    const newNode = {
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
    
    await chartRef.collection('nodes').doc(String(nextId)).set(newNode);
    await chartRef.update({ nextId: nextId + 1 });
    
    res.json({ id: nextId, name, children: [] });
  } catch (err) {
    console.error('Error adding node:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/delete-node", async (req, res) => {
  try {
    const { id } = req.body;
    
    const nodesRef = db.collection('charts').doc(DEFAULT_CHART_ID).collection('nodes');
    const nodesSnapshot = await nodesRef.get();
    const nodes = nodesSnapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    
    function getDescendantIds(parentId) {
      const children = nodes.filter(n => n.parentId === parentId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
        ids = ids.concat(getDescendantIds(c.id));
      });
      return ids;
    }
    
    const idsToDelete = [id, ...getDescendantIds(id)];
    
    const batch = db.batch();
    idsToDelete.forEach(nodeId => {
      batch.delete(nodesRef.doc(String(nodeId)));
    });
    await batch.commit();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting node:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/export-json", async (req, res) => {
  try {
    const nodesSnapshot = await db.collection('charts').doc(DEFAULT_CHART_ID).collection('nodes').get();
    const nodes = nodesSnapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    
    const tree = buildTree(nodes)[0] || {};
    
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=data.json");
    res.send(tree);
  } catch (err) {
    console.error('Error exporting:', err);
    res.status(500).json({ error: err.message });
  }
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
  console.log(`📈 Default Chart: http://localhost:${port}/index.html`);
});
