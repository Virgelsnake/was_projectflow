console.log('=== CLIENT.JS LOADED - VERSION 2.0 (with expand/collapse) ===');
console.log('Expand/Collapse buttons should be present. If you see this but no buttons, check HTML.');

let root;
let i = 0;

// Function to get next unique node number
function getNextNodeNumber() {
  let maxNum = 0;
  function findMax(node) {
    const match = node.data.name.match(/New Node (\d+)/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    if (node.children) node.children.forEach(findMax);
    if (node._children) node._children.forEach(findMax);
  }
  if (root) findMax(root);
  return maxNum + 1;
}

// Get chart ID from URL query parameter
const urlParams = new URLSearchParams(window.location.search);
const chartId = urlParams.get('chart') || 'acme-corp';

// Build API URL with chart parameter
function apiUrl(endpoint) {
  return `${endpoint}?chart=${chartId}`;
}

// Fetch initial data from the server
fetch(apiUrl("/api/tree"))
  .then((response) => response.json())
  .then((data) => {
    console.log({ data });
    root = d3.hierarchy(data);

    root.x0 = height / 2;
    root.y0 = 0;

    function collapse(d) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    if (root.children) {
      root.children.forEach(collapse);
    }

    update(root);
    
    // Center the tree on initial load (delayed to ensure zoom is ready)
    setTimeout(centerTree, 100);
  });

const margin = { top: 40, right: 120, bottom: 50, left: 120 };
const width = 1800 - margin.left - margin.right;
const height = 1200 - margin.top - margin.bottom;

const viewBoxWidth = width + margin.left + margin.right;
const viewBoxHeight = height + margin.top + margin.bottom;

const svg = d3
  .select(".svg-content-responsive")
  .attr("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .append("g")
  .attr("transform", `translate(${viewBoxWidth / 2},${margin.top + 60})`);

const g = svg.append("g");

const tooltip = d3.select("#tooltip");

const dx = 200;
const dy = 200;

const treeLayout = d3.tree().nodeSize([dx, dy]);

const linkGenerator = d3
  .linkVertical()
  .x((d) => d.x)
  .y((d) => d.y);

let selectedNode = null;
let clickTimeout = null;
let hideTooltipTimeout = null;
let deleteMode = false;

function update(source) {
  const treeData = treeLayout(root);
  const nodes = treeData.descendants().reverse();
  const links = treeData.links();

  nodes.forEach((d) => {
    d.y = d.depth * dy;
  });

  const node = g.selectAll("g.node").data(nodes, (d) => d.id || (d.id = ++i));

  const nodeEnter = node
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${source.x0},${source.y0})`)
    .call(
      d3
        .drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded),
    )
    .on("dblclick", (event, d) => {
      if (!deleteMode) {
        toggleChildren(d);
        update(d);
      }
    })
    .on("mouseover", (event, d) => {
      if (hideTooltipTimeout) clearTimeout(hideTooltipTimeout);
      tooltip
        .style("display", "block")
        .html(
          `<strong>${d.data.name}</strong><br/>${d.data.additionalInfo}<br/><strong>Responsible:</strong> ${d.data.personName}<br/><strong>Status:</strong> ${d.data.status}<br/><strong>Cost:</strong> ${d.data.cost}<br/><a href="${d.data.url}" target="_blank" style="color: ${d.data.color === "#FFFF00" || d.data.color === "#00FF00" ? "black" : "white"};">${d.data.url}</a>`,
        )
        .style("left", event.pageX + 50 + "px") // Adjusted offset here
        .style("top", event.pageY - 50 + "px"); // Adjusted offset here
    })
    .on("mouseout", (event, d) => {
      hideTooltipTimeout = setTimeout(() => {
        tooltip.style("display", "none");
      }, 500);
    })
    .on("click", (event, d) => {
      if (deleteMode && d !== root) {
        deleteNode(d);
      }
    });

  tooltip.on("mouseover", () => {
    if (hideTooltipTimeout) clearTimeout(hideTooltipTimeout);
  });

  tooltip.on("mouseout", () => {
    hideTooltipTimeout = setTimeout(() => {
      tooltip.style("display", "none");
    }, 500);
  });

  nodeEnter
    .append("rect")
    .attr("width", 160)
    .attr("height", (d) => {
      const lines = wrapText(d.data.name, 140);
      return lines.length * 14 + 10;
    })
    .attr("x", -80)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2;
    })
    .style("fill", (d) => d.data.color || "#2A3565")
    .style("stroke", "#ccc")
    .style("stroke-width", 2);

  // Add expand/collapse toggle circle for nodes with children
  nodeEnter
    .filter((d) => d.children || d._children)
    .append("circle")
    .attr("class", "toggle-circle")
    .attr("cy", (d) => {
      const lines = wrapText(d.data.name, 140);
      return (lines.length * 14 + 10) / 2 + 12;
    })
    .attr("r", 10)
    .style("fill", "#fff")
    .style("stroke", (d) => d.data.color || "#2A3565")
    .style("stroke-width", 2)
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      event.stopPropagation();
      toggleChildren(d);
      update(d);
    });

  // Add +/- text inside toggle circle
  nodeEnter
    .filter((d) => d.children || d._children)
    .append("text")
    .attr("class", "toggle-text")
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return (lines.length * 14 + 10) / 2 + 12;
    })
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("fill", (d) => d.data.color || "#2A3565")
    .style("pointer-events", "none")
    .text((d) => d._children ? "+" : "−");

  nodeEnter
    .append("foreignObject")
    .attr("x", -80)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2;
    })
    .attr("width", 160)
    .attr("height", (d) => {
      const lines = wrapText(d.data.name, 140);
      return lines.length * 14 + 10;
    })
    .append("xhtml:div")
    .style("width", "160px")
    .style("height", "auto")
    .style("text-align", "center")
    .style("word-wrap", "break-word")
    .style("line-height", "1.1em")
    .style("color", (d) =>
      d.data.color === "#FFFF00" || d.data.color === "#00FF00"
        ? "black"
        : "white",
    )
    .html((d) => d.data.name);

  nodeEnter
    .append("svg:foreignObject")
    .attr("x", -100)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2 + 4;
    })
    .attr("width", 20)
    .attr("height", 20)
    .append("xhtml:div")
    .html(
      '<svg class="edit-button" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21H6.75L17.81 9.93999L14.06 6.18999L3 17.25ZM20.71 7.04099C21.1 6.65099 21.1 6.02099 20.71 5.63099L18.37 3.29099C17.98 2.90099 17.35 2.90099 16.96 3.29099L15.13 5.12099L18.88 8.87099L20.71 7.04099Z" fill="currentColor"/></svg>',
    )
    .on("click", (event, d) => {
      event.stopPropagation();
      const editInput = document.getElementById("editInput");
      const editUrlInput = document.getElementById("editUrlInput");
      const editInfoInput = document.getElementById("editInfoInput");
      const editPersonNameInput = document.getElementById(
        "editPersonNameInput",
      );
      const editStatusInput = document.getElementById("editStatusInput");
      const editCostInput = document.getElementById("editCostInput");
      const saveButton = document.getElementById("saveButton");
      const titleLabel = document.getElementById("titleLabel");
      const urlLabel = document.getElementById("urlLabel");
      const infoLabel = document.getElementById("infoLabel");
      const personNameLabel = document.getElementById("personNameLabel");
      const statusLabel = document.getElementById("statusLabel");
      const costLabel = document.getElementById("costLabel");
      const bbox = event.target.getBoundingClientRect();

      titleLabel.style.left = `${bbox.left}px`;
      titleLabel.style.top = `${bbox.top - 20}px`;
      titleLabel.style.display = "block";

      editInput.style.left = `${bbox.left}px`;
      editInput.style.top = `${bbox.top}px`;
      editInput.value = d.data.name;
      editInput.style.display = "block";
      editInput.focus();

      urlLabel.style.left = `${bbox.left}px`;
      urlLabel.style.top = `${bbox.top + 50 - 20}px`;
      urlLabel.style.display = "block";

      editUrlInput.style.left = `${bbox.left}px`;
      editUrlInput.style.top = `${bbox.top + 50}px`;
      editUrlInput.value = d.data.url || "";
      editUrlInput.style.display = "block";

      infoLabel.style.left = `${bbox.left}px`;
      infoLabel.style.top = `${bbox.top + 100 - 20}px`;
      infoLabel.style.display = "block";

      editInfoInput.style.left = `${bbox.left}px`;
      editInfoInput.style.top = `${bbox.top + 100}px`;
      editInfoInput.value = d.data.additionalInfo || "";
      editInfoInput.style.display = "block";

      personNameLabel.style.left = `${bbox.left}px`;
      personNameLabel.style.top = `${bbox.top + 150 - 20}px`;
      personNameLabel.style.display = "block";

      editPersonNameInput.style.left = `${bbox.left}px`;
      editPersonNameInput.style.top = `${bbox.top + 150}px`;
      editPersonNameInput.value = d.data.personName || "";
      editPersonNameInput.style.display = "block";

      statusLabel.style.left = `${bbox.left}px`;
      statusLabel.style.top = `${bbox.top + 200 - 20}px`;
      statusLabel.style.display = "block";

      editStatusInput.style.left = `${bbox.left}px`;
      editStatusInput.style.top = `${bbox.top + 200}px`;
      editStatusInput.value = d.data.status || "";
      editStatusInput.style.display = "block";

      costLabel.style.left = `${bbox.left}px`;
      costLabel.style.top = `${bbox.top + 250 - 20}px`;
      costLabel.style.display = "block";

      editCostInput.style.left = `${bbox.left}px`;
      editCostInput.style.top = `${bbox.top + 250}px`;
      editCostInput.value = d.data.cost || "";
      editCostInput.style.display = "block";

      saveButton.style.left = `${bbox.left}px`;
      saveButton.style.top = `${bbox.top + 300}px`;
      saveButton.style.display = "block";

      selectedNode = d;
    });

  nodeEnter
    .append("svg:foreignObject")
    .attr("x", 80)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2 + 4;
    })
    .attr("width", 20)
    .attr("height", 20)
    .append("xhtml:div")
    .html(
      '<svg class="color-button" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21H6.75L17.81 9.93999L14.06 6.18999L3 17.25ZM20.71 7.04099C21.1 6.65099 21.1 6.02099 20.71 5.63099L18.37 3.29099C17.98 2.90099 17.35 2.90099 16.96 3.29099L15.13 5.12099L18.88 8.87099L20.71 7.04099Z" fill="currentColor"/></svg>',
    )
    .on("click", (event, d) => {
      event.stopPropagation();
      selectedNode = d;
      const colorPicker = document.getElementById("colorPicker");
      colorPicker.style.left = `${event.pageX}px`;
      colorPicker.style.top = `${event.pageY}px`;
      const colorSelect = document.getElementById("colorSelect");
      colorSelect.value = selectedNode.data.color;
      colorPicker.style.display = "block";
    });

  const nodeUpdate = nodeEnter.merge(node);

  nodeUpdate
    .transition()
    .duration(750)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  nodeUpdate
    .select("rect")
    .attr("width", 160)
    .attr("height", (d) => {
      const lines = wrapText(d.data.name, 140);
      return lines.length * 14 + 10;
    })
    .attr("x", -80)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2;
    })
    .style("fill", (d) => d.data.color || "#2A3565");

  nodeUpdate
    .select("foreignObject div")
    .style("color", (d) =>
      d.data.color === "#FFFF00" || d.data.color === "#00FF00"
        ? "black"
        : "white",
    )
    .html((d) => d.data.name);

  nodeUpdate
    .select(".edit-button")
    .attr("x", -100)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2 + 4;
    });

  nodeUpdate
    .select(".color-button")
    .attr("x", 80)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2 + 4;
    });

  // Update toggle text (+/-) based on collapsed state
  nodeUpdate
    .select(".toggle-text")
    .text((d) => d._children ? "+" : "−");

  // Create a set of visible node IDs for quick lookup
  const visibleNodeIds = new Set(nodes.map(n => n.id || n.data?.id));
  
  const nodeExit = node
    .exit()
    .transition()
    .duration(750)
    .attr("transform", (d) => {
      // Find the closest ancestor that is still visible in the tree
      let ancestor = d.parent;
      while (ancestor && !visibleNodeIds.has(ancestor.id || ancestor.data?.id)) {
        ancestor = ancestor.parent;
      }
      const target = ancestor || source;
      return `translate(${target.x},${target.y})`;
    })
    .remove();

  nodeExit
    .select("rect")
    .attr("width", 160)
    .attr("height", (d) => {
      const lines = wrapText(d.data.name, 140);
      return lines.length * 14 + 10;
    })
    .attr("x", -80)
    .attr("y", (d) => {
      const lines = wrapText(d.data.name, 140);
      return -(lines.length * 14 + 10) / 2;
    });

  nodeExit.select("text").style("fill-opacity", 1e-6);

  const link = g.selectAll("path.link").data(links, (d) => d.target.id);

  const linkEnter = link
    .enter()
    .insert("path", "g")
    .attr("class", "link")
    .attr("d", (d) => {
      const o = { x: source.x0, y: source.y0 };
      return linkGenerator({ source: o, target: o });
    })
    .style("stroke", "#A7A8A9");

  linkEnter.merge(link).transition().duration(750).attr("d", linkGenerator);

  link
    .exit()
    .transition()
    .duration(750)
    .attr("d", (d) => {
      // Find the closest visible ancestor for the link's target
      let ancestor = d.target.parent;
      while (ancestor && !visibleNodeIds.has(ancestor.id || ancestor.data?.id)) {
        ancestor = ancestor.parent;
      }
      const target = ancestor || source;
      const o = { x: target.x, y: target.y };
      return linkGenerator({ source: o, target: o });
    })
    .remove();

  nodes.forEach((d) => {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

function persist(node) {
  fetch(apiUrl("/api/update-node"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: node.data.id,
      parentId: node.data.parentId,
      name: node.data.name,
      url: node.data.url,
      description: node.data.additionalInfo,
      responsible: node.data.personName,
      status: node.data.status,
      cost: node.data.cost,
    }),
  }).catch((err) => console.error(err));
}

