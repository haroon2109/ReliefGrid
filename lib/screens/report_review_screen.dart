import 'dart:io';
import 'package:flutter/material.dart';
import '../services/gemini_orchestrator.dart';

class ReportReviewScreen extends StatefulWidget {
  final Map<String, dynamic> initialData;
  final String imagePath;

  const ReportReviewScreen({
    super.key,
    required this.initialData,
    required this.imagePath,
  });

  @override
  State<ReportReviewScreen> createState() => _ReportReviewScreenState();
}

class _ReportReviewScreenState extends State<ReportReviewScreen> {
  late TextEditingController _itemController;
  late TextEditingController _quantityController;
  late TextEditingController _locationController;
  int _urgency = 3;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _itemController = TextEditingController(text: widget.initialData['item']);
    _quantityController = TextEditingController(text: widget.initialData['quantity'].toString());
    _locationController = TextEditingController(text: widget.initialData['location']);
    _urgency = widget.initialData['urgency_level'] ?? 3;
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      final finalData = {
        ...widget.initialData,
        'item': _itemController.text,
        'quantity': int.tryParse(_quantityController.text) ?? 1,
        'location': _locationController.text,
        'urgency_level': _urgency,
      };

      await GeminiOrchestrator.commitFinalReport(finalData);

      if (!mounted) return;
      Navigator.popUntil(context, (route) => route.isFirst);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report Finalized & Indexed.')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('AI REVIEW', style: TextStyle(fontSize: 12, fontWeight: FontWeight.black, letterSpacing: 2)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Captured Image Review
              ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  height: 200,
                  width: double.infinity,
                  decoration: BoxDecoration(border: Border.all(color: Colors.slate[800]!)),
                  child: Image.file(File(widget.imagePath), fit: BoxFit.cover),
                ),
              ),
              const SizedBox(height: 32),

              // 2. Transcribed Data Form
              const Text('VERIFY AI TRANSCRIPTION', style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 1.5)),
              const SizedBox(height: 24),

              _buildField('ITEM NAME', _itemController),
              const SizedBox(height: 16),
              _buildField('QUANTITY', _quantityController, isNumeric: true),
              const SizedBox(height: 16),
              _buildField('LOCATION', _locationController),
              const SizedBox(height: 24),

              // Urgency Selection
              const Text('URGENCY LEVEL', style: TextStyle(color: Colors.slate[400], fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(5, (index) {
                  final level = index + 1;
                  return GestureDetector(
                    onTap: () => setState(() => _urgency = level),
                    child: Container(
                      width: 50, height: 50,
                      decoration: BoxDecoration(
                        color: _urgency == level ? Colors.blue : Colors.slate[800],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _urgency == level ? Colors.blue[300]! : Colors.transparent),
                      ),
                      child: Center(
                        child: Text(level.toString(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  );
                }),
              ),

              const SizedBox(height: 48),

              // 3. Final Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue[600],
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: _isSubmitting
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('CONFIRM & COMMIT', style: TextStyle(fontWeight: FontWeight.black, letterSpacing: 1.5)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller, {bool isNumeric = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: isNumeric ? TextInputType.number : TextInputType.text,
          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF1E293B),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }
}
