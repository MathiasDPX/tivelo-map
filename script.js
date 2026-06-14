var map = L.map('map').setView([48.44640, -4.27179], 13);

L.tileLayer('https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token={accessToken}', {
    attribution: '<a href="https://github.com/MathiasDPX/tivelo-map" target="_blank">Opensource</a> &copy; <a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">JawgMaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    minZoom: 0,
    maxZoom: 22,
    accessToken: '29WO8RvX2raLhkGQXXiY5Ic8wq5lDReNh6UJqmQcwvPw23kj8ZM67vhY7ce4uPwV'
}).addTo(map);

// Icons
var LeafIcon = L.Icon.extend({
    options: {
        shadowUrl: "images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }
});

var blueMarker = new LeafIcon({ iconUrl: "images/marker-blue.png" });
var orangeMarker = new LeafIcon({ iconUrl: "images/marker-orange.png" });
var redMarker = new LeafIcon({ iconUrl: "images/marker-red.png" });

var geofencingLayer;

function loadGeofencing() {
    fetch('https://w.mathiasd.fr/cors/?url=https://gbfs.partners.fifteen.eu/gbfs/2.2/landerneau/en/geofencing_zones.json')
        .then(r => r.json())
        .then(data => {

            const features = data.data.geofencing_zones.features;

            const forbidden = features
                .filter(f => f.properties?.rules?.[0]?.ride_allowed === false)
                .map(f => f.geometry);

            const forbiddenPolygons = forbidden.map(g => turf.multiPolygon(g.coordinates));

            let unionForbidden = forbiddenPolygons[0];
            for (let i = 1; i < forbiddenPolygons.length; i++) {
                unionForbidden = turf.union(unionForbidden, forbiddenPolygons[i]);
            }

            const world = turf.polygon([features[1].geometry.coordinates[0][0]]);

            const allowed = turf.difference(world, unionForbidden);

            L.geoJSON(allowed, {
                style: {
                    color: "green",
                    weight: 1,
                    fillOpacity: 0.2
                }
            }).addTo(map);

            console.log("Zone autorisée calculée");
        })
        .catch(err => console.error("Geofencing error:", err));
}

loadGeofencing();

// Stations - récupération dynamique depuis l'API GBFS
var stations = {};

// Fonction pour récupérer les stations depuis l'API
function loadStations() {
    const stationInfoPromise = fetch('https://w.mathiasd.fr/cors/?url=https://gbfs.partners.fifteen.eu/gbfs/2.2/landerneau/en/station_information.json')
        .then(response => response.json());

    const stationStatusPromise = fetch('https://w.mathiasd.fr/cors/?url=https://gbfs.partners.fifteen.eu/gbfs/2.2/landerneau/en/station_status.json')
        .then(response => response.json());

    Promise.all([stationInfoPromise, stationStatusPromise])
        .then(([stationInfo, stationStatus]) => {
            const statusMap = {};
            stationStatus.data.stations.forEach(status => {
                statusMap[status.station_id] = status;
            });

            stationInfo.data.stations.forEach(station => {
                const status = statusMap[station.station_id];
                if (status && status.is_installed) {
                    stations[station.station_id] = {
                        "name": station.name,
                        "coords": [station.lat, station.lon],
                        "num_bikes_available": status.num_bikes_available
                    };
                }
            });

            Object.keys(stations).forEach(function (stationId) {
                var station = stations[stationId];
                var num_bikes_available = station.num_bikes_available;

                var icon;
                if (num_bikes_available == 0) {
                    icon = redMarker
                } else if (num_bikes_available == 1) {
                    icon = orangeMarker
                } else {
                    icon = blueMarker
                }
                var marker = L.marker(station.coords, { icon: icon }).addTo(map);

                marker.bindPopup('<b>' + station.name + '</b><br>Vélos disponibles: ' + num_bikes_available);

                marker.on("mouseover", function (ev) {
                    ev.target.openPopup();
                })

                marker.on("mouseout", function (ev) {
                    ev.target.closePopup();
                })
            });

            console.log('Stations chargées:', stations);
        })
        .catch(error => {
            console.error('Erreur lors du chargement des stations:', error);
        });
}

// Charger les stations au démarrage
loadStations();
