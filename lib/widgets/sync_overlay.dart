import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class SyncStatusOverlay extends StatelessWidget {
  final String documentId;
  final Widget child;

  const SyncStatusOverlay({
    super.key,
    required this.documentId,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        // 1. Monitor Metadata via Firestore Stream
        StreamBuilder<DocumentSnapshot>(
          stream: FirebaseFirestore.instance
              .collection('aid_requests')
              .doc(documentId)
              .snapshots(includeMetadataChanges: true),
          builder: (context, snapshot) {
            if (!snapshot.hasData) return const SizedBox.shrink();

            // 2. SMART SYNC LOGIC: Check Metadata
            final isFromCache = snapshot.data!.metadata.isFromCache;
            final isPendingSync = snapshot.data!.metadata.hasPendingWrites;

            if (isFromCache || isPendingSync) {
              return Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    color: Colors.orange.withOpacity(0.9),
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          height: 12,
                          width: 12,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        ),
                        SizedBox(width: 12),
                        Text(
                          'SYNCING TO RELIEFGRID...',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }

            // Data has officially hit the cloud (isFromCache: false)
            return Positioned(
               top: 0,
               left: 0,
               right: 0,
               child: Container(
                  color: Colors.emerald.withOpacity(0.9),
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: const Center(
                    child: Text(
                       'AID RECORD SECURED IN CLOUD',
                       style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                       ),
                    ),
                  ),
               ),
            );
          },
        ),
      ],
    );
  }
}
