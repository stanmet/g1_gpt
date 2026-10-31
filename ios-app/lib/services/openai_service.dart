import 'dart:convert';

import 'package:dio/dio.dart';

import 'settings.dart';

class OpenAIResult {
  final String text;
  final int ms;
  final String model;
  final String usage;
  OpenAIResult(this.text, this.ms, this.model, this.usage);
}

class OpenAIException implements Exception {
  final int status;
  final String code;
  final String message;
  OpenAIException(this.status, this.code, this.message);

  /// Short Russian explanation suitable for the glasses.
  String get human {
    final m = message.toLowerCase();
    if (code == 'no_key') return 'Нет ключа OpenAI. Вставьте ключ в приложении на телефоне.';
    if (code == 'timeout') return 'OpenAI не ответил вовремя. Повторите вопрос.';
    if (status == 0) return 'Нет связи с OpenAI. Проверьте интернет.';
    if (status == 401) return 'Ключ OpenAI не принят. Проверьте ключ.';
    if (code == 'insufficient_quota' || m.contains('quota') || m.contains('billing')) {
      return 'На счёте OpenAI API нет средств. Пополните баланс.';
    }
    if (status == 429) return 'OpenAI просит подождать. Повторите через минуту.';
    if (status == 404 || code == 'model_not_found') return 'Модель недоступна. Выберите другую в настройках.';
    if (status == 403) return 'Доступ запрещён: проверьте права ключа OpenAI.';
    if (status >= 500) return 'Сбой на стороне OpenAI. Повторите вопрос.';
    return 'Ошибка OpenAI $status${code.isNotEmpty ? ' ($code)' : ''}.';
  }

  @override
  String toString() => 'OpenAIException($status, $code, $message)';
}

