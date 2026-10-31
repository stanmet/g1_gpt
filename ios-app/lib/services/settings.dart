import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Persistent storage through the native side: UserDefaults for settings and
/// history, iOS Keychain for the OpenAI API key.
class NativeStore {
  NativeStore._();
  static const _ch = MethodChannel('method.bluetooth');

  static Future<String?> getPref(String key) async {
    try {
      return await _ch.invokeMethod<String>('prefsGet', {'key': key});
    } catch (_) {
      return null;
    }
  }

  static Future<void> setPref(String key, String? value) async {
    try {
      await _ch.invokeMethod('prefsSet', {'key': key, 'value': value});
    } catch (_) {}
  }

  static Future<String?> getSecret(String key) async {
    try {
      return await _ch.invokeMethod<String>('keychainGet', {'key': key});
    } catch (_) {
      return null;
    }
  }

  static Future<bool> setSecret(String key, String? value) async {
    try {
      final ok = await _ch.invokeMethod<bool>('keychainSet', {'key': key, 'value': value});
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }
}

class ChatMessage {
  final String role; // "user" | "assistant"
  final String content;
  final int at;

  ChatMessage(this.role, this.content, this.at);

  Map<String, dynamic> toJson() => {'role': role, 'content': content, 'at': at};

  static ChatMessage? fromJson(dynamic j) {
    if (j is! Map) return null;
    final role = j['role'];
    final content = j['content'];
    if (role is! String || content is! String) return null;
    final at = j['at'];
    return ChatMessage(role, content, at is int ? at : 0);
  }
}

/// All user-tunable options. Defaults are chosen for Russian voice Q&A on G1.
class AppSettings {
  String model = 'gpt-6.1-terra';
  String effort = 'auto'; // auto | none | low | medium | high
  String aboutMe = '';
  String instructions = '';
  int answerWords = 50;
  int historyMessages = 20;
  bool webSearch = false;
  String speechLang = 'RU'; // key of SpeechStreamRecognizer.languageDic
  int autoPageSec = 6; // 0 = pages only by tapping the glasses
  int lineWidthPx = 488; // Even AI text area width on G1
  int contextResetMin = 60; // start a new conversation after this pause; 0 = never
  String lastPair = ''; // "Pair_<channel>" of the last connected glasses

  Map<String, dynamic> toJson() => {
        'model': model,
        'effort': effort,
        'aboutMe': aboutMe,
        'instructions': instructions,
        'answerWords': answerWords,
        'historyMessages': historyMessages,
        'webSearch': webSearch,
        'speechLang': speechLang,
        'autoPageSec': autoPageSec,
        'lineWidthPx': lineWidthPx,
        'contextResetMin': contextResetMin,
        'lastPair': lastPair,
      };

  static int _int(dynamic v, int dflt, int min, int max) {
    final n = v is int ? v : (v is num ? v.round() : int.tryParse('$v'));
    if (n == null) return dflt;
    return n < min ? min : (n > max ? max : n);
  }

  static AppSettings fromJson(dynamic j) {
    final s = AppSettings();
    if (j is! Map) return s;
    if (j['model'] is String && (j['model'] as String).trim().isNotEmpty) s.model = (j['model'] as String).trim();
    if (const ['auto', 'none', 'low', 'medium', 'high'].contains(j['effort'])) s.effort = j['effort'] as String;
    if (j['aboutMe'] is String) s.aboutMe = j['aboutMe'] as String;
    if (j['instructions'] is String) s.instructions = j['instructions'] as String;
    s.answerWords = _int(j['answerWords'], s.answerWords, 15, 400);
    s.historyMessages = _int(j['historyMessages'], s.historyMessages, 0, 60);
    if (j['webSearch'] is bool) s.webSearch = j['webSearch'] as bool;
    if (j['speechLang'] is String) s.speechLang = j['speechLang'] as String;
    s.autoPageSec = _int(j['autoPageSec'], s.autoPageSec, 0, 60);
    s.lineWidthPx = _int(j['lineWidthPx'], s.lineWidthPx, 300, 600);
    s.contextResetMin = _int(j['contextResetMin'], s.contextResetMin, 0, 1440);
    if (j['lastPair'] is String) s.lastPair = j['lastPair'] as String;
    return s;
  }
}

/// Settings + API key + conversation history, shared by the UI and Even AI flow.
class AppState extends ChangeNotifier {
  AppState._();
  static final AppState instance = AppState._();

