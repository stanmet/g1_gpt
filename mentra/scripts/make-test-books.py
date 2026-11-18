# Test books for tests/books.test.ts: python3 scripts/make-test-books.py tests/fixtures/books
# Writes EPUB, FB2 (windows-1251), .fb2.zip, DOCX, TXT (windows-1251) and _mayak.html; mayak.pdf is
# printed from _mayak.html with Chromium (Playwright page.pdf, outline: true), then the HTML is removed.
# The text is written for the tests (not from a real book).
import zipfile, os, sys
out = sys.argv[1]
CH = [
 ("Глава 1. Камни и чертежи", [
  "Маяк на Северном мысе построили в 1874 году по чертежам инженера Карла Штольца.",
  "Штольц приехал из Риги с тремя помощниками и ящиком латунных инструментов. Камень для башни везли на баржах из каменоломни у деревни Лопатино, и каждую глыбу поднимали на скалу воротом.",
  "Башня вышла высотой тридцать два метра. Стены у основания были толщиной в два метра, а наверх вела винтовая лестница из ста сорока ступеней.",
 ]),
 ("Глава 2. Огонь", [
  "Фонарь маяка собрали из двенадцати линз Френеля, отлитых во Франции.",
  "Сначала в лампе жгли рапсовое масло, потом керосин. Свет был виден с моря за девятнадцать миль, если не было тумана.",
  "Смотритель Ефим Громов служил на маяке сорок лет и каждую ночь записывал в журнал погоду и проходящие суда.",
 ]),
 ("Глава 3. Шторм девяносто шестого года", [
  "В ноябре 1896 года шторм сорвал с галереи медный колпак и разбил две линзы.",
  "Громов три ночи подряд держал огонь керосиновым фонарём, пока из города не привезли новые стёкла. За это губернатор наградил его серебряными часами.",
 ]),
]
TITLE = "Маяк на Северном мысе"
AUTHOR = ("Анна", "Тестова")

def xhtml(title, paras):
    body = f"<h2>{title}</h2>" + "".join(f"<p>{p}</p>" for p in paras)
    return f'<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title><style>p{{margin:0}}</style></head><body>{body}</body></html>'

