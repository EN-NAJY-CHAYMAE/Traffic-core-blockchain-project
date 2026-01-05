/**
 * Traffic Core Simulation Engine
 * Automatically simulates traffic behavior and records to blockchain
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

class TrafficSimulation {
    constructor() {
        this.isRunning = false;
        this.speed = 1; // Simulation speed multiplier (1x, 2x, 5x, etc.)
        this.vehicles = [];
        this.roads = [];
        this.intersections = [];
        this.spawnRate = 2; // Vehicles per minute
        this.vehicleTypes = ['car', 'truck', 'bus', 'emergency'];
        this.vehicleTypeDistribution = { car: 0.7, truck: 0.15, bus: 0.1, emergency: 0.05 };
        
        // Timers
        this.vehicleMoveInterval = null;
        this.trafficLightInterval = null;
        this.vehicleSpawnInterval = null;
        this.congestionUpdateInterval = null;
        
        // Counters
        this.vehicleCounter = 1000;
        this.transactionCount = 0;
    }

    // ==================== LIFECYCLE ====================

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Simulation already running');
            return;
        }

        console.log('🚀 Starting Traffic Core Simulation...');
        this.isRunning = true;

        // Load current state from blockchain
        await this.loadState();

        // Start all automated processes
        this.startVehicleMovement();
        this.startTrafficLightCycling();
        this.startVehicleSpawning();
        this.startCongestionUpdates();

        console.log('✅ Simulation started successfully');
    }

    pause() {
        if (!this.isRunning) return;
        
        console.log('⏸️  Pausing simulation...');
        this.clearAllIntervals();
        this.isRunning = false;
        console.log('✅ Simulation paused');
    }

    resume() {
        if (this.isRunning) return;
        
        console.log('▶️  Resuming simulation...');
        this.isRunning = true;
        this.startVehicleMovement();
        this.startTrafficLightCycling();
        this.startVehicleSpawning();
        this.startCongestionUpdates();
        console.log('✅ Simulation resumed');
    }

    async reset() {
        console.log('🔄 Resetting simulation...');
        this.pause();
        
        // Reset counters
        this.vehicleCounter = 1000;
        this.transactionCount = 0;
        
        // Reload initial state
        await this.loadState();
        
        console.log('✅ Simulation reset complete');
    }

    setSpeed(multiplier) {
        console.log(`⚡ Changing simulation speed to ${multiplier}x`);
        this.speed = multiplier;
        
        if (this.isRunning) {
            // Restart intervals with new speed
            this.pause();
            this.resume();
        }
    }

    setSpawnRate(rate) {
        this.spawnRate = rate;
        console.log(`🚗 Vehicle spawn rate set to ${rate}/minute`);
        
        if (this.isRunning) {
            clearInterval(this.vehicleSpawnInterval);
            this.startVehicleSpawning();
        }
    }

    clearAllIntervals() {
        if (this.vehicleMoveInterval) clearInterval(this.vehicleMoveInterval);
        if (this.trafficLightInterval) clearInterval(this.trafficLightInterval);
        if (this.vehicleSpawnInterval) clearInterval(this.vehicleSpawnInterval);
        if (this.congestionUpdateInterval) clearInterval(this.congestionUpdateInterval);
    }

    // ==================== STATE LOADING ====================

    async loadState() {
        try {
            console.log('📥 Loading current state from blockchain...');
            
            const [vehiclesRes, roadsRes, intersectionsRes] = await Promise.all([
                axios.get(`${API_URL}/vehicles`),
                axios.get(`${API_URL}/roads`),
                axios.get(`${API_URL}/intersections`)
            ]);

            this.vehicles = vehiclesRes.data;
            this.roads = roadsRes.data;
            this.intersections = intersectionsRes.data;

            console.log(`✅ Loaded: ${this.vehicles.length} vehicles, ${this.roads.length} roads, ${this.intersections.length} intersections`);
        } catch (error) {
            console.error('❌ Error loading state:', error.message);
        }
    }

    // ==================== VEHICLE MOVEMENT ====================

    // startVehicleMovement() {
    //     const interval = Math.floor(3000 / this.speed); // Base: every 3 seconds
        
    //     this.vehicleMoveInterval = setInterval(async () => {
    //         if (!this.isRunning) return;
            
    //         // Reload vehicles from blockchain
    //         try {
    //             const res = await axios.get(`${API_URL}/vehicles`);
    //             this.vehicles = res.data.filter(v => v.status === 'active');
    //         } catch (error) {
    //             console.error('Error reloading vehicles:', error.message);
    //             return;
    //         }

    //         // Move only a small batch per cycle to avoid saturating Fabric
    //         const BATCH_SIZE = 10;
    //         const batch = this.vehicles
    //         .sort(() => 0.5 - Math.random())
    //         .slice(0, BATCH_SIZE);

    //         for (const vehicle of batch) {
    //         await this.moveVehicle(vehicle);
    //         await this.sleep(150); // slightly bigger delay
    //         }


    //         // Move each active vehicle
            
    //     }, interval);
        

    //     console.log(`Vehicle movement started (every ${interval}ms)`);
    // }
    startVehicleMovement() {
        const interval = Math.floor(3000 / this.speed); // Base: every 3 seconds

        // Prevent overlapping ticks (reduces MVCC conflicts)
        this._movingTickRunning = false;

        this.vehicleMoveInterval = setInterval(async () => {
            if (!this.isRunning) return;
            if (this._movingTickRunning) return; // skip if previous tick still running
            this._movingTickRunning = true;

            try {
            // Reload vehicles from blockchain
            const res = await axios.get(`${API_URL}/vehicles`);
            this.vehicles = (res.data || []).filter(v => v.status === 'active');

            // Move only a small batch per cycle to avoid saturating Fabric
            const BATCH_SIZE = 10;
            const batch = this.vehicles
                .sort(() => 0.5 - Math.random())
                .slice(0, BATCH_SIZE);

            for (const vehicle of batch) {
                await this.moveVehicle(vehicle);
                await this.sleep(150); // small delay between moves
            }
            } catch (error) {
            console.error('Error reloading/moving vehicles:', error.response?.data || error.message);
            } finally {
            this._movingTickRunning = false;
            }
        }, interval);

        console.log(` Vehicle movement started (every ${interval}ms, batch=10, no-overlap)`);
    }


    async moveVehicle(vehicle) {
        try {
            if (vehicle.status === 'quarantine') {
            console.log(`🛑 ${vehicle.id} is quarantined → movement skipped`);
            return;
            }
            // Find current road
            const currentRoad = this.roads.find(r => r.id === vehicle.currentRoad);
            if (!currentRoad) return;

            // Find next intersection
            const nextIntersection = this.getNextIntersection(currentRoad, vehicle.currentIntersection);
            if (!nextIntersection) return;

            // Find next road (random from connected roads)
            const connectedRoads = this.roads.filter(r => 
                r.startIntersection === nextIntersection || r.endIntersection === nextIntersection
            );
            
            if (connectedRoads.length === 0) return;
            
            const nextRoad = connectedRoads[Math.floor(Math.random() * connectedRoads.length)];

            // Calculate new speed (varies based on congestion)
            let newSpeed = this.calculateSpeed(vehicle, nextRoad);

            // Random direction
            const directions = ['north', 'south', 'east', 'west'];
            const newDirection = directions[Math.floor(Math.random() * directions.length)];

            // Update vehicle position on blockchain
            await axios.put(`${API_URL}/vehicles/${vehicle.id}/position`, {
                newRoad: nextRoad.id,
                newIntersection: nextIntersection,
                newSpeed: newSpeed,
                newDirection: newDirection
            });

            this.transactionCount++;
            console.log(`✅ Moved ${vehicle.id}: ${currentRoad.id} → ${nextRoad.id} @ ${newSpeed}km/h`);

        } catch (error) {
            // Silently fail individual moves to keep simulation running
            if (error.response?.status !== 404) {
                console.error(`❌ Error moving ${vehicle.id}:`,  error.response?.data || error.message);
            }
        }
    }

    getNextIntersection(road, currentIntersection) {
        // If at start, go to end; if at end, go to start
        if (road.startIntersection === currentIntersection) {
            return road.endIntersection;
        } else if (road.endIntersection === currentIntersection) {
            return road.startIntersection;
        }
        
        // Default to end intersection
        return road.endIntersection;
    }

    calculateSpeed(vehicle, road) {
        const baseSpeed = road.maxSpeed || 50;
        const variation = (Math.random() * 20) - 10; // ±10 km/h
        
        // Emergency vehicles go faster
        if (vehicle.isEmergency) {
            return Math.min(baseSpeed + 30 + variation, 120);
        }
        
        // Regular vehicles vary around speed limit
        return Math.max(Math.min(baseSpeed + variation, road.maxSpeed), 20);
    }

    // ==================== TRAFFIC LIGHT CYCLING ====================

    startTrafficLightCycling() {
        const interval = Math.floor(15000 / this.speed); // Base: every 15 seconds
        
        this.trafficLightInterval = setInterval(async () => {
            if (!this.isRunning) return;

            for (const intersection of this.intersections) {
                await this.cycleTrafficLight(intersection);
                await this.sleep(50);
            }
        }, interval);

        console.log(`🚦 Traffic light cycling started (every ${interval}ms)`);
    }

    async cycleTrafficLight(intersection) {
        try {
            const currentState = intersection.trafficLightState;
            let newState;

            // Cycle: green → yellow → red → green
            switch (currentState) {
                case 'green':
                    newState = 'yellow';
                    break;
                case 'yellow':
                    newState = 'red';
                    break;
                case 'red':
                    newState = 'green';
                    break;
                default:
                    newState = 'green';
            }

            await axios.put(`${API_URL}/intersections/${intersection.id}/light`, {
                state: newState
            });

            intersection.trafficLightState = newState;
            this.transactionCount++;
            console.log(`🚦 ${intersection.id}: ${currentState} → ${newState}`);

        } catch (error) {
            console.error(`❌ Error cycling light for ${intersection.id}:`, error.message);
        }
    }

    // ==================== VEHICLE SPAWNING ====================

    startVehicleSpawning() {
        if (this.spawnRate === 0) return;
        
        const interval = Math.floor((60000 / this.spawnRate) / this.speed); // Convert rate to interval
        
        this.vehicleSpawnInterval = setInterval(async () => {
            if (!this.isRunning) return;
            await this.spawnVehicle();
        }, interval);

        console.log(`🚗 Vehicle spawning started (every ${interval}ms, ${this.spawnRate}/min)`);
    }

    async spawnVehicle() {
        try {
            // Random vehicle type based on distribution
            const type = this.getRandomVehicleType();
            
            // Random road and intersection
            const road = this.roads[Math.floor(Math.random() * this.roads.length)];
            const intersection = Math.random() > 0.5 ? road.startIntersection : road.endIntersection;
            
            // Random speed and direction
            const speed = Math.floor(Math.random() * (road.maxSpeed - 20)) + 20;
            const directions = ['north', 'south', 'east', 'west'];
            const direction = directions[Math.floor(Math.random() * directions.length)];

            const vehicleId = `SIM${this.vehicleCounter++}`;

            await axios.post(`${API_URL}/vehicles`, {
                id: vehicleId,
                type: type,
                currentRoad: road.id,
                currentIntersection: intersection,
                speed: speed,
                direction: direction
            });

            this.transactionCount++;
            console.log(`✅ Spawned ${vehicleId} (${type}) on ${road.id}`);

        } catch (error) {
            console.error('❌ Error spawning vehicle:', error.message);
        }
    }

    getRandomVehicleType() {
        const rand = Math.random();
        let cumulative = 0;
        
        for (const [type, probability] of Object.entries(this.vehicleTypeDistribution)) {
            cumulative += probability;
            if (rand <= cumulative) return type;
        }
        
        return 'car'; // fallback
    }

    // ==================== CONGESTION UPDATES ====================

    startCongestionUpdates() {
        const interval = Math.floor(10000 / this.speed); // Base: every 10 seconds
        
        this.congestionUpdateInterval = setInterval(async () => {
            if (!this.isRunning) return;
            await this.updateCongestion();
        }, interval);

        console.log(`📊 Congestion updates started (every ${interval}ms)`);
    }

    async updateCongestion() {
        try {
            // Reload vehicles to count per road
            const res = await axios.get(`${API_URL}/vehicles`);
            const vehicles = res.data.filter(v => v.status === 'active');

            for (const road of this.roads) {
                const vehiclesOnRoad = vehicles.filter(v => v.currentRoad === road.id).length;
                
                // Calculate congestion level
                let congestionLevel;
                if (vehiclesOnRoad === 0) {
                    congestionLevel = 'low';
                } else if (vehiclesOnRoad <= 2) {
                    congestionLevel = 'low';
                } else if (vehiclesOnRoad <= 4) {
                    congestionLevel = 'medium';
                } else {
                    congestionLevel = 'high';
                }

                // Update if changed
                if (road.congestionLevel !== congestionLevel) {
                    await axios.put(`${API_URL}/roads/${road.id}/congestion`, {
                        level: congestionLevel
                    });

                    road.congestionLevel = congestionLevel;
                    this.transactionCount++;
                    console.log(`📊 ${road.id}: congestion → ${congestionLevel} (${vehiclesOnRoad} vehicles)`);
                }
            }
        } catch (error) {
            console.error('❌ Error updating congestion:', error.message);
        }
    }

    // ==================== UTILITIES ====================

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            speed: this.speed,
            spawnRate: this.spawnRate,
            totalVehicles: this.vehicles.length,
            totalRoads: this.roads.length,
            totalIntersections: this.intersections.length,
            transactionCount: this.transactionCount
        };
    }
}

// ==================== EXPORTS ====================

module.exports = TrafficSimulation;

// ==================== STANDALONE EXECUTION ====================

if (require.main === module) {
    const simulation = new TrafficSimulation();
    
    console.log('🚦 Traffic Core Simulation Engine');
    console.log('📝 Commands: start, pause, resume, reset, speed <n>, spawn <n>, stats, quit');
    
    // Start simulation automatically
    simulation.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping simulation...');
        simulation.pause();
        process.exit(0);
    });
}
