# N8N Marketing Hub - AI-Powered Marketing Automation Platform

N8N Marketing Hub is a comprehensive marketing automation system with AI-powered content generation, campaign orchestration, and competitive intelligence. Built as an MCP (Model Context Protocol) server for seamless Claude integration.

## Features

- **Marketing Intelligence Dashboard**: Real-time campaign analytics and optimization
- **Advanced Lead Qualification**: AI-powered lead scoring and segmentation  
- **Attribution Modeling**: Multi-touch attribution across marketing channels
- **Behavioral Analysis**: Customer journey mapping and behavior prediction
- **Email Marketing Automation**: Intelligent email sequences and personalization
- **Social Media Automation**: Cross-platform content scheduling and engagement
- **Predictive Modeling**: Marketing performance forecasting and optimization
- **Google My Business Hub**: GMB optimization and Q&A automation

## Architecture

### MCP Marketing Server
- **Server**: `8n8-marketing-server.ts` - Main MCP server providing unlimited marketing automation tools
- **Modules**: 10+ specialized marketing modules for different automation needs
- **Integrations**: Stripe, HubSpot, MailChimp, Facebook Business SDK, Google Ads API, LinkedIn API

### GMB Expert Hub
- **Frontend**: Google My Business Q&A and course platform
- **Backend**: Express.js API with OpenAI integration
- **Features**: Automated Q&A responses, GMB optimization tools, training courses

## Tech Stack

- **MCP Server**: TypeScript, Node.js, OpenAI, Multiple Marketing APIs
- **GMB Hub**: Express.js, OpenAI, SQLite3, Puppeteer, Redis
- **Marketing Integrations**: 15+ marketing platform APIs
- **AI**: OpenAI GPT-4 for content generation and analysis

## Quick Start

### MCP Marketing Server

```bash
cd mcp-server
npm install
npm run build
npm start
```

### GMB Expert Hub

```bash
cd gmb-website/backend
npm install
npm start
```

## Environment Variables

```env
OPENAI_API_KEY="sk-..."
STRIPE_SECRET_KEY="sk_..."
HUBSPOT_ACCESS_TOKEN="..."
MAILCHIMP_API_KEY="..."
FACEBOOK_ACCESS_TOKEN="..."
GOOGLE_ADS_DEVELOPER_TOKEN="..."
LINKEDIN_ACCESS_TOKEN="..."
```

## Modules

### Core Marketing Modules
- **Advanced Lead Qualification**: AI-powered lead scoring
- **Attribution Modeling**: Multi-touch attribution analysis
- **Behavioral Analysis**: Customer behavior prediction
- **Email Marketing**: Automated email sequences
- **Lead Intelligence**: Comprehensive lead research
- **Market Intelligence**: Competitive analysis
- **Marketing Intelligence Dashboard**: Campaign analytics
- **Predictive Modeling**: Performance forecasting
- **Real-time Optimization**: Dynamic campaign adjustment
- **Social Automation**: Multi-platform social media management

## Deployment

Recommended deployment: **Cloudflare Workers** for serverless marketing automation at global scale.

## License

MIT License