  static const _settingsKey = 'g1gpt.settings.v1';
  static const _historyKey = 'g1gpt.history.v1';
  static const _apiKeyName = 'openai_api_key';
  static const _apiKeyFallback = 'g1gpt.key.fallback';

  AppSettings settings = AppSettings();
  String apiKey = '';
  List<ChatMessage> history = [];

  Future<void> load() async {
    try {
      final raw = await NativeStore.getPref(_settingsKey);
      if (raw != null && raw.isNotEmpty) settings = AppSettings.fromJson(jsonDecode(raw));
    } catch (_) {}
    try {
      final raw = await NativeStore.getPref(_historyKey);
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw);
        if (list is List) {
          history = list.map(ChatMessage.fromJson).whereType<ChatMessage>().toList();
        }
      }
    } catch (_) {}
    apiKey = (await NativeStore.getSecret(_apiKeyName)) ?? '';
    if (apiKey.isEmpty) {
      // fallback used only if the Keychain was unavailable when the key was saved
      apiKey = (await NativeStore.getPref(_apiKeyFallback)) ?? '';
    }
    notifyListeners();
  }

  Future<void> saveSettings() async {
    await NativeStore.setPref(_settingsKey, jsonEncode(settings.toJson()));
    notifyListeners();
  }

  Future<bool> setApiKey(String? key) async {
    final k = (key ?? '').trim();
    final ok = await NativeStore.setSecret(_apiKeyName, k.isEmpty ? null : k);
    // Keychain normally works; if it does not (unusual signing), keep the key in app storage instead.
    await NativeStore.setPref(_apiKeyFallback, ok || k.isEmpty ? null : k);
    apiKey = k;
    notifyListeners();
    return ok;
  }

  String get keyHint => apiKey.length > 8 ? '${apiKey.substring(0, 3)}…${apiKey.substring(apiKey.length - 4)}' : '';

  Future<void> _saveHistory() async {
    final keep = history.length > 200 ? history.sublist(history.length - 200) : history;
    await NativeStore.setPref(_historyKey, jsonEncode(keep.map((m) => m.toJson()).toList()));
  }

  /// Messages that go to the model as context (empty if the conversation went stale).
  List<ChatMessage> contextFor(int nowMs) {
    if (history.isEmpty || settings.historyMessages == 0) return [];
    final reset = settings.contextResetMin;
    if (reset > 0 && nowMs - history.last.at > reset * 60 * 1000) return [];
    final n = settings.historyMessages;
    return history.length > n ? history.sublist(history.length - n) : List.of(history);
  }

  bool isStale(int nowMs) {
    final reset = settings.contextResetMin;
    return history.isNotEmpty && reset > 0 && nowMs - history.last.at > reset * 60 * 1000;
  }

  Future<void> addExchange(String question, String answer) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    history.add(ChatMessage('user', question, now));
    history.add(ChatMessage('assistant', answer, now));
    await _saveHistory();
    notifyListeners();
  }

  Future<void> resetConversation() async {
    history = [];
    await _saveHistory();
    notifyListeners();
  }
}

/// In-memory diagnostics log shown on the phone ("Журнал проверки").
class AppLog extends ChangeNotifier {
  AppLog._();
  static final AppLog instance = AppLog._();

  final List<String> lines = [];

  static void add(String kind, String msg) => instance._add(kind, msg);

  void _add(String kind, String msg) {
    final t = DateTime.now();
    String two(int n) => n.toString().padLeft(2, '0');
    final line = '${two(t.hour)}:${two(t.minute)}:${two(t.second)} [$kind] $msg';
    lines.add(line.length > 400 ? line.substring(0, 400) : line);
    if (lines.length > 120) lines.removeRange(0, lines.length - 120);
    debugPrint(line);
    notifyListeners();
  }
}