function saveEdit() {
  const editInput = document.getElementById("editInput");
  const editUrlInput = document.getElementById("editUrlInput");
  const editInfoInput = document.getElementById("editInfoInput");
  const editPersonNameInput = document.getElementById("editPersonNameInput");
  const editStatusInput = document.getElementById("editStatusInput");
  const editCostInput = document.getElementById("editCostInput");
  selectedNode.data.name = editInput.value;
  selectedNode.data.url = editUrlInput.value;
  selectedNode.data.additionalInfo = editInfoInput.value;
  selectedNode.data.personName = editPersonNameInput.value;
  selectedNode.data.status = editStatusInput.value;
  selectedNode.data.cost = editCostInput.value;

  persist(selectedNode);

  update(selectedNode);

  editInput.style.display = "none";
  editUrlInput.style.display = "none";
  editInfoInput.style.display = "none";
  editPersonNameInput.style.display = "none";
  editStatusInput.style.display = "none";
  editCostInput.style.display = "none";
  document.getElementById("saveButton").style.display = "none";

  document.getElementById("titleLabel").style.display = "none";
  document.getElementById("urlLabel").style.display = "none";
  document.getElementById("infoLabel").style.display = "none";
  document.getElementById("personNameLabel").style.display = "none";
  document.getElementById("statusLabel").style.display = "none";
  document.getElementById("costLabel").style.display = "none";
}

