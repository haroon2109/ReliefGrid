import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

class FieldReport {
  final String id;
  final String item;
  final int quantity;
  final int urgencyLevel;
  final String location;
  final String? localFilePath; // Local file path for images/audio
  final DateTime timestamp;

  FieldReport({
    required this.id,
    required this.item,
    required this.quantity,
    required this.urgencyLevel,
    required this.location,
    this.localFilePath,
    required this.timestamp,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'item': item,
    'quantity': quantity,
    'urgency_level': urgencyLevel,
    'location': location,
    'timestamp': timestamp.toIso8601String(),
    'source': 'flutter_mobile',
  };
}

class FieldReportService {
  final _firestore = FirebaseFirestore.instance;
  final _storage = FirebaseStorage.instance;
  
  static const String draftsBoxName = 'field_report_drafts';

  /// Main Submission Function with Offline Logic
  Future<void> submitFieldReport(FieldReport report) async {
    try {
      // 1. Attempt to Upload Media if exists
      String? downloadUrl;
      if (report.localFilePath != null) {
        downloadUrl = await _uploadMedia(report.localFilePath!, report.id);
      }

      // 2. Submit Structured Metadata to Firestore
      final data = report.toMap();
      if (downloadUrl != null) data['media_url'] = downloadUrl;

      // Persistence is enabled, so this will write to local cache if offline
      await _firestore.collection('aid_requests').doc(report.id).set(data);
      
    } catch (e) {
      // 3. ZERO BANDWIDTH Failsafe: Save to Local Drafts Folder via Hive
      await _saveToDrafts(report);
      rethrow;
    }
  }

  /// Upload media to Firebase Storage
  Future<String> _uploadMedia(String path, String id) async {
    final ref = _storage.ref().child('field_reports/$id.jpg');
    final uploadTask = ref.putFile(File(path));
    final snapshot = await uploadTask.whenComplete(() => null);
    return await snapshot.ref.getDownloadURL();
  }

  /// Local Persistence for Unsent Drafts
  Future<void> _saveToDrafts(FieldReport report) async {
    final box = Hive.box(draftsBoxName);
    await box.put(report.id, report.toMap());
    print('🚨 Critical: Zero-Bandwidth state detected. Report saved to Drafts folder.');
  }

  /// Stream for Sync Status UI
  Stream<DocumentSnapshot> getSyncStatus(String docId) {
    return _firestore.collection('aid_requests').doc(docId).snapshots(includeMetadataChanges: true);
  }
}
