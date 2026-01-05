'use strict';

class Intersection {
    constructor(id, name, latitude, longitude, connectedRoads) {
        this.id = id;
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.connectedRoads = connectedRoads; // array of road IDs
        this.currentVehicleCount = 0;
        this.trafficDensity = 'low'; // low, medium, high
        this.hasTrafficLight = true;
        this.currentLightState = 'green'; // green, yellow, red
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            latitude: this.latitude,
            longitude: this.longitude,
            connectedRoads: this.connectedRoads,
            currentVehicleCount: this.currentVehicleCount,
            trafficDensity: this.trafficDensity,
            hasTrafficLight: this.hasTrafficLight,
            currentLightState: this.currentLightState
        };
    }

    static fromJSON(json) {
        const data = JSON.parse(json);
        const intersection = new Intersection(
            data.id,
            data.name,
            data.latitude,
            data.longitude,
            data.connectedRoads
        );
        intersection.currentVehicleCount = data.currentVehicleCount;
        intersection.trafficDensity = data.trafficDensity;
        intersection.hasTrafficLight = data.hasTrafficLight;
        intersection.currentLightState = data.currentLightState;
        return intersection;
    }
}

module.exports = Intersection;
