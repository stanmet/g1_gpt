import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:demo_ai_even/ble_manager.dart';
import 'package:demo_ai_even/controllers/evenai_model_controller.dart';
import 'package:demo_ai_even/services/g1_text.dart';
import 'package:demo_ai_even/services/openai_service.dart';
import 'package:demo_ai_even/services/proto.dart';
import 'package:demo_ai_even/services/settings.dart';
import 'package:demo_ai_even/services/text_service.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

/// Even AI flow, as in the official Even Realities demo, wired to OpenAI:
/// hold the left TouchBar → glasses mic → Apple speech recognition →
/// OpenAI (with conversation context) → answer on the glasses, page by page.
class EvenAI {
  static EvenAI? _instance;
  static EvenAI get get => _instance ??= EvenAI._();

  static bool _isRunning = false;
  static bool get isRunning => _isRunning;

  bool isReceivingAudio = false;
  List<int> audioDataBuffer = [];
  Uint8List? audioData;

  File? lc3File;
  File? pcmFile;
  int durationS = 0;

  static int maxRetry = 10;
  static int _currentLine = 0;
  static Timer? _timer; // Text sending timer
  static List<String> list = [];
  static List<String> sendReplys = [];

  Timer? _recordingTimer;
  final int maxRecordingDuration = 30;

  static bool _isManual = false;

  static set isRunning(bool value) {
    _isRunning = value;
    isEvenAIOpen.value = value;

    isEvenAISyncing.value = value;
  }

  static RxBool isEvenAIOpen = false.obs;

  static RxBool isEvenAISyncing = false.obs;

  int _lastStartTime = 0; // Avoid repeated startup commands of Bluetooth in a short period of time
  int _lastStopTime = 0; // Avoid repeated termination commands of Bluetooth within a short period of time
  final int startTimeGap = 500; // Filter repeated Bluetooth intervals
  final int stopTimeGap = 500;

  static const _eventSpeechRecognize = "eventSpeechRecognize";
  final _eventSpeechRecognizeChannel =
      const EventChannel(_eventSpeechRecognize).receiveBroadcastStream(_eventSpeechRecognize);

  String combinedText = '';
  StreamSubscription? _speechSub;

  final OpenAIService _openai = OpenAIService();

  static final StreamController<String> _textStreamController = StreamController<String>.broadcast();
  static Stream<String> get textStream => _textStreamController.stream;

  static void updateDynamicText(String newText) {
    _textStreamController.add(newText);
  }

  EvenAI._();

  void startListening() {
    combinedText = '';
    _speechSub?.cancel();
    _speechSub = _eventSpeechRecognizeChannel.listen((event) {
      var txt = (event is Map ? event["script"] : null) as String? ?? '';
      combinedText = txt;
    }, onError: (error) {
      AppLog.add('error', 'Распознавание: $error');
    });
  }

  // receiving starting Even AI request from ble
  void toStartEvenAIByOS() async {
    // restart to avoid ble data conflict
    BleManager.get().startSendBeatHeart();

    startListening();

    // avoid duplicate ble command in short time
    int currentTime = DateTime.now().millisecondsSinceEpoch;
    if (currentTime - _lastStartTime < startTimeGap) {
      return;
    }

    _lastStartTime = currentTime;

    clear();
    isReceivingAudio = true;

    isRunning = true;
    _currentLine = 0;

    AppLog.add('voice', 'Левая панель удержана — включаю микрофон очков');
    await BleManager.invokeMethod("startEvenAI", {'lang': AppState.instance.settings.speechLang});

    await openEvenAIMic();

    startRecordingTimer();
  }

  // Monitor the recording time to prevent the recording from ending when the OS exits unexpectedly
  void startRecordingTimer() {
    _recordingTimer = Timer(Duration(seconds: maxRecordingDuration), () {
      if (isReceivingAudio) {
        AppLog.add('voice', 'Запись дольше $maxRecordingDuration с — остановлена');
        clear();
      } else {
        _recordingTimer?.cancel();
        _recordingTimer = null;
      }
    });
  }

  static final RegExp _resetPhrase = RegExp(
      r'^(давай |пожалуйста )?(новый разговор|новый чат|новая тема|начни заново|начнем заново|забудь (все|всё|разговор|контекст)|сбрось контекст|очисти историю)[.!?…\s]*$',
      caseSensitive: false);

