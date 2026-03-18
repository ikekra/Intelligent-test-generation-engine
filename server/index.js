import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import OpenAI from 'openai'
import { createTwoFilesPatch } from 'diff'
import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 5174
const maxOutputTokens = 1800

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' http://localhost:5174 http://localhost:5173 ws://localhost:5173; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
  )
  next()
})

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end()
})

const workspaceRoot = process.cwd()
const uploadsDir = path.join(workspaceRoot, 'uploads')
const exportsDir = path.join(workspaceRoot, 'exports')

await fs.mkdir(uploadsDir, { recursive: true })
await fs.mkdir(exportsDir, { recursive: true })

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/itge'
const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me'
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)
const runsPerDayLimit = Number(process.env.RUNS_PER_DAY_LIMIT || 50)
const tokensPerDayLimit = Number(process.env.TOKENS_PER_DAY_LIMIT || 200000)

await mongoose.connect(mongoUrl)

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
  },
  { timestamps: true },
)

const runSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    language: String,
    framework: String,
    tokenEstimate: Number,
    fileCount: Number,
    includeIntegration: Boolean,
    includeRegression: Boolean,
  },
  { timestamps: true },
)

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

const teamMemberSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, default: 'member' },
  },
  { timestamps: true },
)

const teamInviteSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    email: { type: String, required: true, lowercase: true },
    token: { type: String, required: true },
    status: { type: String, default: 'pending' },
  },
  { timestamps: true },
)

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    state: { type: Object, default: {} },
    fileList: { type: [String], default: [] },
  },
  { timestamps: true },
)

const User = mongoose.model('User', userSchema)
const Run = mongoose.model('Run', runSchema)
const Team = mongoose.model('Team', teamSchema)
const TeamMember = mongoose.model('TeamMember', teamMemberSchema)
const TeamInvite = mongoose.model('TeamInvite', teamInviteSchema)
const Workspace = mongoose.model('Workspace', workspaceSchema)

const createToken = (user) =>
  jwt.sign({ sub: user._id.toString(), email: user.email }, jwtSecret, {
    expiresIn: '7d',
  })

const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.token
  if (!token) return next()
  try {
    const payload = jwt.verify(token, jwtSecret)
    const user = await User.findById(payload.sub).lean()
    req.user = user || null
  } catch (error) {
    req.user = null
  }
  next()
}

app.use(authMiddleware)

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  next()
}

const requireAdmin = (req, res, next) => {
  if (!req.user || !adminEmails.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({ error: 'Admin only.' })
  }
  next()
}

const isMemberOfTeam = async (userId, teamId) => {
  if (!teamId) return false
  const membership = await TeamMember.findOne({ userId, teamId })
  return Boolean(membership)
}

const getTeamRole = async (userId, teamId) => {
  if (!teamId) return null
  const membership = await TeamMember.findOne({ userId, teamId }).lean()
  return membership?.role || null
}

const requireTeamRole = (roles) => async (req, res, next) => {
  const { id } = req.params
  const role = await getTeamRole(req.user._id, id)
  if (!role || !roles.includes(role)) {
    return res.status(403).json({ error: 'Insufficient team permissions.' })
  }
  next()
}

