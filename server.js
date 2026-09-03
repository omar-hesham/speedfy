import express from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import net from 'net';
import { execFile } from 'child_process';

const app = express();
const API_PORT = 3001;
const PROXY_PORT = 8888;

const LOG_DIR = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const SESSION_ID = new Date().toISOString().replace(/[:.]/g, '-');
const SESSION_LOG_FILE = path.join(LOG_DIR, `bondlink-${SESSION_ID}.jsonl`);
const CURRENT_LOG_FILE = path.join(LOG_DIR, 'bondlink-current.jsonl');
const ROUTING_FIX_LOG_FILE = path.join(LOG_DIR, 'windows-routing-fix-latest.json');
fs.writeFileSync(CURRENT_LOG_FILE, '', 'utf8');

const recentLogEvents = [];
const liveLogClients = new Set();
let logSequence = 0;

const toErrorDetails = (error) => ({
    name: error?.name,
    code: error?.code,
    message: error?.message || String(error),
    stdout: error?.stdout,
    stderr: error?.stderr,
    stack: error?.stack
});

const normalizeLogDetails = (details) => {
    if (!details) return undefined;
    if (details instanceof Error) return toErrorDetails(details);
    return details;
};

const logEvent = (level, component, event, message, details = undefined, diagnosis = undefined) => {
    const entry = {
        id: ++logSequence,
        timestamp: new Date().toISOString(),
        level,
        component,
        event,
        message,
        details: normalizeLogDetails(details),
        diagnosis
    };

    const line = `${JSON.stringify(entry)}\n`;
    try {
        fs.appendFileSync(SESSION_LOG_FILE, line, 'utf8');
        fs.appendFileSync(CURRENT_LOG_FILE, line, 'utf8');
    } catch (error) {
        console.error(`[Logger] Failed to write log file: ${error.message}`);
    }

    recentLogEvents.push(entry);
    if (recentLogEvents.length > 1000) recentLogEvents.shift();

    const consoleLine = `[${entry.timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
    if (level === 'error') console.error(consoleLine);
    else if (level === 'warn') console.warn(consoleLine);
    else console.log(consoleLine);

    for (const client of liveLogClients) {
        try {
            client.write(`data: ${JSON.stringify(entry)}\n\n`);
        } catch {
            liveLogClients.delete(client);
        }
    }

    return entry;
};

const createRunId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const asArray = (value) => Array.isArray(value) ? value : (value ? [value] : []);
const escapePowerShellSingleQuoted = (value) => String(value).replace(/'/g, "''");
const powerShellArray = (values) => `@(${values.map(value => `'${escapePowerShellSingleQuoted(value)}'`).join(', ')})`;

const runPowerShellJson = (script, timeout = 45_000) => new Promise((resolve, reject) => {
    execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { timeout, windowsHide: true, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
            if (error) {
                reject(Object.assign(error, { stdout, stderr }));
                return;
            }

            const trimmed = stdout.trim();
            if (!trimmed) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(trimmed));
            } catch (parseError) {
                reject(Object.assign(parseError, { stdout: trimmed, stderr }));
            }
        }
    );
});

const collectRoutingSnapshot = async (ips = []) => {
    const sanitizedIps = [...new Set(ips.map(ip => String(ip).trim()).filter(Boolean))];
    const psIps = powerShellArray(sanitizedIps);
    const script = `
$ErrorActionPreference = 'Stop'
$ips = ${psIps}
$allIpRows = Get-NetIPAddress -AddressFamily IPv4 | Select-Object IPAddress,InterfaceAlias,InterfaceIndex,PrefixLength,AddressState,SkipAsSource
if ($ips.Count -gt 0) {
  $ipRows = @($allIpRows | Where-Object { $ips -contains $_.IPAddress })
} else {
  $ipRows = @($allIpRows)
}
$routes = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric,InterfaceMetric | Select-Object ifIndex,InterfaceAlias,NextHop,RouteMetric,InterfaceMetric,PolicyStore)
$interfaces = @(Get-NetIPInterface -AddressFamily IPv4 | Sort-Object InterfaceMetric,InterfaceAlias | Select-Object InterfaceAlias,InterfaceIndex,InterfaceMetric,AutomaticMetric,ConnectionState,Dhcp)
[pscustomobject]@{
  timestamp = (Get-Date).ToString('o')
  requestedIps = $ips
  ipBindings = $ipRows
  defaultRoutes = $routes
  ipInterfaces = $interfaces
} | ConvertTo-Json -Depth 6 -Compress
`;
    return runPowerShellJson(script);
};

const diagnoseRoutingSnapshot = (snapshot, requestedIps = []) => {
    const ipBindings = asArray(snapshot?.ipBindings);
    const defaultRoutes = asArray(snapshot?.defaultRoutes);
    const ipInterfaces = asArray(snapshot?.ipInterfaces);
    const requested = requestedIps.map(ip => String(ip).trim()).filter(Boolean);
    const targetBindings = requested.length > 0
        ? ipBindings.filter(row => requested.includes(row.IPAddress))
        : ipBindings;
    const targetIndexes = new Set(targetBindings.map(row => Number(row.InterfaceIndex)).filter(Number.isFinite));
    const targetRoutes = defaultRoutes.filter(row => targetIndexes.has(Number(row.ifIndex ?? row.InterfaceIndex)));
    const findings = [];

    for (const ip of requested) {
        if (!targetBindings.some(row => row.IPAddress === ip)) {
            findings.push(`${ip} is not assigned to any active IPv4 adapter.`);
        }
    }

    if (targetBindings.length > 0 && targetRoutes.length === 0) {
        findings.push('Target adapters are present, but no matching default route was found.');
    }

    if (targetRoutes.length > 1) {
        const routeCosts = [...new Set(targetRoutes.map(row => Number(row.RouteMetric)))];
        const interfaceCosts = [...new Set(targetRoutes.map(row => Number(row.InterfaceMetric)))];
        if (routeCosts.length > 1 || interfaceCosts.length > 1) {
            findings.push(`Target adapters are not equal-cost routes: ${targetRoutes.map(row => `${row.InterfaceAlias || row.ifIndex}=route:${row.RouteMetric}/if:${row.InterfaceMetric}`).join(', ')}.`);
        }
    }

    const wifiBinding = targetBindings.find(row => /wi-fi|wifi|wireless|wlan/i.test(row.InterfaceAlias || ''));
    if (wifiBinding) {
        const wifiRoute = targetRoutes.find(row => Number(row.ifIndex ?? row.InterfaceIndex) === Number(wifiBinding.InterfaceIndex));
        if (!wifiRoute) {
            findings.push(`Wi-Fi adapter ${wifiBinding.IPAddress} has no default route.`);
        } else if (Number(wifiRoute.RouteMetric) > 0 || Number(wifiRoute.InterfaceMetric) > 15) {
            findings.push(`Wi-Fi route exists but is not preferred/equalized: route metric ${wifiRoute.RouteMetric}, interface metric ${wifiRoute.InterfaceMetric}.`);
        }
    }

    const ghostMatches = ipInterfaces.filter(row => /vEthernet|VMware|Virtual/i.test(row.InterfaceAlias || '') && Number(row.InterfaceMetric) <= 15);
    if (ghostMatches.length > 0) {
        findings.push(`Virtual adapters also have low metrics (${ghostMatches.map(row => row.InterfaceAlias).slice(0, 4).join(', ')}); bind tests should keep using explicit selected IPs.`);
    }

    return findings.join(' | ') || 'Target NICs are visible; no obvious metric mismatch was detected in the snapshot.';
};

process.on('unhandledRejection', (reason) => {
    logEvent('error', 'process', 'unhandled_rejection', 'Unhandled promise rejection', reason instanceof Error ? reason : { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
    logEvent('error', 'process', 'uncaught_exception', error.message, error);
    process.exit(1);
});

let activeInterfaces = [];
let roundRobinIndex = 0;

app.use(express.json());

// Helper to get active IPs
const getActiveIps = () => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const [name, nets] of Object.entries(interfaces)) {
        for (const net of nets) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push(net.address);
            }
        }
    }
    return ips;
};

// Initialize with all available interfaces automatically
activeInterfaces = getActiveIps();
logEvent('info', 'startup', 'process_boot', 'BondLink backend process started', {
    pid: process.pid,
    node: process.version,
    cwd: process.cwd(),
    apiPort: API_PORT,
    proxyPort: PROXY_PORT,
    sessionLogFile: SESSION_LOG_FILE,
    currentLogFile: CURRENT_LOG_FILE
});
logEvent('info', 'startup', 'interfaces_detected', `Auto-bonding initialized with ${activeInterfaces.length} IPv4 interfaces`, { activeInterfaces });
collectRoutingSnapshot(activeInterfaces)
    .then(snapshot => logEvent('info', 'startup', 'routing_snapshot', 'Captured startup routing snapshot', snapshot, diagnoseRoutingSnapshot(snapshot, activeInterfaces)))
    .catch(error => logEvent('warn', 'startup', 'routing_snapshot_failed', 'Could not capture startup routing snapshot', error));

// 1. API: Get real network interfaces
app.get('/api/interfaces', (req, res) => {
    const interfaces = os.networkInterfaces();
    const results = [];
    
    for (const [name, nets] of Object.entries(interfaces)) {
        for (const net of nets) {
            if (net.family === 'IPv4' && !net.internal) {
                const type = name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan') || name.toLowerCase().includes('wireless') ? 'wifi' : 'ethernet';
                results.push({
                    id: name,
                    name: name,
                    type: type,
                    ipAddress: net.address,
                    macAddress: net.mac,
                    gateway: 'Auto',
                    isActive: true
                });
            }
        }
    }
    res.json(results);
});

// 2. API: Set active interfaces for bonding
app.post('/api/bond', (req, res) => {
    const { ips } = req.body;
    if (Array.isArray(ips)) {
        activeInterfaces = ips;
        logEvent('info', 'proxy', 'active_bonding_updated', `Active bonding IPs updated: ${activeInterfaces.length > 0 ? activeInterfaces.join(', ') : 'None'}`, { activeInterfaces });
        res.json({ success: true, activeInterfaces, proxyPort: PROXY_PORT });
    } else {
        res.status(400).json({ error: 'Invalid IPs array' });
    }
});

const isValidIpv4 = (ip) => typeof ip === 'string' && /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(ip);

app.get('/api/diagnostics/logs', (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    res.json({
        success: true,
        sessionId: SESSION_ID,
        logFile: SESSION_LOG_FILE,
        currentLogFile: CURRENT_LOG_FILE,
        routingFixLogFile: ROUTING_FIX_LOG_FILE,
        activeInterfaces,
        events: recentLogEvents.slice(-limit)
    });
});

app.get('/api/diagnostics/live', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify(logEvent('info', 'diagnostics', 'live_client_connected', 'Diagnostics live log client connected', { clients: liveLogClients.size + 1 }))}\n\n`);
    liveLogClients.add(res);
    req.on('close', () => {
        liveLogClients.delete(res);
    });
});

