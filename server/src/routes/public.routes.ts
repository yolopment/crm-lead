import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

function getPublicPath(relPath: string): string | null {
  const candidate1 = path.resolve(process.cwd(), 'public', relPath);
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.resolve(__dirname, '../../public', relPath);
  if (fs.existsSync(candidate2)) return candidate2;
  return null;
}

const LLMS_TEXT = `# StaffCaller Cloud
> Production SaaS CRM for Automatic Call Tracking, Audio Recording Sync & Lead Distribution

## Documentation & Key Links
- [Platform Home](https://staffcaller.cloud/): Overview, live features, and architecture
- [About StaffCaller](https://staffcaller.cloud/about): Organization mission, technical design, and companion app telemetry
- [Technical Contact & Support](https://staffcaller.cloud/contact): Inquiries, enterprise support, and SLA
- [System Health](https://staffcaller.cloud/health): Live API, uptime, and system status
- [Terms of Service](https://staffcaller.cloud/terms): Platform license and acceptable usage policy
- [Privacy Policy](https://staffcaller.cloud/privacy): Data security, encryption, and audio isolation policy
- [MCP Server Card](https://staffcaller.cloud/.well-known/mcp/server-card.json): Machine-readable Model Context Protocol server capabilities

## Core Capabilities
- **Automatic Call Syncing**: Native Android companion listener capturing incoming and outgoing calls on IDLE state.
- **Audio Extraction**: Direct OEM audio extractor supporting Samsung, Xiaomi (MIUI), Vivo, Oppo, OnePlus, and Google Pixel.
- **HTTP Range Audio Streaming**: Sub-second seeking and instant browser audio streaming with token authorization.
- **Round-Robin Lead Distribution**: Dynamic lead ingestion from Meta Ads & Google Ads with agent leave management exclusion.
- **Cloud Storage Options**: Dual-driver architecture supporting Cloudflare R2 and Google Drive.
- **WhatsApp Web Integration**: Multi-session Baileys client for automated client outreach and messaging.

## Key APIs
- POST /api/v1/auth/login: User authentication with JWT
- POST /api/v1/auth/register: Organization & admin registration
- GET /api/v1/leads: Paginated lead management
- GET /api/v1/calls: Call metadata & audio stream endpoints
- POST /api/v1/webhooks/meta: Meta Ads lead ingestion
`;

