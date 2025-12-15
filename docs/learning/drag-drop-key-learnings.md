# Key Learnings: Drag-and-Drop Hierarchical Charts

**Document Purpose:** Technical reference for developers implementing drag-and-drop reparenting in hierarchical tree structures  
**Based On:** Analysis of D3.js org chart implementation  
**Last Updated:** December 14, 2025

---

## Overview

This document distills critical patterns and anti-patterns learned from implementing drag-and-drop functionality for hierarchical node-based charts. These principles apply whether you're using D3.js, React, or any other framework.

---

## 1. The Three-Phase Drag Pattern

### The Universal Pattern

Every drag-and-drop implementation follows three distinct phases. Understanding these phases is critical for smooth interactions.

```javascript
function dragStarted(event, d) {
  // PHASE 1: SETUP
  // - Visual feedback (cursor change, z-index)
  // - Store initial state
  // - Prepare for position tracking
  
  d3.select(this).raise().classed("active", true);
  this.initialX = d.x;
  this.initialY = d.y;
}

function dragged(event, d) {
  // PHASE 2: UPDATE (fires 60+ times per second)
  // - Update element position
  // - Provide real-time visual feedback
  // - Update connected elements (lines, children, etc.)
  
  d.x = event.x;
  d.y = event.y;
  d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
  updateLinks(d); // Critical: update connections in real-time
}

function dragEnded(event, d) {
  // PHASE 3: FINALIZE
  // - Validate drop location
  // - Trigger reparenting logic
  // - Persist changes to backend
  // - Clean up visual state
  
  d3.select(this).classed("active", false);
  handleNodeDrop(event, d);
  savePositionToDatabase(d);
}
```

### Key Insights

**✅ DO:**
- Update visuals **during** `dragged`, not just on `dragEnded`
- Use `requestAnimationFrame` for smooth 60fps updates
- Keep `dragged` function lightweight (runs 60+ times/sec)
- Debounce expensive operations (layout recalculations, database saves)

**❌ DON'T:**
- Make database calls inside `dragged` (will kill performance)
- Recalculate entire tree layout on every drag event
- Forget to provide visual feedback during drag (connections, drop zones)

### React Implementation Pattern

```typescript
const [isDragging, setIsDragging] = useState(false);
const [draggedNode, setDraggedNode] = useState<Node | null>(null);

const handleDragStart = (nodeId: string) => {
  setIsDragging(true);
  setDraggedNode(nodes.find(n => n.id === nodeId) || null);
};

const handleDrag = useCallback((delta: { x: number; y: number }) => {
  if (!draggedNode) return;
  
  // Update position every frame
  requestAnimationFrame(() => {
    setNodes(nodes => 
      nodes.map(n => 
        n.id === draggedNode.id 
          ? { ...n, x: n.x + delta.x, y: n.y + delta.y }
          : n
      )
    );
  });
}, [draggedNode]);

const handleDragEnd = async () => {
  setIsDragging(false);
  
  // Check for reparenting
  const targetNode = detectDropTarget(draggedNode);
  if (targetNode && isValidDrop(draggedNode, targetNode)) {
    await reparentNode(draggedNode.id, targetNode.id);
  }
  
  // Persist position
  await debouncedSavePosition(draggedNode.id, draggedNode.position);
  setDraggedNode(null);
};
```

---

## 2. Collision Detection for Drop Zones

### Axis-Aligned Bounding Box (AABB) Algorithm

The simplest and most performant collision detection for rectangular nodes:

```javascript
function detectCollision(nodeA, nodeB) {
  // Define bounding boxes
  const a = { 
    x: nodeA.x, 
    y: nodeA.y, 
    width: nodeA.width || 160, 
    height: nodeA.height || 40 
  };
  const b = { 
    x: nodeB.x, 
    y: nodeB.y, 
    width: nodeB.width || 160, 
    height: nodeB.height || 40 
  };
  
  // Check if boxes DON'T overlap (then negate)
  return !(
    a.x > b.x + b.width ||           // A is completely right of B
    a.x + a.width < b.x ||           // A is completely left of B
    a.y > b.y + b.height ||          // A is completely below B
    a.y + a.height < b.y             // A is completely above B
  );
}
```

### Visual Explanation

