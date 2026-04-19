const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

/**
 * Government Bridge: SDMA Real-time Heatmap API
 * Returns demand hotspots in HXL-compatible JSON for government command centers.
 */
router.get('/heatmap', async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('aid_requests')
      .where('status', '==', 'open')
      .get();

    const data = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        location_name: d.location_name,
        latitude: d.location?.lat,
        longitude: d.location?.lng,
        urgency: d.urgency_level,
        item: d.request_type,
        // HXL Tags for Global Interoperability
        "#adm1": d.region || "Chennai",
        "#loc+lat": d.location?.lat,
        "#loc+lon": d.location?.lng,
        "#severity": d.urgency_level,
        "#item+type": d.request_type,
        "#status": "OPEN"
      };
    });

    // Provide both raw data and GeoJSON wrapper
    res.status(200).json({
      base_schema: "HXL/JSON-v1",
      timestamp: new Date().toISOString(),
      count: data.length,
      features: data,
      geojson: {
        type: "FeatureCollection",
        features: data.map(pt => ({
          type: "Feature",
          properties: { urgency: pt.urgency, item: pt.item },
          geometry: {
            type: "Point",
            coordinates: [pt.longitude, pt.latitude]
          }
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to bridge SDMA data grid" });
  }
});

module.exports = router;
