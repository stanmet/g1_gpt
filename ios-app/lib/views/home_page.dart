// ignore_for_file: library_private_types_in_public_api

import 'dart:async';

import 'package:demo_ai_even/ble_manager.dart';
import 'package:demo_ai_even/services/evenai.dart';
import 'package:demo_ai_even/services/settings.dart';
import 'package:demo_ai_even/services/text_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const _knownModels = <String, String>{
  'gpt-6.1-terra': 'GPT-6.1 Terra — быстро и недорого',
  'gpt-6-luna': 'GPT-6 Luna — самая дешёвая',
  'gpt-6.1-sol': 'GPT-6.1 Sol — умнее, дороже',
  'gpt-6-astra': 'GPT-6 Astra — флагман, дорого',
};
const _customModel = '__custom__';

const _efforts = <String, String>{
  'auto': 'Авто (быстро)',
  'none': 'Без размышлений',
  'low': 'Низкая',
  'medium': 'Средняя (медленнее)',
  'high': 'Высокая (медленно)',
};

const _langs = <String, String>{
  'RU': 'Русский',
  'EN': 'English',
  'DE': 'Deutsch',
  'FR': 'Français',
  'ES': 'Español',
  'IT': 'Italiano',
};

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  _HomePageState createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  Timer? scanTimer;
  bool isScanning = false;
  bool _asking = false;
  String _lastAnswer = '';
  StreamSubscription<String>? _textSub;

  final _keyCtl = TextEditingController();
  final _askCtl = TextEditingController();
  final _customModelCtl = TextEditingController();
  final _aboutCtl = TextEditingController();
  final _instrCtl = TextEditingController();
  final _wordsCtl = TextEditingController();
  final _histCtl = TextEditingController();
  final _pageCtl = TextEditingController();
  final _widthCtl = TextEditingController();
  final _resetCtl = TextEditingController();
  String _modelChoice = 'gpt-6.1-terra';
  String _effort = 'auto';
  String _lang = 'RU';
  bool _web = false;

  AppState get state => AppState.instance;

  @override
  void initState() {
    super.initState();
    BleManager.get().setMethodCallHandler();
    BleManager.get().startListening();
    BleManager.get().onStatusChanged = _refreshPage;
    _textSub = EvenAI.textStream.listen((t) {
      if (mounted) setState(() => _lastAnswer = t);
    });
    _fillForm();
    // Reconnect to the glasses used last time without any taps.
    Future.delayed(const Duration(milliseconds: 800), () async {
      if (state.settings.lastPair.isNotEmpty) {
        await _startScan(auto: true);
      }
    });
  }

  void _fillForm() {
    final s = state.settings;
    _modelChoice = _knownModels.containsKey(s.model) ? s.model : _customModel;
    _customModelCtl.text = _knownModels.containsKey(s.model) ? '' : s.model;
    _effort = _efforts.containsKey(s.effort) ? s.effort : 'auto';
    _lang = _langs.containsKey(s.speechLang) ? s.speechLang : 'RU';
    _web = s.webSearch;
    _aboutCtl.text = s.aboutMe;
    _instrCtl.text = s.instructions;
    _wordsCtl.text = '${s.answerWords}';
    _histCtl.text = '${s.historyMessages}';
    _pageCtl.text = '${s.autoPageSec}';
    _widthCtl.text = '${s.lineWidthPx}';
    _resetCtl.text = '${s.contextResetMin}';
  }

  void _refreshPage() {
    if (mounted) setState(() {});
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), duration: const Duration(seconds: 3)));
  }

  Future<void> _startScan({bool auto = false}) async {
    setState(() => isScanning = true);
    if (auto) {
      await BleManager.get().autoConnect();
    } else {
      AppLog.add('ble', 'Поиск очков…');
      await BleManager.get().startScan();
    }
    scanTimer?.cancel();
    scanTimer = Timer(const Duration(seconds: 20), _stopScan);
  }

  Future<void> _stopScan() async {
    if (isScanning) {
      await BleManager.get().stopScan();
      if (mounted) setState(() => isScanning = false);
    }
  }

  Future<void> _saveKey() async {
    final k = _keyCtl.text.trim();
    if (k.isEmpty) return _toast('Вставьте ключ в поле');
    final ok = await state.setApiKey(k);
    _keyCtl.clear();
    AppLog.add('info', ok ? 'Ключ OpenAI сохранён в связке ключей iOS' : 'Ключ сохранён только до перезапуска (Keychain недоступен)');
    _toast(ok ? 'Ключ сохранён на телефоне' : 'Не удалось сохранить в Keychain');
  }

  Future<void> _saveSettings() async {
    final s = state.settings;
    s.model = _modelChoice == _customModel
        ? (_customModelCtl.text.trim().isEmpty ? 'gpt-6.1-terra' : _customModelCtl.text.trim())
        : _modelChoice;
    s.effort = _effort;
    s.speechLang = _lang;
    s.webSearch = _web;
    s.aboutMe = _aboutCtl.text;
    s.instructions = _instrCtl.text;
    int clampParse(TextEditingController c, int dflt, int min, int max) {
      final n = int.tryParse(c.text.trim()) ?? dflt;
      return n < min ? min : (n > max ? max : n);
    }

    s.answerWords = clampParse(_wordsCtl, 50, 15, 400);
    s.historyMessages = clampParse(_histCtl, 20, 0, 60);
    s.autoPageSec = clampParse(_pageCtl, 6, 0, 60);
    s.lineWidthPx = clampParse(_widthCtl, 488, 300, 600);
    s.contextResetMin = clampParse(_resetCtl, 60, 0, 1440);
    await state.saveSettings();
    _fillForm();
    AppLog.add('info', 'Настройки сохранены (модель ${s.model})');
    _toast('Настройки сохранены');
    setState(() {});
  }

  Future<void> _ask() async {
    final q = _askCtl.text.trim();
    if (q.isEmpty || _asking) return;
    setState(() => _asking = true);
    _askCtl.clear();
    await EvenAI.get.askFromPhone(q);
    if (mounted) setState(() => _asking = false);
  }

  Future<void> _testDisplay() async {
    if (!BleManager.get().isConnected) return _toast('Сначала подключите очки');
    AppLog.add('display', 'Тест дисплея');
    await TextService.get.startSendText(
        'Проверка дисплея G1. Ёжик, йогурт, щука, «кавычки» — тире, цифры 0123456789. '
        'Если строки не переносятся сами и всё помещается — ширина строки подобрана верно.');
  }

  // ───────────────────────── UI ─────────────────────────

  Widget _card(String title, List<Widget> children) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title.toUpperCase(),
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: Theme.of(context).hintColor)),
            const SizedBox(height: 10),
            ...children,
          ]),
        ),
      );

  Widget _field(TextEditingController c, String label,
          {bool number = false, int lines = 1, bool obscure = false, String? hint}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: c,
          obscureText: obscure,
          autocorrect: !obscure,
          enableSuggestions: !obscure,
          keyboardType: number ? TextInputType.number : (lines > 1 ? TextInputType.multiline : TextInputType.text),
          minLines: lines,
          maxLines: obscure ? 1 : (lines > 1 ? lines + 3 : 1),
          decoration: InputDecoration(labelText: label, hintText: hint, border: const OutlineInputBorder(), isDense: true),
        ),
      );

  Widget _dropdown(String label, String value, Map<String, String> items, ValueChanged<String> onChanged) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: InputDecorator(
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder(), isDense: true),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              isDense: true,
              items: items.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
              onChanged: (v) {
                if (v != null) setState(() => onChanged(v));
              },
            ),
          ),
        ),
      );

  Widget _glassesCard() {
    final ble = BleManager.get();
    final pairs = ble.getPairedGlasses();
    return _card('Очки', [
      Row(children: [
        Icon(ble.isConnected ? Icons.check_circle : Icons.bluetooth_searching,
            color: ble.isConnected ? Colors.green : Theme.of(context).hintColor),
        const SizedBox(width: 8),
        Expanded(child: Text(ble.getConnectionStatus(), style: const TextStyle(fontSize: 16))),
      ]),
      const SizedBox(height: 10),
      if (!ble.isConnected)
        FilledButton.icon(
          onPressed: isScanning ? null : () => _startScan(),
          icon: const Icon(Icons.search),
          label: Text(isScanning ? 'Ищу очки…' : 'Найти очки'),
        ),
      if (ble.isConnected)
        OutlinedButton(onPressed: () => ble.disconnect(), child: const Text('Отключить')),
      if (!ble.isConnected && pairs.isNotEmpty) ...[
        const SizedBox(height: 8),
        const Text('Нажмите на свои очки:'),
        ...pairs.map((g) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.visibility),
              title: Text('Pair ${g['channelNumber']}'),
              subtitle: Text('${g['leftDeviceName']}\n${g['rightDeviceName']}'),
              onTap: () => ble.connectToGlasses('Pair_${g['channelNumber']}'),
            )),
      ],
      const SizedBox(height: 6),
      Text(
        'Перед первым подключением закройте приложение Even (или выключите в нём очки): '
        'G1 работает только с одним приложением одновременно.',
        style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
      ),
    ]);
  }

  Widget _keyCard() => _card('Ключ OpenAI API', [
        Text(state.apiKey.isEmpty ? 'Ключ не задан — без него помощник не ответит.' : 'Ключ сохранён: ${state.keyHint}',
            style: TextStyle(color: state.apiKey.isEmpty ? Colors.red : null)),
        const SizedBox(height: 10),
        _field(_keyCtl, 'Вставьте ключ sk-…', obscure: true),
        Row(children: [
          Expanded(child: FilledButton(onPressed: _saveKey, child: const Text('Сохранить ключ'))),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: state.apiKey.isEmpty
                ? null
                : () async {
                    await state.setApiKey(null);
                    AppLog.add('info', 'Ключ удалён');
                  },
            child: const Text('Удалить'),
          ),
        ]),
        const SizedBox(height: 6),
        Text('Хранится в связке ключей iOS на этом телефоне и отправляется только в api.openai.com.',
            style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
      ]);

  Widget _testCard() => _card('Проверка', [
        OutlinedButton.icon(onPressed: _testDisplay, icon: const Icon(Icons.text_fields), label: const Text('Тест дисплея')),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: _field(_askCtl, 'Спросить текстом (ответ — на очки)')),
          const SizedBox(width: 8),
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: FilledButton(
                onPressed: _asking ? null : _ask,
                child: _asking
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.send)),
          ),
        ]),
        if (_lastAnswer.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFF0B120D), borderRadius: BorderRadius.circular(8)),
            child: Text(_lastAnswer,
                style: const TextStyle(color: Color(0xFF5DFF8F), fontFamily: 'Menlo', fontSize: 13, height: 1.4)),
          ),
      ]);

  Widget _howToCard() => _card('Как пользоваться', const [
        Text('• Удерживайте левую сенсорную панель очков и говорите вопрос (до 30 с). Отпустите — ответ появится на дисплее.\n'
            '• Ответ листается сам; тап по правой панели — дальше, по левой — назад. Двойной тап — закрыть.\n'
            '• Уточняйте так же: помощник помнит разговор.\n'
            '• Скажите «новый разговор», чтобы забыть контекст.'),
      ]);

  Widget _settingsCard() => _card('Настройки', [
        _dropdown('Модель', _modelChoice, {..._knownModels, _customModel: 'Другая (ввести ID)…'}, (v) => _modelChoice = v),
        if (_modelChoice == _customModel) _field(_customModelCtl, 'ID модели', hint: 'например gpt-5.4-mini'),
        _dropdown('Глубина размышлений', _effort, _efforts, (v) => _effort = v),
        _field(_wordsCtl, 'Длина ответа по умолчанию, слов', number: true),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Поиск в интернете'),
          subtitle: const Text('Для свежих фактов; +\$0.01 за поиск'),
          value: _web,
          onChanged: (v) => setState(() => _web = v),
        ),
        _field(_histCtl, 'Помнить реплик разговора', number: true),
        _field(_resetCtl, 'Новый разговор после паузы, мин (0 — никогда)', number: true),
        _dropdown('Язык распознавания речи', _lang, _langs, (v) => _lang = v),
        _field(_pageCtl, 'Автолистание, секунд на экран (0 — только тапами)', number: true),
        _field(_widthCtl, 'Ширина строки на очках, px (488 по умолчанию)', number: true),
        const SizedBox(height: 4),
        _field(_aboutCtl, 'Обо мне (имя, город, работа, интересы…)', lines: 3),
        _field(_instrCtl, 'Пожелания к ответам', lines: 2, hint: 'Например: обращайся на «ты», цены в евро'),
        FilledButton(onPressed: _saveSettings, child: const Text('Сохранить настройки')),
      ]);

  Widget _historyCard() {
    final h = state.history;
    final recent = h.length > 10 ? h.sublist(h.length - 10) : h;
    return _card('Разговор', [
      Text('Сообщений в памяти: ${h.length}'),
      const SizedBox(height: 8),
      ...recent.map((m) => Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: m.role == 'user' ? Colors.green : Colors.grey, width: 3)),
            ),
            child: Text('${m.role == 'user' ? 'Вы' : 'GPT'}: ${m.content}', style: const TextStyle(fontSize: 13)),
          )),
      OutlinedButton(
        onPressed: h.isEmpty
            ? null
            : () async {
                await state.resetConversation();
                AppLog.add('cmd', 'Новый разговор (с телефона)');
              },
        child: const Text('Новый разговор (забыть контекст)'),
      ),
    ]);
  }

  Widget _logCard() {
    final lines = AppLog.instance.lines;
    final shown = lines.length > 60 ? lines.sublist(lines.length - 60) : lines;
    return _card('Журнал проверки', [
      Text('Шаги цепочки: панель → микрофон → распознавание → OpenAI → дисплей. Пришлите скриншот, если что-то не работает.',
          style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
      const SizedBox(height: 8),
      Container(
        constraints: const BoxConstraints(maxHeight: 320),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(border: Border.all(color: Theme.of(context).dividerColor), borderRadius: BorderRadius.circular(8)),
        child: SingleChildScrollView(
          reverse: true,
          child: SelectableText(shown.isEmpty ? '—' : shown.join('\n'),
              style: const TextStyle(fontFamily: 'Menlo', fontSize: 11, height: 1.35)),
        ),
      ),
      TextButton(
        onPressed: () async {
          await Clipboard.setData(ClipboardData(text: lines.join('\n')));
          _toast('Журнал скопирован');
        },
        child: const Text('Скопировать журнал'),
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('GPT для G1')),
        body: ListenableBuilder(
          listenable: Listenable.merge([AppState.instance, AppLog.instance]),
          builder: (context, _) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
            children: [
              _glassesCard(),
              _keyCard(),
              _testCard(),
              _howToCard(),
              _settingsCard(),
              _historyCard(),
              _logCard(),
            ],
          ),
        ),
      );

  @override
  void dispose() {
    scanTimer?.cancel();
    isScanning = false;
    _textSub?.cancel();
    BleManager.get().onStatusChanged = null;
    for (final c in [_keyCtl, _askCtl, _customModelCtl, _aboutCtl, _instrCtl, _wordsCtl, _histCtl, _pageCtl, _widthCtl, _resetCtl]) {
      c.dispose();
    }
    super.dispose();
  }
}
