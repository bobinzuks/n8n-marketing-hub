#!/bin/bash

# N8N Marketing Hub - Cloudflare Deployment Script
echo "🚀 Starting N8N Marketing Hub Deployment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Login to Cloudflare (will open browser)
echo "🔐 Logging into Cloudflare..."
wrangler login

# Create KV namespace for marketing data
echo "💾 Creating Marketing KV namespace..."
wrangler kv:namespace create MARKETING_CACHE
wrangler kv:namespace create MARKETING_CACHE --preview

# Set environment secrets for marketing APIs
echo "🔑 Setting up marketing API secrets..."
echo "Please enter your OpenAI API key:"
wrangler secret put OPENAI_API_KEY

echo "Please enter your Stripe secret key:"
wrangler secret put STRIPE_SECRET_KEY

echo "Please enter your HubSpot access token:"
wrangler secret put HUBSPOT_ACCESS_TOKEN

echo "Please enter your MailChimp API key:"
wrangler secret put MAILCHIMP_API_KEY

echo "Please enter your Facebook access token:"
wrangler secret put FACEBOOK_ACCESS_TOKEN

echo "Please enter your Google Ads developer token:"
wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN

echo "Please enter your LinkedIn access token:"
wrangler secret put LINKEDIN_ACCESS_TOKEN

# Deploy MCP server
echo "🚀 Deploying MCP Marketing Server..."
cd marketing/mcp-server
npm install
npm run build
wrangler deploy

# Deploy GMB website
echo "🌐 Deploying GMB Expert Hub..."
cd ../gmb-website
wrangler pages deploy . --project-name=gmb-expert-hub

# Set up subdomain
echo "🔗 Setting up marketing subdomain..."
wrangler custom-domains add marketing.gsurveyai.com
wrangler custom-domains add gmb.gsurveyai.com

echo "✅ Marketing Hub deployment complete!"
echo "🌍 Your marketing tools will be available at:"
echo "   - https://marketing.gsurveyai.com"
echo "   - https://gmb.gsurveyai.com"
echo ""
echo "📊 Monitor deployment at: https://dash.cloudflare.com"