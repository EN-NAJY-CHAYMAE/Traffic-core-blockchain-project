const express = require('express');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const TrafficSimulation = require('./simulation-engine');

// Used for decoding QSCC responses (latest block / tx count)
let protos = null;
try {
    protos = require('fabric-protos');
} catch (e) {
    // optional; blockchain explorer routes will return a helpful error if missing
}

const app = express();
app.use(cors());
app.use(express.json());

// Configuration Fabric
const ccpPath = path.resolve(__dirname, 'connection-org1.json');

// Single source of truth
const CHANNEL_NAME = process.env.CHANNEL_NAME || 'trafficchannel';
const CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'traffic';

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
        // discovery: { enabled: false }

    });

    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);

    return { gateway, network, contract };
}

// -------------------- Fabric connection cache --------------------
// Connecting/disconnecting on every request will exhaust gRPC sockets under load.
// We connect ONCE and reuse the same gateway/network/contract for all routes.
let _fabricConn = null;          // { gateway, network, contract }
let _fabricConnPromise = null;   // in-flight connect promise

function _resetFabricConn() {
    try {
        if (_fabricConn && _fabricConn.gateway) {
            _fabricConn.gateway.disconnect();
        }
    } catch (e) {
        // ignore
    } finally {
        _fabricConn = null;
        _fabricConnPromise = null;
    }
}

async function getFabricConn() {
    if (_fabricConn) return _fabricConn;
    if (_fabricConnPromise) return _fabricConnPromise;

    _fabricConnPromise = (async () => {
        const conn = await connectToNetwork();
        _fabricConn = conn;
        return conn;
    })().catch((err) => {
        _fabricConnPromise = null;
        throw err;
    });

    return _fabricConnPromise;
}

// Retry once on transient connectivity issues, then fail.
async function withFabricConn(fn) {
    try {
        const conn = await getFabricConn();
        return await fn(conn);
    } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        const transient =
            msg.includes('Failed to connect') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('deadline') ||
            msg.includes('timeout') ||
            msg.includes('connectFailed');

        if (transient) {
            _resetFabricConn();
            const conn = await getFabricConn();
            return await fn(conn);
        }
        throw err;
    }
}

// Disconnect cleanly on Ctrl+C
process.on('SIGINT', async () => {
    try {
        _resetFabricConn();
    } finally {
        process.exit(0);
    }
});

// -------------------- Helpers --------------------
function okTx({ txId, fn, payload }) {
    return {
        txId,
        fn,
        timestamp: new Date().toISOString(),
        payload
    };
}

function safeJsonParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}

async function submitWithTx(contract, fnName, args = []) {
    const txn = contract.createTransaction(fnName);
    const txId = txn.getTransactionId();
    const result = await txn.submit(...args.map(a => (a === undefined || a === null) ? '' : String(a)));
    const out = result ? result.toString() : '';
    return okTx({ txId, fn: fnName, payload: out ? safeJsonParse(out) : null });
}


