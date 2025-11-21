// modules/roomSchemaCompleteness.js
// Analyzes hotel room schema completeness for booking queries

/**
 * Critical room properties that AI looks for when answering booking queries
 */
const CRITICAL_ROOM_PROPERTIES = [
  'name',
  'description',
  'image',
  'occupancy',
  'bed',
  'amenityFeature',
  'offers'
];

const RECOMMENDED_ROOM_PROPERTIES = [
  'numberOfBedrooms',
  'floorSize',
  'petsAllowed',
  'smokingAllowed'
];

/**
 * Analyze room/accommodation schema completeness
 */
function analyzeRoomSchemaCompleteness(schemas) {
  const analysis = {
    score: 0,
    maxScore: 100,
    hasRoomSchema: false,
    roomCount: 0,
    rooms: [],
    avgCompleteness: 0,
    commonMissingFields: {},
    recommendations: []
  };

  const roomSchemas = schemas.filter(schema => {
    const type = schema['@type'];
    return type && (
      type === 'HotelRoom' ||
      type === 'Room' ||
      type === 'Accommodation' ||
      type === 'Suite'
    );
  });

  if (roomSchemas.length === 0) {
    analysis.recommendations.push(
      'No room schemas found - add HotelRoom schema for each room type'
    );
    console.log('[Room Schema] No room schemas found');
    return analysis;
  }

  analysis.hasRoomSchema = true;
  analysis.roomCount = roomSchemas.length;
  analysis.score += 20; // Base score for having room schema

  // Analyze each room
  roomSchemas.forEach((room, index) => {
    const roomAnalysis = {
      name: room.name || `Room ${index + 1}`,
      criticalFields: [],
      missingCritical: [],
      recommendedFields: [],
      missingRecommended: [],
      completeness: 0
    };

    // Check critical fields
    CRITICAL_ROOM_PROPERTIES.forEach(prop => {
      if (room[prop]) {
        roomAnalysis.criticalFields.push(prop);

        // Special validation for offers
        if (prop === 'offers' && room.offers) {
          const offer = Array.isArray(room.offers) ? room.offers[0] : room.offers;
          if (offer.price && offer.priceCurrency) {
            roomAnalysis.criticalFields.push('offers-complete');
          }
        }
      } else {
        roomAnalysis.missingCritical.push(prop);

        // Track common missing fields
        if (!analysis.commonMissingFields[prop]) {
          analysis.commonMissingFields[prop] = 0;
        }
        analysis.commonMissingFields[prop]++;
      }
    });

    // Check recommended fields
    RECOMMENDED_ROOM_PROPERTIES.forEach(prop => {
      if (room[prop]) {
        roomAnalysis.recommendedFields.push(prop);
      } else {
        roomAnalysis.missingRecommended.push(prop);
      }
    });

    // Calculate room completeness
    const criticalScore = (roomAnalysis.criticalFields.length / CRITICAL_ROOM_PROPERTIES.length) * 70;
    const recommendedScore = (roomAnalysis.recommendedFields.length / RECOMMENDED_ROOM_PROPERTIES.length) * 30;
    roomAnalysis.completeness = Math.round(criticalScore + recommendedScore);

    analysis.rooms.push(roomAnalysis);
  });

  // Calculate average completeness
  const totalCompleteness = analysis.rooms.reduce((sum, room) => sum + room.completeness, 0);
  analysis.avgCompleteness = Math.round(totalCompleteness / analysis.rooms.length);

  // Score based on average completeness
  analysis.score += Math.round(analysis.avgCompleteness * 0.8); // Up to 80 points

  // Generate recommendations
  if (analysis.roomCount < 3) {
    analysis.recommendations.push(
      `Only ${analysis.roomCount} room type(s) found - add schemas for all room categories`
    );
  }

  // Find most common missing fields
  const missingFieldsArray = Object.entries(analysis.commonMissingFields)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  missingFieldsArray.forEach(([field, count]) => {
    analysis.recommendations.push(
      `${count} of ${analysis.roomCount} rooms missing '${field}' property`
    );
  });

  // Check for specific important missing fields
  const firstRoom = analysis.rooms[0];
  if (firstRoom && firstRoom.missingCritical.includes('offers')) {
    analysis.recommendations.push(
      'Add offers with price information - critical for booking queries'
    );
  }

  if (firstRoom && firstRoom.missingCritical.includes('occupancy')) {
    analysis.recommendations.push(
      'Add occupancy information (maxOccupancy) - common AI query'
    );
  }

  console.log('[Room Schema] Found rooms:', analysis.roomCount);
  console.log('[Room Schema] Average completeness:', analysis.avgCompleteness + '%');
  console.log('[Room Schema] Score:', analysis.score);

  return analysis;
}

module.exports = { analyzeRoomSchemaCompleteness };
