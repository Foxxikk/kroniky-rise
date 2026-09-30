import sys, time, subprocess, json, os
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shot'
script = sys.argv[2] if len(sys.argv) > 2 else ''
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 1280, 'height': 760})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto('http://localhost:8765/index.html?autostart' + ('&test' if 'TEST' in os.environ else ''))
        pg.wait_for_function('window.__app && window.__app.game', timeout=120000)
        time.sleep(2)
        if script:
            r = pg.evaluate(open(script).read()) if os.path.exists(script) else None
            print('SCRIPT', json.dumps(r)[:3000])
        if 'vr.js' in script:
            pg.evaluate('window.__app.renderer.setAnimationLoop(null); window.__app.renderer.render(window.__app.scene, window.__app.camera)')
        time.sleep(1)
        pg.screenshot(path=out + '.png')
        for l in logs[:30]: print(l)
        b.close()
finally:
    srv.terminate()
