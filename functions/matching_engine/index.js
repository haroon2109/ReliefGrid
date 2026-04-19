const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { getDistance } = require("geolib");
const _ = require("lodash");

// Initialize Firebase Admin with project context
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Smart Matching Engine - Firestore Trigger
 * Trigger: Every time a new request is added to 'aid_requests'
 */
exports.processMatching = onDocumentCreated("aid_requests/{requestId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const requestData = snapshot.data();
  const requestId = event.params.requestId;
  
  // Extract coordinates and item for matching
  const targetLat = requestData.extractedData?.lat || requestData.lat;
  const targetLng = requestData.extractedData?.lng || requestData.lng;
  const targetItem = requestData.extractedData?.item || requestData.item;
  
  if (!targetLat || !targetLng || !targetItem) {
    console.log(`[MatchingEngine] Skipping requestId: ${requestId} due to missing spatial/item data.`);
    return;
  }

  console.log(`[MatchingEngine] Processing Request ${requestId}: ${targetItem} at (${targetLat}, ${targetLng})`);

  try {
    // --- 1. DEDUPLICATION (24h Window, same Item) ---
    const dayAgo = new Date();
    dayAgo.setHours(dayAgo.getHours() - 24);

    const sameItemQuery = await db.collection("aid_requests")
      .where("extractedData.item", "==", targetItem)
      .where("processed_at", ">=", dayAgo.toISOString())
      .get();

    let isDuplicate = false;
    let originalRequestId = null;

    sameItemQuery.docs.forEach((doc) => {
      if (doc.id === requestId) return; // Skip self

      const existing = doc.data();
      const existingLat = existing.extractedData?.lat || existing.lat;
      const existingLng = existing.extractedData?.lng || existing.lng;

      const distance = getDistance(
        { latitude: targetLat, longitude: targetLng },
        { latitude: existingLat, longitude: existingLng }
      );

      if (distance <= 500) {
        isDuplicate = true;
        originalRequestId = doc.id;
        console.log(`[MatchingEngine] Potential duplicate found! Original: ${originalRequestId}, Distance: ${distance}m`);
      }
    });

    // --- 2. RETRIEVE NEARBY SUPPLY POINTS ---
    const supplyPointsSnapshot = await db.collection("supply_points").get();
    const supplyMatches = supplyPointsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const distance = getDistance(
        { latitude: targetLat, longitude: targetLng },
        { latitude: data.lat, longitude: data.lng }
      );
      return { id: doc.id, ...data, distance };
    });

    // Sort by distance and pick top 3
    const topSupplyPoints = _.sortBy(supplyMatches, ["distance"]).slice(0, 3);

    // --- 3. RETRIEVE NEARBY VOLUNTEERS (FLEETS) ---
    const volunteersSnapshot = await db.collection("users")
      .where("role", "==", "volunteer")
      .get();
    
    const volunteerMatches = volunteersSnapshot.docs.map((doc) => {
      const data = doc.data();
      const vLat = data.location?.lat || data.lat;
      const vLng = data.location?.lng || data.lng;
      
      if (!vLat) return null;

      const distance = getDistance(
        { latitude: targetLat, longitude: targetLng },
        { latitude: vLat, longitude: vLng }
      );
      return { uid: doc.id, name: data.displayName, distance };
    }).filter(v => v !== null);

    const topVolunteers = _.sortBy(volunteerMatches, ["distance"]).slice(0, 3);

    // --- 4. CALCULATE PRIORITY SCORE ---
    // Formula components: Urgency (1-5), Distance (inv), Quantity (linear)
    const urgency = requestData.extractedData?.urgency || requestData.urgency || 1;
    const quantity = requestData.extractedData?.quantity || requestData.quantity || 1;
    const nearestDist = topSupplyPoints.length > 0 ? topSupplyPoints[0].distance : 5000; // Default 5km if none

    // Urgency (50%) + Quantity (30%) + Distance Penalty (20%)
    // Normalize: Urgency (0.2-1.0), Quantity (Cap at 100), Distance (1/Dist)
    const normUrgency = urgency / 5;
    const normQuantity = Math.min(quantity / 100, 1);
    const normDist = Math.max(1 - (nearestDist / 10000), 0); // Normalized over 10km

    const priorityScore = (normUrgency * 0.5) + (normQuantity * 0.3) + (normDist * 0.2);

    // --- 5. UPDATE FIRESTORE DOCUMENT ---
    const updateData = {
      matching_metadata: {
        is_duplicate: isDuplicate,
        original_request_id: originalRequestId,
        priority_score: parseFloat(priorityScore.toFixed(3)),
        suggested_supply_points: topSupplyPoints.map(s => ({ id: s.id, name: s.name, distance_meters: s.distance })),
        suggested_volunteers: topVolunteers.map(v => ({ uid: v.uid, name: v.name, distance_meters: v.distance })),
        processed_by_engine_at: admin.firestore.FieldValue.serverTimestamp()
      }
    };

    if (isDuplicate) {
      updateData.status = "duplicate";
    }

    await db.collection("aid_requests").document(requestId).update(updateData);
    
    console.log(`[MatchingEngine] Successfully processed requestId: ${requestId} with score: ${priorityScore}`);

  } catch (error) {
    console.error(`[MatchingEngine] Error processing requestId ${requestId}:`, error);
  }
});
