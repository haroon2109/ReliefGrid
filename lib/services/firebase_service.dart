import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:logging/logging.dart';

class FirebaseService {
  static final Logger _logger = Logger('FirebaseService');

  /// Initializes Firestore with Offline Persistence and Cache Size
  static Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
      
      // 1. Configure Persistence and Cache
      FirebaseFirestore.instance.settings = const Settings(
        persistenceEnabled: true,
        cacheSizeBytes: 100 * 1024 * 1024, // 100 MB for heavy field data
      );
      
      _logger.info('ReliefGRID Firestore initialized with 100MB Offline Persistence.');
    } catch (e) {
      _logger.severe('Failed to initialize Firebase: $e');
      rethrow;
    }
  }

  /// Get a reference to the main requests collection
  static CollectionReference get requests => 
      FirebaseFirestore.instance.collection('aid_requests');
}