app.post('/api/diagnostics/snapshot', async (req, res) => {
    const requestedIps = Array.isArray(req.body?.ips) ? req.body.ips : activeInterfaces;
    const sanitizedIps = [...new Set(requestedIps.map(ip => String(ip).trim()).filter(isValidIpv4))];

    try {
        const snapshot = await collectRoutingSnapshot(sanitizedIps);
        const diagnosis = diagnoseRoutingSnapshot(snapshot, sanitizedIps);
        logEvent('info', 'diagnostics', 'manual_snapshot', 'Captured manual routing snapshot', { requestedIps: sanitizedIps, snapshot }, diagnosis);
        res.json({ success: true, requestedIps: sanitizedIps, snapshot, diagnosis });
    } catch (error) {
        logEvent('error', 'diagnostics', 'manual_snapshot_failed', 'Manual routing snapshot failed', error);
        res.status(500).json({ success: false, error: error.message, details: toErrorDetails(error) });
    }
});

app.get('/api/diagnostics/routing-fix-result', (req, res) => {
    if (!fs.existsSync(ROUTING_FIX_LOG_FILE)) {
        return res.status(404).json({ success: false, error: 'No routing-fix result log has been written yet.' });
    }

    try {
        const payload = JSON.parse(fs.readFileSync(ROUTING_FIX_LOG_FILE, 'utf8'));
        res.json({ success: true, result: payload, routingFixLogFile: ROUTING_FIX_LOG_FILE });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message, routingFixLogFile: ROUTING_FIX_LOG_FILE });
    }
});

