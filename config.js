window.APP_CONFIG = {
  appName: "Centro Operacional · GCM BH",
  map: {
    center: [-43.95465, -19.85537],
    zoom: 14.8,
    minZoom: 12,
    maxZoom: 19,
    pitch: 0,
    bearing: 0,
    maxBounds: [
      [-44.12, -20.06],
      [-43.80, -19.78]
    ],
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [
        {
          id: "osm",
          type: "raster",
          source: "osm"
        }
      ]
    }
  },
  storage: {
    localKey: "gcm_bh_vtrs_supabase"
  },
  supabase: {
    url: "COLE_AQUI_O_PROJECT_URL",
    anonKey: "COLE_AQUI_A_PUBLISHABLE_KEY"
  }
};