```
      ┌─────────┐
      │  Node B │
      └─────────┘
  ┌─────────┐           ← No collision (left)
  │  Node A │
  └─────────┘

                ┌─────────┐
                │  Node A │   ← No collision (right)
                └─────────┘

      ┌─────────┐
      │  Node B │
      └─────────┘
      ┌─────────┐           ← Collision detected!
      │  Node A │
      └─────────┘
```

### Alternative: Distance-Based Detection (for circular nodes)

```javascript
function detectCircularCollision(nodeA, nodeB, threshold = 50) {
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < threshold;
}
```

### Practical Implementation: Finding Drop Target

```javascript
function findDropTarget(draggedNode, allNodes) {
  let closestNode = null;
  let minDistance = Infinity;
  
  allNodes.forEach(node => {
    // Skip self and descendants
    if (node.id === draggedNode.id || isDescendant(draggedNode, node)) {
      return;
    }
    
    // Check collision
    if (detectCollision(draggedNode, node)) {
      // Optional: prefer closest node if multiple overlaps
      const distance = Math.sqrt(
        Math.pow(node.x - draggedNode.x, 2) + 
        Math.pow(node.y - draggedNode.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    }
  });
  
  return closestNode;
}
```

### Performance Optimization

For charts with 500+ nodes, collision detection can become slow. Optimize with spatial partitioning:

```javascript
// Quadtree-based spatial indexing (D3 provides this)
const quadtree = d3.quadtree()
  .x(d => d.x)
  .y(d => d.y)
  .addAll(nodes);

function findNearbyNodes(node, radius = 100) {
  const nearby = [];
  quadtree.visit((quad, x1, y1, x2, y2) => {
    if (!quad.length) {
      do {
        const d = quad.data;
        if (d !== node) {
          const dx = node.x - d.x;
          const dy = node.y - d.y;
          if (Math.sqrt(dx * dx + dy * dy) < radius) {
            nearby.push(d);
          }
        }
      } while (quad = quad.next);
    }
    // Stop visiting if quadrant is too far away
    return x1 > node.x + radius || y1 > node.y + radius ||
           x2 < node.x - radius || y2 < node.y - radius;
  });
  return nearby;
}
```

---

## 3. Cycle Prevention in Hierarchies

### The Problem

Allowing a parent to become a child of its own descendant creates a cycle:

```
Before (valid):          After (INVALID - cycle!):
    A                           C
    └─ B                        └─ D
       └─ C                        └─ A  ← Creates infinite loop!
          └─ D                        └─ B
                                         └─ C...
```

### The Solution: Recursive Descendant Check

```javascript
function isDescendant(potentialParent, potentialChild) {
  // Base case: node is its own descendant
  if (potentialParent === potentialChild) return true;
  
  // Recursive case: check all children
  if (potentialParent.children) {
    return potentialParent.children.some(child => 
      isDescendant(child, potentialChild)
    );
  }
  
  return false;
}

// Use before reparenting
function canReparent(draggedNode, targetNode) {
  // Cannot drop node onto itself
  if (draggedNode.id === targetNode.id) return false;
  
  // Cannot drop ancestor onto its own descendant
  if (isDescendant(draggedNode, targetNode)) return false;
  
  return true;
}
```

### Alternative: Iterative Implementation (Better Performance)

```javascript
function isDescendant(potentialParent, potentialChild) {
  const queue = [potentialParent];
  const visited = new Set();
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    // Found the child - it's a descendant
    if (current.id === potentialChild.id) return true;
    
    // Prevent infinite loops in corrupted data
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    
    // Add children to queue
    if (current.children) {
      queue.push(...current.children);
    }
  }
  
  return false;
}
```

### Visual Feedback for Invalid Drops

```javascript
function highlightDropZone(draggedNode, targetNode) {
  const isValid = canReparent(draggedNode, targetNode);
  
  if (isValid) {
    // Green border, valid drop
    targetNode.element.style.border = '3px dashed #10b981';
    targetNode.element.style.cursor = 'copy';
    showTooltip(`Drop to move under ${targetNode.name}`);
  } else {
    // Red border, invalid drop
    targetNode.element.style.border = '3px dashed #ef4444';
    targetNode.element.style.cursor = 'not-allowed';
    showTooltip('Cannot move parent under its own child');
  }
}
```

---

## 4. Real-Time Connection Updates

### The Performance Challenge

Redrawing **all** connection lines on every drag event (60 times/second) kills performance. Instead, only update affected connections.

### Efficient Selective Updates