function applyColor() {
  const selectedColor = document.getElementById("colorSelect").value;
  const textColor =
    document.getElementById("colorSelect").selectedOptions[0].dataset.textColor;
  if (selectedNode) {
    fetch(apiUrl("/api/update-node-color"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: selectedNode.data.id,
        color: selectedColor,
        textColor: textColor,
      }),
    }).catch((err) => console.error(err));

    selectedNode.data.color = selectedColor;
    selectedNode.data.textColor = textColor;

    update(selectedNode);

    selectedNode = null;
  }
  document.getElementById("colorPicker").style.display = "none";
}

function toggleChildren(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}

function wrap(text, width) {
  text.each(function () {
    const text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      lineHeight = 1.1,
      y = text.attr("y"),
      dy = parseFloat(text.attr("dy"));
    let word,
      line = [],
      lineNumber = 0,
      tspan = text
        .text(null)
        .append("tspan")
        .attr("x", 0)
        .attr("y", y)
        .attr("dy", dy + "em");
    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text
          .append("tspan")
          .attr("x", 0)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}

function wrapText(text, width) {
  const words = text.split(/\s+/),
    lines = [],
    lineHeight = 1.1;
  let line = [];

  while (words.length) {
    const word = words.shift();
    line.push(word);
    const textLength = line.join(" ").length * 6;
    if (textLength > width) {
      line.pop();
      lines.push(line.join(" "));
      line = [word];
    }
  }

  lines.push(line.join(" "));
  return lines;
}

const zoom = d3
  .zoom()
  .scaleExtent([0.5, 2])
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
  });