app.post('/api/fix-windows-routing', (req, res) => {
    const requestedIps = Array.isArray(req.body?.ips) ? req.body.ips : activeInterfaces;
    const sanitizedIps = [...new Set(requestedIps.map(ip => String(ip).trim()).filter(isValidIpv4))];

    if (sanitizedIps.length === 0) {
        logEvent('warn', 'routing_fix', 'invalid_request', 'Routing fix requested without valid IPv4 targets', { requestedIps });
        return res.status(400).json({ success: false, error: 'No valid IPv4 addresses supplied for routing fix.' });
    }

    const psIpArray = powerShellArray(sanitizedIps);
    const psRoutingFixLogFile = `'${escapePowerShellSingleQuoted(ROUTING_FIX_LOG_FILE)}'`;
    const metricScript = `
$ErrorActionPreference = 'Stop'
$routingFixLogFile = ${psRoutingFixLogFile}
$ips = ${psIpArray}
$result = [ordered]@{
  timestamp = (Get-Date).ToString('o')
  ips = $ips
  status = 'started'
}
try {
  $indexes = @()
  foreach ($ip in $ips) {
    $addr = Get-NetIPAddress -IPAddress $ip -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($addr) { $indexes += $addr.InterfaceIndex }
  }
  $indexes = @($indexes | Sort-Object -Unique)
  if ($indexes.Count -eq 0) { throw "No matching IPv4 interfaces found for $($ips -join ', ')" }

  $result.indexes = $indexes
  $result.beforeInterfaces = @(Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $indexes -contains $_.InterfaceIndex } | Select-Object InterfaceAlias,InterfaceIndex,InterfaceMetric,AutomaticMetric,ConnectionState)
  $result.beforeRoutes = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Where-Object { $indexes -contains $_.ifIndex } | Select-Object ifIndex,InterfaceAlias,NextHop,RouteMetric,InterfaceMetric)

  foreach ($ifIndex in $indexes) {
    Set-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4 -AutomaticMetric Disabled -InterfaceMetric 15
    Get-NetRoute -DestinationPrefix '0.0.0.0/0' -InterfaceIndex $ifIndex -ErrorAction SilentlyContinue | Set-NetRoute -RouteMetric 0 -Confirm:$false
  }

  Start-Sleep -Milliseconds 500
  $result.afterInterfaces = @(Get-NetIPInterface -AddressFamily IPv4 | Where-Object { $indexes -contains $_.InterfaceIndex } | Select-Object InterfaceAlias,InterfaceIndex,InterfaceMetric,AutomaticMetric,ConnectionState)
  $result.afterRoutes = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Where-Object { $indexes -contains $_.ifIndex } | Select-Object ifIndex,InterfaceAlias,NextHop,RouteMetric,InterfaceMetric)
  $result.status = 'success'
} catch {
  $result.status = 'error'
  $result.error = $_.Exception.Message
  $result.stack = $_.ScriptStackTrace
} finally {
  $result.finishedAt = (Get-Date).ToString('o')
  $result | ConvertTo-Json -Depth 6 | Set-Content -Path $routingFixLogFile -Encoding UTF8
}
if ($result.status -eq 'error') { throw $result.error }
`;

    const encodedCommand = Buffer.from(metricScript, 'utf16le').toString('base64');
    const elevatedCommand = `Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}'`;

    logEvent(
        'warn',
        'routing_fix',
        'uac_launch_requested',
        `Launching elevated Windows routing fix for ${sanitizedIps.join(', ')}`,
        { targetedIps: sanitizedIps, routingFixLogFile: ROUTING_FIX_LOG_FILE },
        'Accept the UAC prompt. The elevated script writes before/after route metrics to windows-routing-fix-latest.json.'
    );

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', elevatedCommand], (error) => {
        if (error) {
            logEvent('error', 'routing_fix', 'uac_launch_failed', 'Could not launch elevated Windows routing fix', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        logEvent('info', 'routing_fix', 'uac_prompt_launched', 'Windows UAC prompt launched for routing fix', { targetedIps: sanitizedIps, routingFixLogFile: ROUTING_FIX_LOG_FILE });
        res.json({
            success: true,
            elevated: true,
            targetedIps: sanitizedIps,
            routingFixLogFile: ROUTING_FIX_LOG_FILE,
            note: 'UAC prompt launched. Accept it, then rerun the speed test so Windows applies equal route/interface metrics.'
        });
    });
});