```javascript
function updateLinks(draggedNode) {
  // Only update connections where this node is source or target
  const affectedLinks = allLinks.filter(link => 
    link.source.id === draggedNode.id || 
    link.target.id === draggedNode.id
  );
  
  affectedLinks.forEach(link => {
    const path = linkGenerator({
      source: link.source,
      target: link.target
    });
    
    // Update SVG path
    link.element.setAttribute('d', path);
  });
}
```

### D3 Pattern

```javascript
function updateLinks(source) {
  g.selectAll('path.link')
    .filter(l => l.source === source || l.target === source)
    .attr('d', d => linkGenerator({
      source: d.source === source 
        ? {x: source.x, y: source.y}  // Use live position
        : d.source,
      target: d.target === source 
        ? {x: source.x, y: source.y}  // Use live position
        : d.target
    }));
}
```

### React Pattern with useMemo

```typescript
const affectedConnections = useMemo(() => {
  if (!draggedNode) return [];
  
  return connections.filter(conn => 
    conn.sourceId === draggedNode.id || 
    conn.targetId === draggedNode.id
  );
}, [draggedNode, connections]);

// In render
{affectedConnections.map(conn => (
  <ConnectionLine
    key={conn.id}
    from={getNodePosition(conn.sourceId)}
    to={getNodePosition(conn.targetId)}
    isAnimated={isDragging}
  />
))}
```

### Bezier Curve Generation (D3)

```javascript
const linkGenerator = d3.linkVertical()
  .x(d => d.x)
  .y(d => d.y);

// For horizontal trees
const linkGenerator = d3.linkHorizontal()
  .x(d => d.y)  // Note: x and y swapped
  .y(d => d.x);
```

### Custom Bezier Curves

```javascript
function generateCurvedPath(source, target) {
  const midY = (source.y + target.y) / 2;
  
  // SVG path with cubic Bezier curve
  return `
    M ${source.x} ${source.y}
    C ${source.x} ${midY},
      ${target.x} ${midY},
      ${target.x} ${target.y}
  `;
}
```

---

## 5. Hierarchy Restructuring

### The Complete Reparenting Algorithm

```javascript
function reparentNode(draggedNode, newParent) {
  // Step 1: Remove from old parent
  if (draggedNode.parent) {
    const oldParent = draggedNode.parent;
    oldParent.children = oldParent.children.filter(
      child => child.id !== draggedNode.id
    );
    
    // Clean up empty children array
    if (oldParent.children.length === 0) {
      delete oldParent.children;
    }
  }
  
  // Step 2: Add to new parent
  if (!newParent.children) {
    newParent.children = [];
  }
  newParent.children.push(draggedNode);
  draggedNode.parent = newParent;
  
  // Step 3: Update depth for entire subtree
  updateSubtreeDepth(draggedNode, newParent.depth + 1);
  
  // Step 4: Recalculate layout
  recalculateTreeLayout(root);
  
  // Step 5: Persist to backend
  await saveReparenting(draggedNode.id, newParent.id);
}

function updateSubtreeDepth(node, newDepth) {
  node.depth = newDepth;
  
  if (node.children) {
    node.children.forEach(child => {
      updateSubtreeDepth(child, newDepth + 1);
    });
  }
}
```

### React/Zustand Implementation

```typescript
// In Zustand store
reparentNode: (nodeId: string, newParentId: string | null) => {
  set(state => {
    const nodes = [...state.nodes];
    const draggedNode = nodes.find(n => n.id === nodeId);
    const oldParent = nodes.find(n => n.id === draggedNode.parentId);
    const newParent = newParentId 
      ? nodes.find(n => n.id === newParentId) 
      : null;
    
    // Update parent reference
    draggedNode.parentId = newParentId;
    
    // Update depth recursively
    const updateDepth = (node: Node, depth: number) => {
      node.depth = depth;
      nodes
        .filter(n => n.parentId === node.id)
        .forEach(child => updateDepth(child, depth + 1));
    };
    
    updateDepth(draggedNode, newParent ? newParent.depth + 1 : 0);
    
    return { nodes };
  });
  
  // Persist to Supabase
  await supabase
    .from('org_nodes')
    .update({ parent_id: newParentId })
    .eq('id', nodeId);
},
```

### Database Considerations

