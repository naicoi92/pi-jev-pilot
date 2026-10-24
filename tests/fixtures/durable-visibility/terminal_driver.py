import os, pty, subprocess, select, time, fcntl, termios, struct, re, sys, json
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 70, 180, 0, 0))
p = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, close_fds=True)
os.close(slave)
raw = bytearray()
def capture(seconds):
    end = time.time() + seconds
    while time.time() < end:
        if select.select([master], [], [], .05)[0]:
            try: raw.extend(os.read(master, 65536))
            except OSError: break
def text(): return re.sub(rb'\x1b\[[0-?]*[ -/]*[@-~]', b'', raw).decode('utf8', 'replace')
capture(6)
os.write(master, b'/jev status\r'); capture(1)
startup = text()
open(os.environ['EVIDENCE']+'.startup.txt','w').write(startup)
open(os.environ['EVIDENCE']+'.task-start','w').write('local task starts')
os.write(master, b'Run deterministic worker.\r'); capture(12)
before_reload = text()
os.write(master, b'\x0f'); capture(.5)
reload_offset = len(raw)
os.write(master, b'/reload\r'); capture(3)
after_reload = re.sub(rb'\x1b\[[0-?]*[ -/]*[@-~]', b'', raw[reload_offset:]).decode('utf8', 'replace')
os.write(master, b'/jev status\r'); capture(1)
os.write(master, b'\x03'); capture(.3); os.write(master, b'\x03'); capture(1)
try: p.wait(timeout=5)
except subprocess.TimeoutExpired: p.terminate(); p.wait(timeout=3)
plain = text()
open(os.environ['EVIDENCE']+'.raw','wb').write(raw)
open(os.environ['EVIDENCE']+'.txt','w').write(plain)
checks = {'AC-1 main pending': 'Jev · choosing effort' in before_reload, 'AC-1 durable main': 'Jev main' in before_reload, 'AC-2 status before task': 'Jev loaded' in startup and 'No selection yet' in startup, 'worker independent widget': 'Jev worker' in before_reload and 'choosing model + effort' in before_reload, 'AC-3 durable plan': 'Jev worker plan' in before_reload, 'AC-3 receipt': 'executor receipt' in before_reload, 'AC-5 public reload durable main': 'Jev main' in after_reload, 'AC-5 public reload durable worker': 'Jev worker plan' in after_reload, 'AC-1 public expand details': 'Previous effort:' in text(), 'native exit': p.returncode == 0}
print(json.dumps(checks,indent=2)); print('exit',p.returncode)
sys.exit(0 if all(checks.values()) else 1)