// Submit a transaction but force endorsements from specific org MSP IDs (needed when endorsement policy is AND across orgs).
async function submitWithTxWithEndorsingOrgs(contract, fnName, args = [], endorsingOrgs = []) {
    const txn = contract.createTransaction(fnName);
    if (endorsingOrgs && Array.isArray(endorsingOrgs) && endorsingOrgs.length > 0 && typeof txn.setEndorsingOrganizations === 'function') {
        txn.setEndorsingOrganizations(...endorsingOrgs);
    }
    const txId = txn.getTransactionId();
    const result = await txn.submit(...args.map(a => (a === undefined || a === null) ? '' : String(a)));
    const out = result ? result.toString() : '';
    return okTx({ txId, fn: fnName, payload: out ? safeJsonParse(out) : null });
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

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
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetNetworkStatistics');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: All Roads
app.get('/api/roads', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetAllRoads');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Road Congestion Report
app.get('/api/roads/congestion', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetRoadCongestionReport');
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
        const conn = await getFabricConn();
        const tx = await submitWithTx(conn.contract, 'UpdateRoadCongestion', [id, level]);
        res.json(tx);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/roads/:id', async (req, res) => {
  try {
    const conn = await getFabricConn();
    const result = await conn.contract.evaluateTransaction('ReadRoad', req.params.id);
    res.json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/roads', async (req, res) => {
  try {
    const { id, name, startIntersection, endIntersection, lanes, maxSpeed, length } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'CreateRoad', [
      id,
      name,
      startIntersection,
      endIntersection,
      String(lanes),
      String(maxSpeed),
      String(length)
    ]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/roads/:id', async (req, res) => {
  try {
    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'DeleteRoad', [req.params.id]);
    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET: All Intersections
app.get('/api/intersections', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetAllIntersections');
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
        const conn = await getFabricConn();
        const tx = await submitWithTx(conn.contract, 'UpdateTrafficLight', [id, state]);
        res.json(tx);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/intersections/:id', async (req, res) => {
  try {
    const conn = await getFabricConn();
    const result = await conn.contract.evaluateTransaction('ReadIntersection', req.params.id);
    res.json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/intersections', async (req, res) => {
  try {
    const { id, name, latitude, longitude, connectedRoads } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'CreateIntersection', [
      id,
      name,
      String(latitude),
      String(longitude),
      JSON.stringify(connectedRoads || [])
    ]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/intersections/:id', async (req, res) => {
  try {
    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'DeleteIntersection', [req.params.id]);
    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// GET: All Vehicles
app.get('/api/vehicles', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetAllVehicles');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Create Vehicle
// app.post('/api/vehicles', async (req, res) => {
//     try {
//         const { id, type, currentRoad, currentIntersection, speed, direction } = req.body;
//         const conn = await getFabricConn();
//         const tx = await submitWithTx(conn.contract, 'CreateVehicle', [
//             id,
//             type,
//             currentRoad,
//             currentIntersection,
//             speed,
//             direction
//         ]);

//         res.json(tx);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });
app.post('/api/vehicles', async (req, res) => {
  try {
    const { id, type, currentRoad, currentIntersection, speed, direction } = req.body;

    if (!id) return res.status(400).json({ error: 'Missing id' });

    const conn = await getFabricConn();

    const tx = await submitWithTxWithEndorsingOrgs(conn.contract, 'CreateVehicle', [
      id,
      type,
      currentRoad,
      currentIntersection,
      String(speed),
      direction
    ], SECURITY_ENDORSING_ORGS);

    return res.json(tx);
  } catch (error) {
    const msg = String(error.message || '');

    // ✅ Not a real error in simulation restarts
    if (msg.includes('already exists')) {
      return res.status(200).json({ message: 'Vehicle already exists', id: req.body?.id });
      // (or use 409 Conflict if you prefer)
      // return res.status(409).json({ error: 'Vehicle already exists', id: req.body?.id });
    }

    return res.status(500).json({ error: msg });
  }
});

// PUT: Update Vehicle Position
// app.put('/api/vehicles/:id/position', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { newRoad, newIntersection, newSpeed, newDirection } = req.body;
//         const conn = await getFabricConn();
//         const tx = await submitWithTx(conn.contract, 'UpdateVehiclePosition', [
//             id,
//             newRoad,
//             newIntersection,
//             newSpeed,
//             newDirection
//         ]);

//         res.json(tx);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

app.put('/api/vehicles/:id/position', async (req, res) => {
  try {
    const { id } = req.params;
    const { newRoad, newIntersection, newSpeed, newDirection } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'UpdateVehiclePosition', [
      id, newRoad, newIntersection, String(newSpeed), newDirection
    ]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Create Road
app.post('/api/roads', async (req, res) => {
  try {
    const { id, name, startIntersection, endIntersection, lanes, maxSpeed, length } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'CreateRoad', [
      id,
      name,
      startIntersection,
      endIntersection,
      String(lanes),
      String(maxSpeed),
      String(length)
    ]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});






app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const conn = await getFabricConn();
    const result = await conn.contract.evaluateTransaction('ReadVehicle', req.params.id);
    res.json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'DeleteVehicle', [req.params.id]);
    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/roads/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'UpdateRoadStatus', [id, status]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.put('/api/roads/:id/properties', async (req, res) => {
  try {
    const { id } = req.params;
    const { lanes, maxSpeed, length } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'UpdateRoadProperties', [
      id,
      String(lanes),
      String(maxSpeed),
      String(length)
    ]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.put('/api/intersections/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'UpdateIntersectionLocation', [
      id,
      String(latitude),
      String(longitude)
    ]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.put('/api/intersections/:id/density', async (req, res) => {
  try {
    const { id } = req.params;
    const { density } = req.body;

    const conn = await getFabricConn();
    const tx = await submitWithTx(conn.contract, 'UpdateIntersectionDensity', [id, density]);

    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});






// ==================== NEW ROUTES: INCIDENT MANAGEMENT ====================

// GET: All Incidents
app.get('/api/incidents', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetAllIncidents');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Active Incidents Only
app.get('/api/incidents/active', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetActiveIncidents');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Incidents by Road
app.get('/api/incidents/road/:roadId', async (req, res) => {
    try {
        const { roadId } = req.params;
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetIncidentsByRoad', roadId);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Incidents by Severity
app.get('/api/incidents/severity/:severity', async (req, res) => {
    try {
        const { severity } = req.params;
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetIncidentsBySeverity', severity);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Report Incident
app.post('/api/incidents', async (req, res) => {
    try {
        const { id, type, location, roadId, severity, description } = req.body;
        const conn = await getFabricConn();
        const tx = await submitWithTx(conn.contract, 'ReportIncident', [
            id,
            type,
            location,
            roadId,
            severity,
            description
        ]);
        res.json(tx);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Resolve Incident
app.put('/api/incidents/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const conn = await getFabricConn();
        const tx = await submitWithTx(conn.contract, 'ResolveIncident', [id]);
        res.json(tx);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== NEW ROUTES: SPEED VIOLATIONS ====================

// GET: All Violations
app.get('/api/violations', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetAllViolations');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Violations by Vehicle
app.get('/api/violations/vehicle/:vehicleId', async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetViolationsByVehicle', vehicleId);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Violations by Road
app.get('/api/violations/road/:roadId', async (req, res) => {
    try {
        const { roadId } = req.params;
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetViolationsByRoad', roadId);
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
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetVehicleHistory', id);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Vehicle Movement Path
app.get('/api/vehicles/:id/path', async (req, res) => {
    try {
        const { id } = req.params;
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetVehicleMovementPath', id);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BLOCKCHAIN EXPLORER ====================

// Latest block info (height, latestBlockNumber, hashes)
app.get('/api/blockchain/latest', async (req, res) => {
    try {
        if (!protos) {
            return res.status(500).json({ error: 'fabric-protos not installed. Run: npm install fabric-protos' });
        }

        const conn = await getFabricConn();
        const qscc = conn.network.getContract('qscc');
        const infoBytes = await qscc.evaluateTransaction('GetChainInfo', CHANNEL_NAME);
        const info = protos.common.BlockchainInfo.decode(infoBytes);

        const height = (info.height && typeof info.height.toNumber === 'function')
            ? info.height.toNumber()
            : parseInt(info.height.toString(), 10);
        const latestBlockNumber = Math.max(height - 1, 0);

        res.json({
            height,
            latestBlockNumber,
            currentBlockHash: info.currentBlockHash ? Buffer.from(info.currentBlockHash).toString('base64') : null,
            previousBlockHash: info.previousBlockHash ? Buffer.from(info.previousBlockHash).toString('base64') : null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Block details (txCount + txIds)
app.get('/api/blockchain/block/:num', async (req, res) => {
    try {
        if (!protos) {
            return res.status(500).json({ error: 'fabric-protos not installed. Run: npm install fabric-protos' });
        }

        const blockNum = parseInt(req.params.num, 10);
        if (Number.isNaN(blockNum) || blockNum < 0) {
            return res.status(400).json({ error: 'Invalid block number' });
        }

        const conn = await getFabricConn();
        const qscc = conn.network.getContract('qscc');
        const blockBytes = await qscc.evaluateTransaction('GetBlockByNumber', CHANNEL_NAME, blockNum.toString());
        const block = protos.common.Block.decode(blockBytes);

        const envelopes = (block && block.data && block.data.data) ? block.data.data : [];
        const txIds = [];

        for (const envBytes of envelopes) {
            try {
                const env = protos.common.Envelope.decode(envBytes);
                const payload = protos.common.Payload.decode(env.payload);
                const ch = protos.common.ChannelHeader.decode(payload.header.channelHeader);
                if (ch.txId) txIds.push(ch.txId);
            } catch (err) {
                // ignore decode issues
            }
        }

        res.json({
            blockNumber: blockNum,
            txCount: envelopes.length,
            txIds,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== SERVER START ====================


// ==================== SECURITY ALERTS (BLOCKCHAIN) ====================
// NOTE: chaincode endorsement policy requires Org1 + Org2, so we force endorsing orgs on writes.
const SECURITY_ENDORSING_ORGS = (process.env.SECURITY_ENDORSING_ORGS || 'Org1MSP,Org2MSP')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// GET: All Security Alerts
app.get('/api/security/alerts', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetAllSecurityAlerts');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Active Security Alerts
app.get('/api/security/alerts/active', async (req, res) => {
    try {
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetActiveSecurityAlerts');
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Security Alerts by severity (active by default in chaincode)
app.get('/api/security/alerts/severity/:severity', async (req, res) => {
    try {
        const { severity } = req.params;
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetSecurityAlertsBySeverity', severity);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Security Alerts by entity (query params: entityType, entityId)
app.get('/api/security/alerts/entity', async (req, res) => {
    try {
        const { entityType, entityId } = req.query;
        if (!entityType || !entityId) {
            return res.status(400).json({ error: 'Missing entityType or entityId' });
        }
        const conn = await getFabricConn();
        const result = await conn.contract.evaluateTransaction('GetSecurityAlertsByEntity', String(entityType), String(entityId));
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Report Security Alert (write to blockchain)
// app.post('/api/security/alerts', async (req, res) => {
//   try {
//     const {
//       id,
//       source = 'GNN_GraphSAGE',
//       dataset = '',
//       scenario = '',
//       windowMinutes = 5,
//       entityType = 'host',
//       entityId = '',
//       score = 0,
//       severity = 'medium',
//       justification = '',
//       keyFeatures = []
//     } = req.body || {};

//     if (!id) return res.status(400).json({ error: 'Missing id' });
//     if (!entityId) return res.status(400).json({ error: 'Missing entityId' });

//     const conn = await getFabricConn();

//     // 1) Write alert to blockchain
//     const tx = await submitWithTxWithEndorsingOrgs(conn.contract, 'ReportSecurityAlert', [
//       id,
//       source,
//       dataset,
//       scenario,
//       windowMinutes,
//       entityType,
//       entityId,
//       score,
//       severity,
//       justification,
//       JSON.stringify(Array.isArray(keyFeatures) ? keyFeatures : [])
//     ], SECURITY_ENDORSING_ORGS);

//     try {
//     const sev = String(severity || '').toLowerCase();
//     if ((sev === 'high' || sev === 'critical') && String(entityType || '') === 'host') {
//         const vehicleId = 'V_' + String(entityId || '').replace(/\./g, '_');

//         setImmediate(async () => {
//         try {
//             await submitWithTxWithEndorsingOrgs(
//             conn.contract,
//             'UpdateVehicleStatus',
//             [vehicleId, 'quarantine'],
//             SECURITY_ENDORSING_ORGS
//             );
//             console.log(`[AUTO] Quarantined vehicle ${vehicleId} due to ${sev} alert`);
//         } catch (e) {
//             console.warn(`[AUTO] Mitigation pending: ${vehicleId}. Reason: ${e.message}`);
//         }
//         });
//     }
//     } catch (e) {
//     console.warn('[AUTO] Mitigation scheduling failed:', e.message);
//     }


    
//     res.json(tx);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

app.post('/api/security/alerts', async (req, res) => {
  try {
    const {
      id,
      source = 'GNN_GraphSAGE',
      dataset = '',
      scenario = '',
      windowMinutes = 5,
      entityType = 'host',
      entityId = '',
      score = 0,
      severity = 'medium',
      justification = '',
      keyFeatures = []
    } = req.body || {};

    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (!entityId) return res.status(400).json({ error: 'Missing entityId' });

    const conn = await getFabricConn();

    // 1) Write alert to blockchain
    const alertTx = await submitWithTxWithEndorsingOrgs(
      conn.contract,
      'ReportSecurityAlert',
      [
        id,
        source,
        dataset,
        scenario,
        windowMinutes,
        entityType,
        entityId,
        score,
        severity,
        justification,
        JSON.stringify(Array.isArray(keyFeatures) ? keyFeatures : [])
      ],
      SECURITY_ENDORSING_ORGS
    );

    // 2) Auto mitigation (ONLY if vehicle exists)
    const sev = String(severity || '').toLowerCase();
    let mitigation = { scheduled: false, vehicleId: null, status: 'none', reason: null };

    if ((sev === 'high' || sev === 'critical') && String(entityType || '') === 'host') {
      const vehicleId = 'V_' + String(entityId || '').replace(/\./g, '_');
      mitigation = { scheduled: true, vehicleId, status: 'pending', reason: null };

      setImmediate(async () => {
        try {
          // Check existence first (chaincode throws if missing)
          await conn.contract.evaluateTransaction('ReadVehicle', vehicleId);

          // Exists -> quarantine
          await submitWithTxWithEndorsingOrgs(
            conn.contract,
            'UpdateVehicleStatus',
            [vehicleId, 'quarantine'],
            SECURITY_ENDORSING_ORGS
          );

          console.log(`[AUTO] Quarantined vehicle ${vehicleId} due to ${sev} alert`);
        } catch (e) {
          // Vehicle doesn't exist (or other issue) -> skip mitigation
          console.warn(`[AUTO] Skipped mitigation for ${vehicleId}: ${e.message}`);
        }
      });
    }

    // 3) Respond (clear for frontend/python)
    return res.json({
      ok: true,
      alertTx,
      mitigation
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});




// PUT: Resolve Security Alert (write to blockchain)
app.put('/api/security/alerts/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const conn = await getFabricConn();
        const tx = await submitWithTxWithEndorsingOrgs(conn.contract, 'ResolveSecurityAlert', [id], SECURITY_ENDORSING_ORGS);
        res.json(tx);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
    console.log(`\nTraffic Core API Backend started on http://localhost:${PORT}`);
    console.log(`Channel: ${CHANNEL_NAME} | Chaincode: ${CHAINCODE_NAME}`);
    console.log(`\nAvailable Endpoints:`);
    console.log(`   GET  /health                     - Health check`);
    console.log(`\nBLOCKCHAIN:`);
    console.log(`   GET  /api/blockchain/latest      - Latest block + height`);
    console.log(`   GET  /api/blockchain/block/:num  - Tx count + txIds in block`);
    console.log(`\nSIMULATION CONTROLS:`);
    console.log(`   POST /api/simulation/start         - Start simulation`);
    console.log(`   POST /api/simulation/pause         - Pause simulation`);
    console.log(`   POST /api/simulation/resume        - Resume simulation`);
    console.log(`   POST /api/simulation/reset         - Reset simulation`);
    console.log(`   POST /api/simulation/speed         - Set speed (body: {multiplier: 1-10})`);
    console.log(`   POST /api/simulation/spawn-rate    - Set spawn rate (body: {rate: 0-10})`);
    console.log(`   GET  /api/simulation/stats         - Get simulation stats`);
    console.log(`\nVEHICLES:`);
    console.log(`   GET  /api/vehicles                 - All vehicles`);
    console.log(`   GET  /api/vehicles/:id/history     - Vehicle complete history`);
    console.log(`   GET  /api/vehicles/:id/path        - Vehicle movement path`);
    console.log(`   POST /api/vehicles                 - Create vehicle`);
    console.log(`   PUT  /api/vehicles/:id/position    - Update position`);
    console.log(`\nROADS:`);
    console.log(`   GET  /api/roads                    - All roads`);
    console.log(`   GET  /api/roads/congestion         - Congestion report`);
    console.log(`   PUT  /api/roads/:id/congestion     - Update congestion`);
    console.log(`\nINTERSECTIONS:`);
    console.log(`   GET  /api/intersections            - All intersections`);
    console.log(`   PUT  /api/intersections/:id/light  - Update traffic light`);
    console.log(`\nINCIDENTS:`);
    console.log(`   GET  /api/incidents                - All incidents`);
    console.log(`   GET  /api/incidents/active         - Active incidents only`);
    console.log(`   GET  /api/incidents/road/:roadId   - By road`);
    console.log(`   GET  /api/incidents/severity/:lev  - By severity`);
    console.log(`   POST /api/incidents                - Report incident`);
    console.log(`   PUT  /api/incidents/:id/resolve    - Resolve incident`);
    console.log(`\nVIOLATIONS:`);
    console.log(`   GET  /api/violations               - All violations`);
    console.log(`   GET  /api/violations/vehicle/:id   - By vehicle`);
    console.log(`   GET  /api/violations/road/:roadId  - By road`);
    console.log(`\nSTATISTICS:`);
    console.log(`   GET  /api/stats                    - Network statistics\n`);
});