const ROBOTS_TXT = `User-agent: *
Allow: /

# Dedicated AI Crawlers & LLM Scanners
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

# Content usage signal (RFC compliant)
Content-Signal: search=yes, ai-train=yes

Sitemap: https://staffcaller.cloud/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://staffcaller.cloud/</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://staffcaller.cloud/about</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://staffcaller.cloud/contact</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://staffcaller.cloud/terms</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://staffcaller.cloud/privacy</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://staffcaller.cloud/llms.txt</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;

const MCP_SERVER_CARD = {
  $schema: "https://modelcontextprotocol.io/schemas/server-card-v1.json",
  name: "staffcaller-crm-api",
  description: "StaffCaller Cloud CRM and automatic call audio synchronization platform",
  version: "1.0.0",
  url: "https://staffcaller.cloud/api/v1",
  endpoint: "https://staffcaller.cloud/api/v1",
  homepage: "https://staffcaller.cloud",
  capabilities: {
    tools: true,
    resources: true,
    prompts: false
  },
  endpoints: {
    api: "https://staffcaller.cloud/api/v1",
    health: "https://staffcaller.cloud/health"
  },
  authentication: {
    type: "bearer",
    tokenEndpoint: "https://staffcaller.cloud/api/v1/auth/login"
  }
};

const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>StaffCaller — Automatic Call Recording Sync & Sales CRM</title>
  <meta name="description" content="StaffCaller is a production SaaS CRM for automatic call tracking, Android call recording synchronization, WhatsApp integration, and round-robin lead distribution.">
  <meta name="keywords" content="CRM, call tracking, call recording sync, sales CRM, Android call sync, lead distribution, WhatsApp CRM">
  <link rel="canonical" href="https://staffcaller.cloud/">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://staffcaller.cloud/">
  <meta property="og:title" content="StaffCaller — Automatic Call Recording Sync & Sales CRM">
  <meta property="og:description" content="Production SaaS CRM for automatic call recording sync, team analytics, and lead distribution.">
  <meta property="og:site_name" content="StaffCaller">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="StaffCaller — Automatic Call Recording Sync & Sales CRM">
  <meta name="twitter:description" content="Production SaaS CRM for automatic call recording sync, team analytics, and lead distribution.">

  <!-- Structured Data JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://staffcaller.cloud/#organization",
        "name": "StaffCaller",
        "url": "https://staffcaller.cloud",
        "email": "support@staffcaller.cloud",
        "telephone": "+1-800-555-0199",
        "address": {
          "@type": "PostalAddress",
          "addressCountry": "US",
          "addressLocality": "San Francisco"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+1-800-555-0199",
          "email": "support@staffcaller.cloud",
          "contactType": "customer service"
        },
        "sameAs": [
          "https://github.com/yolopment/crm-lead-app"
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://staffcaller.cloud/#software",
        "name": "StaffCaller CRM",
        "operatingSystem": "Android, Web, Cloud",
        "applicationCategory": "BusinessApplication",
        "description": "Enterprise SaaS CRM for automatic call tracking, Android audio recording sync, and sales lead distribution.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://staffcaller.cloud/#website",
        "url": "https://staffcaller.cloud",
        "name": "StaffCaller Cloud",
        "publisher": { "@id": "https://staffcaller.cloud/#organization" }
      }
    ]
  }
  </script>

  <!-- WebMCP Agent Tools Registration -->
  <script>
    if (typeof window !== 'undefined' && window.navigator && window.navigator.modelContext && typeof window.navigator.modelContext.registerTool === 'function') {
      try {
        window.navigator.modelContext.registerTool({
          name: 'get_staffcaller_status',
          description: 'Get current system status and health of StaffCaller Cloud CRM',
          inputSchema: { type: 'object', properties: {} },
          execute: async function() {
            const res = await fetch('/health');
            return await res.json();
          }
        });
      } catch(e) {}
    }
  </script>

  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      border-bottom: 1px solid var(--card-border);
      padding: 1.25rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }
    .logo {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }
    .logo-badge {
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      margin-left: 1.5rem;
      font-size: 0.95rem;
      transition: color 0.2s;
    }
    nav a:hover { color: #fff; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
      font-size: 0.95rem;
    }
    .btn-primary {
      background-color: var(--primary);
      color: #fff;
    }
    .btn-primary:hover { background-color: var(--primary-hover); transform: translateY(-1px); }
    .btn-outline {
      border: 1px solid var(--card-border);
      color: var(--text);
      background: var(--card-bg);
      margin-left: 0.75rem;
    }
    .btn-outline:hover { background: rgba(255,255,255,0.08); }
    
    main { flex: 1; max-width: 1200px; margin: 0 auto; padding: 4rem 2rem; width: 100%; }
    .hero { text-align: center; max-width: 800px; margin: 0 auto 5rem; }
    .hero h1 {
      font-size: clamp(2.25rem, 5vw, 3.75rem);
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: 1.15rem;
      color: var(--text-muted);
      margin-bottom: 2rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
      margin-bottom: 5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.75rem;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: rgba(59, 130, 246, 0.4); }
    .card-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      font-size: 1.25rem;
    }
    .card h3 { font-size: 1.2rem; margin-bottom: 0.5rem; color: #fff; }
    .card p { font-size: 0.95rem; color: var(--text-muted); }

    .status-banner {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      background-color: #10b981;
      border-radius: 50%;
      display: inline-block;
      margin-right: 0.5rem;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    footer {
      border-top: 1px solid var(--card-border);
      padding: 2.5rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1.5rem;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    footer a { color: var(--text-muted); text-decoration: none; transition: color 0.2s; }
    footer a:hover { color: #fff; }
    .footer-links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">
      <span>StaffCaller</span>
      <span class="logo-badge">Cloud</span>
    </a>
    <nav>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <a href="/health">Health</a>
      <a href="/login" class="btn btn-outline">CRM Sign In</a>
      <a href="/superadmin" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Super Admin</a>
    </nav>
  </header>

  <main>
    <div class="status-banner">
      <div>
        <span class="status-dot"></span>
        <strong>StaffCaller Cloud Platform Active</strong> — Connected to Hostinger Cloud Infrastructure.
      </div>
      <div>
        <a href="/health" style="color: #6ee7b7; text-decoration: none; font-weight: 500;">View System Health &rarr;</a>
      </div>
    </div>

    <section class="hero">
      <h1>Automatic Call Tracking &amp; Sales CRM Platform</h1>
      <p>Seamlessly synchronize phone call recordings directly from Android agent devices. Manage leads with intelligent round-robin routing, WhatsApp Web follow-ups, and instant zero-buffering audio streaming.</p>
      <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
        <a href="/login" class="btn btn-primary">Sign In to CRM</a>
        <a href="/superadmin" class="btn btn-outline">Super Admin Portal</a>
        <a href="/llms.txt" class="btn btn-outline">API &amp; Agent Docs (llms.txt)</a>
      </div>
    </section>

    <div class="grid">
      <div class="card">
        <div class="card-icon">📞</div>
        <h3>Automatic Call Sync</h3>
        <p>Native Android companion service captures call events instantly on completion. Extracts recordings across Samsung, Pixel, Xiaomi, OnePlus, Vivo, and Oppo OEM paths.</p>
      </div>

      <div class="card">
        <div class="card-icon">⚡</div>
        <h3>HTTP Range Audio Streamer</h3>
        <p>Instant audio playback with sub-second timeline seeking. Streams securely with authenticated token verification without exhausting mobile data bandwidth.</p>
      </div>

      <div class="card">
        <div class="card-icon">🎯</div>
        <h3>Round-Robin Lead Routing</h3>
        <p>Real-time lead ingestion from Meta Ads &amp; Google Ads with automatic assignment to available agents. Excludes staff marked on leave automatically.</p>
      </div>

      <div class="card">
        <div class="card-icon">💬</div>
        <h3>WhatsApp Web Integration</h3>
        <p>Direct multi-session WhatsApp integration powered by Baileys. Send automated notifications, quick follow-ups, and client updates straight from the dashboard.</p>
      </div>

      <div class="card">
        <div class="card-icon">☁️</div>
        <h3>Dual Cloud Storage</h3>
        <p>Flexible storage pipelines supporting local Hostinger high-speed SSD disk, Cloudflare R2 zero-egress bucket, and client Google Drive synchronization.</p>
      </div>

      <div class="card">
        <div class="card-icon">📊</div>
        <h3>Team Analytics &amp; Reports</h3>
        <p>Deep call analytics: track connected call percentages, inbound vs outbound talk time, daily call volumes, and export lead databases to CSV with one click.</p>
      </div>
    </div>
  </main>

  <footer>
    <div>
      &copy; 2026 StaffCaller Cloud. Hosted on Hostinger. All rights reserved.
      <br>Contact: <a href="mailto:support@staffcaller.cloud">support@staffcaller.cloud</a> &bull; Tel: <a href="tel:+18005550199">+1 (800) 555-0199</a>
    </div>
    <div class="footer-links">
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <a href="/terms">Terms of Service</a>
      <a href="/privacy">Privacy Policy</a>
      <a href="/robots.txt">robots.txt</a>
      <a href="/sitemap.xml">sitemap.xml</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="/.well-known/mcp/server-card.json">MCP Card</a>
    </div>
  </footer>
</body>
</html>`;