```sql
-- Ensure referential integrity
ALTER TABLE org_nodes
  ADD CONSTRAINT fk_parent
  FOREIGN KEY (parent_id)
  REFERENCES org_nodes(id)
  ON DELETE CASCADE;  -- Delete children when parent deleted

-- Prevent self-reference
ALTER TABLE org_nodes
  ADD CONSTRAINT no_self_parent
  CHECK (id != parent_id);

-- Index for fast hierarchy queries
CREATE INDEX idx_parent ON org_nodes(parent_id);
```

---

## 6. Performance Optimization

### Transform vs Position (Critical!)

```javascript
// ❌ BAD: Triggers layout recalculation (expensive)
node.setAttribute('x', newX);
node.setAttribute('y', newY);

// ✅ GOOD: No layout recalculation
node.setAttribute('transform', `translate(${newX}, ${newY})`);

// 🚀 BEST: GPU-accelerated (use in React/HTML)
node.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
```

### Why This Matters

| Method | Reflow | Repaint | GPU | FPS (500 nodes) |
|--------|---------|---------|-----|-----------------|
| `x`/`y` attributes | ✅ Yes | ✅ Yes | ❌ No | ~15-20 fps |
| SVG `transform` | ❌ No | ✅ Yes | ❌ No | ~45-55 fps |
| CSS `transform` | ❌ No | ❌ No | ✅ Yes | 60 fps |

### RequestAnimationFrame Pattern

```javascript
function dragged(event, d) {
  // Batch updates for next frame
  requestAnimationFrame(() => {
    d.x = event.x;
    d.y = event.y;
    updateNodePosition(d);
    updateLinks(d);
  });
}
```

### Debouncing Database Saves

```javascript
const debouncedSave = debounce((nodeId, position) => {
  fetch('/api/nodes/' + nodeId, {
    method: 'PATCH',
    body: JSON.stringify({ position }),
  });
}, 500); // Wait 500ms after drag ends

function dragEnded(event, d) {
  debouncedSave(d.id, { x: d.x, y: d.y });
}
```

### Viewport Culling (for 1000+ nodes)

```javascript
function getVisibleNodes(allNodes, viewport) {
  const buffer = 100; // Render nodes slightly outside viewport
  
  return allNodes.filter(node => {
    return node.x >= viewport.x - buffer &&
           node.x <= viewport.x + viewport.width + buffer &&
           node.y >= viewport.y - buffer &&
           node.y <= viewport.y + viewport.height + buffer;
  });
}

// Only render visible nodes
const visibleNodes = useMemo(() => 
  getVisibleNodes(allNodes, viewport),
  [allNodes, viewport]
);
```

---

## 7. Visual Feedback Best Practices

### Drop Zone Highlighting

```javascript
function showDropZone(targetNode, isValid) {
  const style = isValid 
    ? {
        border: '3px dashed #10b981',
        boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.2)',
        cursor: 'copy'
      }
    : {
        border: '3px dashed #ef4444',
        boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.2)',
        cursor: 'not-allowed'
      };
  
  Object.assign(targetNode.element.style, style);
}
```

### Drag Shadow Effect

```css
.node.dragging {
  z-index: 1000;
  opacity: 0.8;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  cursor: grabbing;
}

.node.dragging::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid #3b82f6;
  border-radius: inherit;
  pointer-events: none;
}
```

### Animated Reparenting

```javascript
function animateReparent(node, newPosition) {
  // Smooth transition to new position
  const animation = node.element.animate([
    { transform: `translate(${node.x}px, ${node.y}px)` },
    { transform: `translate(${newPosition.x}px, ${newPosition.y}px)` }
  ], {
    duration: 300,
    easing: 'ease-out',
    fill: 'forwards'
  });
  
  animation.onfinish = () => {
    node.x = newPosition.x;
    node.y = newPosition.y;
  };
}
```

---

## 8. Common Pitfalls & Solutions

### Pitfall 1: Losing Node References

```javascript
// ❌ WRONG: Creates new objects, breaks references
const updatedNodes = nodes.map(n => ({
  ...n,
  x: n.id === draggedId ? newX : n.x
}));

// ✅ CORRECT: Mutate existing objects (for D3)
const draggedNode = nodes.find(n => n.id === draggedId);
draggedNode.x = newX;
```

### Pitfall 2: Forgetting to Update Children

```javascript
// When moving a node, its children must move too
function moveNodeWithChildren(node, deltaX, deltaY) {
  node.x += deltaX;
  node.y += deltaY;
  
  // Recursively move all descendants
  if (node.children) {
    node.children.forEach(child => 
      moveNodeWithChildren(child, deltaX, deltaY)
    );
  }
}
```

