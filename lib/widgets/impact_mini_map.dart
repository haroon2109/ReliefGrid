import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class ImpactMiniMap extends StatelessWidget {
  final Set<Circle> hotspots;
  final Set<Marker> supplyPoints;

  const ImpactMiniMap({
    super.key,
    required this.hotspots,
    required this.supplyPoints,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 250,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.slate[800]!, width: 1),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 10, offset: Offset(0, 5)),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: const CameraPosition(
              target: LatLng(13.0827, 80.2707), // Chennai
              zoom: 11,
            ),
            circles: hotspots,
            markers: supplyPoints,
            mapType: MapType.dark,
            rotateGesturesEnabled: false,
            scrollGesturesEnabled: false,
            zoomGesturesEnabled: false,
            myLocationButtonEnabled: false,
            style: '''
            [
              {"elementType": "geometry", "stylers": [{"color": "#0f172a"}]},
              {"elementType": "labels.text.fill", "stylers": [{"color": "#334155"}]},
              {"elementType": "labels.text.stroke", "stylers": [{"color": "#0f172a"}]},
              {"featureType": "water", "elementType": "geometry", "stylers": [{"color": "#020617"}]}
            ]
            ''',
          ),
          Positioned(
            top: 16,
            left: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.slate[900]?.withOpacity(0.8),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.slate[700]!),
              ),
              child: const Row(
                children: [
                   Icon(Icons.map, color: Colors.blue, size: 12),
                   SizedBox(width: 8),
                   Text(
                      'STRATEGIC IMPACT GRID',
                      style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.black, letterSpacing: 1.2),
                   ),
                ],
              ),
            ),
          ),
          // Legend
          Positioned(
            bottom: 16,
            right: 16,
            child: Container(
               padding: const EdgeInsets.all(12),
               decoration: BoxDecoration(
                  color: Colors.slate[900]?.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(12),
               ),
               child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                     _buildLegendItem(Colors.red.withOpacity(0.5), 'High Demand'),
                     const SizedBox(height: 4),
                     _buildLegendItem(Colors.blue, 'Supply Hub'),
                  ],
               ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 8, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