/// OpenAI Responses API, called directly from the phone.
class OpenAIService {
  static const url = 'https://api.openai.com/v1/responses';

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    sendTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 90),
    responseType: ResponseType.plain,
    validateStatus: (_) => true,
  ));

  static String _two(int n) => n.toString().padLeft(2, '0');

  static String localDateTime(DateTime d) {
    const days = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
    final off = d.timeZoneOffset;
    final sign = off.isNegative ? '-' : '+';
    final mins = off.inMinutes.abs();
    return '${d.year}-${_two(d.month)}-${_two(d.day)} ${_two(d.hour)}:${_two(d.minute)} '
        '(${days[d.weekday - 1]}, UTC$sign${_two(mins ~/ 60)}:${_two(mins % 60)})';
  }

  static String buildInstructions(AppSettings s, DateTime now) {
    final parts = <String>[
      'Ты — голосовой помощник. Твои ответы показываются на крошечном дисплее умных очков Even Realities G1: '
          'экран из 5 строк примерно по 26 символов, монохромный текст. Пользователь не видит телефон.',
      'Отвечай по-русски, если пользователь явно не попросил другой язык.',
      'Пиши обычным текстом без Markdown: без заголовков, звёздочек, таблиц, ссылок, эмодзи и блоков кода.',
      'Начинай сразу с сути, без вступлений и повторения вопроса. По умолчанию уложись примерно в '
          '${s.answerWords} слов. Если пользователь просит подробнее или вопрос этого требует — можно длиннее, короткими абзацами.',
      'Списки оформляй короткими строками, каждая начинается с «• ». Числа пиши цифрами.',
      'Вопрос получен через распознавание речи и может содержать ошибки — угадывай смысл по контексту. '
          'Если запрос совсем непонятен, коротко переспроси.',
      'Учитывай предыдущие реплики разговора: пользователь может задавать уточняющие вопросы.',
      'Текущие дата и время у пользователя: ${localDateTime(now)}.',
    ];
    if (s.aboutMe.trim().isNotEmpty) {
      parts.add('Что известно о пользователе (учитывай, когда уместно):\n${s.aboutMe.trim()}');
    }
    if (s.instructions.trim().isNotEmpty) {
      parts.add('Дополнительные пожелания пользователя:\n${s.instructions.trim()}');
    }
    return parts.join('\n\n');
  }

  static String? effortFor(AppSettings s) {
    if (s.effort != 'auto') return s.effort;
    final m = s.model.toLowerCase();
    if (m.contains('terra') || m.contains('luna')) return 'none';
    if (m.contains('sol') || m.contains('astra')) return 'low';
    return null;
  }

  static Map<String, dynamic> buildBody(AppSettings s, List<ChatMessage> history, String question,
      {bool includeReasoning = true, DateTime? now}) {
    final input = <Map<String, String>>[
      ...history.map((m) => {'role': m.role, 'content': m.content}),
      {'role': 'user', 'content': question},
    ];
    var maxTokens = s.answerWords * 12;
    if (maxTokens < 600) maxTokens = 600;
    if (maxTokens > 8000) maxTokens = 8000;
    final body = <String, dynamic>{
      'model': s.model,
      'instructions': buildInstructions(s, now ?? DateTime.now()),
      'input': input,
      'store': false,
      'max_output_tokens': maxTokens,
    };
    final effort = effortFor(s);
    if (effort != null && includeReasoning) body['reasoning'] = {'effort': effort};
    if (s.webSearch) {
      body['tools'] = [
        {'type': 'web_search'}
      ];
    }
    return body;
  }

  static String extractText(dynamic data) {
    if (data is! Map) return '';
    final ot = data['output_text'];
    if (ot is String && ot.trim().isNotEmpty) return ot.trim();
    final out = <String>[];
    final output = data['output'];
    if (output is List) {
      for (final item in output) {
        if (item is! Map || item['type'] != 'message') continue;
        final content = item['content'];
        if (content is! List) continue;
        for (final c in content) {
          if (c is Map && (c['type'] == 'output_text' || c['type'] == 'text') && c['text'] is String) {
            out.add(c['text'] as String);
          }
        }
      }
    }
    return out.join('\n').trim();
  }

  Future<(int, String)> _post(String apiKey, Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<String>(
        url,
        data: jsonEncode(body),
        options: Options(headers: {
          'Authorization': 'Bearer $apiKey',
          'Content-Type': 'application/json',
        }),
      );
      return (res.statusCode ?? 0, res.data ?? '');
    } on DioException catch (e) {
      final timeout = e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.connectionTimeout;
      throw OpenAIException(0, timeout ? 'timeout' : 'network', e.message ?? '$e');
    }
  }

  static OpenAIException _parseError(int status, String raw) {
    var code = '';
    var message = raw.length > 300 ? raw.substring(0, 300) : raw;
    try {
      final j = jsonDecode(raw);
      if (j is Map && j['error'] is Map) {
        final err = j['error'] as Map;
        code = '${err['code'] ?? err['type'] ?? ''}';
        message = '${err['message'] ?? message}';
      }
    } catch (_) {}
    return OpenAIException(status, code, message);
  }

  Future<OpenAIResult> ask(String apiKey, AppSettings s, List<ChatMessage> history, String question) async {
    if (apiKey.isEmpty) throw OpenAIException(401, 'no_key', 'no key');
    final sw = Stopwatch()..start();

    var (status, raw) = await _post(apiKey, buildBody(s, history, question));
    if (status == 400 && RegExp(r'reasoning|effort', caseSensitive: false).hasMatch(raw) && effortFor(s) != null) {
      // Some models reject the reasoning parameter or a given effort value: retry without it.
      (status, raw) = await _post(apiKey, buildBody(s, history, question, includeReasoning: false));
    }
    if (status < 200 || status >= 300) throw _parseError(status, raw);

    dynamic data;
    try {
      data = jsonDecode(raw);
    } catch (_) {
      throw OpenAIException(status, 'bad_json', raw.length > 200 ? raw.substring(0, 200) : raw);
    }
    final text = extractText(data);
    if (text.isEmpty) {
      final reason = data is Map ? '${data['incomplete_details']?['reason'] ?? data['status'] ?? 'empty'}' : 'empty';
      throw OpenAIException(status, 'empty', 'Пустой ответ ($reason)');
    }
    var usage = '';
    if (data is Map && data['usage'] is Map) {
      final u = data['usage'] as Map;
      usage = 'токены ${u['input_tokens'] ?? '?'}→${u['output_tokens'] ?? '?'}';
    }
    final model = data is Map && data['model'] is String ? data['model'] as String : s.model;
    return OpenAIResult(text, sw.elapsedMilliseconds, model, usage);
  }
}