d3.select("svg").call(zoom);

function centerTree() {
  // No initial transform needed - tree will be centered via preserveAspectRatio xMidYMid
  // Just reset to identity transform
  const initialTransform = d3.zoomIdentity;
  d3.select("svg").call(zoom.transform, initialTransform);
}

document.addEventListener("click", function (event) {
  const colorPicker = document.getElementById("colorPicker");
  const editInput = document.getElementById("editInput");
  const editUrlInput = document.getElementById("editUrlInput");
  const editInfoInput = document.getElementById("editInfoInput");
  const editPersonNameInput = document.getElementById("editPersonNameInput");
  const editStatusInput = document.getElementById("editStatusInput");
  const editCostInput = document.getElementById("editCostInput");
  const saveButton = document.getElementById("saveButton");
  const titleLabel = document.getElementById("titleLabel");
  const urlLabel = document.getElementById("urlLabel");
  const infoLabel = document.getElementById("infoLabel");
  const personNameLabel = document.getElementById("personNameLabel");
  const statusLabel = document.getElementById("statusLabel");
  const costLabel = document.getElementById("costLabel");

  if (
    !colorPicker.contains(event.target) &&
    colorPicker.style.display === "block"
  ) {
    colorPicker.style.display = "none";
    selectedNode = null;
  }

  if (
    !editInput.contains(event.target) &&
    !editUrlInput.contains(event.target) &&
    !editInfoInput.contains(event.target) &&
    !editPersonNameInput.contains(event.target) &&
    !editStatusInput.contains(event.target) &&
    !editCostInput.contains(event.target) &&
    !saveButton.contains(event.target)
  ) {
    editInput.style.display = "none";
    editUrlInput.style.display = "none";
    editInfoInput.style.display = "none";
    editPersonNameInput.style.display = "none";
    editStatusInput.style.display = "none";
    editCostInput.style.display = "none";
    saveButton.style.display = "none";

    titleLabel.style.display = "none";
    urlLabel.style.display = "none";
    infoLabel.style.display = "none";
    personNameLabel.style.display = "none";
    statusLabel.style.display = "none";
    costLabel.style.display = "none";
  }
});

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

