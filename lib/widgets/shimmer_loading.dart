import 'package:flutter/material.dart';

class GeminiShimmerLoading extends StatefulWidget {
  final String message;
  const GeminiShimmerLoading({super.key, this.message = 'Gemini is parsing handwriting patterns...'});

  @override
  State<GeminiShimmerLoading> createState() => _GeminiShimmerLoadingState();
}

class _GeminiShimmerLoadingState extends State<GeminiShimmerLoading> 
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _animation = Tween<double>(begin: -2, end: 2).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: double.infinity,
          height: double.infinity,
          color: Colors.slate[950],
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Shimmer Logic
              ShaderMask(
                shaderCallback: (bounds) {
                  return LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    stops: [
                      0.0,
                      0.5 + (_animation.value / 4),
                      1.0,
                    ],
                    colors: [
                      Colors.indigo[900]!.withOpacity(0.4),
                      Colors.blue[400]!,
                      Colors.indigo[900]!.withOpacity(0.4),
                    ],
                  ).createShader(bounds);
                },
                child: const Icon(
                  Icons.auto_awesome,
                  size: 80,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 32),
              Text(
                widget.message.toUpperCase(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.blue,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.0,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'NEURAL TRANSCRIPTION ACTIVE',
                style: TextStyle(
                  color: Colors.slate,
                  fontSize: 8,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
