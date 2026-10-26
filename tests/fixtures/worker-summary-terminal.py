"""Bounded Pi-Bolt native lifecycle + standard Ctrl+O proof; loopback transport only."""
import fcntl, http.server, re, json, os, pathlib, pty, select, struct, subprocess, sys, termios, threading, time

repo, binary, evidence = map(pathlib.Path, sys.argv[1:4])
evidence.mkdir(parents=True, exist_ok=True)
scenario = sys.argv[4] if len(sys.argv) > 4 else 'complete'
foreground = scenario.startswith('foreground-')
workflow = scenario.startswith('foreground-workflow-')
outcome = scenario.rsplit('-', 1)[-1]
home = evidence / 'home'; agent = home / '.pi/agent'
(agent / 'agents').mkdir(parents=True, exist_ok=True)
events = evidence / 'events.jsonl'; events.write_text('')
assessment = threading.Event(); child_end = threading.Event(); requests = []; raw = bytearray(); checks = []
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['content-length'])))
        requests.append({'path': self.path, 'body': body})
        if self.path == '/systemone':
            assessment.wait(30)
            data = json.dumps({'answers': {key: ({'choice': 'low', 'confidence': 1} if key == 'effort' else {'choice': 'balanced', 'confidence': 1} if key == 'tier' else {'noul': 0}) for key in body['questions']}}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers()
            try: self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError): pass
            return
        if self.path != '/v1/chat/completions': self.send_error(404); return
        child = any(m['role'] == 'user' and 'SUMMARY_CHILD' in str(m['content']) for m in body['messages'])
        if child and outcome == 'error':
            child_end.wait(60); data = json.dumps({'error': {'message': 'LOCAL_CHILD_ERROR', 'type': 'fixture_error'}}).encode()
            self.send_response(400); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.end_headers()
        def chunk(delta, finish=None):
            data = {'id': 'summary', 'object': 'chat.completion.chunk', 'created': 1, 'model': 'summary-model', 'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish}]}
            self.wfile.write(('data: ' + json.dumps(data) + '\n\n').encode()); self.wfile.flush()
        try:
            chunk({'role': 'assistant'})
            done = any(m['role'] == 'tool' for m in body['messages']) or any('subagent' in str(m.get('content', '')) and m['role'] == 'user' for m in body['messages'][1:])
            if child:
                chunk({'content': 'LOCAL_CHILD_VISIBLE'}); child_end.wait(60); chunk({}, 'stop')
            elif done:
                chunk({'content': 'LOCAL_PARENT_DONE'}); chunk({}, 'stop')
            else:
                args = {'agent': 'summary-worker', 'task': 'SUMMARY_CHILD return local result.', 'async': not foreground, 'options': {'context': 'fresh', 'acceptance': False, 'artifacts': False, 'timeoutMs': 60000}}
                if workflow:
                    args = {'workflow': str(evidence / 'foreground-workflow.js'), 'async': False, 'options': args['options']}
                chunk({'tool_calls': [{'index': 0, 'id': 'summary-public-call', 'type': 'function', 'function': {'name': 'subagent', 'arguments': json.dumps(args)}}]}); chunk({}, 'tool_calls')
            self.wfile.write(b'data: [DONE]\n\n'); self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError): pass
class Server(http.server.ThreadingHTTPServer): daemon_threads = True
server = Server(('127.0.0.1', 0), Handler); threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
(agent / 'models.json').write_text(json.dumps({'providers': {'fixture': {'baseUrl': base + '/v1', 'api': 'openai-completions', 'apiKey': 'local-placeholder', 'models': [{'id': 'summary-model', 'reasoning': True, 'input': ['text'], 'contextWindow': 32000, 'maxTokens': 512, 'thinkingLevelMap': {'off': 'none', 'low': 'low', 'medium': 'medium', 'high': 'high'}}]}}}))
(agent / 'settings.json').write_text(json.dumps({'quietStartup': True, 'checkForUpdates': False, 'compaction': {'enabled': False}, 'retry': {'enabled': False}, 'jevPilot': {'tiers': {'balanced': 'fixture/summary-model'}}, 'subagents': {'intercomBridge': {'mode': 'off'}}}))
(agent / 'agents/summary-worker.md').write_text('---\nname: summary-worker\ndescription: Local worker summary proof\nmodel: fixture/summary-model\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn local fixture result.\n')
(evidence / 'foreground-workflow.js').write_text('return await runs.run("one", {agent: "summary-worker", task: "SUMMARY_CHILD return local result.", async: false, options: {context: "fresh", acceptance: false, artifacts: false}});')
env = {key: os.environ[key] for key in ['PATH', 'LANG', 'TMPDIR'] if key in os.environ}
env.update(HOME=str(home), PI_CODING_AGENT_DIR=str(agent), PI_OFFLINE='1', PI_TELEMETRY='0', TERM='xterm-256color', JEV_SYSTEM_ONE_URL=base + '/systemone', JEV_SYSTEM_ONE_API_KEY='local-placeholder', JEV_TIMEOUT_MS='10000', JEV_EFFORT_ENABLED='false', JEV_SKILLS_ENABLED='false', JEV_STRATEGY_ENABLED='false', JEV_QUALITY_ENABLED='false', JEV_DESIGN_ENABLED='false', JEV_LEDGER_ENABLED='false', JEV_STATUS_EVENTS=str(events), PI_SUBAGENTS_TEMP_ROOT=str(evidence / 'runtime'))
command = [str(binary), '--no-extensions', '--no-skills', '--no-mcp', '--no-context-files', '--no-prompt-templates', '--no-themes', '--offline', '--no-approve', '--tui-mode', 'fullscreen', '--session-dir', str(evidence / 'sessions'), '--model', 'fixture/summary-model', '--thinking', 'high', '-e', str(repo / 'tests/fixtures/jev-status-observer.ts'), '-e', str(repo / 'tests/fixtures/worker-summary-observer.ts'), '-e', str(repo / 'node_modules/pi-subagents/index.ts'), '-e', str(repo / 'src/extension.ts'), 'Run local worker.']
(evidence / 'command.json').write_text(json.dumps({'argv': command, 'env': env}, indent=2))
master, slave = pty.openpty(); fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 160, 0, 0))
def setup(): os.setsid(); fcntl.ioctl(0, termios.TIOCSCTTY, 0)
process = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, cwd=evidence, env=env, preexec_fn=setup); os.close(slave)
def records():
    return [json.loads(line) for line in events.read_text().splitlines()]
