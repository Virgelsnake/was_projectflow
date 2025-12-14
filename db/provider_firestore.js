// Firestore database provider for the org chart
// Matches the exact structure of provider_memory.js

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK with application default credentials
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'wbs-orgflow',
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Current chart ID - can be set via environment or defaults
let currentChartId = process.env.CHART_ID || 'default';

// Set the current chart to work with
function setCurrentChart(chartId) {
  currentChartId = chartId;
}

// Get reference to nodes collection for current chart
function getNodesRef() {
  return db.collection('charts').doc(currentChartId).collection('nodes');
}

// Get chart metadata reference
function getChartRef() {
  return db.collection('charts').doc(currentChartId);
}

async function listNodes(callback) {
  try {
    const snapshot = await getNodesRef().get();
    const nodes = snapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    callback(null, nodes);
  } catch (err) {
    callback(err, null);
  }
}

async function addNode(name, parentId, callback) {
  try {
    // Get next ID
    const chartDoc = await getChartRef().get();
    let nextId = 1;
    
    if (chartDoc.exists) {
      nextId = (chartDoc.data().nextId || 1);
    }
    
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
    
    // Save node
    await getNodesRef().doc(String(nextId)).set(newNode);
    
    // Update nextId counter
    await getChartRef().set({ nextId: nextId + 1 }, { merge: true });
    
    callback(null, nextId);
  } catch (err) {
    callback(err, null);
  }
}

async function updateNode(id, changes, callback) {
  try {
    await getNodesRef().doc(String(id)).update(changes);
    callback(null);
  } catch (err) {
    callback(err);
  }
}

async function updateNodeColor(id, color, textColor, callback) {
  try {
    await getNodesRef().doc(String(id)).update({ color, textColor });
    callback(null);
  } catch (err) {
    callback(err);
  }
}

async function deleteNode(id, callback) {
  try {
    // Get all nodes to find descendants
    const snapshot = await getNodesRef().get();
    const nodes = snapshot.docs.map(doc => ({
      id: parseInt(doc.id) || doc.id,
      ...doc.data()
    }));
    
    // Find all descendants
    function getDescendantIds(parentId) {
      const children = nodes.filter(n => n.parentId === parentId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
        ids = ids.concat(getDescendantIds(c.id));
      });
      return ids;
    }
    
    const idsToDelete = [id, ...getDescendantIds(id)];
    
    // Delete all nodes in batch
    const batch = db.batch();
    idsToDelete.forEach(nodeId => {
      batch.delete(getNodesRef().doc(String(nodeId)));
    });
    
    await batch.commit();
    callback(null);
  } catch (err) {
    callback(err);
  }
}

// Initialize a chart with seed data
async function initializeChart(chartId, seedNodes) {
  currentChartId = chartId;
  
  const batch = db.batch();
  
  // Clear existing nodes
  const existingDocs = await getNodesRef().get();
  existingDocs.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  // Add seed nodes
  let maxId = 0;
  seedNodes.forEach(node => {
    const nodeId = node.id;
    if (typeof nodeId === 'number' && nodeId > maxId) {
      maxId = nodeId;
    }
    
    const nodeData = { ...node };
    delete nodeData.id; // Don't store ID in document data
    
    batch.set(getNodesRef().doc(String(nodeId)), nodeData);
  });
  
  // Set chart metadata
  batch.set(getChartRef(), { 
    nextId: maxId + 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  await batch.commit();
}

module.exports = {
  listNodes,
  addNode,
  updateNode,
  updateNodeColor,
  deleteNode,
  setCurrentChart,
  initializeChart
};
