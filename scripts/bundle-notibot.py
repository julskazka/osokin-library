"""Create a pasteable Notibot HTML + ZIP, retaining the official external SDK in head."""
from pathlib import Path
import re,base64,zipfile,sys
root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'build'
out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(root/m[1]).read_text()+'</style>',html)
html=html.replace('src="assets/portrait.png"','src="data:image/png;base64,'+base64.b64encode((root/'assets/portrait.png').read_bytes()).decode()+'"')
def inline(m):
 if m[1].startswith('https://'):return m[0]
 return '<script>'+(root/m[1]).read_text().replace('</script','<\\/script')+'</script>'
html=re.sub(r'<script src="([^"]+)"></script>',inline,html)
code='\n'.join((root/f'src/{name}.js').read_text() for name in ['domain','access-provider','app'])
code=re.sub(r'^import .*?;\s*','',code,flags=re.M).replace('export ','')
code='window.OSOKIN_CATALOG='+(root/'data/episodes.json').read_text()+';\n'+code
html=html.replace('<script type="module" src="src/app.js"></script>','<script type="module">'+code+'</script>')
(out/'notibot-library.html').write_text(html)
with zipfile.ZipFile(out/'notibot-library.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(out/'notibot-library.html','notibot-library.html');z.write(root/'NOTIBOT-SETUP.txt','ИНСТРУКЦИЯ.txt')
print(out/'notibot-library.zip')