def pump():
    if select.select([master], [], [], .03)[0]:
        try: raw.extend(os.read(master, 262144))
        except OSError: pass
    if process.poll() is not None: raise AssertionError('Native process exited before proof')
def wait(predicate, label, seconds=20):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        pump()
        if predicate(): return
    raise AssertionError('Deadline: ' + label)
def latest():
    rows = [r['data']['lines'] for r in records() if r['type'] == 'render' and r['data']['key'] == 'jev-pilot']
    return rows[-1] if rows else []
def capture(phase, text, spinner=False):
    wait(lambda: text in '\n'.join(latest()) and bool(set('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏').intersection(''.join(latest()))) == spinner, phase)
    assert len(latest()) == 1, latest()
    assert not any(word in ''.join(latest()) for word in ['unknown', 'unconfirmed', 'w1-', 'PRIVATE']), latest()
    checks.append({'phase': phase, 'lines': latest()}); (evidence / (phase + '.ansi')).write_bytes(raw)
try:
    capture('assessment-pending', 'assessing worker', True)
    assessment.set()
    wait(lambda: any(r['type'] == 'subagent:worker-decision-accepted' for r in records()), 'trusted acceptance')
    wait(lambda: any(r['type'] == 'subagent:child-status' and r['data']['status'] == 'started' for r in records()), 'actual child start')
    capture('actual-running', '1 worker running · low')
    def native_visible():
        active = {}; rendered = {}
        for r in records():
            if r['type'] == 'widget': active[r['data']['key']] = r['data']['active']
            if r['type'] == 'render': rendered[r['data']['key']] = r['data']['lines']
        return {k: rendered.get(k, []) for k in ['subagent-async','subagent-fleet-status'] if active.get(k)}
    if not workflow:
        wait(lambda: not any(any(line.strip() for line in lines) for lines in native_visible().values()), 'acknowledged native leaf rows absent')
        checks.append({'phase':'native-leaf-rows-absent', 'widgets':native_visible()})
    seen = [r for r in records() if r['type'] == 'render']
    if not foreground:
        assert any('worker accepted' in '\n'.join(r['data']['lines']) for r in seen), 'accepted state not rendered'
    assert not any(r['data']['lines'] for r in records() if r['type'] == 'worker-render' and not r['data']['expanded']), 'debug rows collapsed'
    os.write(master, b'\x0f')
    wait(lambda: any(r['type'] == 'worker-render' and r['data']['expanded'] and any('summary-worker ·' in line and 'assessed · fixture/summary-model · low · running' in line for line in r['data']['lines']) for r in records()), 'Ctrl+O expanded metadata')
    checks.append({'phase': 'expanded', 'details': [r['data'] for r in records() if r['type'] == 'worker-render' and r['data']['expanded']][-1]})
    os.write(master, b'\x0f')
    wait(lambda: [r for r in records() if r['type'] == 'worker-render'][-1]['data']['lines'] == [], 'Ctrl+O collapse')
    for _ in range(4): pump()
    default_start = len(raw)
    if scenario == 'complete-fallback':
        os.write(master, b'/reload\r')
        wait(lambda: sum(r['type'] == 'ready' for r in records()) >= 2, 'consumer reload disposal')
        wait(lambda: any(any('summary-worker' in line for line in lines) for lines in native_visible().values()), 'unacknowledged native running fallback')
        checks.append({'phase':'reload-native-fallback','widgets':native_visible()})
        child_end.set()
        wait(lambda: any(r['type']=='subagent:async-complete' for r in records()), 'fallback native completion')
        print(json.dumps({'verdict':'PASS','scenario':scenario,'checks':checks}, indent=2))
        sys.exit(0)
    if outcome == 'cancel': os.write(master, b'/summary-stop\r')
    else: child_end.set()
    terminal = 'cancelled' if outcome == 'cancel' else 'failed' if outcome == 'error' else 'completed'
    capture('terminal-' + terminal, '1 worker ' + terminal + ' · low')
    if not foreground:
        wait(lambda: any(r['type']=='native-notification' for r in records()), 'genuine native completion notice')
        wait(lambda: any(r['type']=='notification-component' for r in records()), 'genuine native notification component')
    if not workflow:
        wait(lambda: not any(any(line.strip() for line in lines) for lines in native_visible().values()), 'terminal native leaf rows absent')
        for _ in range(4): pump()
        default_bytes = bytes(raw[default_start:])
        (evidence / 'terminal-default-slice.ansi').write_bytes(default_bytes)
        plain = re.sub(rb'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)', b'', default_bytes)
        plain = re.sub(rb'\x1b\[[0-?]*[ -/]*[@-~]', b'', plain)
        assert b'LOCAL_CHILD_ERROR' not in plain and b'async-subagent-runs/' not in plain and b'Async: summary-worker [' not in plain, plain
        checks.append({'phase':'terminal-default-no-leaf-debug','native':native_visible()})
        assert not any(r['data']['lines'] for r in records() if r['type']=='notification-component' and not r['data']['expanded']), 'collapsed native notification leaked'
    if foreground:
        wait(lambda: any(r['type']=='worker-result' and r['data'].get('toolCallId')=='summary-public-call' for r in records()), 'settled public foreground result')
        wait(lambda: any(r['type']=='settled' for r in records()), 'foreground parent settled')
    os.write(master, b'\x0f')
    useful = 'LOCAL_CHILD_ERROR' if outcome == 'error' else 'stopped' if outcome == 'cancel' else 'LOCAL_CHILD_VISIBLE'
    if not foreground and outcome == 'complete':
        wait(lambda: any(r['type']=='native-notification' and not r['data']['display'] for r in records()), 'native silent success notice preserved')
    else:
        if not foreground:
            wait(lambda: any(r['data']['expanded'] and useful.lower() in '\n'.join(r['data']['lines']).lower() for r in records() if r['type']=='notification-component'), 'expanded useful native terminal component')
        wait(lambda: useful.lower().encode() in bytes(raw).lower(), 'Ctrl+O useful native terminal bytes')
    checks.append({'phase':'expanded-terminal-output', 'useful':useful})
    (evidence / 'terminal-expanded.ansi').write_bytes(raw)
    os.write(master, b'\x0f')
    if foreground:
        if workflow and outcome == 'error':
            attached = [r['data'] for r in records() if r['type']=='subagent:foreground-complete' and r['data'].get('attached')]
            assert len(attached)==1 and attached[0]['workflowKey']=='one' and attached[0]['state']=='failed', attached
        wait(lambda: any(r['type'] == 'worker-result' and r['data'].get('toolCallId') == 'summary-public-call' for r in records()), 'public foreground result')
        completion = [r for r in records() if r['type'] == 'worker-result' and r['data'].get('toolCallId') == 'summary-public-call'][-1]
        assert completion['data']['isError'] == (outcome == 'error'), completion
        details = completion['data']['result']['details']
        if outcome == 'error': assert details == {}, details
        elif workflow:
            assert 'toolCallId' not in details and details['workflowChildren']['parentToolCallId'] == 'summary-public-call', details
        else: assert details['toolCallId'] == 'summary-public-call', details
    else:
        completion = [r for r in records() if r['type'] == 'subagent:async-complete'][-1]
        assert completion['data']['state'] == ('stopped' if outcome == 'cancel' else 'failed' if outcome == 'error' else 'complete'), completion
    os.write(master, b'/reload\r')
    wait(lambda: sum(r['type'] == 'ready' for r in records()) >= 2, 'interactive reload')
    wait(lambda: any(r['type'] == 'render' and r['data']['key'] == 'jev-pilot' for r in records()[max(i for i, r in enumerate(records()) if r['type'] == 'ready'):]), 'fresh render after reload')
    capture('reloaded', 'Jev')
    assert not any('worker running' in line for line in latest()), latest()
    print(json.dumps({'verdict': 'PASS', 'scenario': scenario, 'checks': checks}, indent=2))
finally:
    assessment.set(); child_end.set()
    (evidence / 'terminal.ansi').write_bytes(raw); (evidence / 'requests.json').write_text(json.dumps(requests, indent=2)); (evidence / 'checks.json').write_text(json.dumps(checks, indent=2))
    process.terminate()
    try: process.wait(timeout=3)
    except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=2)
    os.close(master); server.shutdown(); server.server_close()