function renderSimplePage(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — StaffCaller Cloud</title>
  <meta name="description" content="${title} for StaffCaller Cloud CRM.">
  <link rel="canonical" href="https://staffcaller.cloud/">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1 { margin-bottom: 1.5rem; color: #fff; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .back { margin-bottom: 2rem; display: inline-block; }
    footer { margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; color: #94a3b8; font-size: 0.9rem; }
  </style>
</head>
<body>
  <a href="/" class="back">&larr; Back to StaffCaller Home</a>
  <h1>${title}</h1>
  ${content}
  <footer>
    &copy; 2026 StaffCaller Cloud &bull; Support: <a href="mailto:support@staffcaller.cloud">support@staffcaller.cloud</a> &bull; Tel: <a href="tel:+18005550199">+1 (800) 555-0199</a>
  </footer>
</body>
</html>`;
}

// 1. Root route with Markdown negotiation & RFC 8288 Link header
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Link', '<https://staffcaller.cloud/llms.txt>; rel="alternate"; type="text/markdown"');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.headers.accept?.includes('text/markdown')) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(LLMS_TEXT);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(LANDING_PAGE_HTML);
});

// 2. robots.txt
router.get('/robots.txt', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(ROBOTS_TXT);
});

// 3. sitemap.xml
router.get('/sitemap.xml', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(SITEMAP_XML);
});

// 4. llms.txt & llms-full.txt
router.get('/llms.txt', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(LLMS_TEXT);
});

router.get('/llms-full.txt', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(LLMS_TEXT);
});

// 5. SEP-1649 MCP Server Card
router.get('/.well-known/mcp/server-card.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json(MCP_SERVER_CARD);
});

// 6. Trust anchor pages: About, Contact, Terms, Privacy
router.get('/about', (req: Request, res: Response) => {
  res.send(renderSimplePage('About StaffCaller', `
    <p>StaffCaller Cloud is an automated call intelligence and customer relationship management platform designed for enterprise sales and support teams.</p>
    <p>Our native Android companion app securely captures real-time call telemetry and audio recordings, centralizing communication records for instant analysis, compliance review, and lead acceleration.</p>
  `));
});

router.get('/contact', (req: Request, res: Response) => {
  res.send(renderSimplePage('Contact Support & Inquiries', `
    <p>We are here to assist with platform deployment, companion app configuration, and enterprise API access.</p>
    <p><strong>Primary Support Email:</strong> <a href="mailto:support@staffcaller.cloud">support@staffcaller.cloud</a></p>
    <p><strong>Phone:</strong> <a href="tel:+18005550199">+1 (800) 555-0199</a></p>
    <p><strong>Engineering & Infrastructure:</strong> Hosted on Hostinger Cloud Infrastructure.</p>
  `));
});

router.get('/terms', (req: Request, res: Response) => {
  res.send(renderSimplePage('Terms of Service', `
    <p>By accessing or using StaffCaller Cloud, you agree to comply with our acceptable use policies, including obtaining appropriate team and customer consents for recording business calls in accordance with local regulations.</p>
    <p>For questions regarding enterprise data licensing or terms, contact <a href="mailto:support@staffcaller.cloud">support@staffcaller.cloud</a>.</p>
  `));
});

router.get('/privacy', (req: Request, res: Response) => {
  res.send(renderSimplePage('Privacy Policy', `
    <p>StaffCaller Cloud values your organization's confidentiality. Call metadata, user records, and audio synchronizations are encrypted and stored solely within your configured database and cloud storage buckets.</p>
    <p>We do not sell personal or proprietary business communication records to third parties. For privacy inquiries, contact <a href="mailto:support@staffcaller.cloud">support@staffcaller.cloud</a>.</p>
  `));
});

// 7. Static Next.js chunks & public assets
router.use('/_next', (req: Request, res: Response, next) => {
  const nextPath = getPublicPath('_next');
  if (nextPath) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return express.static(nextPath)(req, res, next);
  }
  next();
});

router.use('/downloads', (req: Request, res: Response, next) => {
  const dlPath = getPublicPath('downloads');
  if (dlPath) {
    return express.static(dlPath)(req, res, next);
  }
  next();
});

// 8. Super Admin Portal & Next.js React App routes
router.get(['/superadmin/login', '/superadmin/login/'], (req: Request, res: Response) => {
  const loginPath = getPublicPath('superadmin/login/index.html');
  if (loginPath) {
    return res.sendFile(loginPath);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderSuperAdminPage());
});

router.get(['/superadmin', '/superadmin/'], (req: Request, res: Response) => {
  const indexPath = getPublicPath('superadmin/index.html');
  if (indexPath) {
    return res.sendFile(indexPath);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderSuperAdminPage());
});

router.get('/superadmin/:section*', (req: Request, res: Response) => {
  const section = req.params.section;
  const sectionPath = getPublicPath(`superadmin/${section}/index.html`);
  if (sectionPath) {
    return res.sendFile(sectionPath);
  }
  const fallback = getPublicPath('superadmin/index.html');
  if (fallback) {
    return res.sendFile(fallback);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderSuperAdminPage());
});

// 9. Tenant CRM Portal & Next.js React Dashboard routes
router.get(['/login', '/login/'], (req: Request, res: Response) => {
  const loginPath = getPublicPath('login/index.html');
  if (loginPath) {
    return res.sendFile(loginPath);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLoginPage());
});

router.get(['/register', '/register/'], (req: Request, res: Response) => {
  const regPath = getPublicPath('register/index.html');
  if (regPath) {
    return res.sendFile(regPath);
  }
  res.redirect('/login');
});

router.get(['/dashboard', '/dashboard/'], (req: Request, res: Response) => {
  const dashPath = getPublicPath('dashboard/index.html');
  if (dashPath) {
    return res.sendFile(dashPath);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLoginPage());
});

router.get('/dashboard/:section*', (req: Request, res: Response) => {
  const section = req.params.section;
  const sectionPath = getPublicPath(`dashboard/${section}/index.html`);
  if (sectionPath) {
    return res.sendFile(sectionPath);
  }
  const fallback = getPublicPath('dashboard/index.html');
  if (fallback) {
    return res.sendFile(fallback);
  }
  res.redirect('/dashboard');
});

router.get('/forms/:slug', (req: Request, res: Response) => {
  const formPath = getPublicPath('forms/default/index.html');
  if (formPath) {
    return res.sendFile(formPath);
  }
  res.redirect('/');
});

function renderSuperAdminPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Super Admin Portal — StaffCaller Cloud</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛡️</text></svg>">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(17, 24, 39, 0.9);
      --border: rgba(255, 255, 255, 0.1);
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; line-height: 1.5; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 2rem; border-bottom: 1px solid var(--border); }
    .logo { font-size: 1.2rem; font-weight: 700; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 0.5rem; }
    .badge { font-size: 0.75rem; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 600; }
    .nav-links a { color: var(--text-muted); text-decoration: none; margin-left: 1rem; font-size: 0.85rem; }
    .nav-links a:hover { color: #fff; }
    .container { max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; width: 100%; flex: 1; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); backdrop-filter: blur(12px); }
    .card-header { margin-bottom: 1.5rem; }
    .card-title { font-size: 1.4rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem; }
    .card-desc { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }
    .form-group { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem; }
    input { width: 100%; padding: 0.75rem 1rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 0.5rem; color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: var(--primary); }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem 1.5rem; background: var(--primary); color: #fff; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: background 0.2s; text-decoration: none; }
    .btn:hover { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn-outline:hover { background: rgba(255,255,255,0.05); }
    .btn-danger { background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.3); }
    .alert { padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.85rem; margin-bottom: 1.25rem; display: none; }
    .alert-error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
    .alert-success { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #6ee7b7; }
    .hint-box { background: rgba(255,255,255,0.03); border: 1px dashed var(--border); border-radius: 0.5rem; padding: 1rem; margin-top: 1.25rem; font-size: 0.8rem; color: var(--text-muted); }
    .hint-box code { color: #60a5fa; font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.15rem 0.35rem; border-radius: 0.25rem; font-size: 0.85rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.25rem; }
    .stat-val { font-size: 1.8rem; font-weight: 700; color: #fff; margin-top: 0.25rem; }
    .stat-lbl { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.75rem; }
    .status-pill { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .pill-active { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3); }
    .pill-trial { background: rgba(234, 179, 8, 0.15); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.3); }
    footer { border-top: 1px solid var(--border); padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
    footer a { color: var(--primary); text-decoration: none; }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">
      <span>🛡️ StaffCaller</span>
      <span class="badge">Root Governance</span>
    </a>
    <div class="nav-links">
      <a href="/">&larr; Public Site</a>
      <a href="/login">Tenant CRM Login</a>
      <a href="/health">Health</a>
    </div>
  </header>

  <div class="container">
    <!-- 1. LOGIN VIEW -->
    <div id="loginSection" class="card" style="max-width: 480px; margin: 2rem auto;">
      <div class="card-header">
        <h2 class="card-title">Super Admin Sign In</h2>
        <p class="card-desc">SaaS Platform Control &amp; Tenant Management</p>
      </div>

      <div id="loginAlert" class="alert"></div>

      <form id="loginForm" onsubmit="handleSuperAdminLogin(event)">
        <div class="form-group">
          <label for="adminEmail">Master Admin Email</label>
          <input type="email" id="adminEmail" required value="admin@crmlead.com" autocomplete="email">
        </div>

        <div class="form-group">
          <label for="adminPassword">Master Password</label>
          <input type="password" id="adminPassword" required value="SuperAdmin@123" autocomplete="current-password">
        </div>

        <button type="submit" id="loginBtn" class="btn">
          <span>Authenticate Root Access &rarr;</span>
        </button>
      </form>

      <div class="hint-box">
        <strong>Default Platform Credentials:</strong><br>
        Email: <code>admin@crmlead.com</code><br>
        Password: <code>SuperAdmin@123</code><br>
        <button type="button" onclick="fillAdminCreds()" class="btn btn-outline" style="margin-top: 0.6rem; padding: 0.4rem; font-size: 0.8rem;">Auto-Fill Super Admin Credentials</button>
      </div>
    </div>

    <!-- 2. DASHBOARD VIEW (Shown when token is valid) -->
    <div id="dashboardSection" style="display: none;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 700;">SaaS Platform Dashboard</h1>
          <p id="adminBadge" style="color: var(--text-muted); font-size: 0.9rem;">Authenticated as: <strong id="adminEmailDisplay" style="color: #60a5fa;"></strong></p>
        </div>
        <div>
          <button onclick="handleSuperAdminLogout()" class="btn btn-danger" style="width: auto; padding: 0.5rem 1.25rem;">Sign Out</button>
        </div>
      </div>

      <div id="statsGrid" class="stats-grid">
        <div class="stat-card">
          <div class="stat-lbl">Total Organizations</div>
          <div id="statOrgs" class="stat-val">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Active Tenants</div>
          <div id="statActiveOrgs" class="stat-val" style="color: #6ee7b7;">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Total Users</div>
          <div id="statUsers" class="stat-val">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Calls Tracked</div>
          <div id="statCalls" class="stat-val" style="color: #93c5fd;">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Leads Ingested</div>
          <div id="statLeads" class="stat-val">-</div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem;">Managed Tenant Organizations</h3>
        <div style="overflow-x: auto;">
          <table id="orgsTable">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody id="orgsTableBody">
              <tr><td colspan="4" style="color: var(--text-muted); text-align: center;">Loading organizations...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">Hostinger Infrastructure Diagnostics</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">MySQL database connected on Hostinger Cloud &bull; LiteSpeed Server Active</p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="/health" target="_blank" class="btn btn-outline" style="width: auto; padding: 0.5rem 1rem; font-size: 0.85rem;">View /health Endpoint</a>
          <a href="/llms.txt" target="_blank" class="btn btn-outline" style="width: auto; padding: 0.5rem 1rem; font-size: 0.85rem;">View /llms.txt</a>
          <a href="/api/v1/superadmin/setup" target="_blank" class="btn btn-outline" style="width: auto; padding: 0.5rem 1rem; font-size: 0.85rem;">Database Sync Status</a>
        </div>
      </div>
    </div>
  </div>

  <footer>
    &copy; 2026 StaffCaller Cloud &bull; Internal Platform Administration
  </footer>

  <script>
    function fillAdminCreds() {
      document.getElementById('adminEmail').value = 'admin@crmlead.com';
      document.getElementById('adminPassword').value = 'SuperAdmin@123';
    }

    async function handleSuperAdminLogin(e) {
      e.preventDefault();
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;
      const btn = document.getElementById('loginBtn');
      const alert = document.getElementById('loginAlert');

      btn.disabled = true;
      btn.innerHTML = '<span>Verifying credentials...</span>';
      alert.style.display = 'none';

      try {
        const res = await fetch('/api/v1/superadmin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Authentication failed');
        }

        localStorage.setItem('saas_token', data.token);
        if (data.admin) {
          localStorage.setItem('saas_admin', JSON.stringify(data.admin));
        }

        checkAuthAndLoad();
      } catch (err) {
        alert.className = 'alert alert-error';
        alert.textContent = err.message;
        alert.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Authenticate Root Access &rarr;</span>';
      }
    }

    function handleSuperAdminLogout() {
      localStorage.removeItem('saas_token');
      localStorage.removeItem('saas_admin');
      checkAuthAndLoad();
    }

    async function checkAuthAndLoad() {
      const token = localStorage.getItem('saas_token');
      const loginSec = document.getElementById('loginSection');
      const dashSec = document.getElementById('dashboardSection');

      if (!token) {
        loginSec.style.display = 'block';
        dashSec.style.display = 'none';
        return;
      }

      loginSec.style.display = 'none';
      dashSec.style.display = 'block';

      const admin = JSON.parse(localStorage.getItem('saas_admin') || '{}');
      document.getElementById('adminEmailDisplay').textContent = admin.email || 'admin@crmlead.com';

      try {
        const statsRes = await fetch('/api/v1/superadmin/dashboard/stats', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (statsRes.status === 401 || statsRes.status === 403) {
          handleSuperAdminLogout();
          return;
        }
        const data = await statsRes.json();
        document.getElementById('statOrgs').textContent = data.totalOrgs ?? 1;
        document.getElementById('statActiveOrgs').textContent = data.activeOrgs ?? 1;
        document.getElementById('statUsers').textContent = data.totalUsers ?? 1;
        document.getElementById('statCalls').textContent = data.totalCalls ?? 0;
        document.getElementById('statLeads').textContent = data.totalLeads ?? 0;

        const orgsRes = await fetch('/api/v1/superadmin/organizations?page=1&limit=10', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const orgsData = await orgsRes.json();
        if (orgsData.organizations && orgsData.organizations.length > 0) {
          const tbody = document.getElementById('orgsTableBody');
          tbody.innerHTML = orgsData.organizations.map(o => \`
            <tr>
              <td><strong>\${o.name}</strong></td>
              <td><code>\${o.slug}</code></td>
              <td><span class="status-pill pill-active">\${o.orgStatus}</span></td>
              <td style="color: var(--text-muted);">\${new Date(o.createdAt).toLocaleDateString()}</td>
            </tr>
          \`).join('');
        }
      } catch (e) {
        console.warn('Dashboard fetch failed:', e);
      }
    }

    window.addEventListener('DOMContentLoaded', checkAuthAndLoad);
  </script>
</body>
</html>`;
}

function renderLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>StaffCaller CRM — Workspace Sign In</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📞</text></svg>">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(17, 24, 39, 0.9);
      --border: rgba(255, 255, 255, 0.1);
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; line-height: 1.5; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 2rem; border-bottom: 1px solid var(--border); }
    .logo { font-size: 1.2rem; font-weight: 700; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 0.5rem; }
    .badge { font-size: 0.75rem; background: rgba(37, 99, 235, 0.15); color: #93c5fd; border: 1px solid rgba(37, 99, 235, 0.3); padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 600; }
    .nav-links a { color: var(--text-muted); text-decoration: none; margin-left: 1rem; font-size: 0.85rem; }
    .nav-links a:hover { color: #fff; }
    .container { max-width: 800px; margin: 2rem auto; padding: 0 1.5rem; width: 100%; flex: 1; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); backdrop-filter: blur(12px); }
    .card-header { margin-bottom: 1.5rem; }
    .card-title { font-size: 1.4rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem; }
    .card-desc { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }
    .form-group { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem; }
    input { width: 100%; padding: 0.75rem 1rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 0.5rem; color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: var(--primary); }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem 1.5rem; background: var(--primary); color: #fff; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: background 0.2s; text-decoration: none; }
    .btn:hover { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn-outline:hover { background: rgba(255,255,255,0.05); }
    .btn-danger { background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; }
    .alert { padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.85rem; margin-bottom: 1.25rem; display: none; }
    .alert-error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
    .hint-box { background: rgba(255,255,255,0.03); border: 1px dashed var(--border); border-radius: 0.5rem; padding: 1rem; margin-top: 1.25rem; font-size: 0.8rem; color: var(--text-muted); }
    .hint-box code { color: #60a5fa; font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.15rem 0.35rem; border-radius: 0.25rem; font-size: 0.85rem; }
    footer { border-top: 1px solid var(--border); padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
    footer a { color: var(--primary); text-decoration: none; }
    .info-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    .info-lbl { color: var(--text-muted); }
    .info-val { font-weight: 600; color: #fff; }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">
      <span>📞 StaffCaller</span>
      <span class="badge">Sales CRM</span>
    </a>
    <div class="nav-links">
      <a href="/">&larr; Public Site</a>
      <a href="/superadmin">Super Admin</a>
      <a href="/health">Health</a>
    </div>
  </header>

  <div class="container">
    <!-- 1. LOGIN VIEW -->
    <div id="loginSection" class="card" style="max-width: 480px; margin: 2rem auto;">
      <div class="card-header">
        <h2 class="card-title">Tenant CRM Sign In</h2>
        <p class="card-desc">Sign in to your organization workspace</p>
      </div>

      <div id="loginAlert" class="alert"></div>

      <form id="loginForm" onsubmit="handleTenantLogin(event)">
        <div class="form-group">
          <label for="tenantEmail">Work Email</label>
          <input type="email" id="tenantEmail" required value="yolopment@gmail.com" autocomplete="email">
        </div>

        <div class="form-group">
          <label for="tenantPassword">Password</label>
          <input type="password" id="tenantPassword" required value="admin123" autocomplete="current-password">
        </div>

        <button type="submit" id="loginBtn" class="btn">
          <span>Sign In to CRM &rarr;</span>
        </button>
      </form>

      <div class="hint-box">
        <strong>Default Tenant Admin:</strong><br>
        Email: <code>yolopment@gmail.com</code><br>
        Password: <code>admin123</code><br>
        <button type="button" onclick="fillTenantCreds()" class="btn btn-outline" style="margin-top: 0.6rem; padding: 0.4rem; font-size: 0.8rem;">Auto-Fill Tenant Credentials</button>
      </div>
    </div>

    <!-- 2. WORKSPACE OVERVIEW (Shown when logged in) -->
    <div id="workspaceSection" class="card" style="display: none; max-width: 600px; margin: 2rem auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <div>
          <h2 class="card-title">Workspace Session Active</h2>
          <p class="card-desc">Logged in to Tenant CRM</p>
        </div>
        <button onclick="handleTenantLogout()" class="btn btn-danger" style="width: auto; padding: 0.5rem 1rem;">Sign Out</button>
      </div>

      <div class="info-row">
        <span class="info-lbl">Organization</span>
        <span id="wsOrg" class="info-val">YOLOPMENT PRIVATE LIMITED</span>
      </div>
      <div class="info-row">
        <span class="info-lbl">Admin User</span>
        <span id="wsUser" class="info-val">AFTAB SEKH</span>
      </div>
      <div class="info-row">
        <span class="info-lbl">Email</span>
        <span id="wsEmail" class="info-val">yolopment@gmail.com</span>
      </div>
      <div class="info-row">
        <span class="info-lbl">Role</span>
        <span class="info-val" style="color: #6ee7b7;">ORGANIZATION ADMIN</span>
      </div>
      <div class="info-row">
        <span class="info-lbl">Android Device Pairing Token</span>
        <span id="wsToken" class="info-val" style="font-family: monospace; color: #93c5fd;">c89fae019b88231c</span>
      </div>

      <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <a href="/superadmin" class="btn btn-outline" style="flex: 1;">Open Super Admin Portal</a>
        <a href="/" class="btn btn-outline" style="flex: 1;">Platform Home</a>
      </div>
    </div>
  </div>

  <footer>
    &copy; 2026 StaffCaller Cloud &bull; <a href="/superadmin">Super Admin Portal</a>
  </footer>

  <script>
    function fillTenantCreds() {
      document.getElementById('tenantEmail').value = 'yolopment@gmail.com';
      document.getElementById('tenantPassword').value = 'admin123';
    }

    async function handleTenantLogin(e) {
      e.preventDefault();
      const email = document.getElementById('tenantEmail').value.trim();
      const password = document.getElementById('tenantPassword').value;
      const btn = document.getElementById('loginBtn');
      const alert = document.getElementById('loginAlert');

      btn.disabled = true;
      btn.innerHTML = '<span>Signing in...</span>';
      alert.style.display = 'none';

      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem('crm_token', data.token);
        if (data.user) {
          localStorage.setItem('crm_user', JSON.stringify(data.user));
        }
        if (data.organization) {
          localStorage.setItem('crm_org', JSON.stringify(data.organization));
        }

        checkTenantAuth();
      } catch (err) {
        alert.className = 'alert alert-error';
        alert.textContent = err.message;
        alert.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to CRM &rarr;</span>';
      }
    }

    function handleTenantLogout() {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      localStorage.removeItem('crm_org');
      checkTenantAuth();
    }

    function checkTenantAuth() {
      const token = localStorage.getItem('crm_token');
      const loginSec = document.getElementById('loginSection');
      const wsSec = document.getElementById('workspaceSection');

      if (!token) {
        loginSec.style.display = 'block';
        wsSec.style.display = 'none';
        return;
      }

      loginSec.style.display = 'none';
      wsSec.style.display = 'block';

      const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
      const org = JSON.parse(localStorage.getItem('crm_org') || '{}');

      if (user.name) document.getElementById('wsUser').textContent = user.name;
      if (user.email) document.getElementById('wsEmail').textContent = user.email;
      if (user.deviceToken) document.getElementById('wsToken').textContent = user.deviceToken;
      if (org.name) document.getElementById('wsOrg').textContent = org.name;
    }

    window.addEventListener('DOMContentLoaded', checkTenantAuth);
  </script>
</body>
</html>`;
}

export default router;
