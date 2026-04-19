import 'package:flutter/material.dart';

class HighTrustMetricsCard extends StatefulWidget {
  const HighTrustMetricsCard({super.key});

  @override
  State<HighTrustMetricsCard> createState() => _HighTrustMetricsCardState();
}

class _HighTrustMetricsCardState extends State<HighTrustMetricsCard> {
  bool _isLive = true;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('JURY TRANSPARENCY MODE', style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 1.5)),
              Switch(value: _isLive, onChanged: (v) => setState(() => _isLive = v)),
            ],
          ),
          const SizedBox(height: 24),
          _buildMetric('MAN-HOURS SAVED', '1,482', 'AI Efficiency Factor: 5x', Colors.blue),
          const Divider(height: 32, color: Colors.slate),
          _buildMetric('VERIFIED DELIVERIES', '842', 'QR Handshake Success: 98%', Colors.emerald),
          const Divider(height: 32, color: Colors.slate),
          _buildMetric('IMPACT RATIO', '94%', 'Optimal Resource Allocation', Colors.amber),
        ],
      ),
    );
  }

  Widget _buildMetric(String label, String value, String sub, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: Colors.slate, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 4),
          Text(sub, style: TextStyle(color: color.withOpacity(0.7), fontSize: 10, fontWeight: FontWeight.bold)),
        ]),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.black)),
      ],
    );
  }
}
