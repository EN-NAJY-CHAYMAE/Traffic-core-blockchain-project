'use strict';

class Road {
    constructor(id, name, startIntersection, endIntersection, lanes, maxSpeed, length) {
        this.id = id;
        this.name = name;
        this.startIntersection = startIntersection;
        this.endIntersection = endIntersection;
        this.lanes = lanes; // number of lanes
        this.maxSpeed = maxSpeed; // km/h
        this.length = length; // meters
        this.currentVehicleCount = 0;
        this.status = 'open'; // open, closed, congested
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            startIntersection: this.startIntersection,
            endIntersection: this.endIntersection,
            lanes: this.lanes,
            maxSpeed: this.maxSpeed,
            length: this.length,
            currentVehicleCount: this.currentVehicleCount,
            status: this.status
        };
    }

    static fromJSON(json) {
        const data = JSON.parse(json);
        const road = new Road(
            data.id,
            data.name,
            data.startIntersection,
            data.endIntersection,
            data.lanes,
            data.maxSpeed,
            data.length
        );
        road.currentVehicleCount = data.currentVehicleCount;
        road.status = data.status;
        return road;
    }
}

module.exports = Road;