const DOWNLOAD_BYTES_PER_REQUEST = 50_000_000;
const UPLOAD_BYTES_PER_REQUEST = 10_000_000;
const SPEEDTEST_TIMEOUT_MS = 15_000;
const UPLOAD_CHUNK_SIZE = 256 * 1024;
const DOWNLOAD_STREAMS_SINGLE = 2;
const DOWNLOAD_STREAMS_BONDED = 6;
const UPLOAD_STREAMS_SINGLE = 2;
const UPLOAD_STREAMS_BONDED = 4;
const DOWNLOAD_URL = `http://speed.cloudflare.com/__down?bytes=${DOWNLOAD_BYTES_PER_REQUEST}`;

const runBoundDownload = (localIp, onBytes, context = {}) => new Promise((resolve) => {
    const startedAt = Date.now();
    let streamBytes = 0;
    let finished = false;

    const finish = (level, event, message, details = {}, diagnosis = undefined) => {
        if (finished) return;
        finished = true;
        logEvent(level, 'speedtest', event, message, {
            ...context,
            localIp,
            bytes: streamBytes,
            durationMs: Date.now() - startedAt,
            ...details
        }, diagnosis);
        resolve({ bytes: streamBytes });
    };

    logEvent('info', 'speedtest', 'stream_start', `Starting download stream via ${localIp}`, context);

    const reqOpt = http.get(DOWNLOAD_URL, { localAddress: localIp, timeout: SPEEDTEST_TIMEOUT_MS }, (resp) => {
        logEvent('info', 'speedtest', 'stream_response', `Download stream via ${localIp} received HTTP ${resp.statusCode}`, {
            ...context,
            localIp,
            statusCode: resp.statusCode,
            headers: {
                server: resp.headers.server,
                contentLength: resp.headers['content-length'],
                contentType: resp.headers['content-type']
            }
        });
        resp.on('data', chunk => {
            streamBytes += chunk.length;
            onBytes(chunk.length);
        });
        resp.on('error', err => finish('warn', 'stream_response_error', `Download response via ${localIp} failed: ${err.code || err.message}`, toErrorDetails(err)));
        resp.on('end', () => finish('info', 'stream_end', `Download stream via ${localIp} finished`, { statusCode: resp.statusCode }));
    });

    reqOpt.on('timeout', () => {
        reqOpt.destroy();
        finish('warn', 'stream_timeout', `Download stream via ${localIp} timed out`, { timeoutMs: SPEEDTEST_TIMEOUT_MS }, 'A bound socket timed out before receiving data; check that this adapter has a usable default route and internet access.');
    });
    reqOpt.on('error', (err) => {
        finish('warn', 'stream_error', `Download stream via ${localIp} failed: ${err.code || err.message}`, toErrorDetails(err), 'A bound socket failed. If this is Wi-Fi while Ethernet works, the likely fault is Windows routing/strong-host behavior or unequal default-route metrics.');
    });
});

