'use strict';

const { Contract } = require('fabric-contract-api');

class TrafficContract extends Contract {

    // ==================== HELPER: GET TRANSACTION TIMESTAMP ====================
    
    _getTxTimestamp(ctx) {
        const ts = ctx.stub.getTxTimestamp();
        const seconds = (ts.seconds.low ?? ts.seconds);
        const nanos = (ts.nanos ?? 0);
        const ms = (seconds * 1000) + Math.floor(nanos / 1e6);
        return new Date(ms).toISOString();
    }

    // ==================== INITIALIZATION ====================

    async InitLedger(ctx) {
        console.log('Initializing Traffic Core Ledger...');

        const txTime = this._getTxTimestamp(ctx);
        const assets = [];

        // 1. Create Intersections first
        assets.push({
            id: 'I001',
            assetType: 'intersection',
            name: 'Central Plaza',
            latitude: 33.5731,
            longitude: -7.5898,
            connectedRoads: ['R001', 'R002', 'R005'],
            trafficLightState: 'green',
            trafficDensity: 'low',
            timestamp: txTime
        });

        assets.push({
            id: 'I002',
            assetType: 'intersection',
            name: 'North Gate',
            latitude: 33.5850,
            longitude: -7.5898,
            connectedRoads: ['R001', 'R003'],
            trafficLightState: 'red',
            trafficDensity: 'medium',
            timestamp: txTime
        });

        assets.push({
            id: 'I003',
            assetType: 'intersection',
            name: 'East Junction',
            latitude: 33.5731,
            longitude: -7.5750,
            connectedRoads: ['R002', 'R004'],
            trafficLightState: 'green',
            trafficDensity: 'low',
            timestamp: txTime
        });

        assets.push({
            id: 'I004',
            assetType: 'intersection',
            name: 'South Hub',
            latitude: 33.5612,
            longitude: -7.5898,
            connectedRoads: ['R005', 'R006'],
            trafficLightState: 'yellow',
            trafficDensity: 'high',
            timestamp: txTime
        });

        assets.push({
            id: 'I005',
            assetType: 'intersection',
            name: 'West Terminal',
            latitude: 33.5731,
            longitude: -7.6046,
            connectedRoads: ['R003', 'R004', 'R006'],
            trafficLightState: 'green',
            trafficDensity: 'medium',
            timestamp: txTime
        });

        // 2. Create Roads
        assets.push({
            id: 'R001',
            assetType: 'road',
            name: 'Mohammed V Avenue',
            startIntersection: 'I001',
            endIntersection: 'I002',
            lanes: 4,
            maxSpeed: 60,
            length: 1500,
            currentVehicleCount: 0,
            status: 'open',
            congestionLevel: 'low',
            timestamp: txTime
        });

        assets.push({
            id: 'R002',
            assetType: 'road',
            name: 'Hassan II Boulevard',
            startIntersection: 'I001',
            endIntersection: 'I003',
            lanes: 3,
            maxSpeed: 50,
            length: 1200,
            currentVehicleCount: 0,
            status: 'open',
            congestionLevel: 'low',
            timestamp: txTime
        });

        assets.push({
            id: 'R003',
            assetType: 'road',
            name: 'Anfa Street',
            startIntersection: 'I002',
            endIntersection: 'I005',
            lanes: 2,
            maxSpeed: 40,
            length: 800,
            currentVehicleCount: 0,
            status: 'open',
            congestionLevel: 'medium',
            timestamp: txTime
        });

        assets.push({
            id: 'R004',
            assetType: 'road',
            name: 'Corniche Road',
            startIntersection: 'I003',
            endIntersection: 'I005',
            lanes: 3,
            maxSpeed: 70,
            length: 2000,
            currentVehicleCount: 0,
            status: 'open',
            congestionLevel: 'low',
            timestamp: txTime
        });

        assets.push({
            id: 'R005',
            assetType: 'road',
            name: 'Zerktouni Avenue',
            startIntersection: 'I001',
            endIntersection: 'I004',
            lanes: 3,
            maxSpeed: 50,
            length: 1000,
            currentVehicleCount: 0,
            status: 'open',
            congestionLevel: 'high',
            timestamp: txTime
        });

        assets.push({
            id: 'R006',
            assetType: 'road',
            name: 'Mers Sultan Road',
            startIntersection: 'I004',
            endIntersection: 'I005',
            lanes: 2,
            maxSpeed: 40,
            length: 900,
            currentVehicleCount: 0,
            status: 'open',
            congestionLevel: 'medium',
            timestamp: txTime
        });

        // 3. Create Vehicles
        assets.push({
            id: 'V001',
            assetType: 'vehicle',
            type: 'car',
            currentRoad: 'R001',
            currentIntersection: 'I001',
            speed: 50,
            direction: 'north',
            timestamp: txTime,
            isEmergency: false,
            status: 'active'
        });

        assets.push({
            id: 'V002',
            assetType: 'vehicle',
            type: 'truck',
            currentRoad: 'R002',
            currentIntersection: 'I001',
            speed: 40,
            direction: 'east',
            timestamp: txTime,
            isEmergency: false,
            status: 'active'
        });

        assets.push({
            id: 'V003',
            assetType: 'vehicle',
            type: 'bus',
            currentRoad: 'R003',
            currentIntersection: 'I002',
            speed: 45,
            direction: 'west',
            timestamp: txTime,
            isEmergency: false,
            status: 'active'
        });

        assets.push({
            id: 'V004',
            assetType: 'vehicle',
            type: 'car',
            currentRoad: 'R004',
            currentIntersection: 'I003',
            speed: 60,
            direction: 'west',
            timestamp: txTime,
            isEmergency: false,
            status: 'active'
        });

        assets.push({
            id: 'V005',
            assetType: 'vehicle',
            type: 'emergency',
            currentRoad: 'R005',
            currentIntersection: 'I001',
            speed: 80,
            direction: 'south',
            timestamp: txTime,
            isEmergency: true,
            status: 'active'
        });

        // Write all assets in order
        for (const asset of assets) {
            await ctx.stub.putState(asset.id, Buffer.from(JSON.stringify(asset)));
            console.log(`${asset.assetType} ${asset.id} initialized`);
        }

        const result = {
            message: 'Traffic Core Ledger initialized successfully',
            intersections: 5,
            roads: 6,
            vehicles: 5,
            total: 16
        };

        console.log('Initialization complete');
        return JSON.stringify(result);
    }