function updateLinks(source) {
  g.selectAll("path.link")
    .filter((l) => l.source === source || l.target === source)
    .attr("d", (d) =>
      linkGenerator({
        source: d.source === source ? { x: source.x, y: source.y } : d.source,
        target: d.target === source ? { x: source.x, y: source.y } : d.target,
      }),
    );
}

function handleNodeDrop(event, draggedNode) {
  const nodes = g.selectAll(".node").nodes();
  let targetNode = null;
  nodes.forEach((nodeElement) => {
    const nodeData = d3.select(nodeElement).datum();
    if (nodeData !== draggedNode && detectCollision(draggedNode, nodeData)) {
      targetNode = nodeData;
    }
  });

  if (
    targetNode &&
    targetNode !== draggedNode.parent &&
    !isDescendant(draggedNode, targetNode)
  ) {
    reconnectNodes(draggedNode, targetNode);
  } else {
    update(root);
  }
}

function detectCollision(nodeA, nodeB) {
  const a = { x: nodeA.x, y: nodeA.y, width: 160, height: 40 };
  const b = { x: nodeB.x, y: nodeB.y, width: 160, height: 40 };
  return !(
    a.x > b.x + b.width ||
    a.x + a.width < b.x ||
    a.y > b.y + b.height ||
    a.y + a.height < b.y
  );
}