const runBoundUpload = (localIp, onBytes, context = {}) => new Promise((resolve) => {
    const startedAt = Date.now();
    let finished = false;
    let sent = 0;
    let acknowledgedBytes = 0;
    const chunk = Buffer.alloc(Math.min(UPLOAD_CHUNK_SIZE, UPLOAD_BYTES_PER_REQUEST), 0x61);

    const finish = (level, event, message, details = {}, diagnosis = undefined) => {
        if (finished) return;
        finished = true;
        logEvent(level, 'speedtest', event, message, {
            ...context,
            localIp,
            bytes: acknowledgedBytes,
            attemptedBytes: sent,
            durationMs: Date.now() - startedAt,
            ...details
        }, diagnosis);
        resolve({ bytes: acknowledgedBytes });
    };

    logEvent('info', 'speedtest', 'stream_start', `Starting upload stream via ${localIp}`, context);

    const reqOpt = https.request({
        hostname: 'speed.cloudflare.com',
        path: `/__up?bytes=${UPLOAD_BYTES_PER_REQUEST}`,
        method: 'POST',
        localAddress: localIp,
        timeout: SPEEDTEST_TIMEOUT_MS,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': UPLOAD_BYTES_PER_REQUEST
        }
    }, (resp) => {
        logEvent('info', 'speedtest', 'stream_response', `Upload stream via ${localIp} received HTTP ${resp.statusCode}`, {
            ...context,
            localIp,
            statusCode: resp.statusCode,
            headers: { server: resp.headers.server }
        });
        resp.resume();
        resp.on('error', err => finish('warn', 'stream_response_error', `Upload response via ${localIp} failed: ${err.code || err.message}`, toErrorDetails(err)));
        resp.on('end', () => finish('info', 'stream_end', `Upload stream via ${localIp} finished`, { statusCode: resp.statusCode }));
    });

    reqOpt.on('timeout', () => {
        reqOpt.destroy();
        finish('warn', 'stream_timeout', `Upload stream via ${localIp} timed out`, { timeoutMs: SPEEDTEST_TIMEOUT_MS }, 'A bound upload socket timed out; check adapter route metrics and upstream connectivity.');
    });
    reqOpt.on('error', (err) => {
        finish('warn', 'stream_error', `Upload stream via ${localIp} failed: ${err.code || err.message}`, toErrorDetails(err), 'A bound upload socket failed. If this is Wi-Fi while Ethernet works, the likely fault is Windows routing/strong-host behavior or unequal default-route metrics.');
    });

    const pump = () => {
        if (finished) return;
        while (sent < UPLOAD_BYTES_PER_REQUEST) {
            const bytesThisChunk = Math.min(chunk.length, UPLOAD_BYTES_PER_REQUEST - sent);
            const payload = bytesThisChunk === chunk.length ? chunk : chunk.subarray(0, bytesThisChunk);
            sent += bytesThisChunk;
            const canContinue = reqOpt.write(payload, () => {
                if (finished) return;
                acknowledgedBytes += bytesThisChunk;
                onBytes(bytesThisChunk);
            });
            if (!canContinue) {
                reqOpt.once('drain', pump);
                return;
            }
        }
        reqOpt.end();
    };

    pump();
});


