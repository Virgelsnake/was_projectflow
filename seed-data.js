// Seed script to add mock org charts to Firestore
// Run with: node seed-data.js

const admin = require('firebase-admin');

// Initialize with default credentials (requires GOOGLE_APPLICATION_CREDENTIALS env var)
// Or use the web SDK approach in a browser context

const mockCharts = [
  {
    title: "TechStart Inc - Engineering Team",
    ownerId: "demo-user",
    version: 1,
    snapshot: {
      meta: { viewport: { x: 0, y: 0, zoom: 1 } },
      nodes: {
        'node-1': {
          id: 'node-1',
          parentId: null,
          pos: { x: 450, y: 60 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Maria Garcia',
            title: 'VP of Engineering',
            department: 'Engineering',
            color: '#8B5CF6'
          }
        },
        'node-2': {
          id: 'node-2',
          parentId: 'node-1',
          pos: { x: 150, y: 200 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'James Liu',
            title: 'Frontend Lead',
            department: 'Frontend',
            color: '#3B82F6'
          }
        },
        'node-3': {
          id: 'node-3',
          parentId: 'node-1',
          pos: { x: 450, y: 200 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Sarah Johnson',
            title: 'Backend Lead',
            department: 'Backend',
            color: '#3B82F6'
          }
        },
        'node-4': {
          id: 'node-4',
          parentId: 'node-1',
          pos: { x: 750, y: 200 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Alex Chen',
            title: 'DevOps Lead',
            department: 'Infrastructure',
            color: '#3B82F6'
          }
        },
        'node-5': {
          id: 'node-5',
          parentId: 'node-2',
          pos: { x: 50, y: 340 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Emma Wilson',
            title: 'React Developer',
            department: 'Frontend',
            color: '#10B981'
          }
        },
        'node-6': {
          id: 'node-6',
          parentId: 'node-2',
          pos: { x: 250, y: 340 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Ryan Park',
            title: 'UI Engineer',
            department: 'Frontend',
            color: '#10B981'
          }
        },
        'node-7': {
          id: 'node-7',
          parentId: 'node-3',
          pos: { x: 450, y: 340 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Nina Patel',
            title: 'API Developer',
            department: 'Backend',
            color: '#10B981'
          }
        },
        'node-8': {
          id: 'node-8',
          parentId: 'node-4',
          pos: { x: 750, y: 340 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Tom Anderson',
            title: 'SRE Engineer',
            department: 'Infrastructure',
            color: '#10B981'
          }
        }
      }
    }
  },
  {
    title: "Global Marketing Division",
    ownerId: "demo-user",
    version: 1,
    snapshot: {
      meta: { viewport: { x: 0, y: 0, zoom: 1 } },
      nodes: {
        'node-1': {
          id: 'node-1',
          parentId: null,
          pos: { x: 400, y: 50 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Jennifer Adams',
            title: 'CMO',
            department: 'Marketing',
            color: '#EF4444'
          }
        },
        'node-2': {
          id: 'node-2',
          parentId: 'node-1',
          pos: { x: 100, y: 180 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Michael Brown',
            title: 'Brand Director',
            department: 'Brand',
            color: '#F59E0B'
          }
        },
        'node-3': {
          id: 'node-3',
          parentId: 'node-1',
          pos: { x: 400, y: 180 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Lisa Zhang',
            title: 'Digital Marketing Director',
            department: 'Digital',
            color: '#F59E0B'
          }
        },
        'node-4': {
          id: 'node-4',
          parentId: 'node-1',
          pos: { x: 700, y: 180 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'David Kim',
            title: 'Content Director',
            department: 'Content',
            color: '#F59E0B'
          }
        },
        'node-5': {
          id: 'node-5',
          parentId: 'node-2',
          pos: { x: 100, y: 320 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Sophie Martin',
            title: 'Brand Manager',
            department: 'Brand',
            color: '#10B981'
          }
        },
        'node-6': {
          id: 'node-6',
          parentId: 'node-3',
          pos: { x: 300, y: 320 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Chris Lee',
            title: 'SEO Specialist',
            department: 'Digital',
            color: '#10B981'
          }
        },
        'node-7': {
          id: 'node-7',
          parentId: 'node-3',
          pos: { x: 500, y: 320 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Amy Taylor',
            title: 'Social Media Manager',
            department: 'Digital',
            color: '#10B981'
          }
        },
        'node-8': {
          id: 'node-8',
          parentId: 'node-4',
          pos: { x: 700, y: 320 },
          size: { w: 180, h: 80 },
          manualPosition: false,
          content: {
            name: 'Robert Clark',
            title: 'Content Writer',
            department: 'Content',
            color: '#10B981'
          }
        }
      }
    }
  }
];

console.log('Mock chart data ready for seeding.');
console.log('Charts to add:', mockCharts.map(c => c.title));
console.log('\nTo add these via the dashboard, use the "New Chart" button with templates.');
console.log('Or add them programmatically via the Firebase console or SDK.');

module.exports = { mockCharts };
