"""Bounded native PTY proof. Fake loopback transport; no install or hosted inference."""
import fcntl, http.server, json, os, pathlib, pty, select, struct, subprocess, sys, termios, threading, time

repo, binary, evidence = map(pathlib.Path, sys.argv[1:4])
evidence.mkdir(parents=True, exist_ok=True)
home = evidence / 'home'
agent = home / '.pi/agent'
(agent / 'agents').mkdir(parents=True, exist_ok=True)
events = evidence / 'events.jsonl'
events.write_text('')
gates = {name: threading.Event() for name in ['main-assessment', 'main-stream', 'worker-assessment', 'worker-stream']}
requests = []
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['content-length'])))
        requests.append({'path': self.path, 'body': body})
        if self.path == '/systemone':
            phase = 'worker-assessment' if sum(r['path'] == '/systemone' for r in requests) > 1 else 'main-assessment'
            gates[phase].wait(12)
            answers = {key: ({'choice': 'medium', 'confidence': 0} if key == 'effort' else {'choice': 'balanced', 'confidence': 1} if key == 'tier' else {'noul': 0}) for key in body['questions']}
            data = json.dumps({'answers': answers}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers()
            try: self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError): pass
            return
        if self.path != '/v1/chat/completions': self.send_error(404); return
        self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.end_headers()
        def chunk(delta, finish=None):
            data = {'id': 'status', 'object': 'chat.completion.chunk', 'created': 1, 'model': 'status-model', 'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish}]}
            self.wfile.write(('data: ' + json.dumps(data) + '\n\n').encode()); self.wfile.flush()
        try:
            chunk({'role': 'assistant'})
            child = any(m['role'] == 'user' and 'STATUS_CHILD' in str(m['content']) for m in body['messages'])
            done = any(m['role'] == 'tool' for m in body['messages'])
            if child:
                chunk({'content': 'STATUS_CHILD_VISIBLE'}); gates['worker-stream'].wait(12); chunk({}, 'stop')
            elif done:
                chunk({'content': 'STATUS_PARENT_DONE'}); chunk({}, 'stop')
            else:
                chunk({'content': 'STATUS_MAIN_VISIBLE'}); gates['main-stream'].wait(12)
                args = {'agent': 'status-worker', 'task': 'STATUS_CHILD return local result.', 'async': False, 'options': {'context': 'fresh', 'acceptance': False, 'artifacts': False, 'timeoutMs': 10000}}
                chunk({'tool_calls': [{'index': 0, 'id': 'status-worker-call', 'type': 'function', 'function': {'name': 'subagent', 'arguments': json.dumps(args)}}]}); chunk({}, 'tool_calls')
            self.wfile.write(b'data: [DONE]\n\n'); self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError): pass
