const admin = require('firebase-admin');
const { getDistance } = require('geolib');

/**
 * Crisis Sentinel: Impact Gap Analysis
 * Identifies high-demand hotspots without nearby supply hubs.
 */
async function runImpactGapAnalysis() {
  const db = admin.firestore();
  
  // 1. Fetch all active aid requests (Demand)
  const requestsSnapshot = await db.collection('aid_requests')
    .where('status', '==', 'open')
    .get();
    
  // 2. Fetch all supply hubs (Warehousing)
  const supplySnapshot = await db.collection('supply_points').get();
  
  const demandPoints = requestsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const supplyPoints = supplySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  const criticalGaps = [];

  // 3. Radius Scan (2km)
  for (const demand of demandPoints) {
    if (!demand.location?.lat || !demand.location?.lng) continue;

    const nearbySupply = supplyPoints.filter(supply => {
      const distance = getDistance(
        { latitude: demand.location.lat, longitude: demand.location.lng },
        { latitude: supply.location.lat, longitude: supply.location.lng }
      );
      return distance <= 2000; // 2km radius
    });

    if (nearbySupply.length === 0 && demand.urgency_level >= 4) {
      criticalGaps.add({
        region: demand.location_name || 'Unknown Zone',
        coordinates: demand.location,
        urgency: demand.urgency_level,
        item_needed: demand.request_type
      });
    }
  }

  // 4. Update the 'integrity_ledger' for the dashboard sentinel view
  await db.collection('system_alerts').doc('impact_gaps').set({
    last_analysis: admin.firestore.FieldValue.serverTimestamp(),
    active_gaps: criticalGaps,
    severity: criticalGaps.length > 5 ? 'CRITICAL' : 'WARNING'
  });

  return criticalGaps;
}

module.exports = { runImpactGapAnalysis };
