import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QrVerifyOverlay extends StatefulWidget {
  final Function(String) onVerify;

  const QrVerifyOverlay({super.key, required this.onVerify});

  @override
  State<QrVerifyOverlay> createState() => _QrVerifyOverlayState();
}

class _QrVerifyOverlayState extends State<QrVerifyOverlay> {
  bool _isScanned = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 20),
          child: Text(
            'BENEFICIARY VERIFICATION SCAN',
            style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2),
          ),
        ),
        
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(32),
            child: Stack(
              children: [
                MobileScanner(
                  onDetect: (capture) {
                    if (_isScanned) return;
                    final List<Barcode> barcodes = capture.barcodes;
                    for (final barcode in barcodes) {
                      if (barcode.rawValue != null) {
                        setState(() => _isScanned = true);
                        widget.onVerify(barcode.rawValue!);
                        break;
                      }
                    }
                  },
                ),
                
                // 1. Scan Frame
                Center(
                  child: Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.blueAccent, width: 2),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Stack(
                      children: [
                        // Animated Scanning Line
                        const ScanningLine(),
                      ],
                    ),
                  ),
                ),

                // 2. Status Label
                Positioned(
                  bottom: 40,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'ALIGN QR WITHIN FRAME',
                        style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class ScanningLine extends StatefulWidget {
  const ScanningLine({super.key});

  @override
  State<ScanningLine> createState() => _ScanningLineState();
}

class _ScanningLineState extends State<ScanningLine> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Positioned(
          top: _controller.value * 190,
          left: 0,
          right: 0,
          child: Container(
            height: 2,
            decoration: BoxDecoration(
              boxShadow: [
                BoxShadow(color: Colors.blueAccent.withOpacity(0.5), blurRadius: 10, spreadRadius: 2),
              ],
              color: Colors.blueAccent,
            ),
          ),
        );
      },
    );
  }
}
