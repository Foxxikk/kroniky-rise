# Skutečný VR test: emulace Meta Quest 3 (IWER od Mety) v headless Chromiu.
# Spustí hru kliknutím na „Hrát ve VR“, nechá běžet snímky, provede skript a vyfotí pohled z brýlí.
import sys, time, subprocess, json, os
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = 8766
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port)], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
out = sys.argv[1]
scripts = sys.argv[2:]
mode = os.environ.get('XRMODE', 'hand')
INIT = open(os.path.join(root, 'test/vendor/iwer.min.js')).read() + """
;(function(){
  const d = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false });
  d.installRuntime({ forceInstall: true });
  d.primaryInputMode = '%s';
  d.position.set(0, 1.6, 0);
  window.__xrdev = d;
})();
""" % mode
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 1280, 'height': 760})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.add_init_script(INIT)
        pg.goto(f'http://localhost:{port}/index.html')
        pg.wait_for_function('window.__app', timeout=60000)
        pg.wait_for_function('!document.getElementById("btn-vr").disabled', timeout=30000)
        pg.click('#btn-vr')
        pg.wait_for_function('window.__app.mode === "vr" && window.__app.renderer.xr.isPresenting', timeout=120000)
        time.sleep(4)
        for s in scripts:
            r = pg.evaluate(open(s).read())
            print('SCRIPT', s, json.dumps(r)[:4000])
        time.sleep(1)
        pg.screenshot(path=out + '.png')
        for l in [l for l in logs if 'TUNNEL' not in l and 'deprecated' not in l][:25]: print(l)
        b.close()
finally:
    srv.terminate()