app.get('/api/speedtest-live', async (req, res) => {
    const mode = req.query.mode;
    const direction = req.query.direction === 'upload' ? 'upload' : 'download';
    const ipAddress = typeof req.query.ipAddress === 'string' ? req.query.ipAddress : null;
    const ips = typeof req.query.ips === 'string' ? req.query.ips.split(',') : activeInterfaces;
    const bytesPerRequest = direction === 'upload' ? UPLOAD_BYTES_PER_REQUEST : DOWNLOAD_BYTES_PER_REQUEST;
    const streamCount = mode === 'single'
        ? (direction === 'upload' ? UPLOAD_STREAMS_SINGLE : DOWNLOAD_STREAMS_SINGLE)
        : (direction === 'upload' ? UPLOAD_STREAMS_BONDED : DOWNLOAD_STREAMS_BONDED);
    const totalExpectedBytes = bytesPerRequest * streamCount;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let transferred = 0;
    const bytesPerIp = {};
    const start = Date.now();
    const promises = [];
    const transferId = createRunId('speedtest');
    let targetIps = [];
    let isFinished = false;

    req.on('close', () => {
        if (!isFinished) {
            logEvent('warn', 'speedtest', 'sse_client_closed', 'Speedtest SSE client disconnected before completion', { transferId, direction, mode, transferred, bytesPerIp });
        }
    });

    const addBytes = (ip, bytes) => {
        transferred += bytes;
        bytesPerIp[ip] = (bytesPerIp[ip] || 0) + bytes;
    };

    const writeProgress = (payload = {}) => {
        const duration = (Date.now() - start) / 1000;
        const mbps = duration > 0 ? (transferred * 8 / 1_000_000) / duration : 0;
        const breakdown = {};
        for (const [ip, b] of Object.entries(bytesPerIp)) {
            breakdown[ip] = duration > 0 ? (b * 8 / 1_000_000) / duration : 0;
        }
        res.write(`data: ${JSON.stringify({
            direction,
            mbps: mbps.toFixed(2),
            breakdown,
            bytes: transferred,
            progress: Math.min(99, (transferred / totalExpectedBytes) * 100),
            ...payload
        })}\n\n`);
    };

    const reportInterval = setInterval(() => {
        if (!isFinished) writeProgress();
    }, 250);

    try {
        const runTransfer = direction === 'upload' ? runBoundUpload : runBoundDownload;

        if (mode === 'single' && ipAddress) {
            if (!isValidIpv4(ipAddress)) {
                const error = `Invalid IPv4 address for single-interface test: ${ipAddress}`;
                logEvent('warn', 'speedtest', 'invalid_target_ip', error, { transferId, ipAddress, direction, mode });
                isFinished = true;
                clearInterval(reportInterval);
                res.write(`data: ${JSON.stringify({ error })}\n\n`);
                return res.end();
            }
            targetIps = [ipAddress];
            logEvent('info', 'speedtest', 'transfer_start', `Starting ${direction} ${mode} speedtest`, { transferId, direction, mode, targetIps, streamCount, bytesPerRequest, totalExpectedBytes });
            bytesPerIp[ipAddress] = 0;
            for (let i = 0; i < streamCount; i++) {
                promises.push(runTransfer(ipAddress, bytes => addBytes(ipAddress, bytes), { transferId, direction, mode, streamIndex: i + 1, streamCount, bytesPerRequest }));
            }
        } else if (mode === 'bonded') {
            targetIps = ips.map(ip => String(ip).trim()).filter(isValidIpv4);
            if (targetIps.length === 0) {
                const error = 'No active interfaces bonded.';
                logEvent('warn', 'speedtest', 'no_bonded_targets', error, { transferId, direction, mode, requestedIps: ips });
                isFinished = true;
                clearInterval(reportInterval);
                res.write(`data: ${JSON.stringify({ error })}\n\n`);
                return res.end();
            }
            logEvent('info', 'speedtest', 'transfer_start', `Starting ${direction} ${mode} speedtest`, { transferId, direction, mode, targetIps, streamCount, bytesPerRequest, totalExpectedBytes });
            for (const ip of targetIps) bytesPerIp[ip] = 0;
            for (let i = 0; i < streamCount; i++) {
                const localIp = targetIps[i % targetIps.length];
                promises.push(runTransfer(localIp, bytes => addBytes(localIp, bytes), { transferId, direction, mode, streamIndex: i + 1, streamCount, bytesPerRequest }));
            }
        } else {
            logEvent('warn', 'speedtest', 'invalid_mode', `Unsupported speedtest mode: ${mode}`, { transferId, direction, mode, ipAddress, ips });
            isFinished = true;
            clearInterval(reportInterval);
            return res.end();
        }
        
        await Promise.all(promises);
        isFinished = true;
        clearInterval(reportInterval);

        const duration = (Date.now() - start) / 1000;
        const finalMbps = duration > 0 ? (transferred * 8 / 1_000_000) / duration : 0;
        const breakdown = {};
        for (const [ip, b] of Object.entries(bytesPerIp)) {
            breakdown[ip] = duration > 0 ? (b * 8 / 1_000_000) / duration : 0;
        }
        const zeroIps = Object.entries(bytesPerIp).filter(([, bytes]) => bytes === 0).map(([ip]) => ip);
        const diagnosis = zeroIps.length > 0
            ? `No ${direction} bytes transferred on ${zeroIps.join(', ')}. The failing boundary is the localAddress-bound socket for that NIC; check Windows route metrics/strong-host behavior and verify the adapter has internet access.`
            : undefined;

        logEvent(
            zeroIps.length > 0 ? 'warn' : 'info',
            'speedtest',
            'transfer_complete',
            `${direction} ${mode} speedtest completed at ${finalMbps.toFixed(2)} Mbps`,
            { transferId, direction, mode, targetIps, duration, bytes: transferred, breakdown, zeroIps },
            diagnosis
        );

        if (zeroIps.length > 0) {
            collectRoutingSnapshot(targetIps)
                .then(snapshot => logEvent('warn', 'diagnostics', 'post_failure_routing_snapshot', 'Captured routing snapshot after zero-throughput adapter result', { transferId, targetIps, snapshot }, diagnoseRoutingSnapshot(snapshot, targetIps)))
                .catch(error => logEvent('warn', 'diagnostics', 'post_failure_routing_snapshot_failed', 'Could not capture post-failure routing snapshot', { transferId, error: toErrorDetails(error) }));
        }

        writeProgress({ done: true, duration });
        res.end();
    } catch (e) {
        isFinished = true;
        clearInterval(reportInterval);
        logEvent('error', 'speedtest', 'transfer_failed', `${direction} ${mode} speedtest failed`, { transferId, direction, mode, targetIps, error: toErrorDetails(e) });
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
    }
});

