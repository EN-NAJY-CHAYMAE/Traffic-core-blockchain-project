const express = require('express');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const TrafficSimulation = require('./simulation-engine');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration Fabric
const ccpPath = path.resolve(__dirname, 'connection-org1.json');

// Initialize simulation engine
const simulation = new TrafficSimulation();

async function connectToNetwork() {
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const identity = await wallet.get('appUser');
    if (!identity) {
        console.log('Identity not found. Creating admin identity...');
        const credPath = path.resolve(__dirname, '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'users', 'Admin@org1.example.com');
        const certificate = fs.readFileSync(path.join(credPath, 'msp', 'signcerts', 'cert.pem')).toString();
        const privateKey = fs.readFileSync(path.join(credPath, 'msp', 'keystore', fs.readdirSync(path.join(credPath, 'msp', 'keystore'))[0])).toString();

        const x509Identity = {
            credentials: {
                certificate: certificate,
                privateKey: privateKey,
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('appUser', x509Identity);
    }

    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: 'appUser',
        discovery: { enabled: true, asLocalhost: true }
    });

    const network = await gateway.getNetwork('trafficchannel');
    const contract = network.getContract('traffic');

    return { gateway, contract };
}

// ==================== SIMULATION CONTROL ENDPOINTS ====================

// Start simulation
app.post('/api/simulation/start', async (req, res) => {
    try {
        await simulation.start();
        res.json({ message: 'Simulation started', stats: simulation.getStats() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pause simulation
app.post('/api/simulation/pause', (req, res) => {
    try {
        simulation.pause();
        res.json({ message: 'Simulation paused', stats: simulation.getStats() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resume simulation
app.post('/api/simulation/resume', (req, res) => {
    try {
        simulation.resume();
        res.json({ message: 'Simulation resumed', stats: simulation.getStats() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset simulation
app.post('/api/simulation/reset', async (req, res) => {
    try {
        await simulation.reset();
        res.json({ message: 'Simulation reset', stats: simulation.getStats() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set simulation speed
app.post('/api/simulation/speed', (req, res) => {
    try {
        const { multiplier } = req.body;
        simulation.setSpeed(parseFloat(multiplier));
        res.json({ message: `Speed set to ${multiplier}x`, stats: simulation.getStats() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set spawn rate
app.post('/api/simulation/spawn-rate', (req, res) => {
    try {
        const { rate } = req.body;
        simulation.setSpawnRate(parseInt(rate));
        res.json({ message: `Spawn rate set to ${rate}/min`, stats: simulation.getStats() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get simulation stats
app.get('/api/simulation/stats', (req, res) => {
    try {
        res.json(simulation.getStats());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== EXISTING ROUTES (UPDATED FUNCTION NAMES) ====================

// GET: Network Statistics
app.get('/api/stats', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetNetworkStatistics');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: All Roads
app.get('/api/roads', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetAllRoads');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Road Congestion Report
app.get('/api/roads/congestion', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetRoadCongestionReport');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Update Road Congestion
app.put('/api/roads/:id/congestion', async (req, res) => {
    try {
        const { id } = req.params;
        const { level } = req.body;
        const { gateway, contract } = await connectToNetwork();

        const result = await contract.submitTransaction('UpdateRoadCongestion', id, level);

        await gateway.disconnect();
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: All Intersections
app.get('/api/intersections', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetAllIntersections');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Update Traffic Light
app.put('/api/intersections/:id/light', async (req, res) => {
    try {
        const { id } = req.params;
        const { state } = req.body;
        const { gateway, contract } = await connectToNetwork();

        const result = await contract.submitTransaction('UpdateTrafficLight', id, state);

        await gateway.disconnect();
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: All Vehicles
app.get('/api/vehicles', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetAllVehicles');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Create Vehicle
app.post('/api/vehicles', async (req, res) => {
    try {
        const { id, type, currentRoad, currentIntersection, speed, direction } = req.body;
        const { gateway, contract } = await connectToNetwork();

        const result = await contract.submitTransaction(
            'CreateVehicle', 
            id, 
            type, 
            currentRoad, 
            currentIntersection, 
            speed.toString(), 
            direction
        );

        await gateway.disconnect();
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Update Vehicle Position
app.put('/api/vehicles/:id/position', async (req, res) => {
    try {
        const { id } = req.params;
        const { newRoad, newIntersection, newSpeed, newDirection } = req.body;
        const { gateway, contract } = await connectToNetwork();

        const result = await contract.submitTransaction(
            'UpdateVehiclePosition', 
            id, 
            newRoad, 
            newIntersection, 
            newSpeed.toString(), 
            newDirection
        );

        await gateway.disconnect();
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== NEW ROUTES: INCIDENT MANAGEMENT ====================

// GET: All Incidents
app.get('/api/incidents', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetAllIncidents');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Active Incidents Only
app.get('/api/incidents/active', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetActiveIncidents');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Incidents by Road
app.get('/api/incidents/road/:roadId', async (req, res) => {
    try {
        const { roadId } = req.params;
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetIncidentsByRoad', roadId);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Incidents by Severity
app.get('/api/incidents/severity/:severity', async (req, res) => {
    try {
        const { severity } = req.params;
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetIncidentsBySeverity', severity);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Report Incident
app.post('/api/incidents', async (req, res) => {
    try {
        const { id, type, location, roadId, severity, description } = req.body;
        const { gateway, contract } = await connectToNetwork();

        const result = await contract.submitTransaction(
            'ReportIncident', 
            id, 
            type, 
            location, 
            roadId, 
            severity, 
            description
        );

        await gateway.disconnect();
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Resolve Incident
app.put('/api/incidents/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { gateway, contract } = await connectToNetwork();

        const result = await contract.submitTransaction('ResolveIncident', id);

        await gateway.disconnect();
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== NEW ROUTES: SPEED VIOLATIONS ====================

// GET: All Violations
app.get('/api/violations', async (req, res) => {
    try {
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetAllViolations');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Violations by Vehicle
app.get('/api/violations/vehicle/:vehicleId', async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetViolationsByVehicle', vehicleId);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Violations by Road
app.get('/api/violations/road/:roadId', async (req, res) => {
    try {
        const { roadId } = req.params;
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetViolationsByRoad', roadId);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== NEW ROUTES: VEHICLE HISTORY ====================

// GET: Vehicle Complete History
app.get('/api/vehicles/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetVehicleHistory', id);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Vehicle Movement Path
app.get('/api/vehicles/:id/path', async (req, res) => {
    try {
        const { id } = req.params;
        const { contract } = await connectToNetwork();
        const result = await contract.evaluateTransaction('GetVehicleMovementPath', id);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== SERVER START ====================

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n✅ Traffic Core API Backend started on http://localhost:${PORT}`);
    console.log(`\n📊 Available Endpoints:`);
    console.log(`\n🎮 SIMULATION CONTROLS:`);
    console.log(`   POST /api/simulation/start         - Start simulation`);
    console.log(`   POST /api/simulation/pause         - Pause simulation`);
    console.log(`   POST /api/simulation/resume        - Resume simulation`);
    console.log(`   POST /api/simulation/reset         - Reset simulation`);
    console.log(`   POST /api/simulation/speed         - Set speed (body: {multiplier: 1-10})`);
    console.log(`   POST /api/simulation/spawn-rate    - Set spawn rate (body: {rate: 0-10})`);
    console.log(`   GET  /api/simulation/stats         - Get simulation stats`);
    console.log(`\n🚗 VEHICLES:`);
    console.log(`   GET  /api/vehicles                 - All vehicles`);
    console.log(`   GET  /api/vehicles/:id/history     - Vehicle complete history`);
    console.log(`   GET  /api/vehicles/:id/path        - Vehicle movement path`);
    console.log(`   POST /api/vehicles                 - Create vehicle`);
    console.log(`   PUT  /api/vehicles/:id/position    - Update position`);
    console.log(`\n🛣️  ROADS:`);
    console.log(`   GET  /api/roads                    - All roads`);
    console.log(`   GET  /api/roads/congestion         - Congestion report`);
    console.log(`   PUT  /api/roads/:id/congestion     - Update congestion`);
    console.log(`\n🚦 INTERSECTIONS:`);
    console.log(`   GET  /api/intersections            - All intersections`);
    console.log(`   PUT  /api/intersections/:id/light  - Update traffic light`);
    console.log(`\n🚨 INCIDENTS:`);
    console.log(`   GET  /api/incidents                - All incidents`);
    console.log(`   GET  /api/incidents/active         - Active incidents only`);
    console.log(`   GET  /api/incidents/road/:roadId   - By road`);
    console.log(`   GET  /api/incidents/severity/:lev  - By severity`);
    console.log(`   POST /api/incidents                - Report incident`);
    console.log(`   PUT  /api/incidents/:id/resolve    - Resolve incident`);
    console.log(`\n🚔 VIOLATIONS:`);
    console.log(`   GET  /api/violations               - All violations`);
    console.log(`   GET  /api/violations/vehicle/:id   - By vehicle`);
    console.log(`   GET  /api/violations/road/:roadId  - By road`);
    console.log(`\n📊 STATISTICS:`);
    console.log(`   GET  /api/stats                    - Network statistics\n`);
});
