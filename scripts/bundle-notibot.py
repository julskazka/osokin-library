"""Build a single HTML file for Notibot from the *current* GitHub Pages sources.

Run: python3 scripts/bundle-notibot.py [output_dir]
The external official Notibot bridge is kept as one script reference.
The inline file must still be uploaded manually to the Notibot HTML page.
"""
from pathlib import Path
from urllib.parse import urlsplit
import re
import base64
import zipfile
import sys

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "build"
out.mkdir(parents=True, exist_ok=True)


def resource_path(url):
    path = (root / urlsplit(url).path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"Local resource is unavailable: {url!r}")
    return path


html = (root / "index.html").read_text(encoding="utf-8")


def inline_css(match):
    css = resource_path(match.group(1)).read_text(encoding="utf-8")
    return "<style>\n" + css + "\n</style>"


html = re.sub(
    r'<link rel="stylesheet" href="([^"]+)">',
    inline_css,
    html,
)


def inline_image(match):
    url = match.group(1)
    if not url.startswith("assets/"):
        return match.group(0)
    path = resource_path(url)
    mime = "image/webp" if path.suffix.lower() == ".webp" else "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return 'src="data:' + mime + ';base64,' + encoded + '"'


html = re.sub(r'src="(assets/[^"]+\.(?:webp|png|jpg|jpeg)(?:\?[^"]*)?)"', inline_image, html)


def inline_script(match):
    url = match.group(1)
    if url.startswith("https://"):
        return match.group(0)
    script = resource_path(url).read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>\n" + script + "\n</script>"


html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)

sources = ["domain", "access-provider", "purchase-recheck", "app"]
parts = []
for name in sources:
    source = (root / "src" / f"{name}.js").read_text(encoding="utf-8")
    source = re.sub(r"^import .*?;\s*", "", source, flags=re.M)
    source = re.sub(r"^export\s+", "", source, flags=re.M)
    parts.append(source)
catalog = (root / "data" / "episodes.json").read_text(encoding="utf-8")
module_code = "window.OSOKIN_CATALOG=" + catalog + ";\n" + "\n".join(parts)
module_code = module_code.replace("</script", "<\\/script")
html, replaced = re.subn(
    r'<script type="module" src="src/app\.js(?:\?[^"]*)?"></script>',
    lambda _: "<script type=\"module\">\n" + module_code + "\n</script>",
    html,
)
if replaced != 1:
    raise RuntimeError(f"Expected exactly one app module tag; found {replaced}")
if "src/app.js" in html or '<link rel="stylesheet" href="assets/' in html:
    raise RuntimeError("Standalone HTML still contains unresolved app dependencies")

file = out / "notibot-library.html"
file.write_text(html, encoding="utf-8")
with zipfile.ZipFile(out / "notibot-library.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.write(file, "notibot-library.html")
    archive.write(root / "NOTIBOT-SETUP.txt", "ИНСТРУКЦИЯ.txt")
print(file)
print(out / "notibot-library.zip")