  // The glasses report that Even AI recording has finished
  Future<void> recordOverByOS() async {
    int currentTime = DateTime.now().millisecondsSinceEpoch;
    if (currentTime - _lastStopTime < stopTimeGap) {
      return;
    }
    _lastStopTime = currentTime;

    isReceivingAudio = false;
    _recordingTimer?.cancel();
    _recordingTimer = null;

    await BleManager.invokeMethod("stopEvenAI");
    await Future.delayed(const Duration(seconds: 2)); // wait for the final recognition result

    final question = combinedText.trim();
    AppLog.add('stt', question.isEmpty ? '(ничего не распознано)' : question);

    if (question.isEmpty) {
      updateDynamicText("Речь не распознана");
      isEvenAISyncing.value = false;
      await sendNetworkErrorReply("Не расслышал. Удерживайте левую панель и говорите.");
      return;
    }

    if (_resetPhrase.hasMatch(question.toLowerCase())) {
      await AppState.instance.resetConversation();
      AppLog.add('cmd', 'Новый разговор: контекст очищен');
      updateDynamicText("$question\n\nКонтекст очищен");
      isEvenAISyncing.value = false;
      await startSendReply("Новый разговор. Контекст очищен.");
      return;
    }

    final answer = await _askOpenAI(question);
    if (answer == null) return; // error already shown

    updateDynamicText("$question\n\n$answer");
    isEvenAISyncing.value = false;
    saveQuestionItem(question, answer);
    await startSendReply(answer);
  }

  /// Calls OpenAI with conversation context; shows a short error on the glasses on failure.
  Future<String?> _askOpenAI(String question, {bool fromPhone = false}) async {
    final state = AppState.instance;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (state.isStale(now)) {
      AppLog.add('info', 'Пауза дольше ${state.settings.contextResetMin} мин — начинаю новый разговор');
      await state.resetConversation();
    }
    final context = state.contextFor(now);
    AppLog.add('ask', '${fromPhone ? '[с телефона] ' : ''}$question (контекст: ${context.length} сообщ.)');
    try {
      final res = await _openai.ask(state.apiKey, state.settings, context, question);
      AppLog.add('openai', 'Ответ за ${(res.ms / 1000).toStringAsFixed(1)} с (${res.model}${res.usage.isNotEmpty ? ', ${res.usage}' : ''})');
      await state.addExchange(question, res.text);
      return res.text;
    } on OpenAIException catch (e) {
      AppLog.add('error', '${e.human} [${e.status} ${e.code}] ${e.message}');
      updateDynamicText("$question\n\n${e.human}");
      isEvenAISyncing.value = false;
      if (fromPhone) {
        await TextService.get.startSendText(e.human);
      } else {
        await sendNetworkErrorReply(e.human);
      }
      return null;
    } catch (e) {
      AppLog.add('error', 'Неожиданная ошибка: $e');
      isEvenAISyncing.value = false;
      if (!fromPhone) await sendNetworkErrorReply('Ошибка приложения. Повторите вопрос.');
      return null;
    }
  }

  /// Question typed on the phone: answer goes to the glasses as plain text pages.
  Future<String?> askFromPhone(String question) async {
    final q = question.trim();
    if (q.isEmpty) return null;
    final answer = await _askOpenAI(q, fromPhone: true);
    if (answer == null) return null;
    updateDynamicText("$q\n\n$answer");
    saveQuestionItem(q, answer);
    if (BleManager.get().isConnected) {
      final ok = await TextService.get.startSendText(answer);
      AppLog.add('display', ok == false ? 'Не удалось отправить текст на очки' : 'Ответ отправлен на очки');
    } else {
      AppLog.add('display', 'Очки не подключены — ответ только на телефоне');
    }
    return answer;
  }

  void saveQuestionItem(String title, String content) {
    try {
      final controller = Get.find<EvenaiModelController>();
      controller.addItem(title, content);
    } catch (_) {}
  }

  int getTotalPages() {
    if (list.isEmpty) {
      return 0;
    }
    if (list.length < 6) {
      return 1;
    }
    int pages = 0;
    int div = list.length ~/ 5;
    int rest = list.length % 5;
    pages = div;
    if (rest != 0) {
      pages++;
    }
    return pages;
  }

  int getCurrentPage() {
    if (_currentLine == 0) {
      return 1;
    }
    int currentPage = 1;
    int div = _currentLine ~/ 5;
    int rest = _currentLine % 5;
    currentPage = 1 + div;
    if (rest != 0) {
      currentPage++;
    }
    return currentPage;
  }

