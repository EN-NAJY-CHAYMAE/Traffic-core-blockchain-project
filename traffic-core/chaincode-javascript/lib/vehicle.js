'use strict';

class Vehicle {
    constructor(id, type, currentRoad, currentIntersection, speed, direction, timestamp) {
        this.id = id;
        this.type = type; // car, truck, bus, emergency
        this.currentRoad = currentRoad;
        this.currentIntersection = currentIntersection;
        this.speed = speed; // km/h
        this.direction = direction; // north, south, east, west
        this.timestamp = timestamp;
        this.isEmergency = type === 'emergency';
        this.status = 'active'; // active, stopped, parked
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            currentRoad: this.currentRoad,
            currentIntersection: this.currentIntersection,
            speed: this.speed,
            direction: this.direction,
            timestamp: this.timestamp,
            isEmergency: this.isEmergency,
            status: this.status
        };
    }

    static fromJSON(json) {
        const data = JSON.parse(json);
        return new Vehicle(
            data.id,
            data.type,
            data.currentRoad,
            data.currentIntersection,
            data.speed,
            data.direction,
            data.timestamp
        );
    }
}

module.exports = Vehicle;