function reconnectNodes(draggedNode, targetNode) {
  const oldParent = draggedNode.parent;
  
  // Remove from old parent's children array
  if (oldParent) {
    if (oldParent.children) {
      oldParent.children = oldParent.children.filter(
        (child) => child !== draggedNode,
      );
      if (oldParent.children.length === 0) {
        delete oldParent.children;
      }
    }
    // Also check _children (collapsed state)
    if (oldParent._children) {
      oldParent._children = oldParent._children.filter(
        (child) => child !== draggedNode,
      );
      if (oldParent._children.length === 0) {
        delete oldParent._children;
      }
    }
  }

  // Add to new parent - always add to visible children to show the result
  // If target is collapsed, expand it first so user can see the result
  if (targetNode._children) {
    targetNode.children = targetNode._children;
    targetNode._children = null;
  }
  
  if (!targetNode.children) targetNode.children = [];
  targetNode.children.push(draggedNode);
  draggedNode.parent = targetNode;

  // Update the data's parentId for persistence
  draggedNode.data.parentId = targetNode.data.id;

  // Recursively update depth for dragged node and all its descendants
  draggedNode.depth = targetNode.depth + 1;
  adjustNodePosition(draggedNode);

  update(root);

  persist(draggedNode);
}

function adjustNodePosition(draggedNode) {
  // Handle visible children
  if (draggedNode.children) {
    draggedNode.children.forEach((child) => {
      child.depth = draggedNode.depth + 1;
      adjustNodePosition(child);
    });
  }
  // Handle collapsed children
  if (draggedNode._children) {
    draggedNode._children.forEach((child) => {
      child.depth = draggedNode.depth + 1;
      adjustNodePosition(child);
    });
  }
}

function isDescendant(parent, child) {
  if (parent === child) return true;
  // Check visible children
  if (parent.children) {
    if (parent.children.some((node) => isDescendant(node, child))) return true;
  }
  // Check collapsed children
  if (parent._children) {
    if (parent._children.some((node) => isDescendant(node, child))) return true;
  }
  return false;
}

function addNewNode() {
  const nodeNum = getNextNodeNumber();
  fetch(apiUrl("/api/add-node"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parentId: root?.data?.id,
      name: `New Node ${nodeNum}`,
    }),
  })
    .then((response) => response.json())
    .then((newNodeData) => {
      const newNode = d3.hierarchy(newNodeData);

      if (!root.children) root.children = [];
      root.children.push(newNode);

      newNode.depth = 1;
      newNode.height = 0;
      newNode.parent = root;
      newNode.x = width / 2;
      newNode.y = 50;

      update(root);

      // Apply drag behaviour to the new node
      g.selectAll("g.node")
        .filter((d) => d.id === newNode.id)
        .call(
          d3
            .drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded),
        );
    });
}

function exportJson() {
  window.location.href = apiUrl("/export-json");
}

function deleteNode(node) {
  if (node === root) return;

  fetch(apiUrl("/api/delete-node"), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: node.data.id,
    }),
  })
    .then(() => {
      const parent = node.parent;
      parent.children = parent.children.filter((child) => child !== node);

      if (parent.children.length === 0) {
        delete parent.children;
      }

      update(root);
    })
    .catch((err) => console.error(err));
}

function toggleDeleteMode() {
  deleteMode = !deleteMode;
  d3.select("body").classed("delete-mode", deleteMode);
  d3.select("#deleteNodeBtn").text(
    deleteMode ? "Cancel Delete Mode" : "Delete Mode",
  );
}

function expandAll() {
  function expand(d) {
    if (d._children) {
      d.children = d._children;
      d._children = null;
    }
    if (d.children) {
      d.children.forEach(expand);
    }
  }
  if (root) {
    expand(root);
    update(root);
  }
}

function collapseAll() {
  function collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }
  if (root && root.children) {
    root.children.forEach(collapse);
    update(root);
  }
}

document.getElementById("addNodeBtn").addEventListener("click", addNewNode);
document
  .getElementById("deleteNodeBtn")
  .addEventListener("click", toggleDeleteMode);

// Diagnostic: Check if expand/collapse buttons exist
const expandBtn = document.getElementById("expandAllBtn");
const collapseBtn = document.getElementById("collapseAllBtn");
console.log('expandAllBtn element:', expandBtn);
console.log('collapseAllBtn element:', collapseBtn);

if (expandBtn) {
  expandBtn.addEventListener("click", expandAll);
  console.log('✓ expandAllBtn listener attached');
} else {
  console.error('✗ expandAllBtn NOT FOUND in HTML!');
}

if (collapseBtn) {
  collapseBtn.addEventListener("click", collapseAll);
  console.log('✓ collapseAllBtn listener attached');
} else {
  console.error('✗ collapseAllBtn NOT FOUND in HTML!');
}

document.getElementById("exportBtn").addEventListener("click", exportJson);