    // ==================== VEHICLE OPERATIONS ====================

    async CreateVehicle(ctx, id, type, currentRoad, currentIntersection, speed, direction) {
        const exists = await this._assetExists(ctx, id);
        if (exists) {
            throw new Error(`Vehicle ${id} already exists`);
        }

        const txTime = this._getTxTimestamp(ctx);

        const vehicle = {
            id,
            assetType: 'vehicle',
            type,
            currentRoad,
            currentIntersection,
            speed: parseInt(speed, 10),
            direction,
            timestamp: txTime,
            isEmergency: type === 'emergency',
            status: 'active'
        };

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(vehicle)));
        return JSON.stringify(vehicle);
    }

    async ReadVehicle(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Vehicle ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    async UpdateVehiclePosition(ctx, id, newRoad, newIntersection, newSpeed, newDirection) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Vehicle ${id} does not exist`);
        }

        const vehicle = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        vehicle.currentRoad = newRoad;
        vehicle.currentIntersection = newIntersection;
        vehicle.speed = parseInt(newSpeed);
        vehicle.direction = newDirection;
        vehicle.timestamp = txTime;

        // Check for speed violations
        await this._checkSpeedViolation(ctx, id, newRoad, parseInt(newSpeed), txTime);

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(vehicle)));
        return JSON.stringify(vehicle);
    }

    async GetAllVehicles(ctx) {
        return await this._getAssetsByType(ctx, 'vehicle');
    }

    async GetVehiclesByType(ctx, type) {
        const allJSON = await this.GetAllVehicles(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(v => v.type === type);
        return JSON.stringify(filtered);
    }

    async GetVehiclesByRoad(ctx, roadId) {
        const allJSON = await this.GetAllVehicles(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(v => v.currentRoad === roadId);
        return JSON.stringify(filtered);
    }

    async DeleteVehicle(ctx, id) {
        const exists = await this._assetExists(ctx, id);
        if (!exists) {
            throw new Error(`Vehicle ${id} does not exist`);
        }
        
        await ctx.stub.deleteState(id);
        return JSON.stringify({ message: `Vehicle ${id} deleted successfully` });
    }

    async UpdateVehicleStatus(ctx, id, newStatus) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Vehicle ${id} does not exist`);
        }

        const vehicle = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        vehicle.status = newStatus;
        vehicle.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(vehicle)));
        return JSON.stringify(vehicle);
    }

    // ==================== ROAD OPERATIONS ====================

    async CreateRoad(ctx, id, name, startIntersection, endIntersection, lanes, maxSpeed, length) {
        const exists = await this._assetExists(ctx, id);
        if (exists) {
            throw new Error(`Road ${id} already exists`);
        }

        const txTime = this._getTxTimestamp(ctx);

        const road = {
            id: id,
            assetType: 'road',
            name: name,
            startIntersection: startIntersection,
            endIntersection: endIntersection,
            lanes: parseInt(lanes),
            maxSpeed: parseInt(maxSpeed),
            length: parseInt(length),
            currentVehicleCount: 0,
            status: 'open',
            congestionLevel: 'low',
            timestamp: txTime
        };

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(road)));
        return JSON.stringify(road);
    }

    async ReadRoad(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Road ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    async UpdateRoadStatus(ctx, id, newStatus) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Road ${id} does not exist`);
        }

        const road = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        road.status = newStatus;
        road.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(road)));
        return JSON.stringify(road);
    }

    async UpdateRoadProperties(ctx, id, lanes, maxSpeed, length) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Road ${id} does not exist`);
        }

        const road = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        road.lanes = parseInt(lanes);
        road.maxSpeed = parseInt(maxSpeed);
        road.length = parseInt(length);
        road.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(road)));
        return JSON.stringify(road);
    }

    async UpdateRoadCongestion(ctx, id, congestionLevel) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Road ${id} does not exist`);
        }

        const road = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        road.congestionLevel = congestionLevel;
        road.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(road)));
        return JSON.stringify(road);
    }

    async GetAllRoads(ctx) {
        return await this._getAssetsByType(ctx, 'road');
    }

    async GetRoadsByStatus(ctx, status) {
        const allJSON = await this.GetAllRoads(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(r => r.status === status);
        return JSON.stringify(filtered);
    }

    async DeleteRoad(ctx, id) {
        const exists = await this._assetExists(ctx, id);
        if (!exists) {
            throw new Error(`Road ${id} does not exist`);
        }
        
        await ctx.stub.deleteState(id);
        return JSON.stringify({ message: `Road ${id} deleted successfully` });
    }

    // ==================== INTERSECTION OPERATIONS ====================

    async CreateIntersection(ctx, id, name, latitude, longitude, connectedRoadsJSON) {
        const exists = await this._assetExists(ctx, id);
        if (exists) {
            throw new Error(`Intersection ${id} already exists`);
        }

        const txTime = this._getTxTimestamp(ctx);

        const intersection = {
            id: id,
            assetType: 'intersection',
            name: name,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            connectedRoads: JSON.parse(connectedRoadsJSON),
            trafficLightState: 'green',
            trafficDensity: 'low',
            timestamp: txTime
        };

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(intersection)));
        return JSON.stringify(intersection);
    }

    async ReadIntersection(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Intersection ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    async UpdateTrafficLight(ctx, id, newState) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Intersection ${id} does not exist`);
        }

        const intersection = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        intersection.trafficLightState = newState;
        intersection.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(intersection)));
        return JSON.stringify(intersection);
    }

    async UpdateIntersectionLocation(ctx, id, latitude, longitude) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Intersection ${id} does not exist`);
        }

        const intersection = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        intersection.latitude = parseFloat(latitude);
        intersection.longitude = parseFloat(longitude);
        intersection.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(intersection)));
        return JSON.stringify(intersection);
    }

    async UpdateIntersectionDensity(ctx, id, density) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Intersection ${id} does not exist`);
        }

        const intersection = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        intersection.trafficDensity = density;
        intersection.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(intersection)));
        return JSON.stringify(intersection);
    }

    async GetAllIntersections(ctx) {
        return await this._getAssetsByType(ctx, 'intersection');
    }

    async GetIntersectionsByTrafficLight(ctx, state) {
        const allJSON = await this.GetAllIntersections(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(i => i.trafficLightState === state);
        return JSON.stringify(filtered);
    }

    async DeleteIntersection(ctx, id) {
        const exists = await this._assetExists(ctx, id);
        if (!exists) {
            throw new Error(`Intersection ${id} does not exist`);
        }
        
        await ctx.stub.deleteState(id);
        return JSON.stringify({ message: `Intersection ${id} deleted successfully` });
    }

    // ==================== INCIDENT MANAGEMENT (NEW FEATURE) ====================

    async ReportIncident(ctx, id, type, location, roadId, severity, description) {
        const exists = await this._assetExists(ctx, id);
        if (exists) {
            throw new Error(`Incident ${id} already exists`);
        }

        const txTime = this._getTxTimestamp(ctx);

        const incident = {
            id: id,
            assetType: 'incident',
            type: type, // 'accident', 'roadwork', 'closure', 'weather'
            location: location,
            roadId: roadId,
            severity: severity, // 'low', 'medium', 'high', 'critical'
            description: description,
            status: 'active',
            reportedAt: txTime,
            resolvedAt: null,
            timestamp: txTime
        };

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(incident)));
        return JSON.stringify(incident);
    }

    async ResolveIncident(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Incident ${id} does not exist`);
        }

        const incident = JSON.parse(assetJSON.toString());
        const txTime = this._getTxTimestamp(ctx);
        
        incident.status = 'resolved';
        incident.resolvedAt = txTime;
        incident.timestamp = txTime;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(incident)));
        return JSON.stringify(incident);
    }

    async GetAllIncidents(ctx) {
        return await this._getAssetsByType(ctx, 'incident');
    }

    async GetActiveIncidents(ctx) {
        const allJSON = await this.GetAllIncidents(ctx);
        const all = JSON.parse(allJSON);
        const active = all.filter(i => i.status === 'active');
        return JSON.stringify(active);
    }

    async GetIncidentsByRoad(ctx, roadId) {
        const allJSON = await this.GetAllIncidents(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(i => i.roadId === roadId);
        return JSON.stringify(filtered);
    }

    async GetIncidentsBySeverity(ctx, severity) {
        const allJSON = await this.GetAllIncidents(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(i => i.severity === severity && i.status === 'active');
        return JSON.stringify(filtered);
    }

    // ==================== SECURITY ALERTS (NEW FEATURE) ====================

async ReportSecurityAlert(
    ctx,
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
    keyFeaturesJSON
) {
    const exists = await this._assetExists(ctx, id);
    if (exists) {
        throw new Error(`SecurityAlert ${id} already exists`);
    }

    const txTime = this._getTxTimestamp(ctx);

    let keyFeatures = [];
    try {
        keyFeatures = JSON.parse(keyFeaturesJSON || '[]');
        if (!Array.isArray(keyFeatures)) keyFeatures = [];
    } catch (e) {
        keyFeatures = [];
    }

    const alert = {
        id: id,
        assetType: 'securityAlert',
        source: source || 'GNN',
        dataset: dataset || '',
        scenario: scenario || '',
        windowMinutes: parseInt(windowMinutes, 10) || 5,

        entityType: entityType || 'host',  // host|vehicle|road|intersection
        entityId: entityId || '',

        score: parseFloat(score) || 0,
        severity: severity || 'medium',     // low|medium|high|critical
        status: 'active',                  // active|resolved

        justification: justification || '',
        keyFeatures: keyFeatures,

        createdAt: txTime,
        resolvedAt: null,
        timestamp: txTime
    };

    await ctx.stub.putState(id, Buffer.from(JSON.stringify(alert)));
    return JSON.stringify(alert);
}

async ResolveSecurityAlert(ctx, id) {
    const assetJSON = await ctx.stub.getState(id);
    if (!assetJSON || assetJSON.length === 0) {
        throw new Error(`SecurityAlert ${id} does not exist`);
    }

    const alert = JSON.parse(assetJSON.toString());
    const txTime = this._getTxTimestamp(ctx);

    alert.status = 'resolved';
    alert.resolvedAt = txTime;
    alert.timestamp = txTime;

    await ctx.stub.putState(id, Buffer.from(JSON.stringify(alert)));
    return JSON.stringify(alert);
}

async GetAllSecurityAlerts(ctx) {
    return await this._getAssetsByType(ctx, 'securityAlert');
}

async GetActiveSecurityAlerts(ctx) {
    const allJSON = await this.GetAllSecurityAlerts(ctx);
    const all = JSON.parse(allJSON);
    const active = all.filter(a => a.status === 'active');
    return JSON.stringify(active);
}

async GetSecurityAlertsBySeverity(ctx, severity) {
    const allJSON = await this.GetAllSecurityAlerts(ctx);
    const all = JSON.parse(allJSON);
    const filtered = all.filter(a => a.severity === severity && a.status === 'active');
    return JSON.stringify(filtered);
}

async GetSecurityAlertsByEntity(ctx, entityType, entityId) {
    const allJSON = await this.GetAllSecurityAlerts(ctx);
    const all = JSON.parse(allJSON);
    const filtered = all.filter(a => a.entityType === entityType && a.entityId === entityId);
    return JSON.stringify(filtered);
}


    // ==================== SPEED VIOLATION TRACKING (NEW FEATURE) ====================

    async _checkSpeedViolation(ctx, vehicleId, roadId, vehicleSpeed, txTime) {
        // Get road to check speed limit
        const roadJSON = await ctx.stub.getState(roadId);
        if (!roadJSON || roadJSON.length === 0) {
            return; // Road doesn't exist, skip check
        }

        const road = JSON.parse(roadJSON.toString());
        
        // If vehicle exceeds speed limit, record violation
        if (vehicleSpeed > road.maxSpeed) {
            const violationId = `VIO_${vehicleId}_${txTime.replace(/[:.]/g, '')}`;
            const violation = {
                id: violationId,
                assetType: 'violation',
                vehicleId: vehicleId,
                roadId: roadId,
                speedLimit: road.maxSpeed,
                actualSpeed: vehicleSpeed,
                excessSpeed: vehicleSpeed - road.maxSpeed,
                timestamp: txTime,
                location: road.name
            };

            await ctx.stub.putState(violationId, Buffer.from(JSON.stringify(violation)));
        }
    }

    async GetAllViolations(ctx) {
        return await this._getAssetsByType(ctx, 'violation');
    }

    async GetViolationsByVehicle(ctx, vehicleId) {
        const allJSON = await this.GetAllViolations(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(v => v.vehicleId === vehicleId);
        return JSON.stringify(filtered);
    }

    async GetViolationsByRoad(ctx, roadId) {
        const allJSON = await this.GetAllViolations(ctx);
        const all = JSON.parse(allJSON);
        const filtered = all.filter(v => v.roadId === roadId);
        return JSON.stringify(filtered);
    }

    // ==================== VEHICLE JOURNEY HISTORY (NEW FEATURE) ====================

    async GetVehicleHistory(ctx, vehicleId) {
        const history = [];
        
        // Get transaction history for this vehicle
        const iterator = await ctx.stub.getHistoryForKey(vehicleId);
        let result = await iterator.next();

        while (!result.done) {
            if (result.value && result.value.value && result.value.value.length > 0) {
                try {
                    const record = JSON.parse(result.value.value.toString('utf8'));
                    const txId = result.value.txId;
                    const timestamp = result.value.timestamp;
                    
                    history.push({
                        txId: txId,
                        timestamp: timestamp,
                        data: record,
                        isDelete: result.value.isDelete
                    });
                } catch (err) {
                    console.log('Error parsing history:', err);
                }
            }
            result = await iterator.next();
        }
        
        await iterator.close();
        
        return JSON.stringify({
            vehicleId: vehicleId,
            totalRecords: history.length,
            history: history
        });
    }

    async GetVehicleMovementPath(ctx, vehicleId) {
        const historyJSON = await this.GetVehicleHistory(ctx, vehicleId);
        const historyData = JSON.parse(historyJSON);
        
        const path = historyData.history
            .filter(h => !h.isDelete && h.data.currentRoad)
            .map(h => ({
                timestamp: h.timestamp,
                road: h.data.currentRoad,
                intersection: h.data.currentIntersection,
                speed: h.data.speed,
                direction: h.data.direction
            }));
        
        return JSON.stringify({
            vehicleId: vehicleId,
            pathLength: path.length,
            path: path
        });
    }

    // ==================== ENHANCED STATISTICS (IMPROVED) ====================

    async GetNetworkStatistics(ctx) {
        const txTime = this._getTxTimestamp(ctx);
        
        const vehiclesJSON = await this.GetAllVehicles(ctx);
        const vehicles = JSON.parse(vehiclesJSON);

        const roadsJSON = await this.GetAllRoads(ctx);
        const roads = JSON.parse(roadsJSON);

        const intersectionsJSON = await this.GetAllIntersections(ctx);
        const intersections = JSON.parse(intersectionsJSON);

        const incidentsJSON = await this.GetAllIncidents(ctx);
        const incidents = JSON.parse(incidentsJSON);

        const violationsJSON = await this.GetAllViolations(ctx);
        const violations = JSON.parse(violationsJSON);

        const stats = {
            timestamp: txTime,
            vehicles: {
                total: vehicles.length,
                active: vehicles.filter(v => v.status === 'active').length,
                emergency: vehicles.filter(v => v.isEmergency === true).length,
                byType: {
                    car: vehicles.filter(v => v.type === 'car').length,
                    truck: vehicles.filter(v => v.type === 'truck').length,
                    bus: vehicles.filter(v => v.type === 'bus').length,
                    emergency: vehicles.filter(v => v.type === 'emergency').length
                },
                averageSpeed: vehicles.length > 0 
                    ? Math.round(vehicles.reduce((sum, v) => sum + v.speed, 0) / vehicles.length) 
                    : 0
            },
            roads: {
                total: roads.length,
                open: roads.filter(r => r.status === 'open').length,
                closed: roads.filter(r => r.status === 'closed').length,
                totalLength: roads.reduce((sum, r) => sum + r.length, 0),
                congestion: {
                    low: roads.filter(r => r.congestionLevel === 'low').length,
                    medium: roads.filter(r => r.congestionLevel === 'medium').length,
                    high: roads.filter(r => r.congestionLevel === 'high').length
                }
            },
            intersections: {
                total: intersections.length,
                trafficLights: {
                    green: intersections.filter(i => i.trafficLightState === 'green').length,
                    yellow: intersections.filter(i => i.trafficLightState === 'yellow').length,
                    red: intersections.filter(i => i.trafficLightState === 'red').length
                },
                density: {
                    low: intersections.filter(i => i.trafficDensity === 'low').length,
                    medium: intersections.filter(i => i.trafficDensity === 'medium').length,
                    high: intersections.filter(i => i.trafficDensity === 'high').length
                }
            },
            incidents: {
                total: incidents.length,
                active: incidents.filter(i => i.status === 'active').length,
                resolved: incidents.filter(i => i.status === 'resolved').length,
                bySeverity: {
                    low: incidents.filter(i => i.severity === 'low').length,
                    medium: incidents.filter(i => i.severity === 'medium').length,
                    high: incidents.filter(i => i.severity === 'high').length,
                    critical: incidents.filter(i => i.severity === 'critical').length
                }
            },
            violations: {
                total: violations.length,
                averageExcessSpeed: violations.length > 0
                    ? Math.round(violations.reduce((sum, v) => sum + v.excessSpeed, 0) / violations.length)
                    : 0
            }
        };

        return JSON.stringify(stats);
    }

    async GetRoadCongestionReport(ctx) {
        const roadsJSON = await this.GetAllRoads(ctx);
        const roads = JSON.parse(roadsJSON);
        const txTime = this._getTxTimestamp(ctx);

        const report = roads.map(road => ({
            roadId: road.id,
            name: road.name,
            congestionLevel: road.congestionLevel,
            status: road.status,
            vehicleCount: road.currentVehicleCount,
            lanes: road.lanes,
            maxSpeed: road.maxSpeed
        }));

        return JSON.stringify({
            timestamp: txTime,
            totalRoads: roads.length,
            roads: report
        });
    }

    // ==================== HELPERS ====================

    async _assetExists(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }

    async _getAssetsByType(ctx, assetType) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();

        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            try {
                const record = JSON.parse(strValue);
                if (record.assetType === assetType) {
                    allResults.push(record);
                }
            } catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        
        await iterator.close();
        return JSON.stringify(allResults);
    }
}

module.exports = TrafficContract;