const normalizeEmail = (value = '') => value.trim().toLowerCase()
const isValidEmail = (value = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isValidPassword = (value = '') => value.length >= 8

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.-]+/g, '_')
    cb(null, `${Date.now()}_${safeName}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
})

const extLanguageMap = new Map([
  ['.py', 'Python'],
  ['.js', 'JavaScript'],
  ['.jsx', 'JavaScript'],
  ['.ts', 'TypeScript'],
  ['.tsx', 'TypeScript'],
  ['.java', 'Java'],
  ['.kt', 'Kotlin'],
  ['.go', 'Go'],
  ['.rb', 'Ruby'],
  ['.cs', 'C#'],
  ['.php', 'PHP'],
  ['.rs', 'Rust'],
  ['.cpp', 'C++'],
  ['.c', 'C'],
])

const defaultFrameworkByLanguage = {
  Python: 'PyTest',
  JavaScript: 'Jest',
  TypeScript: 'Jest',
  Java: 'JUnit',
  Kotlin: 'JUnit',
  Go: 'testing',
  Ruby: 'RSpec',
  'C#': 'xUnit',
  PHP: 'PHPUnit',
  Rust: 'cargo test',
  'C++': 'GoogleTest',
  C: 'Unity',
}

const normalizeFramework = (value, language) =>
  value?.trim() || defaultFrameworkByLanguage[language] || 'Jest'

const detectLanguageFromFiles = (files) => {
  const counts = {}
  files.forEach((file) => {
    const ext = path.extname(file.name || file.path || '')
    const language = extLanguageMap.get(ext)
    if (language) {
      counts[language] = (counts[language] || 0) + 1
    }
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || 'JavaScript'
}

const detectLanguageFromText = (input) => {
  if (!input) return 'JavaScript'
  if (input.includes('def ') || input.includes('import pytest')) return 'Python'
  if (input.includes('public class') || input.includes('System.out'))
    return 'Java'
  if (input.includes('package main') || input.includes('func main'))
    return 'Go'
  if (input.includes('using System') || input.includes('namespace'))
    return 'C#'
  if (input.includes('func') && input.includes('let ') && input.includes('Swift'))
    return 'Swift'
  return 'JavaScript'
}

const buildPrompt = ({
  language,
  framework,
  includeIntegration,
  includeRegression,
  source,
}) => {
  return `You are an expert software testing engineer and static analysis specialist.
Analyze the provided code and generate a complete, meaningful test suite.

Return STRICT JSON with these keys:
- coverage_analysis: array of { function, risk }
- untested_paths: string[]
- generated_tests: string (complete, runnable test file)
- coverage_improvement: string
- suggested_follow_up: string

Requirements:
- Use ${framework} and ${language}
- Each test must have descriptive name: "[function] — [scenario] — [expected]"
- Include happy path, edge cases, failure cases, integration tests (if enabled), regression guards (if enabled)
- Avoid trivial tests
- If unsure about behavior, add comment "// NEEDS HUMAN REVIEW"

Integration tests enabled: ${includeIntegration ? 'yes' : 'no'}
Regression guards enabled: ${includeRegression ? 'yes' : 'no'}

SOURCE:
${source}`
}

const buildStreamingPrompt = ({
  language,
  framework,
  includeIntegration,
  includeRegression,
  source,
}) => {
  return `You are an expert software testing engineer and static analysis specialist.
Generate a complete, meaningful test suite.

Return MARKDOWN with these exact sections:
### Coverage analysis
### Untested paths found
### Generated tests
### Coverage improvement estimate
### Suggested follow-up

Requirements:
- Use ${framework} and ${language}
- Each test must have descriptive name: "[function] — [scenario] — [expected]"
- Include happy path, edge cases, failure cases, integration tests (if enabled), regression guards (if enabled)
- Avoid trivial tests
- If unsure about behavior, add comment "// NEEDS HUMAN REVIEW"

Integration tests enabled: ${includeIntegration ? 'yes' : 'no'}
Regression guards enabled: ${includeRegression ? 'yes' : 'no'}

SOURCE:
${source}`
}

const parseSectionsFromMarkdown = (text = '') => {
  const sections = {
    coverage_analysis: [],
    untested_paths: [],
    generated_tests: '',
    coverage_improvement: '',
    suggested_follow_up: '',
  }

  const getSection = (label) => {
    const pattern = new RegExp(
      `### ${label}\\n([\\s\\S]*?)(?=\\n### |$)`,
      'i',
    )
    const match = text.match(pattern)
    return match ? match[1].trim() : ''
  }

  const toList = (value) =>
    value
      .split('\n')
      .map((line) => line.replace(/^[\-*]\s*/, '').trim())
      .filter(Boolean)

  sections.coverage_analysis = toList(getSection('Coverage analysis')).map(
    (line) => {
      const [fn, risk] = line.split('—').map((part) => part.trim())
      return { function: fn || line, risk: risk || 'MEDIUM' }
    },
  )
  sections.untested_paths = toList(getSection('Untested paths found'))

  const testsBlock = getSection('Generated tests')
  const codeMatch = testsBlock.match(/```[\s\S]*?\n([\s\S]*?)```/)
  sections.generated_tests = codeMatch ? codeMatch[1].trim() : testsBlock

  sections.coverage_improvement = getSection('Coverage improvement estimate')
  sections.suggested_follow_up = getSection('Suggested follow-up')

  return sections
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/routes', (req, res) => {
  const routes = []
  const stack = app._router?.stack || app.router?.stack || []
  stack.forEach((layer) => {
    if (layer.route?.path) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods || {}),
      })
    }
  })
  res.json({ routes })
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {}
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail || !password) {
      return res.status(422).json({ error: 'Email and password required.' })
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(422).json({ error: 'Invalid email format.' })
    }
    if (!isValidPassword(password)) {
      return res
        .status(422)
        .json({ error: 'Password must be at least 8 characters.' })
    }
    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) {
      return res.status(400).json({ error: 'Account already exists.' })
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: name || '',
    })
    const token = createToken(user)
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
    res.json({
      email: user.email,
      name: user.name,
      isAdmin: adminEmails.includes(user.email.toLowerCase()),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to register.' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail || !password) {
      return res.status(422).json({ error: 'Email and password required.' })
    }
    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' })
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(400).json({ error: 'Invalid credentials.' })
    }
    const token = createToken(user)
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
    res.json({
      email: user.email,
      name: user.name,
      isAdmin: adminEmails.includes(user.email.toLowerCase()),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to login.' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  res.json({
    email: req.user.email,
    name: req.user.name,
    isAdmin: adminEmails.includes(req.user.email.toLowerCase()),
  })
})