// --- DISPATCH PROXY SERVER ---

const getNextLocalAddress = () => {
    if (activeInterfaces.length === 0) return null;
    const ip = activeInterfaces[roundRobinIndex % activeInterfaces.length];
    roundRobinIndex++;
    return ip;
};

// Handle standard HTTP requests
const proxyServer = http.createServer((clientReq, clientRes) => {
    const localAddress = getNextLocalAddress();
    
    // Parse target from headers
    const hostHeader = clientReq.headers.host || '';
    const [hostname, portStr] = hostHeader.split(':');
    const port = portStr ? parseInt(portStr, 10) : 80;

    const options = {
        hostname: hostname,
        port: port,
        path: clientReq.url,
        method: clientReq.method,
        headers: clientReq.headers,
    };
    
    if (localAddress) {
        options.localAddress = localAddress; // THE MAGIC: Bind to specific NIC
    }

    const proxyReq = http.request(options, (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(clientRes, { end: true });
    });

    clientReq.pipe(proxyReq, { end: true });
    
    proxyReq.on('error', (err) => {
        logEvent('warn', 'proxy', 'http_request_error', `HTTP proxy request failed for ${hostname || hostHeader}: ${err.code || err.message}`, {
            localAddress,
            method: clientReq.method,
            hostHeader,
            path: clientReq.url,
            error: toErrorDetails(err)
        });
        if (!clientRes.headersSent) {
            clientRes.writeHead(502);
            clientRes.end('Bad Gateway');
        }
    });
});

