const express = require("express");
const { dbProvider } = require("./db/utils");

const { addNode, deleteNode, listNodes, updateNode, updateNodeColor } = require(
  `./db/provider_${dbProvider}.js`,
);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

// API to get the entire tree
app.get("/api/tree", (req, res) => {
  console.log("Received request for /api/tree");
  listNodes((err, nodes) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const tree = buildTree(nodes)[0] || {};
    res.json(tree);
  });
});

// API to update a node
app.post("/api/update-node", (req, res) => {
  console.log("Received request for /api/update-node");
  const { id } = req.body;
  const dataKeys = [
    "parentId",
    "name",
    "url",
    "description",
    "responsible",
    "status",
    "cost",
  ];
  const changes = Object.fromEntries(
    Object.entries(req.body).filter(([k, _]) => dataKeys.includes(k)),
  );
  updateNode(id, changes, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// API to update a node's color
app.post("/api/update-node-color", (req, res) => {
  console.log("Received request for /api/update-node-color");
  const { id, color, textColor } = req.body;
  updateNodeColor(id, color, textColor, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// API to add a new node
app.post("/api/add-node", (req, res) => {
  console.log("Received request for /api/add-node");
  const { parentId, name } = req.body;
  const children = [];
  addNode(name, parentId, (err, id) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id, name, children });
  });
});

// API to delete an existing node
app.delete("/api/delete-node", (req, res) => {
  console.log("Received request for /api/delete-node");
  const { id } = req.body;
  deleteNode(id, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

app.get("/export-json", (req, res) => {
  console.log("Received request for /api/export-json");
  listNodes((err, nodes) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const tree = buildTree(nodes)[0] || {};

    // Set the headers to prompt for download
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=data.json");

    // Send the JSON data
    res.send(tree);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

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