app.post('/api/teams', requireAuth, async (req, res) => {
  const { name } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Team name required.' })
  const team = await Team.create({ name, ownerId: req.user._id })
  await TeamMember.create({ teamId: team._id, userId: req.user._id, role: 'owner' })
  res.json(team)
})

app.get('/api/teams', requireAuth, async (req, res) => {
  const memberships = await TeamMember.find({ userId: req.user._id }).lean()
  const teamIds = memberships.map((m) => m.teamId)
  const teams = await Team.find({ _id: { $in: teamIds } }).lean()
  res.json({ teams })
})

app.post('/api/teams/:id/invite', requireAuth, async (req, res) => {
  const { email } = req.body || {}
  const teamId = req.params.id
  if (!email) return res.status(400).json({ error: 'Email required.' })
  const role = await getTeamRole(req.user._id, teamId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Insufficient team permissions.' })
  }
  const token = crypto.randomBytes(16).toString('hex')
  const invite = await TeamInvite.create({
    teamId,
    email: email.toLowerCase(),
    token,
  })
  res.json({ inviteToken: invite.token })
})

app.get('/api/teams/invites', requireAuth, async (req, res) => {
  const invites = await TeamInvite.find({
    email: req.user.email.toLowerCase(),
    status: 'pending',
  }).lean()
  res.json({ invites })
})

app.post('/api/teams/invites/accept', requireAuth, async (req, res) => {
  const { token } = req.body || {}
  const invite = await TeamInvite.findOne({
    token,
    email: req.user.email.toLowerCase(),
  })
  if (!invite || invite.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid invite.' })
  }
  await TeamMember.create({
    teamId: invite.teamId,
    userId: req.user._id,
    role: 'member',
  })
  invite.status = 'accepted'
  await invite.save()
  res.json({ ok: true })
})

app.get('/api/teams/:id/members', requireAuth, async (req, res) => {
  const { id } = req.params
  const member = await isMemberOfTeam(req.user._id, id)
  if (!member) return res.status(403).json({ error: 'Not a team member.' })
  const members = await TeamMember.find({ teamId: id }).lean()
  const userIds = members.map((m) => m.userId)
  const users = await User.find({ _id: { $in: userIds } }).lean()
  const usersById = new Map(users.map((u) => [u._id.toString(), u]))
  res.json({
    members: members.map((m) => ({
      _id: m._id,
      userId: m.userId,
      role: m.role,
      email: usersById.get(m.userId.toString())?.email || '',
    })),
  })
})

app.patch(
  '/api/teams/:id/members/:memberId/role',
  requireAuth,
  requireTeamRole(['owner', 'admin']),
  async (req, res) => {
    const { id, memberId } = req.params
    const { role } = req.body || {}
    if (!['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' })
    }
    const member = await TeamMember.findById(memberId)
    if (!member || member.teamId.toString() !== id) {
      return res.status(404).json({ error: 'Member not found.' })
    }
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Owner role cannot be changed.' })
    }
    member.role = role
    await member.save()
    res.json({ ok: true })
  },
)

app.delete(
  '/api/teams/:id/members/:memberId',
  requireAuth,
  requireTeamRole(['owner', 'admin']),
  async (req, res) => {
    const { id, memberId } = req.params
    const member = await TeamMember.findById(memberId)
    if (!member || member.teamId.toString() !== id) {
      return res.status(404).json({ error: 'Member not found.' })
    }
    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot be removed.' })
    }
    await member.deleteOne()
    res.json({ ok: true })
  },
)

app.post('/api/workspaces', requireAuth, async (req, res) => {
  const { name, description, teamId, state, fileList } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Workspace name required.' })
  if (teamId) {
    const member = await isMemberOfTeam(req.user._id, teamId)
    if (!member) return res.status(403).json({ error: 'Not a team member.' })
  }
  const workspace = await Workspace.create({
    name,
    description: description || '',
    ownerId: req.user._id,
    teamId: teamId || null,
    state: state || {},
    fileList: fileList || [],
  })
  res.json(workspace)
})

