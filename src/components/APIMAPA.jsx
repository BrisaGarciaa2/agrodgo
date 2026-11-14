import { MapContainer, TileLayer, LayersControl } from "react-leaflet";

export default function APIMAPA() {
    return (
        <MapContainer
            center={[24.6, -104.9]}
            zoom={7}
            style={{ height: "100%", width: "100%" }}
        >
            <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Satélite">
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="Imágenes © Esri"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Calles">
                    <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="© OpenStreetMap"
                    />
                </LayersControl.BaseLayer>
            </LayersControl>
        </MapContainer>
    );
}