  Future sendNetworkErrorReply(String text) async {
    _currentLine = 0;
    list = EvenAIDataMethod.measureStringList(text);

    String ryplyWords = list.sublist(0, min(3, list.length)).map((str) => '$str\n').join();
    String headString = '\n\n';
    ryplyWords = headString + ryplyWords;

    if (!isRunning) isRunning = true;
    // After sending the error prompt the glasses exit automatically
    await sendEvenAIReply(ryplyWords, 0x01, 0x60, 0);
    clear();
  }

  Future startSendReply(String text) async {
    _currentLine = 0;
    list = EvenAIDataMethod.measureStringList(text);
    AppLog.add('display', 'Ответ: ${list.length} строк, ${getTotalPages()} экр.');

    if (list.length < 4) {
      String startScreenWords = list.sublist(0, min(3, list.length)).map((str) => '$str\n').join();
      String headString = '\n\n';
      startScreenWords = headString + startScreenWords;

      // The glasses need to have 0x30 before they can process 0x40
      bool isSuccess = await sendEvenAIReply(startScreenWords, 0x01, 0x30, 0);
      _logSend(isSuccess);

      await Future.delayed(const Duration(seconds: 3));
      // If already switched to manual mode, no need to send 0x40.
      if (_isManual) {
        return;
      }
      await sendEvenAIReply(startScreenWords, 0x01, 0x40, 0);
      return;
    }
    if (list.length == 4) {
      String startScreenWords = list.sublist(0, 4).map((str) => '$str\n').join();
      String headString = '\n';
      startScreenWords = headString + startScreenWords;

      bool isSuccess = await sendEvenAIReply(startScreenWords, 0x01, 0x30, 0);
      _logSend(isSuccess);
      await Future.delayed(const Duration(seconds: 3));
      if (_isManual) {
        return;
      }
      await sendEvenAIReply(startScreenWords, 0x01, 0x40, 0);
      return;
    }

    if (list.length == 5) {
      String startScreenWords = list.sublist(0, 5).map((str) => '$str\n').join();
      bool isSuccess = await sendEvenAIReply(startScreenWords, 0x01, 0x30, 0);
      _logSend(isSuccess);
      await Future.delayed(const Duration(seconds: 3));
      if (_isManual) {
        return;
      }
      await sendEvenAIReply(startScreenWords, 0x01, 0x40, 0);
      return;
    }

    String startScreenWords = list.sublist(0, 5).map((str) => '$str\n').join();
    bool isSuccess = await sendEvenAIReply(startScreenWords, 0x01, 0x30, 0);
    _logSend(isSuccess);

    if (isSuccess) {
      _currentLine = 0;
      await updateReplyToOSByTimer();
    } else {
      clear();
    }
  }

  void _logSend(bool ok) {
    AppLog.add('display', ok ? 'Первый экран показан на очках' : 'Очки не подтвердили приём текста');
  }

  Future updateReplyToOSByTimer() async {
    int interval = AppState.instance.settings.autoPageSec;
    if (interval <= 0) return; // pages only by tapping the TouchBar

    _timer?.cancel();
    _timer = Timer.periodic(Duration(seconds: interval), (timer) async {
      // Switched to manual mode, abolished timer update
      if (_isManual) {
        _timer?.cancel();
        _timer = null;
        return;
      }

      _currentLine = min(_currentLine + 5, list.length - 1);
      sendReplys = list.sublist(_currentLine);

      if (_currentLine > list.length - 1) {
        _timer?.cancel();
        _timer = null;
      } else {
        if (sendReplys.length < 4) {
          var mergedStr = sendReplys.sublist(0, sendReplys.length).map((str) => '$str\n').join();

          if (_currentLine >= list.length - 5) {
            await sendEvenAIReply(mergedStr, 0x01, 0x40, 0);
            _timer?.cancel();
            _timer = null;
          } else {
            await sendEvenAIReply(mergedStr, 0x01, 0x30, 0);
          }
        } else {
          var mergedStr = sendReplys.sublist(0, min(5, sendReplys.length)).map((str) => '$str\n').join();

          if (_currentLine >= list.length - 5) {
            await sendEvenAIReply(mergedStr, 0x01, 0x40, 0);
            _timer?.cancel();
            _timer = null;
          } else {
            await sendEvenAIReply(mergedStr, 0x01, 0x30, 0);
          }
        }
      }
    });
  }

  // Tap the right TouchBar to turn the page down
  void nextPageByTouchpad() {
    if (!isRunning) return;
    _isManual = true;
    _timer?.cancel();
    _timer = null;

    if (getTotalPages() < 2) {
      manualForJustOnePage();
      return;
    }

    if (_currentLine + 5 > list.length - 1) {
      return;
    } else {
      _currentLine += 5;
    }
    updateReplyToOSByManual();
  }