app.get('/api/workspaces', requireAuth, async (req, res) => {
  const memberships = await TeamMember.find({ userId: req.user._id }).lean()
  const teamIds = memberships.map((m) => m.teamId)
  const workspaces = await Workspace.find({
    $or: [{ ownerId: req.user._id }, { teamId: { $in: teamIds } }],
  }).lean()
  res.json({ workspaces })
})

app.get('/api/workspaces/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const workspace = await Workspace.findById(id)
  if (!workspace) return res.status(404).json({ error: 'Not found.' })
  if (
    workspace.ownerId.toString() !== req.user._id.toString() &&
    !(await isMemberOfTeam(req.user._id, workspace.teamId))
  ) {
    return res.status(403).json({ error: 'No workspace access.' })
  }
  res.json(workspace)
})

app.patch('/api/workspaces/:id/state', requireAuth, async (req, res) => {
  const { id } = req.params
  const { state, fileList } = req.body || {}
  const workspace = await Workspace.findById(id)
  if (!workspace) return res.status(404).json({ error: 'Not found.' })
  const isOwner = workspace.ownerId.toString() === req.user._id.toString()
  const teamRole = await getTeamRole(req.user._id, workspace.teamId)
  if (!isOwner && !['owner', 'admin'].includes(teamRole)) {
    return res.status(403).json({ error: 'Insufficient permissions.' })
  }
  workspace.state = state || {}
  workspace.fileList = fileList || []
  await workspace.save()
  res.json({ ok: true })
})

app.get('/api/dashboard', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }
  const totalRuns = await Run.countDocuments({ userId: req.user._id })
  const recentRuns = await Run.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
  const avgTokensAgg = await Run.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, avg: { $avg: '$tokenEstimate' } } },
  ])
  const avgTokens = Math.round(avgTokensAgg[0]?.avg || 0)
  const memberships = await TeamMember.find({ userId: req.user._id }).lean()
  const teamIds = memberships.map((m) => m.teamId)
  const teamRuns = await Run.find({ teamId: { $in: teamIds } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
  res.json({
    totalRuns,
    avgTokens,
    recentRuns,
    teamRuns,
  })
})

app.get('/api/admin/audit', requireAdmin, async (req, res) => {
  const users = await User.find().lean()
  const runs = await Run.find().sort({ createdAt: -1 }).limit(50).lean()
  res.json({ users, runs })
})

app.post('/api/upload', upload.array('files', 50), (req, res) => {
  const files = (req.files || []).map((file) => ({
    name: file.originalname,
    path: file.path,
    size: file.size,
  }))
  res.json({ files })
})

