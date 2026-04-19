import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' show join;
import '../widgets/shimmer_loading.dart';
import 'report_review_screen.dart';
import '../services/gemini_orchestrator.dart';

class CameraCaptureScreen extends StatefulWidget {
  final List<CameraDescription> cameras;
  const CameraCaptureScreen({super.key, required this.cameras});

  @override
  State<CameraCaptureScreen> createState() => _CameraCaptureScreenState();
}

class _CameraCaptureScreenState extends State<CameraCaptureScreen> {
  late CameraController _controller;
  late Future<void> _initializeControllerFuture;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _controller = CameraController(
      widget.cameras.first,
      ResolutionPreset.max, // Highest resolution for handwriting legibility
      enableAudio: false,
    );
    _initializeControllerFuture = _controller.initialize();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _takePicture() async {
    try {
      await _initializeControllerFuture;
      final image = await _controller.takePicture();

      setState(() => _isProcessing = true);

      // 1. Send to Gemini Orchestrator
      final result = await GeminiOrchestrator.processImage(image.path);

      if (!mounted) return;

      // 2. Navigate to Review Screen with AI results
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ReportReviewScreen(
            initialData: result,
            imagePath: image.path,
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isProcessing) return const GeminiShimmerLoading();

    return Scaffold(
      backgroundColor: Colors.black,
      body: FutureBuilder<void>(
        future: _initializeControllerFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.done) {
            return Stack(
              children: [
                // 1. Full Screen Camera Preview
                Positioned.fill(
                  child: AspectRatio(
                    aspectRatio: _controller.value.aspectRatio,
                    child: CameraPreview(_controller),
                  ),
                ),

                // 2. Survey Bounding Box Guide
                Center(
                  child: Container(
                    width: MediaQuery.of(context).size.width * 0.85,
                    height: MediaQuery.of(context).size.width * 1.1,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.blueAccent, width: 2),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Stack(
                       children: [
                          Positioned(
                             top: 20, left: 20,
                             child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                   color: Colors.blueAccent.withOpacity(0.4),
                                   borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                   'ALIGN SURVEY FORM',
                                   style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                                ),
                             ),
                          ),
                       ],
                    ),
                  ),
                ),

                // 3. Bottom Controls
                Positioned(
                  bottom: 40,
                  left: 0,
                  right: 0,
                  child: Column(
                    children: [
                      const Text(
                        'CAPTURE HANDWRITTEN SURVEY',
                        style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 24),
                      GestureDetector(
                        onTap: _takePicture,
                        child: Container(
                          height: 80, width: 80,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 4),
                          ),
                          child: Center(
                            child: Container(
                              height: 60, width: 60,
                              decoration: const BoxDecoration(
                                color: Colors.blueAccent,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.psychology, color: Colors.white, size: 30),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          } else {
            return const Center(child: CircularProgressIndicator());
          }
        },
      ),
    );
  }
}
