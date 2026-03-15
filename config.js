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
  url: "https://bmvscqfkjkzqzdoqhlig.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdnNjcWZramt6cXpkb3FobGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MjA3NjcsImV4cCI6MjA4ODk5Njc2N30.j98MOaPJ8_AAUHJFhor-u_EjnSGJEwBhssoTfGykKC0"
  }
};