app.post('/api/generate', async (req, res) => {
  try {
    const {
      input = '',
      files = [],
      options = {},
      language: requestedLanguage,
      framework: requestedFramework,
      stream = false,
      teamId,
      workspaceId,
    } = req.body || {}

    const detectedLanguage =
      requestedLanguage ||
      (files.length ? detectLanguageFromFiles(files) : detectLanguageFromText(input))

    const language = detectedLanguage
    const framework = normalizeFramework(requestedFramework, language)

    const compiledFiles = files
      .map(
        (file) =>
          `FILE: ${file.name}\n${file.content || ''}\nEND FILE: ${file.name}`,
      )
      .join('\n\n')

    const source = [input, compiledFiles].filter(Boolean).join('\n\n')

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: 'OPENAI_API_KEY is not set in the server environment.',
      })
    }

    if (req.user) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const runsToday = await Run.countDocuments({
        userId: req.user._id,
        createdAt: { $gte: since },
      })
      const tokensAgg = await Run.aggregate([
        { $match: { userId: req.user._id, createdAt: { $gte: since } } },
        { $group: { _id: null, sum: { $sum: '$tokenEstimate' } } },
      ])
      const tokensToday = Number(tokensAgg[0]?.sum || 0)
      if (runsToday + 1 > runsPerDayLimit) {
        return res.status(429).json({ error: 'Daily run limit exceeded.' })
      }
      if (tokensToday + maxOutputTokens > tokensPerDayLimit) {
        return res.status(429).json({ error: 'Daily token limit exceeded.' })
      }
    }

    if (teamId && !req.user) {
      return res.status(401).json({ error: 'Authentication required for team.' })
    }
    if (teamId && req.user) {
      const member = await isMemberOfTeam(req.user._id, teamId)
      if (!member) {
        return res.status(403).json({ error: 'Not a team member.' })
      }
    }

    if (workspaceId && !req.user) {
      return res
        .status(401)
        .json({ error: 'Authentication required for workspace.' })
    }
    if (workspaceId && req.user) {
      const workspace = await Workspace.findById(workspaceId)
      if (!workspace) {
        return res.status(400).json({ error: 'Workspace not found.' })
      }
      if (
        workspace.ownerId?.toString() !== req.user._id.toString() &&
        !(await isMemberOfTeam(req.user._id, workspace.teamId))
      ) {
        return res.status(403).json({ error: 'No workspace access.' })
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = buildPrompt({
      language,
      framework,
      includeIntegration: Boolean(options.includeIntegration),
      includeRegression: Boolean(options.includeRegression),
      source,
    })

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      const streamResponse = await client.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        instructions: buildStreamingPrompt({
          language,
          framework,
          includeIntegration: Boolean(options.includeIntegration),
          includeRegression: Boolean(options.includeRegression),
          source,
        }),
        input: 'Generate the test suite and analysis as requested.',
        max_output_tokens: maxOutputTokens,
        stream: true,
      })

      let outputText = ''
      let tokenEstimate = 0

      for await (const event of streamResponse) {
        if (event.type === 'response.output_text.delta') {
          outputText += event.delta || ''
          tokenEstimate += Math.ceil((event.delta || '').length / 4)
        }
        res.write(
          `data: ${JSON.stringify({
            type: event.type,
            delta: event.delta,
            token_estimate: tokenEstimate,
          })}\n\n`,
        )
      }

      const payload = parseSectionsFromMarkdown(outputText)
      if (req.user) {
        await Run.create({
          userId: req.user._id,
          language,
          framework,
          tokenEstimate,
          fileCount: files.length,
          includeIntegration: Boolean(options.includeIntegration),
          includeRegression: Boolean(options.includeRegression),
          teamId: teamId || null,
          workspaceId: workspaceId || null,
        })
      }

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          language,
          framework,
          token_estimate: tokenEstimate,
          ...payload,
        })}\n\n`,
      )
      res.end()
      return
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      instructions: prompt,
      input: 'Generate the test suite and analysis as requested.',
      max_output_tokens: maxOutputTokens,
    })

    const outputText = response.output_text || ''
    let parsed = null
    try {
      parsed = JSON.parse(outputText)
    } catch (error) {
      parsed = null
    }

    const payload = parsed || {
      coverage_analysis: [],
      untested_paths: [],
      generated_tests: outputText,
      coverage_improvement: 'Unknown (unstructured output).',
      suggested_follow_up: 'Review manually for completeness.',
    }

    if (req.user) {
      await Run.create({
        userId: req.user._id,
        language,
        framework,
        tokenEstimate: 0,
        fileCount: files.length,
        includeIntegration: Boolean(options.includeIntegration),
        includeRegression: Boolean(options.includeRegression),
        teamId: teamId || null,
        workspaceId: workspaceId || null,
      })
    }

    res.json({
      language,
      framework,
      ...payload,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate tests.',
      detail: error?.message || String(error),
    })
  }
})

app.post('/api/export', async (req, res) => {
  try {
    const { content, targetPath } = req.body || {}
    if (!content) {
      return res.status(400).json({ error: 'No content provided.' })
    }

    const safeTarget =
      targetPath && targetPath.trim()
        ? path.resolve(workspaceRoot, targetPath.trim())
        : path.join(exportsDir, `generated-tests-${Date.now()}.txt`)

    if (!safeTarget.startsWith(workspaceRoot)) {
      return res.status(400).json({ error: 'Invalid export path.' })
    }

    await fs.mkdir(path.dirname(safeTarget), { recursive: true })
    await fs.writeFile(safeTarget, content, 'utf8')

    res.json({ path: safeTarget })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export tests.',
      detail: error?.message || String(error),
    })
  }
})

app.post('/api/diff', async (req, res) => {
  try {
    const { existingPath, existingContent, newContent } = req.body || {}
    if (!newContent) {
      return res.status(400).json({ error: 'No new content provided.' })
    }

    let baseline = existingContent || ''
    if (!baseline && existingPath) {
      const resolved = path.resolve(workspaceRoot, existingPath)
      if (!resolved.startsWith(workspaceRoot)) {
        return res.status(400).json({ error: 'Invalid diff path.' })
      }
      baseline = await fs.readFile(resolved, 'utf8')
    }

    const diffText = createTwoFilesPatch(
      existingPath || 'existing-tests',
      'generated-tests',
      baseline,
      newContent,
      undefined,
      undefined,
      { context: 3 },
    )

    res.json({ diff: diffText })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to compute diff.',
      detail: error?.message || String(error),
    })
  }
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
