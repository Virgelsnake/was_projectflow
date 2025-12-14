// Seed Firestore with 3 org charts
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: 'wbs-orgflow',
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Original working chart data (from provider_memory.js)
const acmeCorpNodes = [
  { id: 1, parentId: null, name: 'CEO', description: 'Chief Executive Officer', responsible: 'John Smith', status: 'Active', cost: '$500k', url: '', color: '#003057', textColor: 'white' },
  { id: 2, parentId: 1, name: 'CTO', description: 'Chief Technology Officer', responsible: 'Jane Doe', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
  { id: 3, parentId: 1, name: 'CFO', description: 'Chief Financial Officer', responsible: 'Bob Wilson', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
  { id: 4, parentId: 1, name: 'COO', description: 'Chief Operating Officer', responsible: 'Alice Brown', status: 'Active', cost: '$350k', url: '', color: '#003057', textColor: 'white' },
  { id: 5, parentId: 2, name: 'Engineering Lead', description: 'Leads engineering team', responsible: 'Mike Johnson', status: 'Active', cost: '$200k', url: '', color: '#003057', textColor: 'white' },
  { id: 6, parentId: 2, name: 'Product Manager', description: 'Product management', responsible: 'Sarah Lee', status: 'Active', cost: '$180k', url: '', color: '#003057', textColor: 'white' },
  { id: 7, parentId: 3, name: 'Finance Manager', description: 'Finance operations', responsible: 'Tom Davis', status: 'Active', cost: '$150k', url: '', color: '#003057', textColor: 'white' },
  { id: 8, parentId: 5, name: 'Senior Developer', description: 'Senior software engineer', responsible: 'Chris Martinez', status: 'Active', cost: '$120k', url: '', color: '#003057', textColor: 'white' },
];

// TechStart Engineering Team
const techStartNodes = [
  { id: 1, parentId: null, name: 'VP Engineering', description: 'Vice President of Engineering', responsible: 'Maria Garcia', status: 'Active', cost: '$400k', url: '', color: '#6B21A8', textColor: 'white' },
  { id: 2, parentId: 1, name: 'Frontend Lead', description: 'Frontend Development Lead', responsible: 'James Liu', status: 'Active', cost: '$220k', url: '', color: '#2563EB', textColor: 'white' },
  { id: 3, parentId: 1, name: 'Backend Lead', description: 'Backend Development Lead', responsible: 'Sarah Johnson', status: 'Active', cost: '$220k', url: '', color: '#2563EB', textColor: 'white' },
  { id: 4, parentId: 1, name: 'DevOps Lead', description: 'DevOps & Infrastructure Lead', responsible: 'Alex Chen', status: 'Active', cost: '$220k', url: '', color: '#2563EB', textColor: 'white' },
  { id: 5, parentId: 2, name: 'React Developer', description: 'Senior React Developer', responsible: 'Emma Wilson', status: 'Active', cost: '$140k', url: '', color: '#059669', textColor: 'white' },
  { id: 6, parentId: 2, name: 'UI Engineer', description: 'UI/UX Engineer', responsible: 'Ryan Park', status: 'Active', cost: '$130k', url: '', color: '#059669', textColor: 'white' },
  { id: 7, parentId: 3, name: 'API Developer', description: 'Backend API Developer', responsible: 'Nina Patel', status: 'Active', cost: '$135k', url: '', color: '#059669', textColor: 'white' },
  { id: 8, parentId: 4, name: 'SRE Engineer', description: 'Site Reliability Engineer', responsible: 'Tom Anderson', status: 'Active', cost: '$145k', url: '', color: '#059669', textColor: 'white' },
];

// Global Marketing Division
const marketingNodes = [
  { id: 1, parentId: null, name: 'CMO', description: 'Chief Marketing Officer', responsible: 'Jennifer Adams', status: 'Active', cost: '$380k', url: '', color: '#DC2626', textColor: 'white' },
  { id: 2, parentId: 1, name: 'Brand Director', description: 'Brand Strategy Director', responsible: 'Michael Brown', status: 'Active', cost: '$200k', url: '', color: '#D97706', textColor: 'white' },
  { id: 3, parentId: 1, name: 'Digital Marketing', description: 'Digital Marketing Director', responsible: 'Lisa Zhang', status: 'Active', cost: '$200k', url: '', color: '#D97706', textColor: 'white' },
  { id: 4, parentId: 1, name: 'Content Director', description: 'Content Strategy Director', responsible: 'David Kim', status: 'Active', cost: '$190k', url: '', color: '#D97706', textColor: 'white' },
  { id: 5, parentId: 2, name: 'Brand Manager', description: 'Brand Management', responsible: 'Sophie Martin', status: 'Active', cost: '$110k', url: '', color: '#059669', textColor: 'white' },
  { id: 6, parentId: 3, name: 'SEO Specialist', description: 'Search Engine Optimization', responsible: 'Chris Lee', status: 'Active', cost: '$95k', url: '', color: '#059669', textColor: 'white' },
  { id: 7, parentId: 3, name: 'Social Media', description: 'Social Media Manager', responsible: 'Amy Taylor', status: 'Active', cost: '$90k', url: '', color: '#059669', textColor: 'white' },
  { id: 8, parentId: 4, name: 'Content Writer', description: 'Senior Content Writer', responsible: 'Robert Clark', status: 'Active', cost: '$85k', url: '', color: '#059669', textColor: 'white' },
];

const charts = [
  { id: 'acme-corp', title: 'Acme Corp - Executive Team', nodes: acmeCorpNodes },
  { id: 'techstart-eng', title: 'TechStart - Engineering Team', nodes: techStartNodes },
  { id: 'global-marketing', title: 'Global Marketing Division', nodes: marketingNodes },
];

async function seedCharts() {
  console.log('🌱 Seeding Firestore with org charts...\n');
  
  for (const chart of charts) {
    console.log(`📊 Creating chart: ${chart.title}`);
    
    const chartRef = db.collection('charts').doc(chart.id);
    
    // Delete existing data
    const existingNodes = await chartRef.collection('nodes').get();
    if (!existingNodes.empty) {
      const deleteBatch = db.batch();
      existingNodes.docs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      console.log(`   Cleared ${existingNodes.size} existing nodes`);
    }
    
    // Create chart metadata
    await chartRef.set({
      title: chart.title,
      nextId: chart.nodes.length + 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Add nodes
    const batch = db.batch();
    chart.nodes.forEach(node => {
      const nodeData = { ...node };
      const nodeId = nodeData.id;
      delete nodeData.id;
      batch.set(chartRef.collection('nodes').doc(String(nodeId)), nodeData);
    });
    await batch.commit();
    
    console.log(`   ✅ Added ${chart.nodes.length} nodes\n`);
  }
  
  console.log('🎉 Seeding complete! Charts created:');
  charts.forEach(c => console.log(`   - ${c.title} (${c.id})`));
  
  process.exit(0);
}

seedCharts().catch(err => {
  console.error('❌ Error seeding:', err);
  process.exit(1);
});