### Pitfall 3: Not Preventing Default Drag Behavior

```javascript
// Browser has built-in drag behavior for images, links, etc.
node.addEventListener('dragstart', (e) => {
  e.preventDefault(); // Prevent browser default
  handleDragStart(e);
});
```

### Pitfall 4: Race Conditions on Save

```javascript
// ❌ WRONG: Multiple saves can conflict
function dragEnded() {
  saveToDatabase(node); // If user drags again quickly, conflicts!
}

// ✅ CORRECT: Cancel pending saves
let savePromise = null;

function dragEnded() {
  if (savePromise) {
    savePromise.cancel();
  }
  savePromise = saveToDatabase(node);
}
```

---

## 9. Testing Checklist

### Functional Tests

- [ ] Can drag any node smoothly (60fps)
- [ ] Connections update in real-time during drag
- [ ] Can drop onto valid targets (highlights correctly)
- [ ] Invalid drops prevented (red highlight, tooltip)
- [ ] Cannot create cycles (parent → descendant)
- [ ] Cannot drop node onto itself
- [ ] Children move with parent when dragged
- [ ] Depth updates correctly after reparent
- [ ] Changes persist to database
- [ ] Works with 1 node, 10 nodes, 500 nodes

### Edge Cases

- [ ] Drag root node (no parent to remove from)
- [ ] Drag node with 100+ descendants (performance)
- [ ] Drag to empty space (detach from parent)
- [ ] Rapid successive drags (no corruption)
- [ ] Drag during slow network (auto-save queues correctly)
- [ ] Drag while zoomed in/out
- [ ] Drag while canvas is panned off-center

### Browser Compatibility

- [ ] Chrome (primary)
- [ ] Firefox
- [ ] Safari (especially Mac)
- [ ] Edge
- [ ] Touch devices (iPad, tablets)

---

## 10. Complete Working Example (React + @dnd-kit)

```typescript
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { useState } from 'react';

function OrgChart({ nodes }: { nodes: Node[] }) {
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (!over) {
      // Dropped on empty space - detach from parent
      reparentNode(active.id, null);
      return;
    }
    
    // Validate drop
    const draggedNode = nodes.find(n => n.id === active.id);
    const targetNode = nodes.find(n => n.id === over.id);
    
    if (!canReparent(draggedNode, targetNode)) {
      console.warn('Invalid drop - would create cycle');
      return;
    }
    
    // Reparent
    reparentNode(active.id, over.id);
  };
  
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <svg width="100%" height="100%">
        {nodes.map(node => (
          <DraggableNode
            key={node.id}
            node={node}
            onDragStart={() => setDraggedNode(node)}
          />
        ))}
        
        <ConnectionLines
          nodes={nodes}
          draggedNode={draggedNode}
        />
      </svg>
    </DndContext>
  );
}

function DraggableNode({ node, onDragStart }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: node.id,
    data: node,
  });
  
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    data: node,
  });
  
  const style = {
    transform: transform 
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)` 
      : undefined,
    border: isOver ? '3px dashed #10b981' : '2px solid #e5e7eb',
  };
  
  return (
    <g
      ref={(el) => {
        setNodeRef(el);
        setDropRef(el);
      }}
      {...listeners}
      {...attributes}
      style={style}
      onMouseDown={onDragStart}
    >
      <rect
        x={node.x - 80}
        y={node.y - 25}
        width={160}
        height={50}
        fill="white"
        stroke="currentColor"
      />
      <text
        x={node.x}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {node.name}
      </text>
    </g>
  );
}
```

---

## Summary: The Golden Rules

1. **Update visuals in real-time** during drag (not just on drop)
2. **Use transforms**, not position attributes (GPU acceleration)
3. **Validate drops** before committing (prevent cycles)
4. **Update entire subtree** when reparenting (depth, children)
5. **Debounce database saves** (not on every frame)
6. **Filter connections** to update only affected ones
7. **Provide clear visual feedback** (drop zones, cursors, tooltips)
8. **Test edge cases** (root nodes, deep hierarchies, rapid drags)

---

**Questions or Improvements?**

This document is a living reference. If you discover better patterns or encounter edge cases not covered here, please contribute updates.

**Further Reading:**
- D3 Drag: https://d3js.org/d3-drag
- @dnd-kit: https://docs.dndkit.com
- Pointer Events API: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events