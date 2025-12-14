// In-memory database provider for the org chart example

let nodes = [
  { id: 1, parentId: null, name: 'CEO', description: 'Chief Executive Officer', responsible: 'John Smith', status: 'Active', cost: '$500k', url: '', color: '#003057', textColor: 'white' },
  { id: 2, parentId: 1, name: 'CTO', description: 'Chief Technology Officer', responsible: 'Jane Doe', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
  { id: 3, parentId: 1, name: 'CFO', description: 'Chief Financial Officer', responsible: 'Bob Wilson', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
  { id: 4, parentId: 1, name: 'COO', description: 'Chief Operating Officer', responsible: 'Alice Brown', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
  { id: 5, parentId: 2, name: 'Engineering Lead', description: 'Leads engineering team', responsible: 'Mike Johnson', status: 'Active', cost: '$200k', url: '', color: '#003057', textColor: 'white' },
  { id: 6, parentId: 2, name: 'Product Manager', description: 'Product management', responsible: 'Sarah Lee', status: 'Active', cost: '$180k', url: '', color: '#003057', textColor: 'white' },
  { id: 7, parentId: 3, name: 'Finance Manager', description: 'Finance operations', responsible: 'Tom Davis', status: 'Active', cost: '$150k', url: '', color: '#003057', textColor: 'white' },
  { id: 8, parentId: 5, name: 'Senior Developer', description: 'Senior software engineer', responsible: 'Chris Martinez', status: 'Active', cost: '$120k', url: '', color: '#003057', textColor: 'white' },
];

let nextId = 9;

function listNodes(callback) {
  callback(null, [...nodes]);
}

function addNode(name, parentId, callback) {
  const id = nextId++;
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
  nodes.push(newNode);
  callback(null, id);
}

function updateNode(id, changes, callback) {
  const node = nodes.find(n => n.id === id);
  if (node) {
    Object.assign(node, changes);
  }
  callback(null);
}

function updateNodeColor(id, color, textColor, callback) {
  const node = nodes.find(n => n.id === id);
  if (node) {
    node.color = color;
    node.textColor = textColor;
  }
  callback(null);
}

function deleteNode(id, callback) {
  // Delete node and all descendants
  function getDescendantIds(parentId) {
    const children = nodes.filter(n => n.parentId === parentId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = ids.concat(getDescendantIds(c.id));
    });
    return ids;
  }
  
  const idsToDelete = [id, ...getDescendantIds(id)];
  nodes = nodes.filter(n => !idsToDelete.includes(n.id));
  callback(null);
}

module.exports = {
  listNodes,
  addNode,
  updateNode,
  updateNodeColor,
  deleteNode
};
