import 'g1_glyphs.dart';

/// Text preparation for the G1 display: strip Markdown/emoji and wrap into
/// lines using G1 glyph widths, so the glasses never have to re-wrap a line.
class G1Text {
  G1Text._();

  static const int unknownPx = 18;

  static int charPx(int rune) => g1GlyphPx[rune] ?? unknownPx;

  static int textPx(String s) {
    var w = 0;
    for (final r in s.runes) {
      w += charPx(r);
    }
    return w;
  }

  static const Map<String, String> _replace = {
    '№': 'No',
    ' ': ' ',
    ' ': ' ',
    ' ': ' ',
    '\t': ' ',
    '‑': '-',
    '‐': '-',
    '−': '-',
    '×': 'x',
    '✓': '+',
    '✔': '+',
    '★': '*',
    '⇒': '→',
    '⟶': '→',
    '`': "'",
  };

  /// Plain text that only uses glyphs the G1 font contains.
  static String sanitize(String input) {
    var t = input.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    t = t.replaceAll(RegExp(r'```[^\n]*\n?'), '');
    t = t.replaceAllMapped(RegExp(r'!\[([^\]]*)\]\([^)]*\)'), (m) => m[1] ?? '');
    t = t.replaceAllMapped(RegExp(r'\[([^\]]+)\]\([^)]*\)'), (m) => m[1] ?? '');
    t = t.replaceAllMapped(RegExp(r'https?://(?:www\.)?([^\s/)]+)[^\s)]*'), (m) => m[1] ?? '');
    t = t.replaceAll(RegExp(r'^[ \t]{0,3}#{1,6}[ \t]+', multiLine: true), '');
    t = t.replaceAll(RegExp(r'^[ \t]{0,3}>[ \t]?', multiLine: true), '');
    t = t.replaceAll(RegExp(r'^[ \t]*\|?([ \t]*:?-{2,}:?[ \t]*\|)+[ \t]*:?-*:?[ \t]*$', multiLine: true), '');
    t = t.replaceAllMapped(RegExp(r'^[ \t]*\|(.*)\|[ \t]*$', multiLine: true), (m) {
      final cells = (m[1] ?? '').split('|').map((c) => c.trim()).where((c) => c.isNotEmpty);
      return cells.join(' · ');
    });
    t = t.replaceAll(RegExp(r'^[ \t]*[-*+•▪●◦][ \t]+', multiLine: true), '• ');
    t = t.replaceAllMapped(RegExp(r'(\*\*|__)(.+?)\1'), (m) => m[2] ?? '');
    t = t.replaceAllMapped(RegExp(r'`([^`]*)`'), (m) => m[1] ?? '');
    t = t.replaceAll(RegExp(r'【[^】]*】'), '');
    t = t.replaceAll(RegExp(r'\s?\[\d+(?:,\s*\d+)*\]'), '');

    final out = StringBuffer();
    for (final r in t.runes) {
      final ch = String.fromCharCode(r);
      final rep = _replace[ch];
      if (rep != null) {
        out.write(rep);
      } else if (ch == '\n' || g1GlyphPx.containsKey(r)) {
        out.write(ch);
      }
      // emoji and characters missing from the G1 font are dropped
    }
    return out
        .toString()
        .split('\n')
        .map((l) => l.replaceAll(RegExp(r' {2,}'), ' ').replaceAll('*', '').trim())
        .where((l) => l.isNotEmpty)
        .join('\n');
  }

  static List<String> _splitLongWord(String word, int maxPx) {
    final parts = <String>[];
    final buf = StringBuffer();
    var w = 0;
    final hyphen = charPx('-'.codeUnitAt(0));
    for (final r in word.runes) {
      final cw = charPx(r);
      if (buf.isNotEmpty && w + cw + hyphen > maxPx) {
        parts.add('${buf.toString()}-');
        buf.clear();
        w = 0;
      }
      buf.writeCharCode(r);
      w += cw;
    }
    if (buf.isNotEmpty) parts.add(buf.toString());
    return parts;
  }

  /// Greedy word wrap of sanitized text into lines no wider than [maxPx].
  static List<String> wrap(String text, int maxPx) {
    final lines = <String>[];
    final space = charPx(0x20);
    for (final para in text.split('\n')) {
      final words = para.split(' ').where((w) => w.isNotEmpty);
      var cur = '';
      var w = 0;
      for (final word in words) {
        final pieces = textPx(word) > maxPx ? _splitLongWord(word, maxPx) : [word];
        for (final piece in pieces) {
          final pw = textPx(piece);
          if (cur.isEmpty) {
            cur = piece;
            w = pw;
          } else if (w + space + pw <= maxPx) {
            cur = '$cur $piece';
            w += space + pw;
          } else {
            lines.add(cur);
            cur = piece;
            w = pw;
          }
        }
      }
      if (cur.isNotEmpty) lines.add(cur);
    }
    return lines;
  }
}