# EPUB 3 with nav
with zipfile.ZipFile(os.path.join(out, "mayak.epub"), "w") as z:
    z.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
    z.writestr("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', compress_type=zipfile.ZIP_DEFLATED)
    items = "".join(f'<item id="c{i}" href="Text/ch{i}.xhtml" media-type="application/xhtml+xml"/>' for i in range(3))
    spine = "".join(f'<itemref idref="c{i}"/>' for i in range(3))
    opf = f'<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>{TITLE}</dc:title><dc:creator>{AUTHOR[0]} {AUTHOR[1]}</dc:creator><dc:language>ru</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cover" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>{items}</manifest><spine><itemref idref="cover"/>{spine}</spine></package>'
    z.writestr("OEBPS/content.opf", opf, compress_type=zipfile.ZIP_DEFLATED)
    nav = '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>' + "".join(f'<li><a href="Text/ch{i}.xhtml">{CH[i][0]}</a></li>' for i in range(3)) + '</ol></nav></body></html>'
    z.writestr("OEBPS/nav.xhtml", nav, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr("OEBPS/Text/cover.xhtml", '<html><body><div><img src="../Images/c.jpg"/></div></body></html>', compress_type=zipfile.ZIP_DEFLATED)
    for i, (t, ps) in enumerate(CH):
        z.writestr(f"OEBPS/Text/ch{i}.xhtml", xhtml(t, ps), compress_type=zipfile.ZIP_DEFLATED)

# FB2 in windows-1251, with a notes body and a binary
fb2 = '<?xml version="1.0" encoding="windows-1251"?>\n<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink"><description><title-info><genre>prose</genre><author><first-name>Анна</first-name><last-name>Тестова</last-name></author><book-title>Маяк на Северном мысе</book-title><lang>ru</lang></title-info></description><body><title><p>Маяк на Северном мысе</p></title>'
for t, ps in CH:
    fb2 += "<section><title><p>" + t + "</p></title>" + "".join(f"<p>{p}</p>" for p in ps) + "</section>"
fb2 += '</body><body name="notes"><section id="n1"><title><p>1</p></title><p>Примечание переводчика.</p></section></body><binary id="c.jpg" content-type="image/jpeg">AAAA</binary></FictionBook>'
open(os.path.join(out, "mayak.fb2"), "wb").write(fb2.encode("cp1251"))
with zipfile.ZipFile(os.path.join(out, "mayak.fb2.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("mayak.fb2", fb2.encode("cp1251"))

# DOCX: headings by style
def para(text, style=None):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    # split a run in two to test joining
    h = len(text)//2
    return f'<w:p>{ppr}<w:r><w:t xml:space="preserve">{text[:h]}</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>{text[h:]}</w:t></w:r></w:p>'
doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
doc += para(TITLE, "a3")
for t, ps in CH:
    doc += para(t, "1")
    for p in ps: doc += para(p)
doc += '<w:p/><w:sectPr/></w:body></w:document>'
styles = '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="a3"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/></w:style></w:styles>'
core = f'<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>{TITLE}</dc:title><dc:creator>{AUTHOR[0]} {AUTHOR[1]}</dc:creator></cp:coreProperties>'
with zipfile.ZipFile(os.path.join(out, "mayak.docx"), "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", "<Types/>")
    z.writestr("word/document.xml", doc)
    z.writestr("word/styles.xml", styles)
    z.writestr("docProps/core.xml", core)

# TXT in windows-1251 with chapter lines and wrapped paragraphs
txt = TITLE + "\r\n\r\n"
for t, ps in CH:
    txt += t + "\r\n\r\n"
    for p in ps:
        words = p.split(" ")
        lines = [" ".join(words[i:i+8]) for i in range(0, len(words), 8)]
        txt += "   " + "\r\n".join(lines) + "\r\n"
    txt += "\r\n"
open(os.path.join(out, "mayak.txt"), "wb").write(txt.encode("cp1251"))

# an English book (EPUB 2 with NCX) for cross-language search
EN = [("Chapter 1. The Town Clock", ["The clock on the market hall of Ennis stopped in the winter of 1911.", "Nobody in town could fix it until Brigid Doyle, a young clockmaker from Galway, climbed the tower with a bag of files and a tin of whale oil."]),
      ("Chapter 2. Brass and Patience", ["She replaced the worn escapement wheel with one she cut herself from a ship's brass plate.", "In March 1912 the clock struck noon again, and the mayor paid her eleven pounds."])]
with zipfile.ZipFile(os.path.join(out, "clockmaker.epub"), "w") as z:
    z.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
    z.writestr("META-INF/container.xml", '<?xml version="1.0"?><container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>')
    items = "".join(f'<item id="c{i}" href="c%20{i}.html" media-type="application/xhtml+xml"/>' for i in range(2))
    z.writestr("content.opf", f'<package><metadata><dc:title xmlns:dc="x">The Clockmaker of Ennis</dc:title><dc:creator xmlns:dc="x">J. Example</dc:creator><dc:language xmlns:dc="x">en-IE</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>{items}</manifest><spine toc="ncx">' + "".join(f'<itemref idref="c{i}"/>' for i in range(2)) + '</spine></package>', compress_type=zipfile.ZIP_DEFLATED)
    z.writestr("toc.ncx", '<ncx><navMap>' + "".join(f'<navPoint id="n{i}"><navLabel><text>{EN[i][0]}</text></navLabel><content src="c%20{i}.html"/></navPoint>' for i in range(2)) + '</navMap></ncx>', compress_type=zipfile.ZIP_DEFLATED)
    for i, (t, ps) in enumerate(EN):
        z.writestr(f"c {i}.html", "<html><body>" + "".join(f"<p>{p}</p>" for p in ps) + "</body></html>", compress_type=zipfile.ZIP_DEFLATED)

# an HTML page with the same Russian text, for a PDF printed by Chromium
html = '<html><head><meta charset="utf-8"><style>body{font-family:serif;font-size:14pt} h2{page-break-before:always}</style></head><body><h1>' + TITLE + '</h1>'
for t, ps in CH:
    html += f"<h2>{t}</h2>" + "".join(f"<p>{p}</p>" for p in ps)
html += "</body></html>"
open(os.path.join(out, "_mayak.html"), "w").write(html)
print("ok")
