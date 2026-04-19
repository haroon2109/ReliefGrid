import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../services/voice_nlp_service.dart';

class VernacularVoiceReporter extends StatefulWidget {
  final Function(Map<String, dynamic>) onIntentExtracted;

  const VernacularVoiceReporter({super.key, required this.onIntentExtracted});

  @override
  State<VernacularVoiceReporter> createState() => _VernacularVoiceReporterState();
}

class _VernacularVoiceReporterState extends State<VernacularVoiceReporter> {
  final VoiceNlpService _nlpService = VoiceNlpService();
  final FlutterTts _flutterTts = FlutterTts();
  bool _isRecording = false;
  bool _isProcessing = false;

  Future<void> _speakBack(String text, String languageCode) async {
    await _flutterTts.setLanguage(languageCode);
    await _flutterTts.setPitch(1.0);
    await _flutterTts.speak(text);
  }

  Future<void> _handleRecording() async {
    if (_isRecording) {
      setState(() {
        _isRecording = false;
        _isProcessing = true;
      });
      try {
        final result = await _nlpService.stopAndProcess();
        
        // Audio Feedback Loop: Speak back the intent for low-literacy users
        final msg = "Confirmed. Requesting ${result['quantity']} ${result['item']} for ${result['location_name']}. Urgency level ${result['urgency']}.";
        final lang = result['language_detected'] == 'Tamil' ? 'ta-IN' :
                     result['language_detected'] == 'Hindi' ? 'hi-IN' :
                     result['language_detected'] == 'Bengali' ? 'bn-IN' : 'en-US';
                     
        await _speakBack(msg, lang);
        
        widget.onIntentExtracted(result);
      } catch (e) {
        showDialog(context: context, builder: (ctx) => AlertDialog(title: const Text('Capture Error'), content: Text(e.toString())));
      } finally {
        setState(() => _isProcessing = false);
      }
    } else {
      setState(() => _isRecording = true);
      await _nlpService.startRecording();
    }
  }

  @override
  void dispose() {
    _flutterTts.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isProcessing) return const Center(child: CircularProgressIndicator());

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        GestureDetector(
          onLongPressStart: (_) => _handleRecording(),
          onLongPressEnd: (_) => _handleRecording(),
          child: AnimatedScale(
            scale: _isRecording ? 1.2 : 1.0,
            duration: const Duration(milliseconds: 200),
            child: Container(
              height: 120, width: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isRecording ? Colors.red : Colors.blueAccent,
                boxShadow: [
                  BoxShadow(color: (_isRecording ? Colors.red : Colors.blue).withOpacity(0.35), blurRadius: 30, spreadRadius: 10),
                ],
              ),
              child: Icon(_isRecording ? Icons.mic : Icons.mic_none, color: Colors.white, size: 48),
            ),
          ),
        ),
        const SizedBox(height: 32),
        Text(
          _isRecording ? 'RECORDING VERNACULAR INTENT...' : 'HOLD TO REPORT CORE NEED',
          style: const TextStyle(color: Colors.blueAccent, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2),
        ),
        const SizedBox(height: 12),
        const Text(
          'GEMINI MULTIMODAL TRANSLATION + TTS ACTIVE',
          style: TextStyle(color: Colors.slate, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 1.5),
        ),
      ],
    );
  }
}
