# D3.js Reference Document

This reference document covers the D3.js v7 APIs used in the WBS Organizational Chart project.

---

## Table of Contents

1. [d3-hierarchy](#d3-hierarchy)
2. [Tree Layout](#tree-layout)
3. [Hierarchies](#hierarchies)
4. [d3-selection](#d3-selection)
5. [d3-shape Links](#d3-shape-links)
6. [d3-drag](#d3-drag)
7. [d3-zoom](#d3-zoom)
8. [Project-Specific Usage](#project-specific-usage)

---

## d3-hierarchy

Many datasets are intrinsically hierarchical: geographic entities, organizational structures, file systems, software packages. This module implements several popular techniques for visualizing hierarchical data:

### Visualization Types

- **Node-link diagrams**: Show topology using discrete marks for nodes and links (circles for nodes, lines connecting parent-child). The "tidy" tree is compact, while dendrograms place leaves at the same level.
- **Adjacency diagrams**: Show topology through relative placement of nodes. May encode quantitative dimensions in node area.
- **Enclosure diagrams**: Use area encoding and show topology through containment (treemaps, circle-packing).

### Available Layouts

| Layout | Description |
|--------|-------------|
| `d3.tree()` | Tidy tree diagrams |
| `d3.cluster()` | Dendrograms (leaves at same depth) |
| `d3.partition()` | Space-filling adjacency diagrams |
| `d3.pack()` | Circle-packing enclosure diagrams |
| `d3.treemap()` | Rectangular subdivision by value |

---

## Tree Layout

The tree layout produces tidy node-link diagrams using the Reingold–Tilford algorithm, improved to run in linear time by Buchheim et al.

### `d3.tree()`

Creates a new tree layout with default settings.

```javascript
const treeLayout = d3.tree();
```

### `tree(root)`

Lays out the specified root hierarchy, assigning properties on root and descendants:

- `node.x` - the x-coordinate of the node
- `node.y` - the y-coordinate of the node

The coordinates represent an arbitrary coordinate system (e.g., treat x as angle and y as radius for radial layout).

```javascript
const treeData = treeLayout(root);
```

### `tree.size(size)`

Sets the tree layout's size to a two-element array `[width, height]`.

```javascript
treeLayout.size([width, height]);
```

A layout size of `null` indicates that a node size will be used instead.

### `tree.nodeSize(size)`

Sets the tree layout's node size to a two-element array `[width, height]`.

```javascript
treeLayout.nodeSize([dx, dy]);
```

When a node size is specified, the root node is always positioned at ⟨0, 0⟩.

### `tree.separation(separation)`

Sets the separation accessor function. Default:

```javascript
function separation(a, b) {
  return a.parent == b.parent ? 1 : 2;
}
```

For radial layouts:

```javascript
function separation(a, b) {
  return (a.parent == b.parent ? 1 : 2) / a.depth;
}
```

---

## Hierarchies

Before computing a hierarchical layout, you need a root node. If your data is already hierarchical (like JSON), pass it directly to `d3.hierarchy()`.

### `d3.hierarchy(data, children)`

Constructs a root node from hierarchical data.

```javascript
const data = {
  name: "CEO",
  children: [
    { name: "CTO", children: [...] },
    { name: "CFO", children: [...] }
  ]
};

const root = d3.hierarchy(data);
```

**Returned node properties:**

| Property | Description |
|----------|-------------|
| `node.data` | The associated data passed to hierarchy |
| `node.depth` | Zero for root, increasing by one for each descendant |
| `node.height` | Greatest distance from any descendant leaf (0 for leaves) |
| `node.parent` | Parent node, or null for root |
| `node.children` | Array of child nodes, or undefined for leaves |
| `node.value` | Optional summed value of node and descendants |

### Node Methods

#### `node.ancestors()`
Returns array of ancestor nodes, starting with this node up to root.

#### `node.descendants()`
Returns array of descendant nodes in topological order.

```javascript
const nodes = root.descendants();
```

#### `node.leaves()`
Returns array of leaf nodes (nodes with no children).

#### `node.find(filter)`
Returns first node where filter returns truthy.

```javascript
const cto = root.find(d => d.data.name === "CTO");
```

#### `node.path(target)`
Returns shortest path through hierarchy from this node to target.

#### `node.links()`
Returns array of links with `source` and `target` properties.

```javascript
const links = root.links();
// [{ source: parentNode, target: childNode }, ...]
```

#### `node.sum(value)`
Evaluates value function for each node in post-order traversal. Sets `node.value`.

```javascript
root.sum(d => d.cost || 0);
```

#### `node.count()`
Computes number of leaves under this node, assigns to `node.value`.

#### `node.sort(compare)`
Sorts children using compare function.

```javascript
// Sort by descending height, then ascending name
root.sort((a, b) => b.height - a.height || d3.ascending(a.data.name, b.data.name));
```

### Traversal Methods

#### `node.each(function)`
Breadth-first traversal.

#### `node.eachBefore(function)`
Pre-order traversal (ancestors visited before descendants).

#### `node.eachAfter(function)`
Post-order traversal (descendants visited before ancestors).

#### `node.copy()`
Returns deep copy of subtree (shares same data).

---

## d3-selection

Selections allow powerful data-driven transformation of the DOM: set attributes, styles, properties, HTML or text content.

### Core Concepts

- **Selecting elements**: Query DOM elements
- **Modifying elements**: Change attributes of selected elements
- **Joining data**: Bind data to elements for visualization
- **Handling events**: Declare event listeners
- **Control flow**: Iterate over selected elements

### Common Methods

```javascript
// Select single element
const svg = d3.select("svg");

// Select multiple elements
const nodes = d3.selectAll(".node");

// Append elements
const g = svg.append("g");

// Set attributes
g.attr("transform", `translate(${x}, ${y})`);

// Set styles
g.style("fill", "blue");

// Bind data
const nodeGroups = g.selectAll("g.node")
  .data(nodes, d => d.id);

// Enter selection (new data)
const nodeEnter = nodeGroups.enter()
  .append("g")
  .attr("class", "node");

// Update selection (existing data)
const nodeUpdate = nodeEnter.merge(nodeGroups);

// Exit selection (removed data)
nodeGroups.exit().remove();
```

---

## d3-shape Links

The link shape generates smooth cubic Bézier curves from source to target points.

### `d3.linkVertical()`

Creates a link generator suitable for tree diagrams rooted on top edge.

```javascript
const linkGenerator = d3.linkVertical()
  .x(d => d.x)
  .y(d => d.y);
```

### `d3.linkHorizontal()`

Creates a link generator for tree diagrams rooted on left edge.

```javascript
const linkGenerator = d3.linkHorizontal()
  .x(d => d.x)
  .y(d => d.y);
```

### Link Methods

#### `link.source(source)`
Sets the source accessor function.

```javascript
linkGenerator.source(d => d.source);
```

#### `link.target(target)`
Sets the target accessor function.

```javascript
linkGenerator.target(d => d.target);
```

#### `link.x(x)` / `link.y(y)`
Sets the x/y accessor functions.

### Usage Example

```javascript
const linkGenerator = d3.linkVertical()
  .x(d => d.x)
  .y(d => d.y);

// Generate path string
const pathData = linkGenerator({
  source: { x: 100, y: 100 },
  target: { x: 200, y: 200 }
});
// Returns: "M100,100C100,150,200,150,200,200"
```

---

## d3-drag

Drag-and-drop interaction for manipulating spatial elements.

### `d3.drag()`

Creates a new drag behavior.

```javascript
const drag = d3.drag()
  .on("start", dragStarted)
  .on("drag", dragged)
  .on("end", dragEnded);

// Apply to selection
d3.selectAll(".node").call(drag);
```

### Event Types

| Event | Description |
|-------|-------------|
| `start` | After pointer becomes active (mousedown/touchstart) |
| `drag` | After active pointer moves (mousemove/touchmove) |
| `end` | After pointer becomes inactive (mouseup/touchend) |

### `drag.on(typenames, listener)`

Sets event listener for specified event types.

```javascript
drag.on("start", function(event, d) {
  d3.select(this).raise().classed("active", true);
});

drag.on("drag", function(event, d) {
  d.x = event.x;
  d.y = event.y;
  d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
});

drag.on("end", function(event, d) {
  d3.select(this).classed("active", false);
});
```

### Drag Event Properties

| Property | Description |
|----------|-------------|
| `event.x` | New x-coordinate of subject |
| `event.y` | New y-coordinate of subject |
| `event.dx` | Change in x from previous event |
| `event.dy` | Change in y from previous event |
| `event.subject` | The drag subject |

### `drag.container(container)`

Sets the container accessor (determines coordinate system).

```javascript
drag.container(function() { return this.parentNode; });
```

### `drag.filter(filter)`

Sets event filter. Default ignores right-click and ctrl+click:

```javascript
function filter(event) {
  return !event.ctrlKey && !event.button;
}
```

---

## d3-zoom

Panning and zooming behavior for focusing on regions of interest.

### `d3.zoom()`

Creates a new zoom behavior.

```javascript
const zoom = d3.zoom()
  .scaleExtent([0.5, 2])
  .on("zoom", zoomed);

// Apply to selection
d3.select("svg").call(zoom);
```

### `zoom.on(typenames, listener)`

Sets event listener. The zoom event provides `event.transform`.

```javascript
function zoomed(event) {
  g.attr("transform", event.transform);
}
```

### `zoom.scaleExtent(extent)`

Sets the scale extent as `[min, max]`.

```javascript
zoom.scaleExtent([0.5, 4]); // Allow 50% to 400% zoom
```

### `zoom.translateExtent(extent)`

Sets the translate extent as `[[x0, y0], [x1, y1]]`.

### Transform Object

The `event.transform` object has:

| Property | Description |
|----------|-------------|
| `transform.k` | Scale factor |
| `transform.x` | Translation x |
| `transform.y` | Translation y |

### Methods

```javascript
transform.scale(k)      // Returns scaled transform
transform.translate(x, y) // Returns translated transform
transform.apply([x, y])   // Applies transform to point
transform.invert([x, y])  // Inverts transform on point
```

---

## Project-Specific Usage

### Tree Initialization

```javascript
// Fetch data and create hierarchy
fetch("/api/tree")
  .then(response => response.json())
  .then(data => {
    root = d3.hierarchy(data);
    root.x0 = height / 2;
    root.y0 = 0;
    update(root);
  });
```

### Tree Layout Configuration

```javascript
const dx = 200;  // Horizontal spacing
const dy = 200;  // Vertical spacing

const treeLayout = d3.tree().nodeSize([dx, dy]);
```

### Link Generator

```javascript
const linkGenerator = d3.linkVertical()
  .x(d => d.x)
  .y(d => d.y);
```

### Update Pattern

```javascript
function update(source) {
  // Compute new tree layout
  const treeData = treeLayout(root);
  const nodes = treeData.descendants().reverse();
  const links = treeData.links();

  // Normalize depth
  nodes.forEach(d => { d.y = d.depth * dy; });

  // DATA JOIN for nodes
  const node = g.selectAll("g.node")
    .data(nodes, d => d.id || (d.id = ++i));

  // ENTER new nodes
  const nodeEnter = node.enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${source.x0},${source.y0})`);

  // UPDATE + ENTER
  const nodeUpdate = nodeEnter.merge(node);
  nodeUpdate.transition()
    .duration(750)
    .attr("transform", d => `translate(${d.x},${d.y})`);

  // EXIT removed nodes
  node.exit()
    .transition()
    .duration(750)
    .attr("transform", d => `translate(${source.x},${source.y})`)
    .remove();

  // DATA JOIN for links
  const link = g.selectAll("path.link")
    .data(links, d => d.target.id);

  // ENTER new links
  const linkEnter = link.enter()
    .insert("path", "g")
    .attr("class", "link")
    .attr("d", d => {
      const o = { x: source.x0, y: source.y0 };
      return linkGenerator({ source: o, target: o });
    });

  // UPDATE + ENTER
  linkEnter.merge(link)
    .transition()
    .duration(750)
    .attr("d", linkGenerator);

  // EXIT removed links
  link.exit()
    .transition()
    .duration(750)
    .attr("d", d => {
      const o = { x: source.x, y: source.y };
      return linkGenerator({ source: o, target: o });
    })
    .remove();

  // Store positions for transitions
  nodes.forEach(d => {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}
```

### Drag Implementation

```javascript
function dragStarted(event, d) {
  d3.select(this).raise().classed("active", true);
}

function dragged(event, d) {
  d.x = event.x;
  d.y = event.y;
  d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
  updateLinks(d);
}

function dragEnded(event, d) {
  d3.select(this).classed("active", false);
  handleNodeDrop(event, d);
}

// Apply drag behavior
nodeEnter.call(
  d3.drag()
    .on("start", dragStarted)
    .on("drag", dragged)
    .on("end", dragEnded)
);
```

### Zoom Implementation

```javascript
const zoom = d3.zoom()
  .scaleExtent([0.5, 2])
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
  });

d3.select("svg").call(zoom);
```

### Toggle Children (Collapse/Expand)

```javascript
function toggleChildren(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}
```

---

## Resources

- [D3.js Official Documentation](https://d3js.org/)
- [d3-hierarchy Documentation](https://d3js.org/d3-hierarchy)
- [d3-selection Documentation](https://d3js.org/d3-selection)
- [d3-shape Documentation](https://d3js.org/d3-shape)
- [d3-drag Documentation](https://d3js.org/d3-drag)
- [d3-zoom Documentation](https://d3js.org/d3-zoom)
- [Observable D3 Examples](https://observablehq.com/@d3)
