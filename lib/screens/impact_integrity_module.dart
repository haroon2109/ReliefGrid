import 'package:flutter/material.dart';
import '../widgets/qr_verify_overlay.dart';
import '../widgets/vernacular_voice_reporter.dart';
import '../widgets/high_trust_metrics_card.dart';

class ImpactIntegrityModule extends StatefulWidget {
  const ImpactIntegrityModule({super.key});

  @override
  State<ImpactIntegrityModule> createState() => _ImpactIntegrityModuleState();
}

class _ImpactIntegrityModuleState extends State<ImpactIntegrityModule> {
  int _currentIndex = 0;

  void _onQrVerified(String code) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Icon(Icons.verified_user, color: Colors.emerald, size: 48),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('BENEFICIARY VERIFIED', style: TextStyle(color: Colors.white, fontWeight: FontWeight.black, letterSpacing: 1.5)),
            const SizedBox(height: 12),
            Text('UID: $code', style: const TextStyle(color: Colors.slate, fontSize: 10)),
            const SizedBox(height: 20),
            const Text('Aid delivery is authorized for this recipient.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70, fontSize: 12)),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('DISMISS')),
        ],
      ),
    );
  }

  void _onVoiceIntent(Map<String, dynamic> intent) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('GEMINI VERNACULAR EXTRACTION', style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 1.5)),
            const SizedBox(height: 24),
            Text('Detected: ${intent['language_detected']}', style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.slate[800], borderRadius: BorderRadius.circular(16)),
              child: Text(intent['intent'] ?? 'No intent identified', style: const TextStyle(color: Colors.white, fontSize: 14, fontStyle: FontStyle.italic)),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(child: _buildBadge('ITEM: ${intent['item']}', Colors.indigo)),
                const SizedBox(width: 8),
                Expanded(child: _buildBadge('QTY: ${intent['quantity']}', Colors.blue)),
              ],
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.blue[600], padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Text('CREATE OFFICIAL REQUEST'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(0.5))),
      child: Center(child: Text(text.toUpperCase(), style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold))),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('IMPACT & INTEGRITY', style: TextStyle(fontSize: 12, fontWeight: FontWeight.black, letterSpacing: 2)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          QrVerifyOverlay(onVerify: _onQrVerified),
          Center(child: VernacularVoiceReporter(onIntentExtracted: _onVoiceIntent)),
          const SingleChildScrollView(padding: EdgeInsets.all(24), child: HighTrustMetricsCard()),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFF1E293B)))),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          backgroundColor: const Color(0xFF0F172A),
          selectedItemColor: Colors.blue,
          unselectedItemColor: Colors.slate,
          selectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
          unselectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.qr_code_scanner), label: 'VERIFY'),
            BottomNavigationBarItem(icon: Icon(Icons.mic_none), label: 'REPORT'),
            BottomNavigationBarItem(icon: Icon(Icons.analytics_outlined), label: 'IMPACT'),
          ],
        ),
      ),
    );
  }
}