  // Tap the left TouchBar to turn the page up
  void lastPageByTouchpad() {
    if (!isRunning) return;
    _isManual = true;
    _timer?.cancel();
    _timer = null;

    if (getTotalPages() < 2) {
      manualForJustOnePage();
      return;
    }

    if (_currentLine - 5 < 0) {
      _currentLine = 0;
    } else {
      _currentLine -= 5;
    }
    updateReplyToOSByManual();
  }

  Future updateReplyToOSByManual() async {
    if (_currentLine < 0 || _currentLine > list.length - 1) {
      return;
    }

    sendReplys = list.sublist(_currentLine);
    if (sendReplys.length < 4) {
      var mergedStr = sendReplys.sublist(0, sendReplys.length).map((str) => '$str\n').join();
      await sendEvenAIReply(mergedStr, 0x01, 0x50, 0);
    } else {
      var mergedStr = sendReplys.sublist(0, min(5, sendReplys.length)).map((str) => '$str\n').join();
      await sendEvenAIReply(mergedStr, 0x01, 0x50, 0);
    }
  }

  // When there is only one page of text, tap the page turn TouchBar
  Future manualForJustOnePage() async {
    if (list.length < 4) {
      String screenWords = list.sublist(0, min(3, list.length)).map((str) => '$str\n').join();
      String headString = '\n\n';
      screenWords = headString + screenWords;

      await sendEvenAIReply(screenWords, 0x01, 0x50, 0);
      return;
    }

    if (list.length == 4) {
      String screenWords = list.sublist(0, 4).map((str) => '$str\n').join();
      String headString = '\n';
      screenWords = headString + screenWords;

      await sendEvenAIReply(screenWords, 0x01, 0x50, 0);
      return;
    }

    if (list.length == 5) {
      String screenWords = list.sublist(0, 5).map((str) => '$str\n').join();

      await sendEvenAIReply(screenWords, 0x01, 0x50, 0);
      return;
    }
  }

  Future stopEvenAIByOS() async {
    isRunning = false;
    clear();

    await BleManager.invokeMethod("stopEvenAI");
  }

  void clear() {
    isReceivingAudio = false;
    isRunning = false;
    _isManual = false;
    _currentLine = 0;
    _recordingTimer?.cancel();
    _recordingTimer = null;
    _timer?.cancel();
    _timer = null;
    audioDataBuffer.clear();
    audioDataBuffer = [];
    audioData = null;
    list = [];
    sendReplys = [];
    durationS = 0;
    retryCount = 0;
  }

  Future openEvenAIMic() async {
    final (micStartMs, isStartSucc) = await Proto.micOn(lr: "R");
    AppLog.add('voice', isStartSucc ? 'Микрофон очков включён' : 'Микрофон не ответил, повторяю…');

    if (!isStartSucc && isReceivingAudio && isRunning) {
      await Future.delayed(const Duration(seconds: 1));
      await openEvenAIMic();
    }
  }

  // Send text data to the glasses, including status information
  int retryCount = 0;
  Future<bool> sendEvenAIReply(String text, int type, int status, int pos) async {
    if (!isRunning) {
      return false;
    }

    bool isSuccess = await Proto.sendEvenAIData(text,
        newScreen: EvenAIDataMethod.transferToNewScreen(type, status),
        pos: pos,
        current_page_num: getCurrentPage(),
        max_page_num: getTotalPages());
    if (!isSuccess) {
      if (retryCount < maxRetry) {
        retryCount++;
        return await sendEvenAIReply(text, type, status, pos);
      } else {
        retryCount = 0;
        return false;
      }
    }
    retryCount = 0;
    return true;
  }

  static void dispose() {
    _textStreamController.close();
  }
}

extension EvenAIDataMethod on EvenAI {
  static int transferToNewScreen(int type, int status) {
    int newScreen = status | type;
    return newScreen;
  }

  /// Split text into display lines using G1 glyph widths (replaces the demo's
  /// phone-font measurement, which does not match the glasses' font for Cyrillic).
  static List<String> measureStringList(String text, [double? maxW]) {
    final width = maxW?.round() ?? AppState.instance.settings.lineWidthPx;
    final clean = G1Text.sanitize(text);
    return G1Text.wrap(clean.isEmpty ? '(пустой ответ)' : clean, width);
  }
}