// Handle HTTPS CONNECT requests
proxyServer.on('connect', (req, clientSocket, head) => {
    const localAddress = getNextLocalAddress();
    
    // req.url is typically "hostname:port" for CONNECT requests
    const [hostname, portStr] = req.url.split(':');
    const port = portStr ? parseInt(portStr, 10) : 443;
    
    const options = {
        port: port,
        host: hostname,
    };
    
    if (localAddress) {
        options.localAddress = localAddress; // THE MAGIC: Bind to specific NIC
    }

    const serverSocket = net.connect(options, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                           'Proxy-agent: Node-Dispatch-Proxy\r\n' +
                           '\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
        logEvent('warn', 'proxy', 'connect_error', `HTTPS CONNECT failed for ${hostname}:${port}: ${err.code || err.message}`, {
            localAddress,
            hostname,
            port,
            error: toErrorDetails(err)
        });
        clientSocket.end();
    });
    
    clientSocket.on('error', (err) => {
        logEvent('warn', 'proxy', 'client_socket_error', `Client socket error during CONNECT: ${err.code || err.message}`, {
            localAddress,
            hostname,
            port,
            error: toErrorDetails(err)
        });
        serverSocket.end();
    });
});

const apiServer = app.listen(API_PORT, () => {
    logEvent('info', 'startup', 'api_listening', `API Server running on port ${API_PORT}`, { apiPort: API_PORT });
});

apiServer.on('error', (error) => {
    logEvent('error', 'startup', 'api_listen_error', `API server failed to listen on port ${API_PORT}: ${error.code || error.message}`, error, error.code === 'EADDRINUSE' ? `Port ${API_PORT} is already in use. Stop the old Node server process, then restart BondLink.` : undefined);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 50);
});

proxyServer.listen(PROXY_PORT, () => {
    logEvent('info', 'startup', 'proxy_listening', `Bonding Proxy running on port ${PROXY_PORT}`, { proxyPort: PROXY_PORT, proxyAddress: `127.0.0.1:${PROXY_PORT}` });
});

proxyServer.on('error', (error) => {
    logEvent('error', 'startup', 'proxy_listen_error', `Proxy failed to listen on port ${PROXY_PORT}: ${error.code || error.message}`, error, error.code === 'EADDRINUSE' ? `Port ${PROXY_PORT} is already in use. Stop the old Node server process, then restart BondLink.` : undefined);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 50);
});
