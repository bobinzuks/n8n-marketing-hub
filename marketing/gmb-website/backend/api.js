/**
 * GMB Expert Hub Backend API
 * Handles questions, AI responses, course management, and analytics
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OpenAI } = require('openai');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Database setup
const db = new sqlite3.Database('gmb_expert_hub.db');

// Initialize database tables
db.serialize(() => {
  // Questions table
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    email TEXT NOT NULL,
    business_type TEXT NOT NULL,
    question_category TEXT NOT NULL,
    question TEXT NOT NULL,
    urgency TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    ai_answer TEXT,
    expert_answer TEXT,
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    answered_at DATETIME,
    helpful_votes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0
  )`);
  
  // Course progress table
  db.run(`CREATE TABLE IF NOT EXISTS course_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    course_id TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  )`);
  
  // Analytics table
  db.run(`CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    event_data TEXT,
    user_ip TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Knowledge base table
  db.run(`CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT,
    views INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// File upload setup
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Email transporter setup
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Routes

// Analytics tracking
app.post('/api/analytics/track', (req, res) => {
  const { event_type, event_data } = req.body;
  const user_ip = req.ip;
  const user_agent = req.headers['user-agent'];
  
  db.run(
    'INSERT INTO analytics (event_type, event_data, user_ip, user_agent) VALUES (?, ?, ?, ?)',
    [event_type, JSON.stringify(event_data), user_ip, user_agent],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to track analytics' });
      }
      res.json({ success: true });
    }
  );
});

// Search questions and knowledge base
app.post('/api/search', async (req, res) => {
  try {
    const { query, category, limit = 10 } = req.body;
    
    // Search in knowledge base first
    const searchPromise = new Promise((resolve, reject) => {
      let sql = `
        SELECT id, title, content, category, helpful_votes, views 
        FROM knowledge_base 
        WHERE title LIKE ? OR content LIKE ?
      `;
      const params = [`%${query}%`, `%${query}%`];
      
      if (category && category !== 'all') {
        sql += ' AND category = ?';
        params.push(category);
      }
      
      sql += ' ORDER BY helpful_votes DESC, views DESC LIMIT ?';
      params.push(limit);
      
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const dbResults = await searchPromise;
    
    // If no results found in DB, use AI to generate helpful answer
    if (dbResults.length === 0) {
      const aiAnswer = await generateAIAnswer(query, category);
      return res.json({
        results: [{
          id: 'ai-generated',
          title: `AI Answer: ${query}`,
          content: aiAnswer,
          category: 'AI Generated',
          helpful_votes: 0,
          views: 0,
          is_ai_generated: true
        }],
        source: 'ai'
      });
    }
    
    // Update view counts
    dbResults.forEach(result => {
      db.run('UPDATE knowledge_base SET views = views + 1 WHERE id = ?', [result.id]);
    });
    
    res.json({
      results: dbResults,
      source: 'database'
    });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Generate AI answer for GMB questions
async function generateAIAnswer(query, category = '') {
  const prompt = `
    You are a Google My Business expert providing helpful answers to local business owners.
    
    Question: "${query}"
    Category: ${category}
    
    Provide a comprehensive, accurate answer that:
    1. Directly addresses the question
    2. Includes step-by-step instructions when relevant
    3. Mentions any Google policy considerations
    4. Offers practical tips and best practices
    5. Stays current with Google My Business features
    6. Is written in a helpful, professional tone
    
    Keep the answer between 200-400 words and structure it clearly.
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('AI answer generation error:', error);
    return "I'm sorry, I'm having trouble generating an answer right now. Please try again later or contact our support team for assistance.";
  }
}

// Submit new question
app.post('/api/questions', async (req, res) => {
  try {
    const {
      business_name,
      email,
      business_type,
      question_category,
      question,
      urgency = 'medium'
    } = req.body;
    
    // Validate required fields
    if (!business_name || !email || !business_type || !question_category || !question) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Generate AI answer immediately
    const ai_answer = await generateAIAnswer(question, question_category);
    
    // Insert question into database
    db.run(
      `INSERT INTO questions 
       (business_name, email, business_type, question_category, question, urgency, ai_answer, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'answered')`,
      [business_name, email, business_type, question_category, question, urgency, ai_answer],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to submit question' });
        }
        
        const questionId = this.lastID;
        
        // Send email notification to user
        sendQuestionConfirmation(email, business_name, question, ai_answer);
        
        // If urgent, notify support team
        if (urgency === 'urgent' || urgency === 'high') {
          notifySupportTeam(questionId, business_name, question, urgency);
        }
        
        res.json({
          success: true,
          question_id: questionId,
          ai_answer: ai_answer,
          message: 'Question submitted successfully. You will receive an email with the answer shortly.'
        });
      }
    );
    
  } catch (error) {
    console.error('Question submission error:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

// Get popular questions
app.get('/api/questions/popular', (req, res) => {
  const limit = req.query.limit || 10;
  
  db.all(
    `SELECT id, question_category, question, ai_answer, helpful_votes, views, created_at 
     FROM questions 
     WHERE is_public = 1 AND ai_answer IS NOT NULL 
     ORDER BY helpful_votes DESC, views DESC 
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch popular questions' });
      }
      res.json(rows);
    }
  );
});

// Vote on question helpfulness
app.post('/api/questions/:id/vote', (req, res) => {
  const questionId = req.params.id;
  const { vote_type } = req.body; // 'helpful' or 'not_helpful'
  
  if (vote_type === 'helpful') {
    db.run(
      'UPDATE questions SET helpful_votes = helpful_votes + 1 WHERE id = ?',
      [questionId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to record vote' });
        }
        res.json({ success: true, message: 'Thank you for your feedback!' });
      }
    );
  } else {
    res.json({ success: true, message: 'Thank you for your feedback!' });
  }
});

// Course management
app.get('/api/courses', (req, res) => {
  const courses = [
    {
      id: 'gmb-fundamentals',
      title: 'Google My Business Fundamentals',
      description: 'Learn the basics of setting up and optimizing your Google My Business listing',
      level: 'Beginner',
      duration: '2 hours',
      modules: [
        'Introduction to Google My Business',
        'Setting Up Your Business Profile',
        'Verification Process',
        'Basic Optimization Techniques',
        'Understanding GMB Insights'
      ],
      free: true
    },
    {
      id: 'advanced-gmb-optimization',
      title: 'Advanced GMB Optimization',
      description: 'Master advanced techniques for local SEO and Google My Business features',
      level: 'Intermediate',
      duration: '3 hours',
      modules: [
        'Advanced Local SEO Strategies',
        'GMB Posts and Updates',
        'Q&A Management',
        'Photo and Video Optimization',
        'Local Citation Building'
      ],
      free: true
    },
    {
      id: 'gmb-compliance-policy',
      title: 'GMB Compliance & Policy',
      description: 'Stay compliant with Google policies and avoid suspensions',
      level: 'Advanced',
      duration: '1.5 hours',
      modules: [
        'Understanding Google Guidelines',
        'Common Policy Violations',
        'Suspension Prevention',
        'Recovery Strategies',
        'Quality Guidelines Compliance'
      ],
      free: true
    },
    {
      id: 'review-management-mastery',
      title: 'Review Management Mastery',
      description: 'Ethical strategies to generate and manage customer reviews',
      level: 'Intermediate',
      duration: '2.5 hours',
      modules: [
        'Review Acquisition Strategies',
        'Professional Response Techniques',
        'Handling Negative Reviews',
        'Review Policy Compliance',
        'Automation and Tools'
      ],
      free: true
    }
  ];
  
  res.json(courses);
});

// Track course progress
app.post('/api/courses/:courseId/progress', (req, res) => {
  const { courseId } = req.params;
  const { email, progress, completed = false } = req.body;
  
  db.run(
    `INSERT OR REPLACE INTO course_progress 
     (user_email, course_id, progress, completed) 
     VALUES (?, ?, ?, ?)`,
    [email, courseId, progress, completed],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to track progress' });
      }
      res.json({ success: true });
    }
  );
});

// Get user's course progress
app.get('/api/courses/progress/:email', (req, res) => {
  const { email } = req.params;
  
  db.all(
    'SELECT course_id, progress, completed, started_at, completed_at FROM course_progress WHERE user_email = ?',
    [email],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch progress' });
      }
      res.json(rows);
    }
  );
});

// Email notification functions
async function sendQuestionConfirmation(email, businessName, question, aiAnswer) {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Your GMB Question Has Been Answered - GMB Expert Hub',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4285f4 0%, #34a853 100%); color: white; padding: 20px; text-align: center;">
          <h1>GMB Expert Hub</h1>
          <p>Your Google My Business question has been answered!</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Hello ${businessName}!</h2>
          <p>Thank you for your question. Our AI expert has provided a detailed answer below:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #4285f4;">Your Question:</h3>
            <p style="font-style: italic; color: #666;">"${question}"</p>
            
            <h3 style="color: #34a853;">Expert Answer:</h3>
            <div style="line-height: 1.6; color: #333;">
              ${aiAnswer.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <p>If you need additional clarification or have follow-up questions, feel free to visit our website and submit another question.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://gmbexpert.customerhappy.ai" style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Visit GMB Expert Hub</a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This answer was generated by our AI expert system. For complex issues, our human experts may provide additional insights within 24-48 hours.
          </p>
        </div>
        
        <div style="background: #333; color: white; padding: 20px; text-align: center;">
          <p>&copy; 2024 GMB Expert Hub - Powered by CustomerHappy AI</p>
        </div>
      </div>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent successfully');
  } catch (error) {
    console.error('Email sending error:', error);
  }
}

async function notifySupportTeam(questionId, businessName, question, urgency) {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: process.env.SUPPORT_EMAIL || 'support@customerhappy.ai',
    subject: `${urgency.toUpperCase()} Priority GMB Question - ID: ${questionId}`,
    html: `
      <h2>High Priority GMB Question Received</h2>
      <p><strong>Question ID:</strong> ${questionId}</p>
      <p><strong>Business:</strong> ${businessName}</p>
      <p><strong>Urgency:</strong> ${urgency}</p>
      <p><strong>Question:</strong></p>
      <blockquote>${question}</blockquote>
      <p>Please review and provide expert follow-up if needed.</p>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log('Support team notified successfully');
  } catch (error) {
    console.error('Support notification error:', error);
  }
}

// Lead generation and customer pipeline
app.post('/api/leads/capture', (req, res) => {
  const {
    email,
    business_name,
    business_type,
    source,
    interest_level,
    additional_data
  } = req.body;
  
  // Here you would integrate with CustomerHappy's main CRM
  // For now, we'll log it and send to email marketing
  
  console.log('Lead captured:', {
    email,
    business_name,
    business_type,
    source,
    interest_level
  });
  
  // Send to CustomerHappy lead qualification system
  // This would trigger email sequences and potentially sales outreach
  
  res.json({ success: true, message: 'Lead captured successfully' });
});

// Admin endpoints (would require authentication in production)
app.get('/api/admin/analytics', (req, res) => {
  const timeframe = req.query.timeframe || '30d';
  
  // Get analytics data
  db.all(
    `SELECT 
       DATE(created_at) as date,
       event_type,
       COUNT(*) as count
     FROM analytics 
     WHERE created_at >= datetime('now', '-${timeframe}')
     GROUP BY DATE(created_at), event_type
     ORDER BY date DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch analytics' });
      }
      res.json(rows);
    }
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`GMB Expert Hub API server running on port ${PORT}`);
  
  // Initialize some sample knowledge base entries
  initializeKnowledgeBase();
});

// Initialize knowledge base with common GMB questions
function initializeKnowledgeBase() {
  const sampleEntries = [
    {
      title: "How to verify Google My Business listing",
      content: "To verify your Google My Business listing: 1) Sign in to your GMB account, 2) Select your business, 3) Click 'Verify now', 4) Choose verification method (postcard, phone, email), 5) Complete the verification process. Verification typically takes 1-7 business days.",
      category: "Setup & Verification",
      tags: "verification,setup,gmb"
    },
    {
      title: "Google My Business listing suspended - how to recover",
      content: "If your GMB listing is suspended: 1) Identify the policy violation, 2) Fix the issue (business name, address, categories), 3) Submit a reinstatement request, 4) Wait for Google's review. Common violations include keyword stuffing, fake reviews, or ineligible business types.",
      category: "Policy & Compliance",
      tags: "suspension,policy,recovery"
    },
    {
      title: "How to get more Google reviews ethically",
      content: "Increase Google reviews by: 1) Asking satisfied customers directly, 2) Sending follow-up emails with review links, 3) Using QR codes in-store, 4) Providing excellent service, 5) Making the review process easy, 6) Responding to all reviews professionally. Never buy fake reviews or incentivize only positive reviews.",
      category: "Review Management",
      tags: "reviews,customers,ethics"
    }
  ];
  
  sampleEntries.forEach(entry => {
    db.run(
      'INSERT OR IGNORE INTO knowledge_base (title, content, category, tags) VALUES (?, ?, ?, ?)',
      [entry.title, entry.content, entry.category, entry.tags]
    );
  });
}

module.exports = app;