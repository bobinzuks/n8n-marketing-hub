# N8N Marketing Hub - Cloudflare Deployment Guide

## Prerequisites
1. Install Wrangler CLI: `npm install -g wrangler`
2. Authenticate: `wrangler login`
3. Purchase domain: `n8nmarketing.com` (recommended)

## Setup
```bash
# Create KV namespace for caching
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview

# Update wrangler.toml with returned namespace IDs
```

## Environment Variables
```bash
# Set marketing API secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put HUBSPOT_ACCESS_TOKEN
wrangler secret put MAILCHIMP_API_KEY
wrangler secret put FACEBOOK_ACCESS_TOKEN
wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN
wrangler secret put LINKEDIN_ACCESS_TOKEN
```

## Deploy to Production
```bash
# Build and deploy MCP server
cd marketing/mcp-server
npm run build
wrangler deploy

# Deploy GMB website
cd ../gmb-website
wrangler pages deploy . --project-name=gmb-expert-hub

# Add custom domain (after purchasing)
wrangler custom-domains add n8nmarketing.com
```

## Post-Deployment
- Configure marketing API integrations
- Set up webhook endpoints
- Test MCP server connectivity
- Verify all marketing modules