class Server(http.server.ThreadingHTTPServer): daemon_threads = True
server = Server(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
(agent / 'models.json').write_text(json.dumps({'providers': {'fixture': {'baseUrl': base + '/v1', 'api': 'openai-completions', 'apiKey': 'local-placeholder', 'models': [{'id': 'status-model', 'reasoning': True, 'input': ['text'], 'contextWindow': 32000, 'maxTokens': 512, 'thinkingLevelMap': {'off': 'none', 'minimal': None, 'low': 'low', 'medium': 'medium', 'high': 'high', 'xhigh': None, 'max': None}}]}}}))
(agent / 'settings.json').write_text(json.dumps({'quietStartup': True, 'checkForUpdates': False, 'compaction': {'enabled': False}, 'retry': {'enabled': False}, 'jevPilot': {'tiers': {'balanced': 'fixture/status-model'}}, 'subagents': {'intercomBridge': {'mode': 'off'}}}))
(agent / 'agents/status-worker.md').write_text('---\nname: status-worker\ndescription: Local status proof\nmodel: fixture/status-model\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn local fixture result.\n')
env = {key: os.environ[key] for key in ['PATH', 'LANG', 'TMPDIR'] if key in os.environ}
env.update(HOME=str(home), PI_CODING_AGENT_DIR=str(agent), PI_OFFLINE='1', PI_TELEMETRY='0', TERM='xterm-256color', JEV_SYSTEM_ONE_URL=base + '/systemone', JEV_SYSTEM_ONE_API_KEY='local-placeholder', JEV_TIMEOUT_MS='10000', JEV_SKILLS_ENABLED='false', JEV_STRATEGY_ENABLED='false', JEV_QUALITY_ENABLED='false', JEV_DESIGN_ENABLED='false', JEV_LEDGER_ENABLED='false', JEV_STATUS_EVENTS=str(events), PI_SUBAGENTS_TEMP_ROOT=str(evidence / 'runtime'))
command = [str(binary), '--no-extensions', '--no-skills', '--no-mcp', '--no-context-files', '--no-prompt-templates', '--no-themes', '--offline', '--no-approve', '--tui-mode', 'fullscreen', '--model', 'fixture/status-model', '--thinking', 'high', '-e', str(repo / 'tests/fixtures/jev-status-observer.ts'), '-e', str(repo / 'node_modules/pi-subagents/index.ts'), '-e', str(repo / 'src/extension.ts'), 'Run local worker.']
(evidence / 'command.json').write_text(json.dumps({'argv': command, 'env': env}, indent=2))
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 160, 0, 0))
def setup(): os.setsid(); fcntl.ioctl(0, termios.TIOCSCTTY, 0)
process = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, cwd=evidence, env=env, preexec_fn=setup)
os.close(slave)
raw = bytearray()
checks = []
def records(): return [json.loads(line) for line in events.read_text().splitlines()]
def pump():
    if select.select([master], [], [], .03)[0]:
        try: raw.extend(os.read(master, 262144))
        except OSError: pass
    if process.poll() is not None: raise AssertionError('Native process exited before proof')
def wait(predicate, label):
    deadline = time.monotonic() + 9
    while time.monotonic() < deadline:
        pump()
        if predicate(): return
    raise AssertionError('Deadline: ' + label)
spin = set('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏')
def latest(): return [r['data']['lines'] for r in records() if r['type'] == 'render' and r['data']['key'] == 'jev-pilot'][-1]
def capture(phase, busy, text):
    wait(lambda: any(r['type'] == 'render' for r in records()) and text in '\n'.join(latest()) and bool(spin.intersection(latest()[0])) == busy, phase)
    # Drain terminal output after observed render, retaining actual PTY bytes per phase.
    for _ in range(5): pump()
    active = {r['data']['key'] for r in records() if r['type'] == 'widget' and r['data']['active'] and r['data']['key'].startswith('jev-')}
    assert active == {'jev-pilot'}, active
    (evidence / (phase + '.ansi')).write_bytes(raw)
    (evidence / (phase + '.widget.txt')).write_text('\n'.join(latest()))
    checks.append({'phase': phase, 'busy': busy, 'widgetKeys': sorted(active), 'lines': latest()})
try:
    capture('main-assessment', True, 'choosing effort'); gates['main-assessment'].set()
    wait(lambda: b'STATUS_MAIN_VISIBLE' in raw, 'main text')
    capture('main-stream', False, 'working'); gates['main-stream'].set()
    capture('worker-assessment', True, 'assessing worker'); gates['worker-assessment'].set()
    wait(lambda: any(r['path'] == '/v1/chat/completions' and any(m['role'] == 'user' and 'STATUS_CHILD' in str(m['content']) for m in r['body']['messages']) for r in requests), 'actual child request')
    capture('worker-stream', False, 'worker'); gates['worker-stream'].set()
    wait(lambda: any(r['type'] == 'settled' for r in records()), 'settled')
    capture('settled', False, 'executor receipt')
    result = [r['data'] for r in records() if r['type'] == 'worker-result'][-1]
    assert not result['isError'], result
    os.write(master, b'/reload\r')
    wait(lambda: sum(r['type'] == 'ready' for r in records()) >= 2, 'interactive reload')
    capture('reloaded', False, 'Jev')
    print(json.dumps({'verdict': 'PASS', 'checks': checks}, indent=2))
finally:
    for gate in gates.values(): gate.set()
    (evidence / 'terminal.ansi').write_bytes(raw)
    (evidence / 'requests.json').write_text(json.dumps(requests, indent=2))
    (evidence / 'checks.json').write_text(json.dumps(checks, indent=2))
    process.terminate()
    try: process.wait(timeout=3)
    except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=2)
    os.close(master); server.shutdown(); server.server_close()
