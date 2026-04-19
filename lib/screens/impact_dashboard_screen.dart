import 'package:flutter/material.dart';
import '../widgets/efficiency_card.dart';
import '../widgets/impact_mini_map.dart';
import '../services/impact_report_service.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class ImpactDashboardScreen extends StatefulWidget {
  const ImpactDashboardScreen({super.key});

  @override
  State<ImpactDashboardScreen> createState() => _ImpactDashboardScreenState();
}

class _ImpactDashboardScreenState extends State<ImpactDashboardScreen> {
  final ImpactReportService _reportService = ImpactReportService();
  late Future<ImpactMetrics> _metricsFuture;

  @override
  void initState() {
    super.initState();
    _metricsFuture = _reportService.calculateMetrics();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        title: const Text('COORDINATOR IMPACT', 
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.black, letterSpacing: 2, color: Colors.indigo)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
             icon: const Icon(Icons.share_outlined, color: Colors.slate, size: 20),
             onPressed: () {},
          ),
        ],
      ),
      body: FutureBuilder<ImpactMetrics>(
        future: _metricsFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());

          final metrics = snapshot.data!;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Efficiency Cards Grid
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 16,
                  crossAxisSpacing: 16,
                  childAspectRatio: 0.85,
                  children: [
                    EfficiencyCard(
                      title: 'Processed',
                      value: metrics.totalProcessed.toString(),
                      subtitle: 'Aid nodes verified',
                      icon: Icons.auto_awesome,
                      color: Colors.blue,
                      trend: '+12%',
                    ),
                    EfficiencyCard(
                      title: 'Hours Saved',
                      value: metrics.manHoursSaved.toStringAsFixed(1),
                      subtitle: 'AI vs Manual Entry',
                      icon: Icons.timer,
                      color: Colors.indigo,
                      trend: '🔥 High',
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                EfficiencyCard(
                  title: 'Response Latency',
                  value: '${metrics.averageLatency}s',
                  subtitle: 'Triage Speed Benchmark',
                  icon: Icons.bolt,
                  color: Colors.amber,
                  trend: '99.9%',
                ),

                const SizedBox(height: 32),

                // 2. High-Level Strategic Map
                const Text('DEMAND SATURATION HEATMAP', 
                  style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 1.5)),
                const SizedBox(height: 24),
                ImpactMiniMap(
                  hotspots: {
                    Circle(circleId: const CircleId('h1'), center: const LatLng(13.0827, 80.2707), radius: 2000, fillColor: Colors.red.withOpacity(0.35), strokeWidth: 0),
                    Circle(circleId: const CircleId('h2'), center: const LatLng(13.0400, 80.2400), radius: 1500, fillColor: Colors.red.withOpacity(0.35), strokeWidth: 0),
                  },
                  supplyPoints: {
                    const Marker(markerId: MarkerId('s1'), position: LatLng(13.0600, 80.2500)),
                  },
                ),

                const SizedBox(height: 48),

                // 3. Export PDF Call to Action
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _reportService.generateAndExportReport(metrics),
                    icon: const Icon(Icons.picture_as_pdf, size: 18),
                    label: const Text('GENERATE IMPACT REPORT', 
                      style: TextStyle(fontWeight: FontWeight.black, letterSpacing: 1.2)),
                    style: ElevatedButton.styleFrom(
                       backgroundColor: Colors.indigo[600],
                       padding: const EdgeInsets.symmetric(vertical: 20),
                       shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                       elevation: 10,
                       shadowColor: Colors.indigo.withOpacity(0.4),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Center(
                  child: Text('FOR GOVERNMENT STAKEHOLDERS & CSR AUDITS', 
                    style: TextStyle(color: Colors.slate, fontSize: 8, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
